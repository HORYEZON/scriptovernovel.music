// lib/activity-log.ts
//
// The shared vocabulary of the audit trail (Dashboard ▸ Activity Log) —
// category metadata, the catalogue of action verbs, and retention windows.
//
// Client-safe on purpose (no prisma import), because both halves need it:
// the writer (lib/activity-log-server.ts) and the panel that renders and
// filters the rows (components/admin/ActivityLogPanel.tsx). Keeping the
// labels here rather than in the panel means the filter dropdown and the
// row badges can never disagree about what a category is called.

/** Mirrors the ActivityCategory enum in prisma/schema.prisma. */
export const ACTIVITY_CATEGORIES = ["CONTENT", "AUTH", "COMMERCE", "VISITOR", "SYSTEM"] as const;
export type ActivityCategory = (typeof ACTIVITY_CATEGORIES)[number];

/** Coarse "who did this" bucket — stored as a plain string on the row. */
export const ACTIVITY_ACTOR_TYPES = ["admin", "visitor", "system"] as const;
export type ActivityActorType = (typeof ACTIVITY_ACTOR_TYPES)[number];

/**
 * Per-category presentation: the label above the filter pill and the chip
 * colour on each row. The colour strings follow the same `color/10`
 * background + `color` text convention the rest of the admin uses for status
 * chips (see dashboard/page.tsx's STAT_ACCENTS, ORDER_STATUS_COLORS).
 */
export const ACTIVITY_CATEGORY_META: Record<
  ActivityCategory,
  { label: string; description: string; chipClass: string }
> = {
  CONTENT: {
    label: "Content",
    description: "Artworks, products, tales, museum rooms and settings an admin changed.",
    chipClass: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  },
  AUTH: {
    label: "Auth",
    description: "Sign-ins, sign-outs, two-factor changes and password resets.",
    chipClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  COMMERCE: {
    label: "Commerce",
    description: "Orders, checkout sessions and payment webhooks.",
    chipClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  VISITOR: {
    label: "Visitor",
    description: "Anonymous public-site activity — museum walks, Freedom Wall posts, mini-games.",
    chipClass: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  },
  SYSTEM: {
    label: "System",
    description: "Backups, maintenance mode, log pruning and handled server errors.",
    chipClass: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  },
};

/**
 * How long each category's rows are kept, in days.
 *
 * VISITOR is by far the highest-volume category — a museum walk emits a row
 * per room entered — so it gets the shortest window; nobody is auditing which
 * room an anonymous visitor stood in six months ago. AUTH gets the longest,
 * because a login trail is only useful if it reaches back further than the
 * incident you are investigating.
 *
 * Enforced by pruneActivityLogs() in lib/activity-log-server.ts, not by the
 * database — Postgres has no TTL and adding a scheduler for this alone isn't
 * worth it, so the prune piggybacks on the admin panel's own reads.
 */
export const ACTIVITY_RETENTION_DAYS: Record<ActivityCategory, number> = {
  CONTENT: 365,
  AUTH: 365,
  COMMERCE: 730,
  VISITOR: 30,
  SYSTEM: 180,
};

/**
 * The action verbs in use today, grouped by category — what the panel's
 * "Action" filter offers.
 *
 * This is a catalogue, not a constraint: ActivityLog.action is a free-form
 * String (see that column's comment), so a new call site can log a verb that
 * isn't listed here and the row is stored and displayed perfectly well — it
 * just won't appear in the dropdown until it's added. That trade is
 * deliberate: requiring a migration (or even an edit to this file) before a
 * new event can be logged is how audit logging quietly stops happening.
 */
export const ACTIVITY_ACTIONS: Record<ActivityCategory, string[]> = {
  CONTENT: [
    "artwork.created", "artwork.updated", "artwork.deleted", "artwork.restored",
    "product.created", "product.updated", "product.deleted",
    "story.created", "story.updated", "story.deleted",
    "cosplay.created", "cosplay.updated", "cosplay.deleted",
    "event.created", "event.updated", "event.deleted",
    "announcement.created", "announcement.updated", "announcement.deleted",
    "museum.settings.updated", "museum.room.created", "museum.room.updated", "museum.room.deleted",
    "museum.scene-object.created", "museum.scene-object.updated", "museum.scene-object.deleted",
    "profile.updated", "settings.updated", "theme.updated",
    "trash.restored", "trash.purged",
  ],
  AUTH: [
    "auth.login.succeeded", "auth.login.failed", "auth.logout",
    "auth.totp.enabled", "auth.totp.disabled", "auth.totp.failed",
    "auth.password.reset-requested", "auth.password.reset-completed",
    "auth.inactivity-timeout.updated",
    "auth.session.expired",
  ],
  COMMERCE: [
    "order.created", "order.status-changed", "order.deleted",
    "checkout.started", "payment.webhook.received", "payment.succeeded", "payment.failed",
  ],
  VISITOR: [
    "museum.visit.started", "museum.room.entered",
    "freedom-wall.note.posted", "minigame.session.started", "minigame.session.completed",
    "contact.submitted", "achievement.claimed", "milestone.claimed",
  ],
  SYSTEM: [
    "backup.started", "backup.completed", "backup.failed",
    "maintenance.enabled", "maintenance.disabled",
    "activity-log.pruned", "activity-log.purged",
    "error.handled",
  ],
};

/** Every catalogued verb, flattened — the panel's unfiltered dropdown. */
export const ALL_ACTIVITY_ACTIONS: string[] = Object.values(ACTIVITY_ACTIONS).flat();

/**
 * Turn "artwork.updated" into "Artwork updated" for the action filter and the
 * per-row chip. Purely cosmetic: the raw verb is what's stored and what the
 * API filters on, so an uncatalogued verb still renders sensibly here.
 */
export function formatActivityAction(action: string): string {
  const words = action.split(".").join(" ").split("-").join(" ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** One row as the API hands it to the panel — `metadata` arrives already
 *  JSON-parsed, and `createdAt` as an ISO string (JSON has no Date). */
export interface ActivityLogRow {
  id: string;
  category: ActivityCategory;
  action: string;
  summary: string;
  actorId: string | null;
  actorLabel: string | null;
  actorEmail: string | null;
  actorType: ActivityActorType;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

/**
 * The columns the panel's Sort dropdown offers.
 *
 * Restricted to three because each one is backed by an index (see the
 * @@index list on ActivityLog) — this table is the one place in the app that
 * genuinely grows without bound, and an ORDER BY on an unindexed column here
 * is a sequential scan of the whole trail. Ordering by `category` groups the
 * list by kind, `action` by verb; `createdAt` is the default and the only one
 * anybody usually wants.
 */
export const ACTIVITY_SORT_FIELDS = ["createdAt", "category", "action"] as const;
export type ActivitySortField = (typeof ACTIVITY_SORT_FIELDS)[number];

export const ACTIVITY_SORT_LABELS: Record<ActivitySortField, string> = {
  createdAt: "Date",
  category: "Category",
  action: "Action",
};

/** Default rows per page. Matches ROWS_PER_PAGE_OPTIONS in
 *  components/admin/RowsPerPageSelect.tsx, which is the control the panel
 *  uses — same dropdown as Orders, Artworks and the rest. */
export const ACTIVITY_PAGE_SIZE = 20;
