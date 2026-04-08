export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { manufacturers, userManufacturers, projects, users } from "@/db/schema";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { ensureSchema } from "@/lib/ensureSchema";
import { logAudit, getClientIp } from "@/lib/audit";

export async function GET() {
  await ensureSchema();

  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role === "admin") {
      // Admin sees all manufacturers.
      // Color + tag come from the creator's user record so cards are
      // visually grouped by owner.
      const all = await db.query.manufacturers.findMany({
        where: (m, { isNull }) => isNull(m.deletedAt),
        orderBy: (m, { asc }) => [asc(m.createdAt)],
      });

      if (all.length === 0) return NextResponse.json([]);

      const mfgIds = all.map((m) => m.id);

      // Total project counts across all users.
      const countsRows = await db
        .select({
          manufacturerId: projects.manufacturerId,
          count: sql<number>`count(*)::int`,
        })
        .from(projects)
        .where(and(isNull(projects.deletedAt), inArray(projects.manufacturerId, mfgIds)))
        .groupBy(projects.manufacturerId);

      const countMap = new Map<number, number>();
      for (const row of countsRows) countMap.set(row.manufacturerId, Number(row.count));

      // Fetch creator info (color + fullName + username) in one query.
      const creatorIds = [
        ...new Set(
          all.map((m) => m.createdByUserId).filter((id): id is number => id !== null)
        ),
      ];
      const creators =
        creatorIds.length > 0
          ? await db.query.users.findMany({
              where: (u, { inArray }) => inArray(u.id, creatorIds),
            })
          : [];
      // Map userId → { color, fullName, username }
      const creatorMap = Object.fromEntries(
        creators.map((u) => [u.id, { color: u.color, fullName: u.fullName, username: u.username }])
      );

      return NextResponse.json(
        all.map((m) => {
          const creator = m.createdByUserId ? creatorMap[m.createdByUserId] : null;
          return {
            ...m,
            // Color and tag come from the creator's user record.
            color: creator?.color ?? "cyan",
            tag: creator?.username ?? null,
            createdByUserName: creator?.fullName ?? null,
            projectCount: countMap.get(m.id) ?? 0,
          };
        })
      );
    }

    // Non-admin: return their user_manufacturers rows.
    // Color is from user_manufacturers (seeded from users.color at creation).
    // Tag is their username (also stored in user_manufacturers).
    const rows = await db
      .select({
        id: manufacturers.id,
        name: manufacturers.name,
        color: userManufacturers.color,
        tag: userManufacturers.tag,
        createdAt: userManufacturers.createdAt,
        createdByUserId: manufacturers.createdByUserId,
      })
      .from(userManufacturers)
      .innerJoin(manufacturers, eq(userManufacturers.manufacturerId, manufacturers.id))
      .where(
        and(
          eq(userManufacturers.userId, user.id),
          isNull(userManufacturers.deletedAt),
          isNull(manufacturers.deletedAt)
        )
      )
      .orderBy(asc(userManufacturers.createdAt));

    if (rows.length === 0) return NextResponse.json([]);

    const mfgIds = rows.map((r) => r.id);
    let countsRows: { manufacturerId: number; count: number | string }[] = [];
    try {
      countsRows = await db
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
    }

    const countMap = new Map<number, number>();
    for (const row of countsRows) countMap.set(row.manufacturerId, Number(row.count));

    return NextResponse.json(
      rows.map((r) => ({
        ...r,
        createdByUserName: null,
        projectCount: countMap.get(r.id) ?? 0,
      }))
    );
  } catch (error) {
    console.error("[manufacturers GET]", error);
    return NextResponse.json({ error: "Failed to fetch manufacturers" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  await ensureSchema();

  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name } = await req.json();
    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // Color comes from the user's profile (set once at account creation).
    // Tag is always the user's username.
    const color = user.color ?? "cyan";
    const tag = user.username;

    // Find or create the global manufacturer by name.
    let manufacturer = await db.query.manufacturers.findFirst({
      where: (m, { eq, isNull, and }) => and(eq(m.name, name.trim()), isNull(m.deletedAt)),
    });

    if (!manufacturer) {
      [manufacturer] = await db
        .insert(manufacturers)
        .values({ name: name.trim(), createdByUserId: user.id })
        .returning();
    }

    // Check for an existing (possibly soft-deleted) user_manufacturers entry.
    const existing = await db.query.userManufacturers.findFirst({
      where: (um, { eq, and }) =>
        and(eq(um.userId, user.id), eq(um.manufacturerId, manufacturer!.id)),
    });

    let userMfg;
    if (existing) {
      if (!existing.deletedAt) {
        return NextResponse.json(
          { error: "You already have this manufacturer" },
          { status: 409 }
        );
      }
      // Restore with current user color/tag.
      [userMfg] = await db
        .update(userManufacturers)
        .set({ color, tag, deletedAt: null })
        .where(eq(userManufacturers.id, existing.id))
        .returning();
    } else {
      [userMfg] = await db
        .insert(userManufacturers)
        .values({ userId: user.id, manufacturerId: manufacturer!.id, color, tag })
        .returning();
    }

    await logAudit({
      actor: user,
      action: "create",
      entityType: "manufacturer",
      entityId: manufacturer!.id,
      details: { name: manufacturer!.name, color: userMfg.color, tag: userMfg.tag },
      ipAddress: getClientIp(req),
    });

    return NextResponse.json(
      { ...manufacturer, color: userMfg.color, tag: userMfg.tag },
      { status: 201 }
    );
  } catch (error) {
    console.error("[manufacturers POST]", error);
    return NextResponse.json({ error: "Failed to create manufacturer" }, { status: 500 });
  }
}
