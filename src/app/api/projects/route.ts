export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projects, projectConstants, productLines } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const manufacturerId = searchParams.get("manufacturerId");
    if (!manufacturerId) {
      return NextResponse.json({ error: "manufacturerId required" }, { status: 400 });
    }
    const all = await db.query.projects.findMany({
      where: (p, { eq }) => eq(p.manufacturerId, parseInt(manufacturerId)),
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
    const { name, manufacturerId } = await req.json();
    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    if (!manufacturerId) {
      return NextResponse.json({ error: "manufacturerId is required" }, { status: 400 });
    }

    // Create project
    const [project] = await db
      .insert(projects)
      .values({ name: name.trim(), manufacturerId: parseInt(manufacturerId) })
      .returning();

    // Create default constants
    await db.insert(projectConstants).values({ projectId: project.id });

    // Create 5 empty product lines
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
