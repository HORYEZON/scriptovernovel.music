// lib/system-health.ts
//
// Server-only infrastructure snapshot behind Dashboard ▸ System Health —
// what Vercel, Supabase Postgres and Cloudflare R2 are doing underneath the app, plus what the app
// can measure about itself.
//
// It reuses the credentials that already exist (VERCEL_ANALYTICS_TOKEN /
// VERCEL_PROJECT_ID for Vercel, R2_ACCOUNT_ID / R2_ACCESS_KEY_ID /
// R2_SECRET_ACCESS_KEY / R2_BUCKET for Storage, DATABASE_URL for Postgres) rather
// than asking for new ones. That has a consequence worth stating plainly:
// VERCEL_ANALYTICS_TOKEN was minted for the Web Analytics endpoints, and
// depending on its scope the deployments/project endpoints below may come
// back 403. That is not an error condition here — every section reports its
// own `status`, and the panel renders "not available" for the ones that
// couldn't be read while still showing the ones that could.
//
// Same contract as lib/vercel-analytics.ts, which this sits beside:
//   • Safe to call unconfigured — returns a snapshot full of "unconfigured"
//     sections, never throws.
//   • Every network call is try/caught and bounded by a timeout; a hanging
//     upstream must not hold the dashboard open.
//   • Cached briefly. This is a health *dashboard*, not a pager: a 60-second
//     window is fresh enough to be useful and stops a tab switch from
//     hammering three upstream APIs.

import { prisma } from "@/lib/prisma";

const VERCEL_API = "https://api.vercel.com";
const REVALIDATE_SECONDS = 60;
const UPSTREAM_TIMEOUT_MS = 6000;

/**
 * Why a section has no data, distinguished so the panel can say something
 * useful instead of a generic dash:
 *  - "ok"           — read successfully.
 *  - "unconfigured" — the env vars for it aren't set. Actionable: set them.
 *  - "unauthorized" — configured, but the token lacks scope for this
 *                     endpoint (the expected outcome for the analytics-scoped
 *                     Vercel token on deployment endpoints). Actionable: mint
 *                     a broader token.
 *  - "error"        — reachable but failed, or timed out. Not actionable;
 *                     probably transient.
 */
export type HealthStatus = "ok" | "unconfigured" | "unauthorized" | "error";

export interface DeploymentInfo {
  id: string;
  /** "READY" | "ERROR" | "BUILDING" | "QUEUED" | "CANCELED" — Vercel's own. */
  state: string;
  /** "production" | "preview". */
  target: string | null;
  url: string | null;
  createdAt: string;
  /** Build duration in ms, when the deployment has finished. */
  durationMs: number | null;
  commitMessage: string | null;
  creator: string | null;
}

export interface VercelHealth {
  status: HealthStatus;
  projectName: string | null;
  framework: string | null;
  /** Most recent production deployment that reached READY. */
  currentProduction: DeploymentInfo | null;
  /** Newest deployments across all targets, newest first. */
  recent: DeploymentInfo[];
  /** Of `recent`, how many are in a failed state — the panel's red number. */
  failedCount: number;
}

export interface TableSize {
  table: string;
  rows: number;
  /** Total size on disk including indexes, in bytes. */
  bytes: number;
}

export interface DatabaseHealth {
  status: HealthStatus;
  /** Round-trip time of a trivial `SELECT 1`, in ms — the honest measure of
   *  how far away the database is from the running instance. */
  latencyMs: number | null;
  /** Postgres server version string, trimmed to the version number. */
  version: string | null;
  /** Total size of the connected database, in bytes. */
  totalBytes: number | null;
  /** Currently open backend connections, and the server's max_connections. */
  connections: { active: number; max: number } | null;
  /** The heaviest tables, largest first — where the space is actually going. */
  largestTables: TableSize[];
}

export interface StorageHealth {
  status: HealthStatus;
  buckets: { name: string; public: boolean; createdAt: string | null }[];
  /** Objects and total bytes in the app's own bucket. Null when the listing
   *  couldn't be completed — see the note in getStorageHealth on why this is
   *  capped rather than exhaustive. */
  objectCount: number | null;
  totalBytes: number | null;
  /** True when objectCount/totalBytes are a floor rather than the real total
   *  because the listing hit its page cap. */
  truncated: boolean;
}

export interface AppHealth {
  /** Vercel's own deployment metadata, present in any Vercel runtime. */
  environment: string | null;
  region: string | null;
  commitSha: string | null;
  branch: string | null;
  nodeVersion: string;
  /** Process uptime in seconds — resets on every cold start, so a small
   *  number here is normal on serverless, not a crash. */
  uptimeSeconds: number;
  /** Resident heap in bytes, for spotting a leak across refreshes. */
  heapUsedBytes: number;
}

