// app/api/admin/totp/disable/route.ts
//
// POST { password } — turns off 2FA. Requires re-entering the account
// password even though the admin is already signed in: an active admin
// session alone (e.g. an unlocked, unattended laptop) shouldn't be enough
// to strip the account's second factor.
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { logActivity } from "@/lib/activity-log-server";
import { auth } from "@/lib/auth";
import { notifyUserOfTotpDisabled } from "@/lib/notifications/security";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = (await request.json().catch(() => null)) as { password?: unknown } | null;
    const password = typeof body?.password === "string" ? body.password : "";
    if (!password) {
      return NextResponse.json({ error: "Enter your password to confirm." }, { status: 400 });
    }

    const session = await auth();
    const userId = (session!.user as { id: string }).id;
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user?.password || !(await bcrypt.compare(password, user.password))) {
      // A wrong password on the *disable* form is worth a trail entry in its
      // own right — it is an attempt to weaken the account's protection.
      void logActivity({
        category: "AUTH",
        action: "auth.totp.failed",
        summary: `Incorrect password entered while trying to turn off two-factor authentication.`,
        actor: { id: userId, label: user?.name || user?.email || null, email: user?.email ?? null, type: "admin" },
        entityType: "user",
        entityId: userId,
        metadata: { reason: "bad-password-on-disable" },
        request,
      });
      return NextResponse.json({ error: "Incorrect password." }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { totpEnabled: false, totpSecret: null, totpRecoveryCodes: [] },
    });

    // Best-effort — a mail hiccup must never fail a disable the admin
    // explicitly (and just re-authenticated to) request.
    await notifyUserOfTotpDisabled(user.email);

    void logActivity({
      category: "AUTH",
      action: "auth.totp.disabled",
      summary: `${user.name || user.email} turned off two-factor authentication.`,
      actor: { id: userId, label: user.name || user.email, email: user.email, type: "admin" },
      entityType: "user",
      entityId: userId,
      request,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[totp] failed to disable 2FA", error);
    return NextResponse.json(
      { error: "Could not turn off two-factor authentication." },
      { status: 500 }
    );
  }
}
