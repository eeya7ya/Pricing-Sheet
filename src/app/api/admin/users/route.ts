export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, manufacturers, accountRequests } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser, hashPassword } from "@/lib/auth";
import nodemailer from "nodemailer";

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

    const [user] = await db
      .insert(users)
      .values({
        email: email.trim().toLowerCase(),
        passwordHash,
        fullName: fullName.trim(),
        role: "user",
        manufacturerId: mfgId,
      })
      .returning();

    // Mark account request as approved
    if (requestId) {
      await db
        .update(accountRequests)
        .set({ status: "approved" })
        .where(eq(accountRequests.id, requestId));
    }

    // Send credentials email
    const smtpHost = process.env.SMTP_HOST;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (smtpHost && smtpUser && smtpPass) {
      try {
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: parseInt(process.env.SMTP_PORT ?? "587"),
          secure: process.env.SMTP_SECURE === "true",
          auth: { user: smtpUser, pass: smtpPass },
        });

        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://your-app.vercel.app";

        await transporter.sendMail({
          from: `"Smart Pricing Sheet" <${smtpUser}>`,
          to: email.trim(),
          subject: "Your Smart Pricing Sheet account is ready",
          html: `
            <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;border:1px solid #e5e7eb;border-radius:12px;">
              <h2 style="margin:0 0 4px;font-size:20px;color:#111827;">Welcome, ${fullName.trim()}!</h2>
              <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">Your account has been created. Here are your login credentials:</p>
              <table style="width:100%;border-collapse:collapse;font-size:14px;">
                <tr><td style="padding:8px 0;color:#6b7280;width:110px;">Email</td><td style="padding:8px 0;color:#111827;font-weight:600;">${email.trim()}</td></tr>
                <tr><td style="padding:8px 0;color:#6b7280;">Password</td><td style="padding:8px 0;font-family:monospace;color:#111827;font-weight:600;">${password}</td></tr>
              </table>
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
              <a href="${appUrl}/login" style="display:inline-block;padding:10px 24px;background:#0891b2;color:#fff;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">Sign In Now</a>
              <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;">Please change your password after your first login.</p>
            </div>
          `,
        });
      } catch (emailErr) {
        console.error("[admin/users] Email send failed:", emailErr);
        // Don't fail the whole request over email
      }
    }

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
