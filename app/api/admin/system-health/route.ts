// app/api/admin/system-health/route.ts
//
// GET — the infrastructure snapshot behind Dashboard ▸ System Health.
//
// The dashboard renders its first snapshot server-side (so the tab has
// content on first paint without a spinner); this route exists for the
// panel's Refresh button, which needs a *fresh* read rather than whatever
// Next.js cached for the page.
//
// Never fails: getSystemHealthSnapshot absorbs each section's errors and
// reports them as that section's `status`, so a dead upstream shows as one
// grey card rather than a 500 for the whole tab.

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getSystemHealthSnapshot } from "@/lib/system-health";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const snapshot = await getSystemHealthSnapshot();
  return NextResponse.json(snapshot, {
    // Explicitly uncacheable — a health readout that a CDN or the browser can
    // serve from cache is a health readout that can lie about right now.
    headers: { "Cache-Control": "no-store" },
  });
}
