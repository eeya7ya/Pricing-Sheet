export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { manufacturers, projects } from "@/db/schema";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { ensureSchema, consolidateToAdmin } from "@/lib/ensureSchema";
import { logAudit, getClientIp } from "@/lib/audit";

export async function GET() {
  await ensureSchema();
  await consolidateToAdmin();

  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // All non-deleted manufacturers — shared between users.
    const all = await db.query.manufacturers.findMany({
      where: (m, { isNull }) => isNull(m.deletedAt),
      orderBy: (m, { asc }) => [asc(m.createdAt)],
    });

    if (all.length === 0) return NextResponse.json([]);

    // Compute per-manufacturer project counts in a single query.
    // Non-admins only count their own projects; admins count all.
    const mfgIds = all.map((m) => m.id);

    // Guard the user-scoped query: if the projects.user_id column hasn't
    // been applied yet (first request on an older DB), fall back to the
    // admin-style count so the dashboard still loads.
    let countsRows: { manufacturerId: number; count: number | string }[] = [];
    try {
      countsRows =
        user.role === "admin"
          ? await db
              .select({
                manufacturerId: projects.manufacturerId,
                count: sql<number>`count(*)::int`,
              })
              .from(projects)
              .where(
                and(
                  isNull(projects.deletedAt),
                  inArray(projects.manufacturerId, mfgIds)
                )
              )
              .groupBy(projects.manufacturerId)
          : await db
              .select({
                manufacturerId: projects.manufacturerId,
                count: sql<number>`count(*)::int`,
              })
              .from(projects)
              .where(
                and(
                  isNull(projects.deletedAt),
                  eq(projects.userId, user.id),
                  inArray(projects.manufacturerId, mfgIds)
                )
              )
              .groupBy(projects.manufacturerId);
    } catch (countErr) {
      console.error("[manufacturers GET] counts query failed:", countErr);
      // Degrade gracefully: return the list with zero counts rather
      // than 500'ing the whole dashboard.
      countsRows = [];
    }

    const countMap = new Map<number, number>();
    for (const row of countsRows) {
      countMap.set(row.manufacturerId, Number(row.count));
    }

    const result = all.map((m) => ({
      ...m,
      projectCount: countMap.get(m.id) ?? 0,
    }));
    return NextResponse.json(result);
  } catch (error) {
    console.error("[manufacturers GET]", error);
    return NextResponse.json(
      { error: "Failed to fetch manufacturers" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  await ensureSchema();

  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, color, tag } = await req.json();
    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const [created] = await db
      .insert(manufacturers)
      .values({
        name: name.trim(),
        color: typeof color === "string" && color.trim() ? color.trim() : null,
        tag: typeof tag === "string" && tag.trim() ? tag.trim() : null,
        createdByUserId: user.id,
      })
      .returning();

    await logAudit({
      actor: user,
      action: "create",
      entityType: "manufacturer",
      entityId: created.id,
      details: { name: created.name, color: created.color, tag: created.tag },
      ipAddress: getClientIp(req),
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("[manufacturers POST]", error);
    return NextResponse.json(
      { error: "Failed to create manufacturer" },
      { status: 500 }
    );
  }
}
