// lib/minigames/player.ts
//
// Anonymous player identity. Casual play needs no account, but the server
// still needs a stable handle to attribute sessions, "your best score" and
// reward claims to — and one the visitor cannot simply type in the request
// body, or they could post scores as someone else.
//
// So: a random id in an httpOnly cookie, HMAC-signed with the app secret.
// The browser can delete it (losing its history, which is fine) but cannot
// forge one for a different player.

import { cookies } from "next/headers";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";

const COOKIE_NAME = "kal_player";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/**
 * Only ever reached on a development machine whose .env is incomplete.
 *
 * A random per-process key would be the safer-looking choice, but it does not
 * survive the way Next.js compiles each route handler into its own bundle:
 * two routes can end up with separate instances of this module, and a cookie
 * signed in /api/minigames/session then fails to verify in
 * /api/minigames/submit. The result is a system that looks like it works and
 * silently loses every score. A fixed dev-only constant keeps local play
 * coherent, and production never sees it — see signingKey().
 */
const DEV_ONLY_SECRET = "scriptovernovel-minigames-development-only";

function signingKey(): string {
  // Same two names, in the same order, as auth.config.ts — NextAuth v5 renamed
  // NEXTAUTH_SECRET to AUTH_SECRET and accepts either, so reading only one of
  // them here would mean a deployment where the admin can log in but every
  // mini-game round 500s.
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (secret) return secret;

  // One of those is already required for the admin login to work at all, so
  // this can only fire on a misconfigured deployment — better a loud failure
  // than cookies signed with a value that is sitting in a public repository.
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "AUTH_SECRET (or NEXTAUTH_SECRET) is required to sign mini-game player cookies in production."
    );
  }
  return DEV_ONLY_SECRET;
}

function sign(id: string): string {
  return createHmac("sha256", signingKey())
    .update(id)
    .digest("hex")
    .slice(0, 32);
}

function verify(value: string): string | null {
  const [id, signature] = value.split(".");
  if (!id || !signature || id.length > 64) return null;

  const expected = sign(id);
  if (expected.length !== signature.length) return null;
  try {
    if (!timingSafeEqual(Buffer.from(expected), Buffer.from(signature)))
      return null;
  } catch {
    return null;
  }
  return id;
}

/**
 * The current visitor's id, or null. Safe to call from Server Components —
 * it only reads.
 */
export async function readPlayerId(): Promise<string | null> {
  const raw = (await cookies()).get(COOKIE_NAME)?.value;
  return raw ? verify(raw) : null;
}

/**
 * The current visitor's id, minting and setting one if they don't have it.
 * Only callable from a Route Handler or Server Action — Next.js rejects
 * cookie writes anywhere else.
 */
export async function ensurePlayerId(): Promise<string> {
  const store = await cookies();
  const existing = store.get(COOKIE_NAME)?.value;
  const verified = existing ? verify(existing) : null;
  if (verified) return verified;

  const id = randomBytes(16).toString("hex");
  store.set(COOKIE_NAME, `${id}.${sign(id)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
  return id;
}
