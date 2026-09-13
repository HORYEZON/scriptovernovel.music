// app/api/admin/blocked-emails/route.ts
//
// GET  — every blocked email, newest first. Backs Settings → Blocked Emails
//        and is the same table app/api/contact/route.ts checks before
//        accepting a submission.
// POST — { email, reason? } — block an address directly from this page,
//        without going through "Block Sender" on an existing Gmail
//        notification (e.g. blocking ahead of time, or a sender who hasn't
//        actually messaged yet).
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const blockedEmails = await prisma.blockedEmail.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ blockedEmails });
  } catch (error) {
    console.error("[blocked-emails] failed to list", error);
    return NextResponse.json({ error: "Could not load blocked emails." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = (await request.json().catch(() => null)) as
      | { email?: unknown; reason?: unknown }
      | null;

    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const reason = typeof body?.reason === "string" && body.reason.trim() ? body.reason.trim() : null;

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }

    const blocked = await prisma.blockedEmail.upsert({
      where: { email },
      create: { email, reason },
      update: { reason },
    });

    revalidatePath("/admin/settings/blocked-emails");

    return NextResponse.json({ blocked }, { status: 201 });
  } catch (error) {
    console.error("[blocked-emails] failed to add", error);
    return NextResponse.json({ error: "Could not block that email." }, { status: 500 });
  }
}
