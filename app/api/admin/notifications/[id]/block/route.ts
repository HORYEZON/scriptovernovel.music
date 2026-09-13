// app/api/admin/notifications/[id]/block/route.ts
//
// POST — blocks the sender's email (from a CONTACT notification's
// metadata) from submitting the public contact form again — see the check
// in app/api/contact/route.ts. Only meaningful for CONTACT rows; anything
// else is rejected outright since there's no "sender" to block.
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id } = await params;

    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    if (notification.type !== "CONTACT") {
      return NextResponse.json(
        { error: "Only contact-form messages have a sender to block." },
        { status: 400 }
      );
    }

    const metadata = notification.metadata as { email?: unknown } | null;
    // Lowercased + trimmed so this always matches how app/api/contact/
    // route.ts and app/api/admin/blocked-emails/route.ts store/look up an
    // email — without this, blocking "Someone@Gmail.com" wouldn't catch a
    // later submission from "someone@gmail.com" (or vice versa), and the
    // two entry points (here vs. the Blocked Emails page's own "add" form)
    // could silently create two different-cased rows for the same address.
    const email =
      typeof metadata?.email === "string" ? metadata.email.trim().toLowerCase() : null;
    if (!email) {
      return NextResponse.json(
        { error: "This message has no sender email on record." },
        { status: 400 }
      );
    }

    // Upsert rather than create — blocking an already-blocked sender again
    // (e.g. from a second message of theirs) is a no-op, not an error.
    await prisma.blockedEmail.upsert({
      where: { email },
      create: { email, reason: `Blocked from contact notification ${id}` },
      update: {},
    });

    // Also mark this message read + spam, so it drops out of the default
    // Gmail view along with everything else from a sender the admin just
    // decided not to hear from again.
    await prisma.notification.update({
      where: { id },
      data: { isSpam: true, readAt: new Date() },
    });

    // The Blocked Emails settings page is a plain server-rendered list fed
    // by initialBlockedEmails props — without this, navigating there via
    // client-side <Link> routing right after a block can still serve the
    // Router Cache's pre-block snapshot instead of hitting the DB again.
    revalidatePath("/admin/settings/blocked-emails");
    revalidatePath("/admin/notifications");

    return NextResponse.json({ success: true, email });
  } catch (error) {
    console.error("[notifications] failed to block sender", error);
    return NextResponse.json({ error: "Could not block this sender." }, { status: 500 });
  }
}
