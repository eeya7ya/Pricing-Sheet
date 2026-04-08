export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auditLogs } from "@/db/schema";
import { desc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { ensureSchema } from "@/lib/ensureSchema";
import { logAudit, getClientIp } from "@/lib/audit";

// Audit logs are retained FOREVER. There is no scheduled job, TTL, or
// retention window that prunes rows. The only way to remove entries is
// an admin manually calling DELETE /api/admin/logs from the Activity Logs
// page. Please keep it that way.

export async function GET(req: Request) {
  await ensureSchema();

  try {
    const me = await getCurrentUser();
    if (!me || me.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    // `limit=all` (or any non-numeric value) returns the complete history.
    // Numeric limits are still honored so the page can paginate cheaply if
    // needed, but we no longer silently cap responses — that made it look
    // like old entries were being auto-deleted.
    const raw = searchParams.get("limit");
    const parsed = raw == null ? NaN : parseInt(raw, 10);
    const limit = Number.isFinite(parsed) && parsed > 0 ? parsed : null;

    const query = db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt));

    const rows = limit == null ? await query : await query.limit(limit);

    return NextResponse.json(rows);
  } catch (error) {
    console.error("[admin/logs]", error);
    return NextResponse.json(
      { error: "Failed to fetch logs" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/logs — manual, admin-only reset of the entire audit
// trail. This is the ONLY path that may remove audit rows; nothing in the
// codebase should call it automatically.
export async function DELETE(req: Request) {
  await ensureSchema();

  try {
    const me = await getCurrentUser();
    if (!me || me.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const deleted = await db.delete(auditLogs).returning({ id: auditLogs.id });

    // Record the reset itself so the trail is never completely blank.
    await logAudit({
      actor: me,
      action: "logs_reset",
      entityType: "audit_logs",
      details: { clearedCount: deleted.length },
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ success: true, cleared: deleted.length });
  } catch (error) {
    console.error("[admin/logs] reset failed:", error);
    return NextResponse.json(
      { error: "Failed to reset logs" },
      { status: 500 }
    );
  }
}
