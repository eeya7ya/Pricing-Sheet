export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { manufacturers, projects } from "@/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
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

    // All non-deleted manufacturers — shared between users.
    const all = await db.query.manufacturers.findMany({
      where: (m, { isNull }) => isNull(m.deletedAt),
      orderBy: (m, { asc }) => [asc(m.createdAt)],
    });

    if (all.length === 0) return NextResponse.json([]);

    // Compute per-manufacturer project counts in a single query.
    // Non-admins only count their own projects; admins count all.
    const mfgIds = all.map((m) => m.id);
    const countsRows = user.role === "admin"
      ? await db
          .select({
            manufacturerId: projects.manufacturerId,
            count: sql<number>`count(*)::int`,
          })
          .from(projects)
          .where(
            and(
              isNull(projects.deletedAt),
              sql`${projects.manufacturerId} = ANY(${mfgIds})`
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
              sql`${projects.manufacturerId} = ANY(${mfgIds})`
            )
          )
          .groupBy(projects.manufacturerId);

    const countMap = new Map<number, number>();
    for (const row of countsRows) {
      countMap.set(row.manufacturerId, Number(row.count));
    }

    // Attach creator names (admin uses these for the "group by user" tabs).
    const creatorIds = [
      ...new Set(
        all
          .map((m) => m.createdByUserId)
          .filter((id): id is number => id !== null)
      ),
    ];
    const creators = creatorIds.length > 0
      ? await db.query.users.findMany({
          where: (u, { inArray }) => inArray(u.id, creatorIds),
        })
      : [];
    const creatorMap = Object.fromEntries(
      creators.map((u) => [u.id, u.fullName])
    );

    const result = all.map((m) => ({
      ...m,
      createdByUserName: m.createdByUserId
        ? creatorMap[m.createdByUserId] ?? null
        : null,
      projectCount: countMap.get(m.id) ?? 0,
    }));
    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
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

    const { name } = await req.json();
    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const [created] = await db
      .insert(manufacturers)
      .values({ name: name.trim(), createdByUserId: user.id })
      .returning();

    await logAudit({
      actor: user,
      action: "create",
      entityType: "manufacturer",
      entityId: created.id,
      details: { name: created.name },
      ipAddress: getClientIp(req),
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to create manufacturer" },
      { status: 500 }
    );
  }
}
