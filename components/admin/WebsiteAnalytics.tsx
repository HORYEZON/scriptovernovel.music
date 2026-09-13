// components/admin/WebsiteAnalytics.tsx
//
// Async Server Component — fetches the default-range snapshot from the
// Vercel Web Analytics API (lib/vercel-analytics.ts) and hands it to
// WebsiteAnalyticsPanel.tsx (client), which owns the date-range filter and
// re-fetches from /api/analytics when an admin picks a different range.
// Card chrome (white/bg-black/40, border-black/10/white/10, backdrop-blur-md)
// matches the rest of app/(admin)/admin/dashboard/page.tsx.
//
// Meant to be rendered inside a <Suspense> boundary from the dashboard page
// so a slow/unreachable analytics API never blocks the artwork/product/order
// counts above it from painting.
import Link from "next/link";
import { Globe, ExternalLink } from "lucide-react";
import {
  isAnalyticsConfigured,
  getAnalyticsSnapshot,
  DEFAULT_ANALYTICS_RANGE_DAYS,
} from "@/lib/vercel-analytics";
import { WebsiteAnalyticsPanel } from "./WebsiteAnalyticsPanel";

function SectionShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-card border rounded-2xl overflow-hidden backdrop-blur-md shadow-xl">
      {children}
    </div>
  );
}

/** Skeleton fallback for <Suspense> — mirrors the real panel's shape,
 *  including the date-range pill row so the layout doesn't jump on load. */
export function WebsiteAnalyticsSkeleton() {
  return (
    <SectionShell>
      <div className="p-5 sm:p-6 space-y-6 sm:space-y-8 animate-pulse">
        <div className="flex items-center justify-between gap-3">
          <div className="h-3 w-48 rounded bg-black/5 dark:bg-white/5" />
          <div className="h-8 w-40 rounded-xl admin-input border" />
        </div>
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-20 sm:h-24 rounded-xl admin-input border"
            />
          ))}
        </div>
        <div className="h-40 sm:h-48 rounded-xl admin-input border" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
          <div className="h-32 rounded-xl admin-input border" />
          <div className="h-32 rounded-xl admin-input border" />
        </div>
      </div>
    </SectionShell>
  );
}

/** Rendered when VERCEL_ANALYTICS_TOKEN/VERCEL_PROJECT_ID aren't set — one
 *  small note instead of five widgets with nothing to show. */
function NotConfiguredNotice() {
  return (
    <div className="p-8 sm:p-10 text-center">
      <Globe
        className="w-8 h-8 text-ink-400 dark:text-ink-300 mx-auto mb-3 opacity-50"
        strokeWidth={1.5}
      />
      <p className="font-body text-sm text-ink-400 dark:text-ink-300">
        Connect Vercel Analytics to see visitor stats here.
      </p>
      <Link
        href="https://vercel.com/docs/analytics"
        target="_blank"
        rel="noopener noreferrer"
        className="font-body text-xs text-sepia hover:underline inline-flex items-center gap-1 mt-2 transition-colors"
      >
        View setup docs <ExternalLink size={12} strokeWidth={1.5} />
      </Link>
    </div>
  );
}

export async function WebsiteAnalytics() {
  if (!isAnalyticsConfigured()) {
    return (
      <SectionShell>
        <NotConfiguredNotice />
      </SectionShell>
    );
  }

  const snapshot = await getAnalyticsSnapshot(DEFAULT_ANALYTICS_RANGE_DAYS);

  return (
    <SectionShell>
      <WebsiteAnalyticsPanel initialSnapshot={snapshot} initialDays={DEFAULT_ANALYTICS_RANGE_DAYS} />
    </SectionShell>
  );
}
