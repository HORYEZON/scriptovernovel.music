// app/api/subscribers/confirm/route.ts
//
// The target of the "Confirm subscription" button in the email. A GET that
// writes, which is the shape an email link has to be — so it is written to be
// harmless when followed by something that isn't a person: spending a token
// only ever confirms a subscription the owner of that inbox asked for, and
// doing it twice is a no-op.
//
// It redirects to /subscribe rather than rendering, so the address in the bar
// afterwards is a page the visitor can bookmark, reload or share without
// re-sending a token.
import { NextRequest, NextResponse } from "next/server";
import { SITE_URL } from "@/lib/site-url";
import { confirmSubscriber, revalidateSubscriberPaths } from "@/lib/subscribers-server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  let state: string;
  try {
    state = await confirmSubscriber(token);
    if (state === "confirmed") revalidateSubscriberPaths();
  } catch {
    state = "error";
  }
  // Absolute, from SITE_URL: a relative redirect would resolve against the
  // deployment host, which on Vercel is the preview URL rather than the
  // domain the visitor is actually on.
  return NextResponse.redirect(`${SITE_URL}/subscribe?state=${state}`, { status: 303 });
}
