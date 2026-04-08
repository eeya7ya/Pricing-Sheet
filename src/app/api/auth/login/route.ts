export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { signToken, comparePassword, COOKIE_NAME, type AuthUser } from "@/lib/auth";
import { ensureSchema, ensureAdminUser, consolidateToAdmin } from "@/lib/ensureSchema";
import { logAudit, getClientIp } from "@/lib/audit";

export async function POST(req: Request) {
  // Make sure the admin account exists and audit_logs table is ready
  // before we try to authenticate anyone. consolidateToAdmin() is
  // idempotent and only runs meaningful work once per process: it
  // reassigns every legacy row to the admin account and removes any
  // other users left over from the multi-tenant era.
  await ensureSchema();
  await ensureAdminUser();
  await consolidateToAdmin();

  const ip = getClientIp(req);

  try {
    const { email, password } = await req.json();

    if (!email?.trim() || !password) {
      return NextResponse.json(
        { error: "Username and password are required." },
        { status: 400 }
      );
    }

    const normalized = email.trim().toLowerCase();

    const user = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.email, normalized),
    });

    if (!user) {
      await logAudit({
        actorEmail: normalized,
        action: "login_failed",
        details: { reason: "user_not_found" },
        ipAddress: ip,
      });
      return NextResponse.json(
        { error: "Invalid username or password." },
        { status: 401 }
      );
    }

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      await logAudit({
        actorEmail: user.email,
        actorName: user.fullName,
        action: "login_failed",
        details: { reason: "bad_password" },
        ipAddress: ip,
      });
      return NextResponse.json(
        { error: "Invalid username or password." },
        { status: 401 }
      );
    }

    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role as "admin" | "user",
      manufacturerId: user.manufacturerId ?? null,
    };

    const token = await signToken(authUser);

    // With the shared-manufacturer model, every signed-in user lands on
    // the same dashboard. Admin sees everything; users see shared
    // manufacturers with only their own projects inside.
    const redirectTo = "/";

    const res = NextResponse.json({ user: authUser, redirectTo });
    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    });

    await logAudit({
      actor: authUser,
      action: "login",
      ipAddress: ip,
    });

    return res;
  } catch (error) {
    console.error("[auth/login]", error);
    return NextResponse.json({ error: "Login failed." }, { status: 500 });
  }
}
