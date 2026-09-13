// lib/activity-log-server.ts
//
// The write side of the audit trail (Dashboard ▸ Activity Log). Server-only —
// it imports prisma; the labels, categories and retention windows the admin
// panel also needs live in the client-safe lib/activity-log.ts next to it.
//
// The one rule this module exists to enforce: **logging must never break the
// thing it is logging**. A failed audit write is a lost row, not a failed
// order. So every export here swallows its own errors (console.error and
// carry on), and `logActivity` is deliberately awaitable-but-ignorable —
// call sites do `void logActivity(...)` and move on rather than adding a
// round-trip to the DB in front of the response they owe the user.
//
// The corollary is that a row is best-effort, and the panel says so. If
// Postgres is down you lose trail entries; you do not lose checkout.

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_RETENTION_DAYS,
  type ActivityActorType,
  type ActivityCategory,
} from "@/lib/activity-log";

/** Everything a call site can say about an event. Only `category`, `action`
 *  and `summary` are required — the rest is filled in from the request when
 *  it can be and left null when it can't. */
export interface LogActivityInput {
  category: ActivityCategory;
  /** Dotted verb, e.g. "artwork.updated". See ACTIVITY_ACTIONS. */
  action: string;
  /** The human sentence shown in the panel, composed now rather than rebuilt
   *  at read time — see the schema comment on ActivityLog.summary. */
  summary: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  /**
   * Who did it. Omit entirely and the signed-in admin is looked up from the
   * session — which is what almost every admin route wants. Pass an explicit
   * actor for the cases where the session either doesn't exist yet or isn't
   * the answer: a failed login (no session, but we know the attempted email),
   * an anonymous visitor, a cron job.
   */
  actor?: {
    id?: string | null;
    label?: string | null;
    email?: string | null;
    type: ActivityActorType;
  };
  /**
   * Skip the session lookup and record no actor at all. For hot public paths
   * where `auth()` would be a pointless round-trip on every call — a museum
   * room entry has no signed-in user by definition.
   */
  anonymous?: boolean;
  /**
   * The originating request, when the caller has one in hand. Used only for
   * IP/user-agent; when omitted they're read from next/headers() instead,
   * which works inside route handlers and server actions but not in a
   * background job (where both correctly end up null).
   */
  request?: Request | null;
}

/** IP + user agent, best-effort and never throwing. Falls back to
 *  next/headers() so a call site that didn't thread its Request through
 *  still gets context inside a route handler. */
async function requestContext(
  request?: Request | null
): Promise<{ ipAddress: string | null; userAgent: string | null }> {
  try {
    const source = request
      ? request.headers
      : await headers();
    const forwarded = source.get("x-forwarded-for");
    const ip = forwarded
      ? forwarded.split(",")[0].trim()
      : source.get("x-real-ip")?.trim() || null;
    return {
      ipAddress: ip,
      // Truncated: a user-agent string is unbounded input we store verbatim,
      // and nothing past ~350 chars has ever identified a browser.
      userAgent: source.get("user-agent")?.slice(0, 350) || null,
    };
  } catch {
    // headers() throws outside a request scope — that's a background job, and
    // "no request context" is the honest answer, not an error.
    return { ipAddress: null, userAgent: null };
  }
}

/**
 * The signed-in admin, or null. Never throws — an auth() failure during
 * logging must not surface as a failure of the logged action.
 *
 * `auth` is imported dynamically, not at the top of the file, to break a real
 * import cycle: lib/auth.ts logs its own sign-in events through this module,
 * so a static `import { auth } from "@/lib/auth"` here would have each module
 * needing the other to have finished evaluating first — which, for NextAuth's
 * `export const { auth } = NextAuth(...)`, resolves to `undefined` rather than
 * a function. The dynamic import defers that resolution to call time, by
 * which point both modules are fully initialised.
 */
async function sessionActor(): Promise<LogActivityInput["actor"] | null> {
  try {
    const { auth } = await import("@/lib/auth");
    const session = await auth();
    const user = session?.user;
    if (!user?.id) return null;
    return {
      id: user.id,
      label: user.name || user.email || "Admin",
      email: user.email ?? null,
      type: (user as { role?: string }).role === "ADMIN" ? "admin" : "visitor",
    };
  } catch {
    return null;
  }
}

