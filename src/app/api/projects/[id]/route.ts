export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projects, projectConstants, productLines } from "@/db/schema";
import { eq, isNull, and } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const project = await db.query.projects.findFirst({
      where: (p, { eq, isNull, and }) =>
        and(eq(p.id, parseInt(id)), isNull(p.deletedAt)),
    });
    if (!project) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Non-admin can only access their own manufacturer's projects
    if (user.role !== "admin" && user.manufacturerId !== project.manufacturerId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const constants = await db.query.projectConstants.findFirst({
      where: (c, { eq }) => eq(c.projectId, parseInt(id)),
    });

    const lines = await db.query.productLines.findMany({
      where: (l, { eq }) => eq(l.projectId, parseInt(id)),
      orderBy: (l, { asc }) => [asc(l.position)],
    });

    return NextResponse.json({ project, constants, productLines: lines });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch project" }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await req.json();

    // Verify project exists and is not deleted
    const project = await db.query.projects.findFirst({
      where: (p, { eq, isNull, and }) =>
        and(eq(p.id, parseInt(id)), isNull(p.deletedAt)),
    });
    if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (user.role !== "admin" && user.manufacturerId !== project.manufacturerId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Update project name/date if provided
    if (body.name !== undefined || body.date !== undefined) {
      const patch: Record<string, any> = {};
      if (body.name !== undefined) patch.name = body.name.trim();
      if (body.date !== undefined) patch.date = body.date ?? null;
      await db
        .update(projects)
        .set(patch)
        .where(eq(projects.id, parseInt(id)));
    }

    // Update constants if provided
    if (body.constants !== undefined) {
      await db
        .update(projectConstants)
        .set({
          currencyRate: String(body.constants.currencyRate),
          shippingRate: String(body.constants.shippingRate),
          customsRate: String(body.constants.customsRate),
          profitMargin: String(body.constants.profitMargin),
          taxRate: String(body.constants.taxRate),
          targetCurrency: body.constants.targetCurrency ?? "JOD",
        })
        .where(eq(projectConstants.projectId, parseInt(id)));
    }

    // Update product lines if provided
    if (body.productLines !== undefined) {
      await db.delete(productLines).where(eq(productLines.projectId, parseInt(id)));
      if (body.productLines.length > 0) {
        await db.insert(productLines).values(
          body.productLines.map((line: any, idx: number) => ({
            projectId: parseInt(id),
            position: idx + 1,
            itemModel: line.itemModel ?? "",
            priceUsd: String(line.priceUsd ?? 0),
            quantity: line.quantity ?? 1,
            shippingOverride: line.shippingOverride != null ? String(line.shippingOverride) : null,
            customsOverride: line.customsOverride != null ? String(line.customsOverride) : null,
          }))
        );
      }
    }

    const freshLines = await db.query.productLines.findMany({
      where: (l, { eq }) => eq(l.projectId, parseInt(id)),
      orderBy: (l, { asc }) => [asc(l.position)],
    });
    return NextResponse.json({ success: true, productLines: freshLines });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const project = await db.query.projects.findFirst({
      where: (p, { eq }) => eq(p.id, parseInt(id)),
    });
    if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (user.role !== "admin" && user.manufacturerId !== project.manufacturerId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Soft delete
    await db
      .update(projects)
      .set({ deletedAt: new Date() })
      .where(eq(projects.id, parseInt(id)));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 });
  }
}
