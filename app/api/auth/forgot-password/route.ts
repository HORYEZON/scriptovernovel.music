// app/api/auth/forgot-password/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/mail";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

const bodySchema = z.object({
  email: z.string().trim().email(),
});

// Always returns the same generic response, whether or not the email is
// registered — prevents callers from using this endpoint to enumerate
// which addresses have an admin account.
const GENERIC_MESSAGE =
  "If an account exists for that email, a password reset link has been sent.";

export async function POST(req: Request) {
  let email: string;
  try {
    const json = await req.json();
    ({ email } = bodySchema.parse(json));
  } catch {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    // Only credentials-based accounts have a password to reset.
    if (user?.password) {
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

      // Invalidate any outstanding reset requests for this user first.
      await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
      await prisma.passwordResetToken.create({
        data: {
          tokenHash,
          userId: user.id,
          expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
        },
      });

      const baseUrl =
        process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
      const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`;

      await sendPasswordResetEmail(user.email, resetUrl);
    }

    return NextResponse.json({ success: true, message: GENERIC_MESSAGE });
  } catch (err) {
    console.error("[forgot-password]", err);
    // Still return the generic message — don't leak internal errors either.
    return NextResponse.json({ success: true, message: GENERIC_MESSAGE });
  }
}
