export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, manufacturers, accountRequests } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser, hashPassword } from "@/lib/auth";
import { sendCredentialsEmail } from "@/lib/email";

export async function GET() {
  try {
    const me = await getCurrentUser();
    if (!me || me.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const allUsers = await db.query.users.findMany({
      orderBy: (u, { asc }) => [asc(u.createdAt)],
    });

    // Don't expose password hashes
    return NextResponse.json(
      allUsers.map(({ passwordHash: _ph, ...u }) => u)
    );
  } catch (error) {
    console.error("[admin/users GET]", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const me = await getCurrentUser();
    if (!me || me.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const {
      email,
      password,
      fullName,
      role,             // "user" | "admin", defaults to "user"
      manufacturerId,   // existing manufacturer id, or null to create new
      manufacturerName, // used when manufacturerId is null
      requestId,        // optional: mark account_request as approved
    } = body;

    if (!email?.trim() || !password || !fullName?.trim()) {
      return NextResponse.json(
        { error: "email, password, and fullName are required." },
        { status: 400 }
      );
    }
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    // Resolve manufacturer
    let mfgId: number | null = manufacturerId ?? null;

    if (!mfgId && manufacturerName?.trim()) {
      const [newMfg] = await db
        .insert(manufacturers)
        .values({ name: manufacturerName.trim() })
        .returning();
      mfgId = newMfg.id;
    }

    const passwordHash = await hashPassword(password);

    const assignedRole = role === "admin" ? "admin" : "user";

    const [user] = await db
      .insert(users)
      .values({
        email: email.trim().toLowerCase(),
        passwordHash,
        fullName: fullName.trim(),
        role: assignedRole,
        manufacturerId: assignedRole === "admin" ? null : mfgId,
      })
      .returning();

    // Mark account request as approved
    if (requestId) {
      await db
        .update(accountRequests)
        .set({ status: "approved" })
        .where(eq(accountRequests.id, requestId));
    }

    // Send credentials email (non-blocking)
    sendCredentialsEmail({
      to: email.trim(),
      fullName: fullName.trim(),
      password,
    }).catch((err) => console.error("[admin/users] credentials email error:", err));

    return NextResponse.json(
      { success: true, userId: user.id, manufacturerId: mfgId },
      { status: 201 }
    );
  } catch (error: any) {
    if (error?.code === "23505") {
      return NextResponse.json(
        { error: "A user with this email already exists." },
        { status: 409 }
      );
    }
    console.error("[admin/users POST]", error);
    return NextResponse.json({ error: "Failed to create user." }, { status: 500 });
  }
}
