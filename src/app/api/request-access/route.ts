export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { accountRequests } from "@/db/schema";
import nodemailer from "nodemailer";

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

    // Basic email format check
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

    // Send email notification if SMTP is configured
    const smtpHost = process.env.SMTP_HOST;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const adminEmail = process.env.ADMIN_EMAIL;

    if (smtpHost && smtpUser && smtpPass && adminEmail) {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(process.env.SMTP_PORT ?? "587"),
        secure: process.env.SMTP_SECURE === "true",
        auth: { user: smtpUser, pass: smtpPass },
      });

      await transporter.sendMail({
        from: `"Smart Pricing Sheet" <${smtpUser}>`,
        to: adminEmail,
        subject: `New Account Request — ${fullName.trim()}`,
        html: `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;border:1px solid #e5e7eb;border-radius:12px;">
            <h2 style="margin:0 0 4px;font-size:20px;color:#111827;">New Account Request</h2>
            <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">Someone is requesting access to Smart Pricing Sheet.</p>
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              <tr><td style="padding:8px 0;color:#6b7280;width:110px;">Full Name</td><td style="padding:8px 0;color:#111827;font-weight:600;">${fullName.trim()}</td></tr>
              <tr><td style="padding:8px 0;color:#6b7280;">Email</td><td style="padding:8px 0;"><a href="mailto:${email.trim()}" style="color:#0891b2;">${email.trim()}</a></td></tr>
              ${company?.trim() ? `<tr><td style="padding:8px 0;color:#6b7280;">Company</td><td style="padding:8px 0;color:#111827;">${company.trim()}</td></tr>` : ""}
              ${message?.trim() ? `<tr><td style="padding:8px 0;color:#6b7280;vertical-align:top;">Message</td><td style="padding:8px 0;color:#111827;">${message.trim().replace(/\n/g, "<br/>")}</td></tr>` : ""}
            </table>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
            <p style="margin:0;font-size:12px;color:#9ca3af;">Reply to this email to send credentials to the requester.</p>
          </div>
        `,
        replyTo: email.trim(),
      });
    } else {
      console.log(
        "[request-access] SMTP not configured — email notification skipped. Request saved to DB."
      );
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("[request-access]", error);
    return NextResponse.json(
      { error: "Failed to submit request. Please try again." },
      { status: 500 }
    );
  }
}
