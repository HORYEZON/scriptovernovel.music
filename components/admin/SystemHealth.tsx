// components/admin/SystemHealth.tsx
//
// Async Server Component — takes the infrastructure snapshot
// (lib/system-health.ts) and hands it to SystemHealthPanel.tsx (client),
// which owns the Refresh button and re-reads from /api/admin/system-health.
//
// Exactly the WebsiteAnalytics.tsx split, for the same reason: the fetch
// needs server-side credentials (the Vercel token, the Supabase service-role
// key, the DB connection) that must never reach the browser, while the
// interactivity needs to be a client component.
//
// Meant to be rendered inside a <Suspense> boundary from the dashboard page —
// this one probes three upstreams, so it is the slowest thing on that page
// and must never be on the critical path of the Overview tab's first paint.

import { getSystemHealthSnapshot } from "@/lib/system-health";
import { SystemHealthPanel } from "./SystemHealthPanel";

/** Skeleton fallback for <Suspense> — mirrors the four stacked cards so the
 *  tab doesn't jump when the real snapshot lands. */
export function SystemHealthSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-5 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-3 w-32 rounded bg-black/5 dark:bg-white/5" />
        <div className="h-7 w-24 rounded-xl admin-input border" />
      </div>
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="admin-card border rounded-2xl backdrop-blur-md shadow-xl h-44 sm:h-52"
        />
      ))}
    </div>
  );
}

export async function SystemHealth() {
  // No "is it configured" short-circuit, unlike WebsiteAnalytics: this
  // snapshot is never entirely empty. The database and running-instance cards
  // work with zero extra configuration, and each remaining card reports its
  // own unconfigured/unauthorized state — so the panel always has something
  // real to show. See lib/system-health.ts's header.
  const snapshot = await getSystemHealthSnapshot();
  return <SystemHealthPanel initialSnapshot={snapshot} />;
}
