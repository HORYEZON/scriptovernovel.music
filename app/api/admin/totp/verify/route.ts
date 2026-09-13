// app/api/admin/totp/verify/route.ts
//
// POST { code } — confirms enrollment: the admin must prove they actually
// scanned the QR and their app produces valid codes before totpEnabled
// flips on. Also (re)generates the 10 recovery codes at this point — same
// moment 2FA actually becomes load-bearing, so the plaintext codes are
// handed back exactly once, right here.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { logActivity } from "@/lib/activity-log-server";
import { auth } from "@/lib/auth";
import { generateRecoveryCodes, verifyTotpToken } from "@/lib/totp";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = (await request.json().catch(() => null)) as { code?: unknown } | null;
    const code = typeof body?.code === "string" ? body.code.trim() : "";
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { error: "Enter the 6-digit code from your authenticator app." },
        { status: 400 }
      );
    }

    const session = await auth();
    const userId = (session!.user as { id: string }).id;
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user?.totpSecret) {
      return NextResponse.json(
        { error: "Start setup again — no pending secret found." },
        { status: 400 }
      );
    }

    const ok = await verifyTotpToken(code, user.totpSecret);
    if (!ok) {
      void logActivity({
        category: "AUTH",
        action: "auth.totp.failed",
        summary: `Wrong code entered while enrolling ${user.name || user.email} in two-factor authentication.`,
        actor: { id: userId, label: user.name || user.email, email: user.email, type: "admin" },
        entityType: "user",
        entityId: userId,
        request,
      });
      return NextResponse.json({ error: "That code didn't match. Try again." }, { status: 400 });
    }

    const { plaintext, hashed } = await generateRecoveryCodes();
    await prisma.user.update({
      where: { id: userId },
      data: { totpEnabled: true, totpRecoveryCodes: hashed },
    });

    void logActivity({
      category: "AUTH",
      action: "auth.totp.enabled",
      summary: `${user.name || user.email} turned on two-factor authentication.`,
      actor: { id: userId, label: user.name || user.email, email: user.email, type: "admin" },
      entityType: "user",
      entityId: userId,
      request,
    });

    return NextResponse.json({ success: true, recoveryCodes: plaintext });
  } catch (error) {
    console.error("[totp] failed to verify enrollment", error);
    return NextResponse.json(
      { error: "Could not confirm two-factor setup." },
      { status: 500 }
    );
  }
}
