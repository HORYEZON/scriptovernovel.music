// lib/vercel-analytics.ts
//
// Typed, server-only wrapper around the Vercel Web Analytics API
// (https://api.vercel.com/v1/query/web-analytics) — powers the "Website
// Analytics" section on the admin dashboard (components/admin/WebsiteAnalytics.tsx).
//
// Design rules, all deliberate:
//   • Same env-var pattern as the rest of the app (lib/mail.ts, lib/minigames/
//     notify.ts) — plain `process.env.X` reads, no zod/env-schema layer exists
//     here, so this doesn't invent one.
//   • Every exported function is safe to call unconfigured — with no token/
//     project ID it returns null (single-object endpoints) or [] (list
//     endpoints) instead of throwing, so the admin dashboard always renders.
//   • Every network call is wrapped in try/catch, and any non-2xx response is
//     treated as "no data" rather than an error — an analytics hiccup must
//     never break the rest of the admin page.
//   • This is dashboard data, not a live counter — every fetch opts into
//     Next.js's data cache with a 15-minute revalidate window so a slow
//     analytics API is never on the critical path of every dashboard load.

const BASE_URL = "https://api.vercel.com/v1/query/web-analytics";
const REVALIDATE_SECONDS = 900; // 15 minutes

export interface VisitTotals {
  pageviews: number;
  visitors: number;
}

export interface DailyVisitPoint {
  timestamp: string;
  pageviews: number;
  visitors: number;
}

export interface TopPageRow {
  route: string;
  pageviews: number;
  visitors: number;
}

export interface ReferrerRow {
  /** Empty string means direct/unknown traffic — callers should label it "Direct". */
  referrerHostname: string;
  pageviews: number;
  visitors: number;
}

export interface CountryRow {
  /** ISO 3166-1 alpha-2, as Vercel returns it ("PH", "US"). Empty string when
   *  the edge couldn't place the request — rendered as "Unknown", not dropped,
   *  so the percentages still add up to the visitors actually counted. */
  country: string;
  pageviews: number;
  visitors: number;
}

export interface DeviceRow {
  deviceType: string;
  pageviews: number;
  visitors: number;
}

/** The date-range presets the dashboard's filter offers — single source of
 *  truth shared by the range switcher (components/admin/WebsiteAnalyticsPanel.tsx)
 *  and the API route that re-fetches on selection (app/api/analytics/route.ts),
 *  so the two can never drift out of sync on what's a valid range. */
