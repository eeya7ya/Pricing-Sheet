export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { manufacturers } from "@/db/schema";
import { eq, isNull, and } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { logAudit, getClientIp } from "@/lib/audit";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const mfgId = parseInt(id);

    const manufacturer = await db.query.manufacturers.findFirst({
      where: (m, { eq, isNull, and }) =>
        and(eq(m.id, mfgId), isNull(m.deletedAt)),
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
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const mfgId = parseInt(id);

    const existing = await db.query.manufacturers.findFirst({
      where: (m, { eq, isNull, and }) => and(eq(m.id, mfgId), isNull(m.deletedAt)),
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Only admins or the creator can rename a shared manufacturer.
    if (user.role !== "admin" && existing.createdByUserId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { name } = await req.json();
    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    const [updated] = await db
      .update(manufacturers)
      .set({ name: name.trim() })
      .where(and(eq(manufacturers.id, mfgId), isNull(manufacturers.deletedAt)))
      .returning();
    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await logAudit({
      actor: user,
      action: "update",
      entityType: "manufacturer",
      entityId: mfgId,
      details: { from: existing.name, to: updated.name },
      ipAddress: getClientIp(req),
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update manufacturer" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const mfgId = parseInt(id);

    // Soft delete
    await db
      .update(manufacturers)
      .set({ deletedAt: new Date() })
      .where(eq(manufacturers.id, mfgId));

    await logAudit({
      actor: user,
      action: "delete",
      entityType: "manufacturer",
      entityId: mfgId,
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete manufacturer" }, { status: 500 });
  }
}
