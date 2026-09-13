import nodemailer from "nodemailer";
import { NextResponse } from "next/server";
import { notifyAdminOfContactMessage } from "@/lib/notifications/contact";
import { contactSubjectLabel } from "@/lib/contact";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log-server";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export async function POST(req: Request) {
  const { name, email, subject, message, captchaToken } = await req.json();

  if (!name || !email || !subject || !message) {
    return NextResponse.json({ error: "All fields are required." }, { status: 400 });
  }

  // Blocked senders (Admin → Notifications → Gmail → Block Sender) get the
  // exact same response shape as an actual send failure below — never a
  // distinct "you're blocked" message, so there's nothing here for a
  // spammer to learn or work around. Lowercased to match how BlockedEmail
  // rows are written (app/api/admin/blocked-emails/route.ts and
  // app/api/admin/notifications/[id]/block/route.ts) — otherwise a sender
  // blocked as "someone@gmail.com" could resubmit as "Someone@Gmail.com"
  // and sail right through.
  const blocked = await prisma.blockedEmail
    .findUnique({ where: { email: String(email).trim().toLowerCase() } })
    .catch(() => null);
  if (blocked) {
    return NextResponse.json({ error: "Failed to send message. Please try again." }, { status: 500 });
  }

  const verifyRes = await fetch(
    `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${captchaToken}`,
    { method: "POST" }
  );
  const verifyData = await verifyRes.json();
  if (!verifyData.success || verifyData.score < 0.5) {
    return NextResponse.json({ error: "Failed captcha verification." }, { status: 403 });
  }

  const subjectLabel = contactSubjectLabel(subject);

  try {
    await transporter.sendMail({
      from: `"ScriptOverNovel Music" <${process.env.GMAIL_USER}>`,
      to: process.env.GMAIL_USER,
      replyTo: email,
      subject: `[ScriptOverNovel Music] ${subjectLabel}`,
      text: `Name: ${name}\nEmail: ${email}\nSubject: ${subjectLabel}\n\n${message}`,
    });

    // Mirrors this into the admin notifications bell ("Gmail" tab) — the
    // email above is still the primary alert; this is best-effort and never
    // fails the request the visitor is waiting on.
    await notifyAdminOfContactMessage({ name, email, subject, subjectLabel, message });

    void logActivity({
      category: "VISITOR",
      action: "contact.submitted",
      summary: `${name} sent a message about ${subjectLabel}.`,
      // The sender is the actor here, and their email is the whole point of
      // the record — but they have no account, so this is a visitor.
      actor: { label: name, email, type: "visitor" },
      metadata: { subject: subjectLabel },
      request: req,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to send message. Please try again." }, { status: 500 });
  }
}
