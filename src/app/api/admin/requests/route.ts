export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  try {
    const me = await getCurrentUser();
    if (!me || me.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const requests = await db.query.accountRequests.findMany({
      orderBy: (r, { desc }) => [desc(r.createdAt)],
    });

    return NextResponse.json(requests);
  } catch (error) {
    console.error("[admin/requests]", error);
    return NextResponse.json({ error: "Failed to fetch requests" }, { status: 500 });
  }
}
