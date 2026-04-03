export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { manufacturers } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const manufacturer = await db.query.manufacturers.findFirst({
      where: (m, { eq }) => eq(m.id, parseInt(id)),
    });
    if (!manufacturer) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(manufacturer);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch manufacturer" }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { name } = await req.json();
    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    const [updated] = await db
      .update(manufacturers)
      .set({ name: name.trim() })
      .where(eq(manufacturers.id, parseInt(id)))
      .returning();
    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update manufacturer" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await db.delete(manufacturers).where(eq(manufacturers.id, parseInt(id)));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete manufacturer" }, { status: 500 });
  }
}
