// app/(admin)/admin/dashboard/DashboardTabs.tsx
"use client";

import { useState } from "react";
import { LayoutGrid, BarChart3, ScrollText, HeartPulse } from "lucide-react";

type TabId = "overview" | "analytics" | "activity" | "health";

const TABS: { id: TabId; label: string; icon: typeof LayoutGrid }[] = [
  { id: "overview", label: "Overview", icon: LayoutGrid },
  { id: "analytics", label: "Website Analytics", icon: BarChart3 },
  { id: "activity", label: "Activity Log", icon: ScrollText },
  { id: "health", label: "System Health", icon: HeartPulse },
];

/**
 * Splits the dashboard into four tabs — Overview (stats/orders/quick
 * actions), Website Analytics, Activity Log (the audit trail) and System
 * Health (Vercel/Supabase/instance observability) — same segmented-control
 * pattern as announcement/AnnouncementTabs.tsx. Every panel is handed down
 * already rendered from the parent Server Component (dashboard/page.tsx),
 * analytics and health each wrapped in their own <Suspense>, so switching
 * tabs is just a visibility toggle — never a refetch — and a slow upstream
 * call still can't block the Overview tab's initial paint.
 *
 * All panels stay mounted the whole time (toggled via the `hidden` attribute,
 * not a conditional/ternary render) specifically so their internal state
 * survives a tab switch: WebsiteAnalyticsPanel's date range, ActivityLogPanel's
 * filters and loaded pages, SystemHealthPanel's refreshed snapshot. Unmounting
 * on every switch would silently reset an admin's "7D"/"90D" pick back to the
 * 30-day default, and throw away a Load-more'd log they had scrolled into.
 *
 * The flip side is that four panels' worth of markup is in the DOM at once.
 * That's fine here — these are text and small charts, not 3D scenes — and it
 * is the same trade the tab row already made for two.
 */
export function DashboardTabs({
  overview,
  analytics,
  activity,
  health,
}: {
  overview: React.ReactNode;
  analytics: React.ReactNode;
  activity: React.ReactNode;
  health: React.ReactNode;
}) {
  const [tab, setTab] = useState<TabId>("overview");

  return (
    <div>
      <div
        role="tablist"
        aria-label="Dashboard view"
        /* Scrollable on mobile now that there are four tabs — at 375px the
           row no longer fits, and shrinking each button would truncate
           "Website Analytics" and "System Health" into ambiguity. */
        className="flex gap-1 p-1 rounded-2xl admin-input border w-full sm:w-auto sm:inline-flex mb-6 sm:mb-8 overflow-x-auto no-scrollbar"
      >
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            /* shrink-0 rather than flex-1: the row scrolls on mobile now, and
               a growing/shrinking button in a scroll container squeezes the
               labels instead of letting them scroll. */
            className={`shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-jakarta text-sm font-medium transition-all whitespace-nowrap ${
              tab === id
                ? "bg-white dark:bg-[#1A1A1A] text-ink dark:text-cream shadow-sm"
                : "text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream"
            }`}
          >
            <Icon size={16} strokeWidth={1.5} />
            {label}
          </button>
        ))}
      </div>

      <div key="overview-panel" hidden={tab !== "overview"}>
        {overview}
      </div>
      <div key="analytics-panel" hidden={tab !== "analytics"}>
        {analytics}
      </div>
      <div key="activity-panel" hidden={tab !== "activity"}>
        {activity}
      </div>
      <div key="health-panel" hidden={tab !== "health"}>
        {health}
      </div>
    </div>
  );
}
