export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { manufacturers } from "@/db/schema";
import { eq, isNull } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role === "admin") {
      const all = await db.query.manufacturers.findMany({
        where: (m, { isNull }) => isNull(m.deletedAt),
        orderBy: (m, { asc }) => [asc(m.createdAt)],
      });
      return NextResponse.json(all);
    }

    // Regular user: return only their assigned manufacturer (if not deleted)
    if (!user.manufacturerId) {
      return NextResponse.json([]);
    }
    const mfg = await db.query.manufacturers.findFirst({
      where: (m, { eq, isNull, and }) =>
        and(eq(m.id, user.manufacturerId!), isNull(m.deletedAt)),
    });
    return NextResponse.json(mfg ? [mfg] : []);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch manufacturers" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { name } = await req.json();
    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    const [created] = await db
      .insert(manufacturers)
      .values({ name: name.trim() })
      .returning();
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create manufacturer" }, { status: 500 });
  }
}
