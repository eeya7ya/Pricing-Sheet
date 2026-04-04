export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { hashPassword } from "@/lib/auth";

// Creates the first admin account — only works when the users table is empty.
// Disable or delete this endpoint after setup.
export async function POST(req: Request) {
  try {
    const existing = await db.query.users.findFirst();
    if (existing) {
      return NextResponse.json(
        { error: "Setup already complete. An admin account already exists." },
        { status: 403 }
      );
    }

    const { email, password, fullName } = await req.json();

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

    const passwordHash = await hashPassword(password);
    const [admin] = await db
      .insert(users)
      .values({
        email: email.trim().toLowerCase(),
        passwordHash,
        fullName: fullName.trim(),
        role: "admin",
        manufacturerId: null,
      })
      .returning();

    return NextResponse.json(
      { success: true, id: admin.id, email: admin.email },
      { status: 201 }
    );
  } catch (error) {
    console.error("[admin/setup]", error);
    return NextResponse.json(
      { error: "Setup failed." },
      { status: 500 }
    );
  }
}
