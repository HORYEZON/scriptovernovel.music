// components/admin/SystemHealthPanel.tsx
"use client";

// Dashboard ▸ System Health — what Vercel, Supabase Postgres, Cloudflare R2 and the running instance
// are doing underneath the app. Reads the snapshot assembled by
// lib/system-health.ts.
//
// Handed a server-rendered first snapshot (so the tab paints with real
// numbers rather than four spinners) and re-fetches from
// /api/admin/system-health on Refresh.
//
// The section that shapes this whole file: **each card reports its own
// status**. The credentials here are reused rather than purpose-minted (see
// lib/system-health.ts's header), so it is entirely expected that Vercel
// comes back "unauthorized" while the database and storage cards are fine.
// That must read as a configuration note next to three working cards, never
// as an outage — hence StatusNote below, and why no card is ever hidden just
// because its data didn't load.

import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Cloud,
  Database,
  HardDrive,
  Loader2,
  RefreshCw,
  Server,
  XCircle,
} from "lucide-react";
import toast from "@/lib/toast";
import { formatBytes } from "@/lib/utils";
import type {
  DeploymentInfo,
  HealthStatus,
  SystemHealthSnapshot,
} from "@/lib/system-health";

/** Vercel deployment states → the chip they get. Anything unrecognised falls
 *  through to the neutral style rather than being coloured as a guess. */
const DEPLOY_STATE_STYLES: Record<string, string> = {
  READY: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  ERROR: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  BUILDING: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  QUEUED: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  CANCELED: "bg-ink-400/10 text-ink-400 dark:text-ink-300",
};

function Card({
  icon: Icon,
  title,
  status,
  action,
  children,
}: {
  icon: typeof Database;
  title: string;
  status: HealthStatus;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="admin-card border rounded-2xl overflow-hidden backdrop-blur-md shadow-xl">
      <div className="px-4 sm:px-5 py-3.5 border-b border-black/5 dark:border-white/5 flex items-center justify-between gap-3">
        <h3 className="font-jakarta text-sm font-semibold text-ink dark:text-cream flex items-center gap-2">
          <Icon size={15} strokeWidth={1.5} className="text-sepia" />
          {title}
        </h3>
        <div className="flex items-center gap-2">
          {action}
          <StatusDot status={status} />
        </div>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  );
}

function StatusDot({ status }: { status: HealthStatus }) {
  const map = {
    ok: { Icon: CheckCircle2, className: "text-emerald-500", label: "Healthy" },
    unconfigured: { Icon: AlertTriangle, className: "text-ink-400 dark:text-ink-300", label: "Not configured" },
    unauthorized: { Icon: AlertTriangle, className: "text-amber-500", label: "Token lacks access" },
    error: { Icon: XCircle, className: "text-rose-500", label: "Unavailable" },
  } as const;
  const { Icon, className, label } = map[status];
  return (
    <span
      title={label}
      className={`inline-flex items-center gap-1.5 font-body text-[11px] ${className}`}
    >
      <Icon size={13} strokeWidth={1.75} />
      <span className="hidden sm:inline">{label}</span>
    </span>
  );
}

/** What a card shows *instead of* its data when it has none. Deliberately
 *  specific per reason — "not configured" is something the admin can act on,
 *  "unavailable" is something they should ignore and retry. */
function StatusNote({ status, hint }: { status: HealthStatus; hint?: string }) {
  if (status === "ok") return null;
  const text =
    status === "unconfigured"
      ? hint ?? "Not configured for this environment."
      : status === "unauthorized"
        ? "The configured token doesn't have access to this data."
        : "Couldn't reach this service — try refreshing in a moment.";
  return (
    <p className="font-body text-xs text-ink-400 dark:text-ink-300 italic">{text}</p>
  );
}

/** Label + value, the unit this whole tab is built from. */
function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <dt className="font-body text-[10px] uppercase tracking-widest text-ink-400 dark:text-ink-300">
        {label}
      </dt>
      <dd
        title={hint}
        className="font-jakarta text-sm font-semibold text-ink dark:text-cream tabular-nums mt-0.5"
      >
        {value}
      </dd>
    </div>
  );
}

/** A proportion bar — used for connection pool use and per-table share of
 *  total DB size. Turns amber past 70% and rose past 90%: the numbers that
 *  matter on this tab are the ones approaching a ceiling. */
