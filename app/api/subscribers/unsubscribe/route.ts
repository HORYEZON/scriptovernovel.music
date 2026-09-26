// app/api/subscribers/unsubscribe/route.ts
//
// POST, not GET, and that is the whole point: mail scanners, link checkers and
// Gmail's own image proxy follow GET links in email, so an unsubscribe that
// happened on GET would take people off the list who never clicked anything.
// The link in the email opens /subscribe/unsubscribe, which shows the address
// and a button; this is what the button calls.
//
// No auth and no rate limit: possession of the token is the authorisation, the
// only thing it can do is remove that one address, and the worst case of a
// replay is that an already-unsubscribed row stays unsubscribed. Guessing a
// token means guessing 192 bits.
import { NextRequest, NextResponse } from "next/server";
import { logActivity } from "@/lib/activity-log-server";
import {
  revalidateSubscriberPaths,
  subscriberByUnsubscribeToken,
  unsubscribeByToken,
} from "@/lib/subscribers-server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const token = typeof (body as Record<string, unknown>)?.token === "string" ? String((body as Record<string, unknown>).token) : "";

  try {
    // Read the address before the write, so the log can name it — afterwards is
    // the same row, but this keeps the two reads from disagreeing if the same
    // token is posted twice at once.
    const row = await subscriberByUnsubscribeToken(token);
    const result = await unsubscribeByToken(token);
    if (result === "invalid") {
      return NextResponse.json({ error: "That link isn't valid — it may have been replaced." }, { status: 404 });
    }
    if (row && !row.unsubscribedAt) {
      revalidateSubscriberPaths();
      void logActivity({
        category: "VISITOR",
        action: "subscriber.unsubscribed",
        summary: `${row.email} left the mailing list.`,
        actor: { label: row.email, email: row.email, type: "visitor" },
        request,
      });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
