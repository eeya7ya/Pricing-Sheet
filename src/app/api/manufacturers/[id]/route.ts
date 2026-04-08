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
    // Non-admins can only access their own manufacturers.
    if (user.role !== "admin" && manufacturer.createdByUserId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

    const body = await req.json();
    const { name, color, tag } = body ?? {};

    const patch: Partial<{ name: string; color: string | null; tag: string | null }> = {};
    if (typeof name === "string") {
      if (!name.trim()) {
        return NextResponse.json({ error: "Name is required" }, { status: 400 });
      }
      patch.name = name.trim();
    }
    if (Object.prototype.hasOwnProperty.call(body ?? {}, "color")) {
      patch.color = typeof color === "string" && color.trim() ? color.trim() : null;
    }
    if (Object.prototype.hasOwnProperty.call(body ?? {}, "tag")) {
      patch.tag = typeof tag === "string" && tag.trim() ? tag.trim() : null;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const [updated] = await db
      .update(manufacturers)
      .set(patch)
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
      details: {
        from: { name: existing.name, color: existing.color, tag: existing.tag },
        to: { name: updated.name, color: updated.color, tag: updated.tag },
      },
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
