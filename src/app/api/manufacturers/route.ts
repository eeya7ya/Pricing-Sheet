export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { manufacturers, users } from "@/db/schema";
import { eq, isNull, inArray } from "drizzle-orm";
import { getCurrentUser, signToken, COOKIE_NAME, type AuthUser } from "@/lib/auth";

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
      // Attach creator name for grouping in the dashboard
      const creatorIds = [...new Set(all.map((m) => m.createdByUserId).filter((id): id is number => id !== null))];
      const creators = creatorIds.length > 0
        ? await db.query.users.findMany({ where: (u, { inArray }) => inArray(u.id, creatorIds) })
        : [];
      const creatorMap = Object.fromEntries(creators.map((u) => [u.id, u.fullName]));
      const result = all.map((m) => ({
        ...m,
        createdByUserName: m.createdByUserId ? (creatorMap[m.createdByUserId] ?? null) : null,
      }));
      return NextResponse.json(result);
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
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name } = await req.json();
    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    const [created] = await db
      .insert(manufacturers)
      .values({ name: name.trim(), createdByUserId: user.id })
      .returning();

    // For regular users with no manufacturer yet: assign them to this new one and refresh JWT
    if (user.role !== "admin" && !user.manufacturerId) {
      await db.update(users).set({ manufacturerId: created.id }).where(eq(users.id, user.id));
      const updatedUser: AuthUser = { ...user, manufacturerId: created.id };
      const token = await signToken(updatedUser);
      const res = NextResponse.json(created, { status: 201 });
      res.cookies.set(COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30,
        path: "/",
      });
      return res;
    }

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create manufacturer" }, { status: 500 });
  }
}
