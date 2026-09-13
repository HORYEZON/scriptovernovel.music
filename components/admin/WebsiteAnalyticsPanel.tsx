// components/admin/WebsiteAnalyticsPanel.tsx
"use client";

import { useState } from "react";
import toast from "@/lib/toast";
import { Eye, Users, Globe, Monitor, Smartphone, Tablet, Loader2 } from "lucide-react";
import {
  ANALYTICS_RANGE_OPTIONS,
  type AnalyticsSnapshot,
  type AnalyticsRangeDays,
  type DeviceRow,
  type CountryRow,
} from "@/lib/vercel-analytics";
import { VisitsAreaChart } from "./VisitsAreaChart";

// Same icon-badge accent convention as STAT_ACCENTS in dashboard/page.tsx —
// duplicated locally rather than reaching across files for three class strings.
const STAT_ACCENTS: Record<string, string> = {
  sepia: "bg-sepia/10 text-sepia",
  indigo: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
};

const DEVICE_ICONS: Record<string, typeof Monitor> = {
  desktop: Monitor,
  mobile: Smartphone,
  tablet: Tablet,
};

const EMPTY_STATE_TEXT = "No analytics data yet.";

function WidgetLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-body text-[10px] sm:text-xs text-ink-400 dark:text-ink-300 uppercase tracking-widest mb-3">
      {children}
    </h3>
  );
}

function EmptyState() {
  return (
    <p className="font-body text-sm text-ink-400 dark:text-ink-300 italic">{EMPTY_STATE_TEXT}</p>
  );
}

