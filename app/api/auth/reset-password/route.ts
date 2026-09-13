// app/api/auth/reset-password/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { notifyUserOfPasswordChange } from "@/lib/notifications/security";

function hashToken(rawToken: string) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

// GET /api/auth/reset-password?token=... — lets the reset page confirm the
// link is still valid before showing the "new password" form.
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) {
    return NextResponse.json({ valid: false, error: "Missing token." }, { status: 400 });
  }

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });

  if (!record || record.expiresAt < new Date()) {
    return NextResponse.json(
      { valid: false, error: "This reset link is invalid or has expired." },
      { status: 400 }
    );
  }

  return NextResponse.json({ valid: true });
}

const bodySchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export async function POST(req: Request) {
  let token: string, password: string;
  try {
    const json = await req.json();
    ({ token, password } = bodySchema.parse(json));
  } catch (err) {
    const message =
      err instanceof z.ZodError ? err.issues[0]?.message : "Invalid request.";
    return NextResponse.json({ error: message ?? "Invalid request." }, { status: 400 });
  }

  const tokenHash = hashToken(token);
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!record || record.expiresAt < new Date()) {
    // Clean up an expired-but-lingering row so it can't be replayed.
    if (record) {
      await prisma.passwordResetToken.delete({ where: { id: record.id } }).catch(() => {});
    }
    return NextResponse.json(
      { error: "This reset link is invalid or has expired. Please request a new one." },
      { status: 400 }
    );
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { password: hashedPassword },
    }),
    // Single-use: burn every outstanding token for this user, not just the
    // one that was consumed, so old links can't be reused after a reset.
    prisma.passwordResetToken.deleteMany({ where: { userId: record.userId } }),
  ]);

  // Best-effort security alert — a mail hiccup here must never fail a
  // password reset that has already succeeded.
  await notifyUserOfPasswordChange(record.user.email);

  return NextResponse.json({ success: true });
}