/**
 * Record one event.
 *
 * Fire-and-forget: call it as `void logActivity({...})` from a route handler
 * so the response isn't waiting on an audit insert. Awaiting it is fine too
 * (tests, or a place that genuinely wants the row committed first) — it
 * resolves either way and never rejects.
 */
export async function logActivity(input: LogActivityInput): Promise<void> {
  try {
    const actor = input.actor ?? (input.anonymous ? null : await sessionActor());
    const { ipAddress, userAgent } = await requestContext(input.request);

    await prisma.activityLog.create({
      data: {
        category: input.category,
        action: input.action,
        // Bounded for the same reason as userAgent — a summary that quotes a
        // user-supplied title is user-supplied input.
        summary: input.summary.slice(0, 500),
        actorId: actor?.id ?? null,
        actorLabel: actor?.label ?? null,
        actorEmail: actor?.email ?? null,
        actorType: actor?.type ?? "system",
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        metadata: (input.metadata ?? undefined) as never,
        ipAddress,
        userAgent,
      },
    });
  } catch (error) {
    // Intentionally terminal: see this module's header. A lost trail row is
    // strictly better than a failed request.
    console.error("[activity-log] failed to record", input.action, error);
  }
}

/**
 * The shorthand for the overwhelmingly common case: an admin created,
 * updated or deleted one record.
 *
 * Exists because the alternative is thirty CRUD routes each hand-writing the
 * same four lines — and the summary sentence being composed slightly
 * differently in every one of them. Here the wording is generated from the
 * entity type and its display name, so the whole CONTENT category reads
 * consistently ("Updated artwork “Squid Dreams”") no matter which route wrote
 * the row.
 *
 * `changed` is the list of field names a PATCH actually touched — enough to
 * answer "what did they change?" without storing a full before/after copy of
 * every record in an unbounded log table.
 */
export function logContentChange(
  verb: "created" | "updated" | "deleted" | "restored",
  entityType: string,
  entity: { id: string; name?: string | null },
  options?: { request?: Request | null; changed?: string[]; metadata?: Record<string, unknown> }
): void {
  const readableType = entityType.replace(/-/g, " ");
  const past = verb.charAt(0).toUpperCase() + verb.slice(1);
  void logActivity({
    category: "CONTENT",
    action: `${entityType}.${verb}`,
    summary: entity.name
      ? `${past} ${readableType} “${entity.name}”.`
      : `${past} a ${readableType}.`,
    entityType,
    entityId: entity.id,
    metadata: {
      ...(options?.changed?.length ? { changed: options.changed } : {}),
      ...(options?.metadata ?? {}),
    },
    request: options?.request,
  });
}

/** Which of `fields` are actually present in a PATCH body — the `changed`
 *  list logContentChange records. A PATCH here is partial by convention
 *  (every route spreads `...(x !== undefined && { x })`), so "present in the
 *  body" is exactly "the admin edited this". */
export function changedFields(body: Record<string, unknown>, fields: string[]): string[] {
  return fields.filter((f) => body[f] !== undefined);
}

/**
 * Drop rows past their category's retention window (ACTIVITY_RETENTION_DAYS).
 *
 * Called opportunistically by the admin panel's own GET rather than on a
 * schedule — there is no cron in this app, and the trail only needs pruning
 * on roughly the cadence someone looks at it. `PRUNE_MIN_INTERVAL_MS` keeps
 * repeated tab switches from issuing five deletes a minute.
 *
 * Returns the number of rows removed (0 when it skipped or failed), so the
 * caller can log a "system.activity-log.pruned" entry when it actually did
 * something.
 */
const PRUNE_MIN_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
let lastPruneAt = 0;

export async function pruneActivityLogs(force = false): Promise<number> {
  const now = Date.now();
  if (!force && now - lastPruneAt < PRUNE_MIN_INTERVAL_MS) return 0;
  // Set the stamp *before* the work, not after: two concurrent dashboard
  // loads should not both run the delete.
  lastPruneAt = now;

  let removed = 0;
  try {
    for (const category of ACTIVITY_CATEGORIES) {
      const cutoff = new Date(now - ACTIVITY_RETENTION_DAYS[category] * 24 * 60 * 60 * 1000);
      const result = await prisma.activityLog.deleteMany({
        where: { category, createdAt: { lt: cutoff } },
      });
      removed += result.count;
    }
  } catch (error) {
    console.error("[activity-log] prune failed", error);
    return removed;
  }
  return removed;
}
