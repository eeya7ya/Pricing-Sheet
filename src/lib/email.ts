import { Resend } from "resend";

// Lazily initialise so the module loads even without the key configured
let _resend: Resend | null = null;
function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!_resend) _resend = new Resend(key);
  return _resend;
}

const FROM = process.env.EMAIL_FROM ?? "Smart Pricing Sheet <onboarding@resend.dev>";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "";

/** Notify admin that someone requested an account */
export async function sendAccountRequestNotification(opts: {
  fullName: string;
  email: string;
  company?: string;
  message?: string;
}) {
  const resend = getResend();
  if (!resend || !ADMIN_EMAIL) {
    console.log("[email] RESEND_API_KEY or ADMIN_EMAIL not set — skipping notification email.");
    return;
  }

  const { fullName, email, company, message } = opts;

  await resend.emails.send({
    from: FROM,
    to: ADMIN_EMAIL,
    replyTo: email,
    subject: `New Account Request — ${fullName}`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;border:1px solid #e5e7eb;border-radius:12px;">
        <h2 style="margin:0 0 4px;font-size:20px;color:#111827;">New Account Request</h2>
        <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">Someone is requesting access to Smart Pricing Sheet.</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="padding:8px 0;color:#6b7280;width:110px;">Full Name</td><td style="padding:8px 0;color:#111827;font-weight:600;">${fullName}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;">Email</td><td style="padding:8px 0;"><a href="mailto:${email}" style="color:#0891b2;">${email}</a></td></tr>
          ${company ? `<tr><td style="padding:8px 0;color:#6b7280;">Company</td><td style="padding:8px 0;color:#111827;">${company}</td></tr>` : ""}
          ${message ? `<tr><td style="padding:8px 0;color:#6b7280;vertical-align:top;">Message</td><td style="padding:8px 0;color:#111827;">${message.replace(/\n/g, "<br/>")}</td></tr>` : ""}
        </table>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
        <p style="margin:0;font-size:12px;color:#9ca3af;">Reply to this email to contact the requester, or log in to the Admin panel to create their account.</p>
      </div>
    `,
  });
}

/** Send login credentials to a newly created user */
export async function sendCredentialsEmail(opts: {
  to: string;
  fullName: string;
  password: string;
}) {
  const resend = getResend();
  if (!resend) {
    console.log("[email] RESEND_API_KEY not set — skipping credentials email.");
    return;
  }

  const { to, fullName, password } = opts;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  await resend.emails.send({
    from: FROM,
    to,
    subject: "Your Smart Pricing Sheet account is ready",
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;border:1px solid #e5e7eb;border-radius:12px;">
        <h2 style="margin:0 0 4px;font-size:20px;color:#111827;">Welcome, ${fullName}!</h2>
        <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">Your account has been created. Here are your login credentials:</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr><td style="padding:8px 0;color:#6b7280;width:110px;">Email</td><td style="padding:8px 0;color:#111827;font-weight:600;">${to}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;">Password</td><td style="padding:8px 0;font-family:monospace;background:#f9fafb;padding:6px 10px;border-radius:6px;color:#111827;font-weight:600;">${password}</td></tr>
        </table>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
        ${appUrl ? `<a href="${appUrl}/login" style="display:inline-block;padding:10px 24px;background:#0891b2;color:#fff;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">Sign In Now</a>` : ""}
        <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;">Please change your password after your first login.</p>
      </div>
    `,
  });
}