function DeviceBars({ devices }: { devices: DeviceRow[] }) {
  const total = devices.reduce((sum, d) => sum + d.pageviews, 0) || 1;
  const sorted = [...devices].sort((a, b) => b.pageviews - a.pageviews);

  return (
    <div className="space-y-3">
      {sorted.map((d) => {
        const pct = Math.round((d.pageviews / total) * 100);
        const Icon = DEVICE_ICONS[d.deviceType.toLowerCase()] ?? Globe;
        return (
          <div key={d.deviceType}>
            <div className="flex items-center justify-between mb-1">
              <span className="font-body text-xs text-ink dark:text-cream flex items-center gap-1.5 capitalize">
                <Icon size={13} strokeWidth={1.5} className="text-ink-400 dark:text-ink-300" />
                {d.deviceType || "Unknown"}
              </span>
              <span className="font-jakarta text-xs font-semibold tabular-nums text-ink-400 dark:text-ink-300">
                {pct}%
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
              <div className="h-full rounded-full bg-sepia/70" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * "PH" → 🇵🇭. The regional-indicator block sits at U+1F1E6 for "A", so each
 * letter maps to its own symbol and the pair renders as one flag — no image
 * set, no lookup table, no dependency. Anything that isn't two ASCII letters
 * (including the empty string Vercel returns when the edge couldn't place a
 * request) gets no flag rather than a pair of stray glyphs.
 */
function countryFlag(code: string): string {
  if (!/^[A-Za-z]{2}$/.test(code)) return "";
  return code
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

/** ISO alpha-2 → the reader's own name for it ("PH" → "Philippines"), via the
 *  platform's own table. Falls back to the raw code if the runtime doesn't
 *  know it, which is better than showing nothing at all. */
function countryName(code: string): string {
  if (!code) return "Unknown";
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

function CountryBars({ countries }: { countries: CountryRow[] }) {
  // Share of *visitors*, not pageviews — this widget answers "where are people
  // coming from", and one visitor refreshing a lot shouldn't out-weigh a
  // country that actually sent more of them. Same reason getCountryBreakdown
  // sorts by visitors.
  const total = countries.reduce((sum, c) => sum + c.visitors, 0) || 1;

  return (
    <div className="space-y-3">
      {countries.map((c) => {
        const pct = Math.round((c.visitors / total) * 100);
        const flag = countryFlag(c.country);
        return (
          <div key={c.country || "unknown"}>
            <div className="flex items-center justify-between mb-1 gap-3">
              <span className="font-body text-xs text-ink dark:text-cream flex items-center gap-1.5 min-w-0">
                {flag ? (
                  <span aria-hidden="true" className="text-sm leading-none shrink-0">
                    {flag}
                  </span>
                ) : (
                  <Globe size={13} strokeWidth={1.5} className="text-ink-400 dark:text-ink-300 shrink-0" />
                )}
                <span className="truncate">{countryName(c.country)}</span>
              </span>
              <span className="font-jakarta text-xs font-semibold tabular-nums text-ink-400 dark:text-ink-300 shrink-0">
                {c.visitors.toLocaleString()} · {pct}%
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
              <div className="h-full rounded-full bg-sepia/70" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * The interactive half of Website Analytics — everything below the date
 * range picker. Receives the default-range snapshot already fetched
 * server-side (WebsiteAnalytics.tsx) so first paint needs no client fetch;
 * switching ranges after that calls /api/analytics and swaps the snapshot in.
 *
 * `days` (the range the *displayed* snapshot is scoped to) only updates once
 * a fetch succeeds — `pendingDays` tracks which button is mid-request so the
 * active pill never claims a range before its data has actually arrived, and
 * a failed fetch leaves the last good snapshot on screen instead of a broken
 * or empty one.
 */
export function WebsiteAnalyticsPanel({
  initialSnapshot,
  initialDays,
}: {
  initialSnapshot: AnalyticsSnapshot;
  initialDays: AnalyticsRangeDays;
}) {
  const [days, setDays] = useState<AnalyticsRangeDays>(initialDays);
  const [snapshot, setSnapshot] = useState<AnalyticsSnapshot>(initialSnapshot);
  const [pendingDays, setPendingDays] = useState<AnalyticsRangeDays | null>(null);

  async function handleRangeChange(nextDays: AnalyticsRangeDays) {
    if (nextDays === days || pendingDays !== null) return;
    setPendingDays(nextDays);
    try {
      const res = await fetch(`/api/analytics?days=${nextDays}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Request failed");
      const data: AnalyticsSnapshot = await res.json();
      setSnapshot(data);
      setDays(nextDays);
    } catch {
      toast.error("Couldn't refresh analytics — showing the last loaded data.");
    } finally {
      setPendingDays(null);
    }
  }

  const { totals, daily, topPages, topReferrers, devices, countries } = snapshot;

  const pagesPerVisit =
    totals && totals.visitors > 0 ? (totals.pageviews / totals.visitors).toFixed(1) : null;

  const stats = [
    {
      label: "Visitors",
      value: totals ? totals.visitors.toLocaleString() : "—",
      icon: Users,
      color: "sepia",
    },
    {
      label: "Page Views",
      value: totals ? totals.pageviews.toLocaleString() : "—",
      icon: Eye,
      color: "indigo",
    },
    {
      label: "Pages / Visit",
      value: pagesPerVisit ?? "—",
      icon: Globe,
      color: "blue",
    },
  ];

  return (
    <div className="p-5 sm:p-6 space-y-6 sm:space-y-8">
      {/* Date range filter */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-body text-xs text-ink-400 dark:text-ink-300">
          Storefront visitor stats, powered by Vercel Web Analytics.
        </p>
        <div
          role="tablist"
          aria-label="Date range"
          className="inline-flex gap-1 p-1 rounded-xl admin-input border"
        >
          {ANALYTICS_RANGE_OPTIONS.map((range) => (
            <button
              key={range.days}
              type="button"
              role="tab"
              aria-selected={days === range.days}
              disabled={pendingDays !== null}
              onClick={() => handleRangeChange(range.days)}
              className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg font-jakarta text-[11px] sm:text-xs font-medium transition-all disabled:cursor-not-allowed ${
                days === range.days
                  ? "bg-white dark:bg-[#1A1A1A] text-ink dark:text-cream shadow-sm"
                  : "text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream"
              }`}
            >
              {pendingDays === range.days && (
                <Loader2 size={11} className="animate-spin" strokeWidth={2} />
              )}
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stat row — same badge/number/label pattern as the top 4-stat grid */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="border border-black/10 dark:border-white/10 rounded-xl p-3 sm:p-4"
          >
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center ${STAT_ACCENTS[stat.color]}`}
            >
              <stat.icon size={16} strokeWidth={1.5} />
            </div>
            <p className="font-jakarta text-lg sm:text-2xl font-semibold tracking-tight text-ink dark:text-cream mt-2 sm:mt-3 truncate">
              {stat.value}
            </p>
            <p className="font-body text-[10px] sm:text-xs text-ink-400 dark:text-ink-300 uppercase tracking-widest mt-1">
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      {/* Visits over time */}
      <div>
        <WidgetLabel>Visits Over Time</WidgetLabel>
        {daily.length === 0 ? <EmptyState /> : <VisitsAreaChart data={daily} />}
      </div>

      {/* Top Pages + Traffic Sources */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
        <div>
          <WidgetLabel>Top Pages</WidgetLabel>
          {topPages.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="divide-y divide-black/5 dark:divide-white/5 border border-black/10 dark:border-white/10 rounded-xl overflow-hidden">
              {topPages.map((page) => (
                <div
                  key={page.route}
                  className="flex items-center justify-between px-3 sm:px-4 py-2.5"
                >
                  <span className="font-body text-sm text-ink dark:text-cream truncate">
                    {page.route}
                  </span>
                  <span className="font-jakarta text-xs font-semibold tabular-nums text-ink-400 dark:text-ink-300 shrink-0 ml-3">
                    {page.pageviews.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <WidgetLabel>Traffic Sources</WidgetLabel>
          {topReferrers.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="divide-y divide-black/5 dark:divide-white/5 border border-black/10 dark:border-white/10 rounded-xl overflow-hidden">
              {topReferrers.map((ref) => (
                <div
                  key={ref.referrerHostname || "direct"}
                  className="flex items-center justify-between px-3 sm:px-4 py-2.5"
                >
                  <span className="font-body text-sm text-ink dark:text-cream truncate">
                    {ref.referrerHostname || "Direct"}
                  </span>
                  <span className="font-jakarta text-xs font-semibold tabular-nums text-ink-400 dark:text-ink-300 shrink-0 ml-3">
                    {ref.pageviews.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Devices + Countries — the two "who is visiting" breakdowns, paired so
          they read as one answer rather than two unrelated strips. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
        <div>
          <WidgetLabel>Devices</WidgetLabel>
          {devices.length === 0 ? <EmptyState /> : <DeviceBars devices={devices} />}
        </div>
        <div>
          <WidgetLabel>Countries</WidgetLabel>
          {countries.length === 0 ? <EmptyState /> : <CountryBars countries={countries} />}
        </div>
      </div>
    </div>
  );
}
