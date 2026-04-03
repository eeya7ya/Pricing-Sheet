export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { manufacturers } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const all = await db.query.manufacturers.findMany({
      orderBy: (m, { asc }) => [asc(m.createdAt)],
    });
    return NextResponse.json(all);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch manufacturers" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
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
