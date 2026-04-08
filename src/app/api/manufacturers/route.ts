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
      // Admin sees all manufacturers with creator info and total project counts.
      const all = await db.query.manufacturers.findMany({
        where: (m, { isNull }) => isNull(m.deletedAt),
        orderBy: (m, { asc }) => [asc(m.createdAt)],
      });

      if (all.length === 0) return NextResponse.json([]);

      const mfgIds = all.map((m) => m.id);
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
      const creatorMap = Object.fromEntries(creators.map((u) => [u.id, u.fullName]));

      return NextResponse.json(
        all.map((m) => ({
          ...m,
          createdByUserName: m.createdByUserId ? creatorMap[m.createdByUserId] ?? null : null,
          projectCount: countMap.get(m.id) ?? 0,
        }))
      );
    }

    // Non-admin: return their user_manufacturers entries with the manufacturer name.
    // Color and tag come from the junction table (per-user).
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

    // Project counts scoped to this user.
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

    const { name, color, tag } = await req.json();
    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    if (!color?.trim()) {
      return NextResponse.json({ error: "Color is required" }, { status: 400 });
    }
    if (!tag?.trim()) {
      return NextResponse.json({ error: "Tag is required" }, { status: 400 });
    }

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

    // Check if user already has a (possibly soft-deleted) entry for this manufacturer.
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
      // Restore soft-deleted entry with new color/tag.
      [userMfg] = await db
        .update(userManufacturers)
        .set({ color: color.trim(), tag: tag.trim(), deletedAt: null })
        .where(eq(userManufacturers.id, existing.id))
        .returning();
    } else {
      [userMfg] = await db
        .insert(userManufacturers)
        .values({
          userId: user.id,
          manufacturerId: manufacturer!.id,
          color: color.trim(),
          tag: tag.trim(),
        })
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