export interface SystemHealthSnapshot {
  vercel: VercelHealth;
  database: DatabaseHealth;
  storage: StorageHealth;
  app: AppHealth;
  /** When this snapshot was taken, ISO. */
  capturedAt: string;
}

export function isVercelConfigured(): boolean {
  return Boolean(process.env.VERCEL_ANALYTICS_TOKEN && process.env.VERCEL_PROJECT_ID);
}

export function isStorageConfigured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET
  );
}

/** GET against the Vercel REST API. Distinguishes 401/403 from other
 *  failures so the caller can report "token lacks scope" rather than a
 *  generic error — the single most likely outcome here (see header). */
async function vercelGet<T>(
  path: string
): Promise<{ status: HealthStatus; data: T | null }> {
  if (!isVercelConfigured()) return { status: "unconfigured", data: null };

  const token = process.env.VERCEL_ANALYTICS_TOKEN as string;
  const teamId = process.env.VERCEL_TEAM_ID;
  const url = new URL(`${VERCEL_API}${path}`);
  if (teamId) url.searchParams.set("teamId", teamId);

  try {
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    if (res.status === 401 || res.status === 403) return { status: "unauthorized", data: null };
    if (!res.ok) return { status: "error", data: null };
    return { status: "ok", data: (await res.json()) as T };
  } catch {
    return { status: "error", data: null };
  }
}

interface RawDeployment {
  uid?: string;
  id?: string;
  state?: string;
  readyState?: string;
  target?: string | null;
  url?: string;
  created?: number;
  createdAt?: number;
  ready?: number;
  buildingAt?: number;
  meta?: Record<string, string>;
  creator?: { username?: string; email?: string };
}

function toDeployment(raw: RawDeployment): DeploymentInfo {
  const created = raw.createdAt ?? raw.created ?? Date.now();
  // Vercel reports build start and ready as separate epoch stamps; the
  // difference is the only "how long did it take" it exposes. Both are
  // absent while a deployment is still queued, hence the null.
  const durationMs =
    raw.ready && raw.buildingAt ? Math.max(0, raw.ready - raw.buildingAt) : null;
  return {
    id: raw.uid ?? raw.id ?? "",
    state: raw.readyState ?? raw.state ?? "UNKNOWN",
    target: raw.target ?? null,
    url: raw.url ? `https://${raw.url}` : null,
    createdAt: new Date(created).toISOString(),
    durationMs,
    commitMessage: raw.meta?.githubCommitMessage ?? null,
    creator: raw.creator?.username ?? raw.creator?.email ?? null,
  };
}

/** Deployment history and project metadata. */
export async function getVercelHealth(limit = 8): Promise<VercelHealth> {
  const empty: VercelHealth = {
    status: "unconfigured",
    projectName: null,
    framework: null,
    currentProduction: null,
    recent: [],
    failedCount: 0,
  };
  if (!isVercelConfigured()) return empty;

  const projectId = process.env.VERCEL_PROJECT_ID as string;

  // Both calls go out together — they're independent, and the project fetch
  // shouldn't add its latency on top of the deployments fetch.
  const [project, deployments] = await Promise.all([
    vercelGet<{ name?: string; framework?: string | null }>(`/v9/projects/${projectId}`),
    vercelGet<{ deployments?: RawDeployment[] }>(
      `/v6/deployments?projectId=${encodeURIComponent(projectId)}&limit=${limit}`
    ),
  ]);

  const recent = (deployments.data?.deployments ?? []).map(toDeployment);

  return {
    // The deployments list is the section's real payload, so its status is
    // the section's status; a readable project name is a bonus.
    status: deployments.status === "ok" ? "ok" : deployments.status,
    projectName: project.data?.name ?? null,
    framework: project.data?.framework ?? null,
    currentProduction:
      recent.find((d) => d.target === "production" && d.state === "READY") ?? null,
    recent,
    failedCount: recent.filter((d) => d.state === "ERROR" || d.state === "CANCELED").length,
  };
}

/**
 * Postgres health, measured from inside the app via the connection it
 * already has — no management API and no extra credential.
 *
 * The table sizes come from pg_catalog rather than counting rows, which
 * matters: `SELECT count(*)` on every table would be a full scan of the whole
 * database every time an admin opens this tab. `reltuples` is the planner's
 * estimate, refreshed by autovacuum — approximate by design, and clearly
 * labelled as such in the panel.
 */
