// app/api/admin/totp/setup/route.ts
//
// POST — starts (or restarts) enrollment: generates a fresh secret, stores
// it on the user (totpEnabled stays false until /verify confirms a real
// code), and returns the QR code + raw secret for the authenticator app.
// Calling this again before /verify just replaces the pending secret —
// there's nothing to "cancel", a second scan simply supersedes the first.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { auth } from "@/lib/auth";
import { generateTotpSecret, totpKeyUri, totpQrCodeDataUrl } from "@/lib/totp";

export const dynamic = "force-dynamic";

export async function POST() {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const session = await auth();
    const userId = (session!.user as { id: string }).id;
    const email = session!.user!.email as string;

    const secret = generateTotpSecret();
    await prisma.user.update({
      where: { id: userId },
      data: { totpSecret: secret, totpEnabled: false },
    });

    const keyUri = totpKeyUri(email, secret);
    const qrCodeDataUrl = await totpQrCodeDataUrl(keyUri);

    return NextResponse.json({ secret, qrCodeDataUrl });
  } catch (error) {
    console.error("[totp] failed to start enrollment", error);
    return NextResponse.json(
      { error: "Could not start two-factor setup." },
      { status: 500 }
    );
  }
}
