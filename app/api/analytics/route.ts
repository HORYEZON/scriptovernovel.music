// app/api/analytics/route.ts
//
// Admin-only read endpoint for the Website Analytics date-range switcher
// (components/admin/WebsiteAnalyticsPanel.tsx) — called only when an admin
// picks a different range in the browser. The initial page load never hits
// this; it's server-rendered directly via lib/vercel-analytics.ts in
// components/admin/WebsiteAnalytics.tsx.
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import {
  getAnalyticsSnapshot,
  ANALYTICS_RANGE_OPTIONS,
  DEFAULT_ANALYTICS_RANGE_DAYS,
} from "@/lib/vercel-analytics";

const ALLOWED_DAYS: number[] = ANALYTICS_RANGE_OPTIONS.map((r) => r.days);

export async function GET(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const requested = Number(request.nextUrl.searchParams.get("days"));
  const days = ALLOWED_DAYS.includes(requested) ? requested : DEFAULT_ANALYTICS_RANGE_DAYS;

  // getAnalyticsSnapshot() never throws — missing config or an unreachable
  // Vercel API resolve to safe empty values internally, so this route always
  // returns 200 with a shape the panel can render (empty states, not errors).
  const snapshot = await getAnalyticsSnapshot(days);
  return NextResponse.json(snapshot);
}