export const ANALYTICS_RANGE_OPTIONS = [
  { label: "7D", days: 7 },
  { label: "14D", days: 14 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
] as const;

export type AnalyticsRangeDays = (typeof ANALYTICS_RANGE_OPTIONS)[number]["days"];

export const DEFAULT_ANALYTICS_RANGE_DAYS: AnalyticsRangeDays = 30;

export interface AnalyticsSnapshot {
  totals: VisitTotals | null;
  daily: DailyVisitPoint[];
  topPages: TopPageRow[];
  topReferrers: ReferrerRow[];
  devices: DeviceRow[];
  countries: CountryRow[];
}

/** True once VERCEL_ANALYTICS_TOKEN + VERCEL_PROJECT_ID are both set. */
export function isAnalyticsConfigured(): boolean {
  return Boolean(process.env.VERCEL_ANALYTICS_TOKEN && process.env.VERCEL_PROJECT_ID);
}

function toDateParam(daysAgo: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function todayParam(): string {
  return new Date().toISOString().slice(0, 10);
}

// Some Vercel query APIs wrap the payload in `{ data: ... }`; others return
// it bare. Accept both so a minor response-shape difference doesn't turn
// into "no data" for no reason.
function unwrap(json: unknown): unknown {
  if (json && typeof json === "object" && "data" in (json as Record<string, unknown>)) {
    return (json as Record<string, unknown>).data;
  }
  return json;
}

/**
 * Low-level GET against /v1/query/web-analytics/visits/{endpoint}.
 * Returns null on missing config, network failure, or a non-2xx response —
 * never throws.
 */
async function queryVisits(
  endpoint: "count" | "aggregate",
  params: Record<string, string>
): Promise<unknown | null> {
  if (!isAnalyticsConfigured()) return null;

  const token = process.env.VERCEL_ANALYTICS_TOKEN as string;
  const projectId = process.env.VERCEL_PROJECT_ID as string;
  const teamId = process.env.VERCEL_TEAM_ID;

  const search = new URLSearchParams({ projectId, ...params });
  if (teamId) search.set("teamId", teamId);

  try {
    const res = await fetch(`${BASE_URL}/visits/${endpoint}?${search.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) return null;
    return unwrap(await res.json());
  } catch {
    return null;
  }
}

/** Site-wide pageviews + visitors for the trailing `sinceDays` days. */
export async function getVisitTotals(sinceDays = 30): Promise<VisitTotals | null> {
  const payload = await queryVisits("count", {
    since: toDateParam(sinceDays),
    until: todayParam(),
  });

  if (!payload || typeof payload !== "object") return null;
  const row = payload as Record<string, unknown>;
  if (typeof row.pageviews !== "number") return null;

  return {
    pageviews: row.pageviews,
    visitors: typeof row.visitors === "number" ? row.visitors : 0,
  };
}

/** Daily pageviews/visitors for the trailing `sinceDays` days, oldest first. */
export async function getDailyVisits(sinceDays = 14): Promise<DailyVisitPoint[]> {
  const payload = await queryVisits("aggregate", {
    since: toDateParam(sinceDays),
    until: todayParam(),
    by: "day",
  });

  if (!Array.isArray(payload)) return [];

  return payload
    .map((row): DailyVisitPoint => ({
      timestamp: String((row as Record<string, unknown>).timestamp ?? ""),
      pageviews: Number((row as Record<string, unknown>).pageviews) || 0,
      visitors: Number((row as Record<string, unknown>).visitors) || 0,
    }))
    .filter((row) => row.timestamp)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

/** Top `limit` routes by pageviews over the trailing `sinceDays` days. */
export async function getTopPages(sinceDays = 30, limit = 5): Promise<TopPageRow[]> {
  const payload = await queryVisits("aggregate", {
    since: toDateParam(sinceDays),
    until: todayParam(),
    by: "route",
  });

  if (!Array.isArray(payload)) return [];

  return payload
    .map((row): TopPageRow => ({
      route: String((row as Record<string, unknown>).route ?? "/"),
      pageviews: Number((row as Record<string, unknown>).pageviews) || 0,
      visitors: Number((row as Record<string, unknown>).visitors) || 0,
    }))
    .sort((a, b) => b.pageviews - a.pageviews)
    .slice(0, limit);
}

/** Top `limit` referrer hostnames by pageviews over the trailing `sinceDays` days. */
export async function getTopReferrers(sinceDays = 30, limit = 5): Promise<ReferrerRow[]> {
  const payload = await queryVisits("aggregate", {
    since: toDateParam(sinceDays),
    until: todayParam(),
    by: "referrerHostname",
  });

  if (!Array.isArray(payload)) return [];

  return payload
    .map((row): ReferrerRow => ({
      referrerHostname: String((row as Record<string, unknown>).referrerHostname ?? ""),
      pageviews: Number((row as Record<string, unknown>).pageviews) || 0,
      visitors: Number((row as Record<string, unknown>).visitors) || 0,
    }))
    .sort((a, b) => b.pageviews - a.pageviews)
    .slice(0, limit);
}

/** Device-type breakdown (desktop/mobile/tablet/...) over the trailing `sinceDays` days. */
export async function getDeviceBreakdown(sinceDays = 30): Promise<DeviceRow[]> {
  const payload = await queryVisits("aggregate", {
    since: toDateParam(sinceDays),
    until: todayParam(),
    by: "deviceType",
  });

  if (!Array.isArray(payload)) return [];

  return payload.map((row): DeviceRow => ({
    deviceType: String((row as Record<string, unknown>).deviceType ?? "unknown"),
    pageviews: Number((row as Record<string, unknown>).pageviews) || 0,
    visitors: Number((row as Record<string, unknown>).visitors) || 0,
  }));
}

/**
 * Visitors by country over the trailing `sinceDays` days.
 *
 * `country` is one of the dimensions Vercel's own aggregate endpoint groups by
 * — the same `by=` mechanism the referrer and device widgets already use, so
 * this needs no extra service, no IP handling and no new storage. City is
 * *not* on that list (the API's allowed set is hour, day, week, month, year,
 * country, deviceType, environment, requestPath, referrerHostname, osName,
 * browserName, route, the utm* fields and flags), which is why this stops at
 * the country.
 */
export async function getCountryBreakdown(
  sinceDays = 30,
  limit = 8
): Promise<CountryRow[]> {
  const payload = await queryVisits("aggregate", {
    since: toDateParam(sinceDays),
    until: todayParam(),
    by: "country",
  });

  if (!Array.isArray(payload)) return [];

  return payload
    .map((row): CountryRow => ({
      country: String((row as Record<string, unknown>).country ?? ""),
      pageviews: Number((row as Record<string, unknown>).pageviews) || 0,
      visitors: Number((row as Record<string, unknown>).visitors) || 0,
    }))
    // By visitors rather than pageviews: this widget answers "where are people
    // coming from", and one visitor refreshing a lot shouldn't outrank a
    // country that actually sent more of them.
    .sort((a, b) => b.visitors - a.visitors)
    .slice(0, limit);
}

/**
 * Bundles all six widgets' data for a single date range in one call — the
 * shared fetch behind both the initial server render (WebsiteAnalytics.tsx)
 * and the /api/analytics route the date-range switcher re-fetches from when
 * an admin picks a different window. One range drives every widget at once,
 * including the daily chart (previously hardcoded to 14 days regardless of
 * the 30-day stat totals) — so "7D" genuinely means the whole panel is
 * scoped to 7 days, not a mix of ranges.
 */
export async function getAnalyticsSnapshot(
  sinceDays: number = DEFAULT_ANALYTICS_RANGE_DAYS
): Promise<AnalyticsSnapshot> {
  const [totals, daily, topPages, topReferrers, devices, countries] = await Promise.all([
    getVisitTotals(sinceDays),
    getDailyVisits(sinceDays),
    getTopPages(sinceDays, 5),
    getTopReferrers(sinceDays, 5),
    getDeviceBreakdown(sinceDays),
    getCountryBreakdown(sinceDays, 8),
  ]);

  return { totals, daily, topPages, topReferrers, devices, countries };
}
