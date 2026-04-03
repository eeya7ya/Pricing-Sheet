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

    // Update project name if provided
    if (body.name !== undefined) {
      await db
        .update(projects)
        .set({ name: body.name.trim() })
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
        })
        .where(eq(projectConstants.projectId, parseInt(id)));
    }

    // Update product lines if provided
    if (body.productLines !== undefined) {
      for (const line of body.productLines) {
        await db
          .update(productLines)
          .set({
            itemModel: line.itemModel ?? "",
            priceUsd: String(line.priceUsd ?? 0),
            quantity: line.quantity ?? 1,
          })
          .where(
            eq(productLines.id, line.id)
          );
      }
    }

    return NextResponse.json({ success: true });
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
