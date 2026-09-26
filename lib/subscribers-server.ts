// lib/subscribers-server.ts
//
// Server-only mailing-list helpers: token minting, the signup upsert, and the
// confirm / unsubscribe transitions. Not client-safe (Prisma + node:crypto) —
// mirrors lib/shows-server.ts.
//
// Every function here is written to be safe to call twice: a visitor
// double-submitting a form, an email client prefetching a link, and a mail
// scanner following it are all normal, and none of them should produce a second
// row, a second email, or an error page.
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { CONFIRM_RESEND_COOLDOWN_MS } from "@/lib/subscribers";

/**
 * A URL-safe random token.
 *
 * 24 bytes = 192 bits, from the CSPRNG. These tokens are bearer credentials —
 * confirming an address and unsubscribing both happen on possession alone — so
 * they must not be guessable, which rules out anything built from the id, the
 * email or the clock.
 */
export function mintToken(): string {
  return randomBytes(24).toString("base64url");
}

export const SUBSCRIBER_SELECT = {
  id: true,
  email: true,
  source: true,
  confirmedAt: true,
  confirmSentAt: true,
  unsubscribedAt: true,
  createdAt: true,
} satisfies Prisma.SubscriberSelect;

export type AdminSubscriber = Prisma.SubscriberGetPayload<{ select: typeof SUBSCRIBER_SELECT }>;

export interface SignupResult {
  /** The confirmation mail this call should send, or null when it shouldn't:
   *  already confirmed, or inside the resend cooldown. */
  sendConfirm: { email: string; token: string } | null;
}

/**
 * Record a signup for `email`, returning whether a confirmation should go out.
 *
 * Four cases, one row:
 * - **new** → create it, pending, with a fresh confirm token → send.
 * - **pending, cooldown elapsed** → rotate the token (the old link stops
 *   working, which is what "resend" has to mean) → send.
 * - **pending, inside cooldown** → touch nothing but the source → don't send.
 * - **confirmed** → nothing to do → don't send. Re-subscribing after an
 *   unsubscribe *does* reopen the row: that is a person asking to come back.
 *
 * The caller sends the mail rather than this function, so a mail outage can't
 * roll back a signup that was legitimately recorded.
 */
export async function recordSignup(email: string, source: string | null): Promise<SignupResult> {
  const now = new Date();
  const existing = await prisma.subscriber.findUnique({ where: { email } });

  if (!existing) {
    const token = mintToken();
    await prisma.subscriber.create({
      data: {
        email,
        source,
        confirmToken: token,
        confirmSentAt: now,
        unsubscribeToken: mintToken(),
      },
    });
    return { sendConfirm: { email, token } };
  }

  // Coming back after leaving: clear the unsubscribe and confirm again, so
  // nobody is re-added to a list they left without proving it was them.
  const returning = Boolean(existing.unsubscribedAt);
  if (existing.confirmedAt && !returning) return { sendConfirm: null };

  const withinCooldown =
    existing.confirmSentAt !== null &&
    now.getTime() - existing.confirmSentAt.getTime() < CONFIRM_RESEND_COOLDOWN_MS;

  if (withinCooldown && !returning) {
    // Keep the newest source — it says which form they actually used.
    if (source && source !== existing.source) {
      await prisma.subscriber.update({ where: { id: existing.id }, data: { source } });
    }
    return { sendConfirm: null };
  }

  const token = mintToken();
  await prisma.subscriber.update({
    where: { id: existing.id },
    data: {
      confirmToken: token,
      confirmSentAt: now,
      confirmedAt: null,
      unsubscribedAt: null,
      ...(source ? { source } : {}),
    },
  });
  return { sendConfirm: { email, token } };
}

/**
 * Spend a confirmation token.
 *
 * Returns "confirmed" on success and "invalid" when the token matches nothing —
 * which is also what an already-spent token looks like, since the token is
 * cleared on use. That ambiguity is why the confirmed page's wording works
 * either way: a visitor who clicks the link twice should not be told something
 * went wrong.
 */
export async function confirmSubscriber(token: string): Promise<"confirmed" | "invalid"> {
  if (!token) return "invalid";
  const row = await prisma.subscriber.findUnique({ where: { confirmToken: token } });
  if (!row) return "invalid";
  await prisma.subscriber.update({
    where: { id: row.id },
    data: { confirmedAt: new Date(), confirmToken: null, unsubscribedAt: null },
  });
  return "confirmed";
}

/** The address behind an unsubscribe token, for the "unsubscribe <email>?"
 *  page. Null when the token is unknown. */
export async function subscriberByUnsubscribeToken(token: string) {
  if (!token) return null;
  return prisma.subscriber.findUnique({
    where: { unsubscribeToken: token },
    select: { email: true, unsubscribedAt: true },
  });
}

/**
 * Unsubscribe by token. Idempotent, and never rotates the token — an
 * unsubscribe link in an old email has to keep working, and re-clicking it
 * must not error.
 */
export async function unsubscribeByToken(token: string): Promise<"unsubscribed" | "invalid"> {
  if (!token) return "invalid";
  const row = await prisma.subscriber.findUnique({ where: { unsubscribeToken: token } });
  if (!row) return "invalid";
  if (!row.unsubscribedAt) {
    await prisma.subscriber.update({
      where: { id: row.id },
      // The confirm token is cleared too: a pending row that unsubscribes
      // should not still carry a live "confirm your subscription" link.
      data: { unsubscribedAt: new Date(), confirmToken: null },
    });
  }
  return "unsubscribed";
}

/**
 * The admin list, after a signup / confirm / unsubscribe.
 *
 * Kept out of the transition functions above and called by the routes instead —
 * the same split every other module here uses (`revalidateShowPaths`,
 * `revalidateReleasePaths`). `revalidatePath` throws outside a request context,
 * so a data function that calls it can't be run from a script or a test.
 */
export function revalidateSubscriberPaths() {
  revalidatePath("/admin/subscribers");
}

/** Confirmed and not unsubscribed — the only rows that are actually on the
 *  list, and the only ones an export may contain. */
export const CONFIRMED_SUBSCRIBER_WHERE: Prisma.SubscriberWhereInput = {
  confirmedAt: { not: null },
  unsubscribedAt: null,
};
