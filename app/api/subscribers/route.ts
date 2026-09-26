// app/api/subscribers/route.ts
//
// The mailing list's public signup (POST) and the admin's list (GET).
//
// POST is the one endpoint on the site that emails an address supplied by
// whoever called it, so it is written defensively:
//
// - **Every outcome answers the same way.** New address, already pending,
//   already confirmed, blocked, even a send failure on an address we've
//   already got — all return the same acknowledgement. Anything else turns
//   this into an oracle for "is this person on the list", which is not ours to
//   tell. The admin can see the real state; a visitor can't.
// - **Rate limited per IP**, and per address by the resend cooldown in
//   lib/subscribers.ts, so it can't be used to bomb someone's inbox.
// - **Double opt-in**, so an address typed in by someone else never becomes a
//   subscriber — see the Subscriber model's comment.
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { sendSubscribeConfirmEmail } from "@/lib/mail";
import { SITE_URL } from "@/lib/site-url";
import { logActivity } from "@/lib/activity-log-server";
import {
  SUBSCRIBE_ACK,
  isSubscriberSource,
  isValidSubscriberEmail,
  normalizeEmail,
} from "@/lib/subscribers";
import { SUBSCRIBER_SELECT, recordSignup, revalidateSubscriberPaths } from "@/lib/subscribers-server";

export const dynamic = "force-dynamic";

/** Five signups a minute from one address is already generous for a form with
 *  one field; the per-email cooldown does the rest of the work. */
const SIGNUP_LIMIT = 5;
const SIGNUP_WINDOW_MS = 60 * 1000;

// POST /api/subscribers — public signup
export async function POST(request: NextRequest) {
  const limit = rateLimit(`subscribe:${clientIp(request)}`, SIGNUP_LIMIT, SIGNUP_WINDOW_MS);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSec);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { email: rawEmail, source: rawSource } = (body ?? {}) as Record<string, unknown>;

  const email = normalizeEmail(rawEmail);
  // The one case that does get its own message: a malformed address is the
  // visitor's own typo, and telling them is help rather than disclosure.
  if (!isValidSubscriberEmail(email)) {
    return NextResponse.json({ error: "That doesn't look like an email address." }, { status: 400 });
  }
  const source = isSubscriberSource(rawSource) ? rawSource : null;

  // Blocked senders (Admin → Notifications → Block Sender) get the ordinary
  // acknowledgement and no row — the same "nothing to learn here" rule the
  // contact form follows.
  const blocked = await prisma.blockedEmail.findUnique({ where: { email } }).catch(() => null);
  if (blocked) return NextResponse.json({ ok: true, message: SUBSCRIBE_ACK });

  try {
    const { sendConfirm } = await recordSignup(email, source);

    if (sendConfirm) {
      const row = await prisma.subscriber.findUnique({
        where: { email },
        select: { unsubscribeToken: true },
      });
      const confirmUrl = `${SITE_URL}/api/subscribers/confirm?token=${encodeURIComponent(sendConfirm.token)}`;
      const unsubscribeUrl = `${SITE_URL}/subscribe/unsubscribe?token=${encodeURIComponent(row?.unsubscribeToken ?? "")}`;
      await sendSubscribeConfirmEmail(sendConfirm.email, confirmUrl, unsubscribeUrl);
      revalidateSubscriberPaths();

      void logActivity({
        category: "VISITOR",
        action: "subscriber.signup",
        summary: `${email} asked to join the mailing list.`,
        actor: { label: email, email, type: "visitor" },
        metadata: { source: source ?? "unknown" },
        request,
      });
    }

    return NextResponse.json({ ok: true, message: SUBSCRIBE_ACK });
  } catch {
    // The row may well have been written before the send failed; saying so
    // would leak that the address is now on file, and telling them to try
    // again is the useful half anyway.
    return NextResponse.json(
      { error: "We couldn't send the confirmation just now. Please try again in a few minutes." },
      { status: 500 }
    );
  }
}

// GET /api/subscribers — admin list. Tokens are never selected: they are bearer
// credentials, and the admin has no use for them.
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const subscribers = await prisma.subscriber.findMany({
      select: SUBSCRIBER_SELECT,
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(subscribers);
  } catch {
    return NextResponse.json({ error: "Failed to fetch subscribers" }, { status: 500 });
  }
}
