export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { accountRequests } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const me = await getCurrentUser();
    if (!me || me.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { status } = await req.json();
    if (!["rejected", "pending", "approved"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const { id: rawId } = await params;
    const id = parseInt(rawId);
    await db
      .update(accountRequests)
      .set({ status })
      .where(eq(accountRequests.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[admin/requests/[id]]", error);
    return NextResponse.json({ error: "Failed to update request" }, { status: 500 });
  }
}
