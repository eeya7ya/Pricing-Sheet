export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projects, projectConstants, productLines } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { ensureSchema } from "@/lib/ensureSchema";
import { logAudit, getClientIp } from "@/lib/audit";

export async function GET(req: Request) {
  await ensureSchema();

  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const manufacturerId = searchParams.get("manufacturerId");
    if (!manufacturerId) {
      return NextResponse.json({ error: "manufacturerId required" }, { status: 400 });
    }

    const mfgId = parseInt(manufacturerId);

    // Shared manufacturers: any signed-in user can list projects, but
    // non-admins only see their own projects.
    const all = await db.query.projects.findMany({
      where: (p, { eq, isNull, and }) => {
        const base = and(eq(p.manufacturerId, mfgId), isNull(p.deletedAt));
        if (user.role === "admin") return base;
        return and(base, eq(p.userId, user.id));
      },
      orderBy: (p, { asc }) => [asc(p.createdAt)],
    });
    return NextResponse.json(all);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  await ensureSchema();

  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { name, manufacturerId } = await req.json();
    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    if (!manufacturerId) {
      return NextResponse.json({ error: "manufacturerId is required" }, { status: 400 });
    }

    const mfgId = parseInt(manufacturerId);

    const [project] = await db
      .insert(projects)
      .values({ name: name.trim(), manufacturerId: mfgId, userId: user.id })
      .returning();

    await db.insert(projectConstants).values({ projectId: project.id });

    await db.insert(productLines).values(
      Array.from({ length: 5 }, (_, i) => ({
        projectId: project.id,
        position: i + 1,
        itemModel: "",
        priceUsd: "0",
        quantity: 1,
      }))
    );

    await logAudit({
      actor: user,
      action: "create",
      entityType: "project",
      entityId: project.id,
      details: { name: project.name, manufacturerId: mfgId },
      ipAddress: getClientIp(req),
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}
