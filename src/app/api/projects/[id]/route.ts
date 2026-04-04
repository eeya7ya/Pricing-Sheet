export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projects, projectConstants, productLines } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const project = await db.query.projects.findFirst({
      where: (p, { eq }) => eq(p.id, parseInt(id)),
    });
    if (!project) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
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
    const { id } = await params;
    const body = await req.json();

    // Update project name/date if provided
    if (body.name !== undefined || body.date !== undefined) {
      const patch: Record<string, string> = {};
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

    // Update product lines if provided — delete all and re-insert so adds/removes are
    // both handled correctly (avoids stale fake client-side IDs from new rows).
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

    // Return fresh product lines so the client can sync real DB ids
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
    const { id } = await params;
    await db.delete(projects).where(eq(projects.id, parseInt(id)));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 });
  }
}
