export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projects, projectConstants, productLines } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const manufacturerId = searchParams.get("manufacturerId");
    if (!manufacturerId) {
      return NextResponse.json({ error: "manufacturerId required" }, { status: 400 });
    }

    const mfgId = parseInt(manufacturerId);

    // Non-admin can only access their own manufacturer's projects
    if (user.role !== "admin" && user.manufacturerId !== mfgId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const all = await db.query.projects.findMany({
      where: (p, { eq, isNull, and }) =>
        and(eq(p.manufacturerId, mfgId), isNull(p.deletedAt)),
      orderBy: (p, { asc }) => [asc(p.createdAt)],
    });
    return NextResponse.json(all);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
  }
}

export async function POST(req: Request) {
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

    // Non-admin can only create projects for their own manufacturer
    if (user.role !== "admin" && user.manufacturerId !== mfgId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [project] = await db
      .insert(projects)
      .values({ name: name.trim(), manufacturerId: mfgId })
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

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}
