export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, manufacturers } from "@/db/schema";
import { getCurrentUser, hashPassword } from "@/lib/auth";
import { logAudit, getClientIp } from "@/lib/audit";
import { MANUFACTURER_COLORS } from "@/lib/manufacturerColors";

const VALID_COLOR_KEYS = new Set(MANUFACTURER_COLORS.map((c) => c.key));

export async function GET() {
  try {
    const me = await getCurrentUser();
    if (!me || me.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const allUsers = await db.query.users.findMany({
      orderBy: (u, { asc }) => [asc(u.createdAt)],
    });

    // Never expose password hashes.
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
      username,
      password,
      fullName,
      color,            // optional accent color key; defaults to "cyan"
      manufacturerId,   // optional existing manufacturer id
      manufacturerName, // optional: create a new manufacturer to assign
    } = body ?? {};

    if (!username?.trim() || !password || !fullName?.trim()) {
      return NextResponse.json(
        { error: "username, password, and fullName are required." },
        { status: 400 }
      );
    }

    // Color is optional but, if provided, must match a known palette key.
    const normalizedColor: string =
      typeof color === "string" && VALID_COLOR_KEYS.has(color) ? color : "cyan";

    // Usernames are ascii, lowercase, 3-32 chars, letters/digits/._-
    const normalized = String(username).trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,32}$/.test(normalized)) {
      return NextResponse.json(
        {
          error:
            "Username must be 3-32 chars and use only letters, digits, dot, underscore, or dash.",
        },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters." },
        { status: 400 }
      );
    }

    // Resolve manufacturer assignment (optional).
    let mfgId: number | null =
      typeof manufacturerId === "number" ? manufacturerId : null;

    if (!mfgId && typeof manufacturerName === "string" && manufacturerName.trim()) {
      const [newMfg] = await db
        .insert(manufacturers)
        .values({ name: manufacturerName.trim(), createdByUserId: me.id })
        .returning();
      mfgId = newMfg.id;
    }

    const passwordHash = await hashPassword(password);

    const [user] = await db
      .insert(users)
      .values({
        username: normalized,
        passwordHash,
        fullName: String(fullName).trim(),
        role: "user",
        color: normalizedColor,
        manufacturerId: mfgId,
      })
      .returning();

    await logAudit({
      actor: me,
      action: "create",
      entityType: "user",
      entityId: user.id,
      details: {
        username: user.username,
        fullName: user.fullName,
        color: user.color,
        manufacturerId: mfgId,
      },
      ipAddress: getClientIp(req),
    });

    const { passwordHash: _ph, ...safe } = user;
    return NextResponse.json(
      { success: true, user: safe },
      { status: 201 }
    );
  } catch (error: any) {
    if (error?.code === "23505") {
      return NextResponse.json(
        { error: "A user with this username already exists." },
        { status: 409 }
      );
    }
    console.error("[admin/users POST]", error);
    return NextResponse.json({ error: "Failed to create user." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const me = await getCurrentUser();
    if (!me || me.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const idParam = searchParams.get("id");
    if (!idParam) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
    const id = parseInt(idParam);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: "invalid id" }, { status: 400 });
    }

    const target = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.id, id),
    });
    if (!target) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    // Never let an admin delete themselves or the built-in admin.
    if (target.username === "admin" || target.id === me.id) {
      return NextResponse.json(
        { error: "This account cannot be deleted." },
        { status: 400 }
      );
    }

    const { eq } = await import("drizzle-orm");
    await db.delete(users).where(eq(users.id, id));

    await logAudit({
      actor: me,
      action: "delete",
      entityType: "user",
      entityId: id,
      details: { username: target.username },
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[admin/users DELETE]", error);
    return NextResponse.json({ error: "Failed to delete user." }, { status: 500 });
  }
}
