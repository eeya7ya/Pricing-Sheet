export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  projects,
  manufacturers,
  userManufacturers,
  productLines,
} from "@/db/schema";
import { and, asc, eq, exists, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

/**
 * Global project search — finds projects across all manufacturers the
 * current user can access. Matches against project name, manufacturer
 * name and product-line item models.
 *
 * Implementation notes
 * --------------------
 *  * Single round-trip: matches against product_lines are folded into
 *    the main SELECT via EXISTS, so we no longer fetch every matching
 *    line up front and then re-issue a project query with an IN list.
 *  * Index-friendly: `ilike '%q%'` can use the pg_trgm GIN indexes
 *    created by ensureSchema (projects.name, manufacturers.name,
 *    product_lines.item_model).
 *  * Scoped: ownership / manufacturer-allow-list filters are applied
 *    inside the EXISTS subquery too, so the planner doesn't scan
 *    product_lines belonging to manufacturers the user can't see.
 *  * Annotated: a SQL boolean tells the client whether the row was
 *    matched via a product line, without a second pass on the JS side.
 *
 * Query params:
 *   q              — free-text search (required, min 2 chars)
 *   manufacturerId — optional, restrict to a specific manufacturer
 *   ownerUserId    — admin-only owner scoping
 *   limit          — max results (default 25, max 100)
 */
export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") ?? "").trim();
    const limit = Math.min(
      parseInt(searchParams.get("limit") ?? "25", 10) || 25,
      100
    );
    const restrictManufacturerId = searchParams.get("manufacturerId");
    const ownerParam = searchParams.get("ownerUserId");
    const restrictOwnerUserId =
      ownerParam != null && Number.isFinite(parseInt(ownerParam, 10))
        ? parseInt(ownerParam, 10)
        : null;

    // pg_trgm needs at least 2 chars to do anything useful and a single
    // character expands to ~the whole table; cheap guard against the
    // tightest case.
    if (q.length < 2) {
      return NextResponse.json([]);
    }

    const like = `%${q}%`;

    // Work out which manufacturers the user can see. Admins see all;
    // non-admins see only those they have a user_manufacturers row for.
    let allowedMfgIds: number[] | null = null;
    if (user.role !== "admin") {
      const ums = await db
        .select({ manufacturerId: userManufacturers.manufacturerId })
        .from(userManufacturers)
        .where(
          and(
            eq(userManufacturers.userId, user.id),
            isNull(userManufacturers.deletedAt)
          )
        );
      allowedMfgIds = ums.map((u) => u.manufacturerId);
      if (allowedMfgIds.length === 0) {
        return NextResponse.json([]);
      }
    }

    const baseConds = [isNull(projects.deletedAt)];
    if (user.role !== "admin") {
      baseConds.push(eq(projects.userId, user.id));
    }
    if (allowedMfgIds) {
      baseConds.push(inArray(projects.manufacturerId, allowedMfgIds));
    }
    if (restrictManufacturerId) {
      const mfgId = parseInt(restrictManufacturerId, 10);
      if (!Number.isNaN(mfgId)) {
        baseConds.push(eq(projects.manufacturerId, mfgId));
      }
    }
    if (restrictOwnerUserId != null && user.role === "admin") {
      baseConds.push(eq(projects.userId, restrictOwnerUserId));
    }

    // Correlated subquery — the planner can short-circuit the line scan
    // as soon as it finds a single matching row per project, instead of
    // materialising the entire (project_id, item_model) match set first.
    const lineMatchExists = exists(
      db
        .select({ one: sql<number>`1` })
        .from(productLines)
        .where(
          and(
            eq(productLines.projectId, projects.id),
            ilike(productLines.itemModel, like)
          )
        )
    );

    const matchExpr = or(
      ilike(projects.name, like),
      ilike(manufacturers.name, like),
      lineMatchExists
    );

    const rows = await db
      .select({
        id: projects.id,
        name: projects.name,
        date: projects.date,
        responsiblePerson: projects.responsiblePerson,
        createdAt: projects.createdAt,
        ownerUserId: projects.userId,
        manufacturerId: projects.manufacturerId,
        manufacturerName: manufacturers.name,
        manufacturerColor: userManufacturers.color,
        manufacturerTag: userManufacturers.tag,
        parentProjectId: projects.parentProjectId,
        revisionNumber: projects.revisionNumber,
        // Boolean computed in SQL so we don't need a second pass on the
        // result set to flag "matched in product lines".
        matchedInLines: sql<boolean>`(${lineMatchExists})`,
      })
      .from(projects)
      .innerJoin(manufacturers, eq(projects.manufacturerId, manufacturers.id))
      .leftJoin(
        userManufacturers,
        and(
          eq(userManufacturers.manufacturerId, manufacturers.id),
          eq(userManufacturers.userId, user.id),
          isNull(userManufacturers.deletedAt)
        )
      )
      .where(and(...baseConds, matchExpr))
      .orderBy(asc(manufacturers.name), asc(projects.name), asc(projects.revisionNumber))
      .limit(limit);

    return NextResponse.json(rows);
  } catch (error) {
    console.error("[projects/search]", error);
    return NextResponse.json(
      { error: "Failed to search projects" },
      { status: 500 }
    );
  }
}