export async function getDatabaseHealth(): Promise<DatabaseHealth> {
  const empty: DatabaseHealth = {
    status: "error",
    latencyMs: null,
    version: null,
    totalBytes: null,
    connections: null,
    largestTables: [],
  };

  try {
    const startedAt = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const latencyMs = Date.now() - startedAt;

    const [versionRow, sizeRow, connRow, tables] = await Promise.all([
      prisma.$queryRaw<{ version: string }[]>`SELECT version() AS version`,
      prisma.$queryRaw<{ bytes: bigint }[]>`
        SELECT pg_database_size(current_database()) AS bytes`,
      prisma.$queryRaw<{ active: bigint; max: string }[]>`
        SELECT
          (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database()) AS active,
          current_setting('max_connections') AS max`,
      prisma.$queryRaw<{ table: string; rows: number; bytes: bigint }[]>`
        SELECT
          c.relname AS "table",
          c.reltuples::bigint AS rows,
          pg_total_relation_size(c.oid) AS bytes
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind = 'r' AND n.nspname = 'public'
        ORDER BY pg_total_relation_size(c.oid) DESC
        LIMIT 10`,
    ]);

    // Postgres reports version() as a full banner ("PostgreSQL 15.1 on
    // x86_64-pc-linux-gnu, compiled by …"); only the first two words are
    // information anyone reads off a dashboard.
    const banner = versionRow[0]?.version ?? "";
    const version = banner.split(" ").slice(0, 2).join(" ") || null;

    return {
      status: "ok",
      latencyMs,
      version,
      totalBytes: sizeRow[0] ? Number(sizeRow[0].bytes) : null,
      connections: connRow[0]
        ? { active: Number(connRow[0].active), max: Number(connRow[0].max) }
        : null,
      largestTables: tables.map((t) => ({
        table: t.table,
        rows: Number(t.rows),
        bytes: Number(t.bytes),
      })),
    };
  } catch (error) {
    console.error("[system-health] database probe failed", error);
    return empty;
  }
}

/**
 * Cloudflare R2 usage for the app's own bucket, via the S3 credentials
 * that already upload to it.
 *
 * R2 has no "how big is this bucket" endpoint — the only way to a total
 * is to list objects and add up their sizes. That is unbounded work for an
 * unbounded bucket, so this walks at most STORAGE_PAGE_CAP pages and reports
 * `truncated: true` if it runs out. A floor with an honest "at least" beats
 * either a wrong number or a dashboard that takes 30 seconds to load.
 */
const STORAGE_PAGE_SIZE = 1000;
const STORAGE_PAGE_CAP = 5;

export async function getStorageHealth(): Promise<StorageHealth> {
  const empty: StorageHealth = {
    status: "unconfigured",
    buckets: [],
    objectCount: null,
    totalBytes: null,
    truncated: false,
  };
  if (!isStorageConfigured()) return empty;

  try {
    // Imported lazily so an unconfigured deployment never pays for the AWS
    // SDK, and so this file stays importable at build time.
    const { listObjects, bucket } = await import("@/lib/storage/r2");

    // R2's listing is a flat prefix walk, so one call from the root sees the
    // whole tree — no per-folder loop the way Supabase's list() needed.
    // Capped so a bucket that has grown past what a health card should be
    // paging through reports "truncated" instead of stalling the dashboard.
    const { objects, truncated } = await listObjects("", STORAGE_PAGE_SIZE * STORAGE_PAGE_CAP);

    let totalBytes = 0;
    for (const o of objects) totalBytes += o.size;

    return {
      status: "ok",
      // One bucket by construction; the token is scoped to it, so there is
      // no account-level listing to enumerate others from.
      buckets: [{ name: bucket(), public: Boolean(process.env.R2_PUBLIC_URL), createdAt: null }],
      objectCount: objects.length,
      totalBytes,
      truncated,
    };
  } catch (error) {
    console.error("[system-health] storage probe failed", error);
    return { ...empty, status: "error" };
  }
}

/** What the running instance knows about itself. Synchronous — all of this
 *  is process state, no I/O. */
export function getAppHealth(): AppHealth {
  const memory = process.memoryUsage();
  return {
    environment: process.env.VERCEL_ENV ?? (process.env.NODE_ENV || null),
    region: process.env.VERCEL_REGION ?? null,
    commitSha: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
    nodeVersion: process.version,
    uptimeSeconds: Math.round(process.uptime()),
    heapUsedBytes: memory.heapUsed,
  };
}

/** Everything, in parallel. Each section already absorbs its own failures,
 *  so this always resolves to a complete snapshot. */
export async function getSystemHealthSnapshot(): Promise<SystemHealthSnapshot> {
  const [vercel, database, storage] = await Promise.all([
    getVercelHealth(),
    getDatabaseHealth(),
    getStorageHealth(),
  ]);
  return { vercel, database, storage, app: getAppHealth(), capturedAt: new Date().toISOString() };
}

// Byte formatting for this tab's sizes lives in lib/utils.ts (formatBytes) —
// the panel that renders them is a client component and can't import this
// module, which pulls in prisma. See that function's own comment.
