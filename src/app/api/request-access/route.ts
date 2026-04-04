export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { accountRequests } from "@/db/schema";
import { sendAccountRequestNotification } from "@/lib/email";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { fullName, email, company, message } = body;

    if (!fullName?.trim() || !email?.trim()) {
      return NextResponse.json(
        { error: "Full name and email are required." },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Please provide a valid email address." },
        { status: 400 }
      );
    }

    // Save to database
    await db.insert(accountRequests).values({
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      company: company?.trim() ?? "",
      message: message?.trim() ?? "",
      status: "pending",
    });

    // Notify admin by email (non-blocking — don't fail the request if email fails)
    sendAccountRequestNotification({
      fullName: fullName.trim(),
      email: email.trim(),
      company: company?.trim(),
      message: message?.trim(),
    }).catch((err) => console.error("[request-access] email error:", err));

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("[request-access]", error);
    return NextResponse.json(
      { error: "Failed to submit request. Please try again." },
      { status: 500 }
    );
  }
}