function UsageBar({ ratio }: { ratio: number }) {
  const pct = Math.min(100, Math.max(0, ratio * 100));
  const color = pct >= 90 ? "bg-rose-500" : pct >= 70 ? "bg-amber-500" : "bg-sepia/70";
  return (
    <div className="h-1.5 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function DeploymentRow({ deployment }: { deployment: DeploymentInfo }) {
  const chip = DEPLOY_STATE_STYLES[deployment.state] ?? "bg-ink-400/10 text-ink-400 dark:text-ink-300";
  return (
    <li className="flex items-center gap-3 py-2 border-b border-black/5 dark:border-white/5 last:border-0">
      <span
        className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-jakarta font-semibold tracking-wide ${chip}`}
      >
        {deployment.state}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-body text-xs text-ink dark:text-cream truncate">
          {deployment.commitMessage || deployment.url || deployment.id}
        </p>
        <p className="font-body text-[10px] text-ink-400 dark:text-ink-300">
          {deployment.target ?? "preview"}
          {deployment.creator ? ` · ${deployment.creator}` : ""}
          {deployment.durationMs != null
            ? ` · built in ${Math.round(deployment.durationMs / 1000)}s`
            : ""}
        </p>
      </div>
      <time
        dateTime={deployment.createdAt}
        title={new Date(deployment.createdAt).toLocaleString("en-PH")}
        className="shrink-0 font-jakarta text-[10px] tabular-nums text-ink-400 dark:text-ink-300"
      >
        {new Date(deployment.createdAt).toLocaleDateString("en-PH", {
          day: "numeric",
          month: "short",
        })}
      </time>
    </li>
  );
}

export function SystemHealthPanel({
  initialSnapshot,
}: {
  initialSnapshot: SystemHealthSnapshot;
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const res = await fetch("/api/admin/system-health", { cache: "no-store" });
      if (!res.ok) throw new Error("Request failed");
      setSnapshot(await res.json());
    } catch {
      // The previous snapshot stays on screen — stale numbers with a visible
      // "as of" stamp beat blanking the tab out.
      toast.error("Couldn't refresh — showing the last successful read.");
    } finally {
      setRefreshing(false);
    }
  }

  const { vercel, database, storage, app, capturedAt } = snapshot;

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="font-body text-xs text-ink-400 dark:text-ink-300 inline-flex items-center gap-1.5">
          <Clock size={12} strokeWidth={1.5} />
          As of {new Date(capturedAt).toLocaleTimeString("en-PH")}
        </p>
        <button
          type="button"
          onClick={refresh}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl admin-input border font-jakarta text-xs font-medium text-ink dark:text-cream hover:text-sepia transition-colors disabled:opacity-50"
        >
          {refreshing ? (
            <Loader2 size={13} strokeWidth={1.5} className="animate-spin" />
          ) : (
            <RefreshCw size={13} strokeWidth={1.5} />
          )}
          Refresh
        </button>
      </div>

      {/* ── Database ─────────────────────────────────────────────────────── */}
      <Card icon={Database} title="Database (Supabase Postgres)" status={database.status}>
        {database.status !== "ok" ? (
          <StatusNote status={database.status} />
        ) : (
          <div className="space-y-5">
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Metric
                label="Latency"
                value={`${database.latencyMs} ms`}
                hint="Round-trip time of a trivial query from this instance."
              />
              <Metric label="Size" value={formatBytes(database.totalBytes)} />
              <Metric label="Version" value={database.version ?? "—"} />
              <Metric
                label="Connections"
                value={
                  database.connections
                    ? `${database.connections.active} / ${database.connections.max}`
                    : "—"
                }
              />
            </dl>

            {database.connections && (
              <UsageBar ratio={database.connections.active / (database.connections.max || 1)} />
            )}

            {database.largestTables.length > 0 && (
              <div>
                <h4 className="font-body text-[10px] uppercase tracking-widest text-ink-400 dark:text-ink-300 mb-2">
                  Largest tables
                </h4>
                <ul className="space-y-2">
                  {database.largestTables.map((t) => (
                    <li key={t.table}>
                      <div className="flex items-center justify-between gap-3 mb-1">
                        <span className="font-mono text-[11px] text-ink dark:text-cream truncate">
                          {t.table}
                        </span>
                        <span className="font-jakarta text-[11px] tabular-nums text-ink-400 dark:text-ink-300 shrink-0">
                          {formatBytes(t.bytes)}
                          {/* Row counts are the planner's estimate, not a
                              count(*) — see getDatabaseHealth's comment. */}
                          <span className="opacity-60"> · ~{t.rows.toLocaleString()} rows</span>
                        </span>
                      </div>
                      <UsageBar ratio={t.bytes / (database.largestTables[0]?.bytes || 1)} />
                    </li>
                  ))}
                </ul>
                <p className="font-body text-[10px] text-ink-400 dark:text-ink-300 mt-2 italic">
                  Row counts are Postgres&rsquo; own estimates, refreshed by autovacuum.
                </p>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* ── Vercel ───────────────────────────────────────────────────────── */}
      <Card
        icon={Cloud}
        title={`Hosting${vercel.projectName ? ` · ${vercel.projectName}` : " (Vercel)"}`}
        status={vercel.status}
      >
        {vercel.status !== "ok" ? (
          <StatusNote
            status={vercel.status}
            hint="Set VERCEL_ANALYTICS_TOKEN and VERCEL_PROJECT_ID to see deployments here."
          />
        ) : (
          <div className="space-y-5">
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Metric label="Framework" value={vercel.framework ?? "—"} />
              <Metric
                label="Production"
                value={vercel.currentProduction?.state ?? "—"}
              />
              <Metric
                label="Last deploy"
                value={
                  vercel.recent[0]
                    ? new Date(vercel.recent[0].createdAt).toLocaleDateString("en-PH", {
                        day: "numeric",
                        month: "short",
                      })
                    : "—"
                }
              />
              <Metric
                label="Failed"
                value={
                  <span className={vercel.failedCount > 0 ? "text-rose-500" : undefined}>
                    {vercel.failedCount}
                  </span>
                }
                hint="Errored or cancelled deployments among those listed below."
              />
            </dl>

            {vercel.recent.length > 0 && (
              <div>
                <h4 className="font-body text-[10px] uppercase tracking-widest text-ink-400 dark:text-ink-300 mb-1">
                  Recent deployments
                </h4>
                <ul>
                  {vercel.recent.map((d) => (
                    <DeploymentRow key={d.id} deployment={d} />
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* ── Storage ──────────────────────────────────────────────────────── */}
      <Card icon={HardDrive} title="Storage (Cloudflare R2)" status={storage.status}>
        {storage.status !== "ok" ? (
          <StatusNote
            status={storage.status}
            hint="Set the R2_* variables (see .env.example) to see bucket usage."
          />
        ) : (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Metric
                label="Objects"
                value={`${storage.truncated ? "≥ " : ""}${(storage.objectCount ?? 0).toLocaleString()}`}
              />
              <Metric
                label="Used"
                value={`${storage.truncated ? "≥ " : ""}${formatBytes(storage.totalBytes)}`}
              />
              <Metric label="Buckets" value={storage.buckets.length} />
            </dl>
            {storage.truncated && (
              <p className="font-body text-[10px] text-ink-400 dark:text-ink-300 italic">
                Listing hit its page cap — the real totals are at least these.
              </p>
            )}
            {storage.buckets.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {storage.buckets.map((b) => (
                  <span
                    key={b.name}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg admin-input border font-mono text-[10px] text-ink dark:text-cream"
                  >
                    {b.name}
                    <span
                      className={`text-[9px] font-jakarta font-semibold uppercase ${
                        b.public ? "text-amber-500" : "text-emerald-500"
                      }`}
                    >
                      {b.public ? "public" : "private"}
                    </span>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* ── This instance ────────────────────────────────────────────────── */}
      <Card icon={Server} title="Running instance" status="ok">
        <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <Metric label="Environment" value={app.environment ?? "—"} />
          <Metric label="Region" value={app.region ?? "local"} />
          <Metric label="Branch" value={app.branch ?? "—"} />
          <Metric label="Commit" value={app.commitSha ? <code>{app.commitSha}</code> : "—"} />
          <Metric label="Node" value={app.nodeVersion} />
          <Metric
            label="Heap"
            value={formatBytes(app.heapUsedBytes)}
            hint={`Up ${app.uptimeSeconds}s — resets on every cold start.`}
          />
        </dl>
        <p className="font-body text-[10px] text-ink-400 dark:text-ink-300 mt-4 italic inline-flex items-center gap-1.5">
          <Activity size={11} strokeWidth={1.5} />
          Serverless: these describe whichever instance answered this request, not the fleet.
        </p>
      </Card>
    </div>
  );
}
