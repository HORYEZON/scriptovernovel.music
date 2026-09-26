// lib/subscribers.ts
//
// Single source for the mailing list: how an address is normalised and
// validated, where a signup can come from, how a row's status is read off its
// three timestamps, and the resend cooldown. Client-safe (no Prisma) — shared
// by the public form, both API routes and the admin list, so all four agree on
// what a valid address is. Mirrors lib/shows.ts.

export const MAX_SUBSCRIBER_EMAIL = 254; // RFC 5321's limit on a path

/**
 * Lowercased and trimmed.
 *
 * The local part of an address is technically case-sensitive, but no mail
 * provider anyone uses treats it that way, and storing both cases means
 * Someone@Gmail.com and someone@gmail.com are two subscribers — one of whom
 * gets two of everything and can only unsubscribe from one.
 */
export function normalizeEmail(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().toLowerCase() : "";
}

/**
 * Deliberately loose: one @, something either side, a dot in the domain, no
 * whitespace. A stricter regex rejects real addresses (this is a famously bad
 * thing to be clever about), and the double opt-in is the real check — an
 * address that can't receive the confirmation never becomes a subscriber.
 */
export function isValidSubscriberEmail(email: string): boolean {
  if (!email || email.length > MAX_SUBSCRIBER_EMAIL) return false;
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email);
}

/** Where a signup came from — for the admin's own read on which form works.
 *  A string column, so adding one here is not a migration. */
export const SUBSCRIBER_SOURCES: Record<string, string> = {
  footer: "Footer",
  shows: "Shows page",
  subscribe: "Subscribe page",
  release: "Release page",
};

export function subscriberSourceLabel(source: string | null | undefined): string {
  if (!source) return "—";
  return SUBSCRIBER_SOURCES[source] ?? source;
}

export function isSubscriberSource(value: unknown): value is string {
  return typeof value === "string" && value in SUBSCRIBER_SOURCES;
}

export type SubscriberStatus = "pending" | "confirmed" | "unsubscribed";

export const SUBSCRIBER_STATUS_LABELS: Record<SubscriberStatus, string> = {
  pending: "Unconfirmed",
  confirmed: "Confirmed",
  unsubscribed: "Unsubscribed",
};

/**
 * A row's status, read off its timestamps rather than stored as a column —
 * there is no state the three dates can't express, and a separate column would
 * be a second source of truth to keep in step.
 *
 * Unsubscribed wins over confirmed: someone who confirmed and later left is
 * gone, and must never appear in an export.
 */
export function subscriberStatus(row: {
  confirmedAt: Date | string | null;
  unsubscribedAt: Date | string | null;
}): SubscriberStatus {
  if (row.unsubscribedAt) return "unsubscribed";
  if (row.confirmedAt) return "confirmed";
  return "pending";
}

/**
 * How long before the same address can be sent another confirmation.
 *
 * Without this, a public endpoint that emails whatever address it is handed is
 * a way to bomb a stranger's inbox: post their address in a loop and every
 * request sends them another mail. The row is still created/updated inside the
 * window — only the send is skipped — so the visitor's experience of a
 * double-submit is unchanged.
 */
export const CONFIRM_RESEND_COOLDOWN_MS = 10 * 60 * 1000;

/** What the public form and both API routes call the shared success case.
 *  Deliberately the same sentence whether the address was new, already
 *  pending, or already confirmed — see the POST route on why. */
export const SUBSCRIBE_ACK =
  "Check your inbox — there's a link in there to confirm. (It may take a minute.)";
