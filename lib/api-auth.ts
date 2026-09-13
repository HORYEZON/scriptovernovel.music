// lib/api-auth.ts
import { createHash, timingSafeEqual } from "crypto";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

/**
 * Constant-time string compare for secrets.
 *
 * `a === b` on strings returns as soon as two bytes differ, so how long it
 * took to say "no" tells the caller how many leading bytes they got right.
 * Repeat that per position and a secret can be recovered without ever
 * guessing it whole. Comparing the two SHA-256-length buffers instead keeps
 * the runtime independent of the input — and hashing first means a
 * length mismatch doesn't short-circuit either (timingSafeEqual throws on
 * differing lengths, which would reintroduce the very leak we're closing).
 */
function secretsMatch(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/**
 * Guard for admin-only API routes.
 *
 * Returns a ready-to-return 401 when the caller is not an admin, or null when
 * they are — so a route opens with:
 *
 *   const denied = await requireAdmin();
 *   if (denied) return denied;
 *
 * Authentication is accepted via either:
 *   1. An active NextAuth session cookie (browser/admin panel).
 *   2. An `x-api-key` header matching the API_SECRET_KEY env var (external
 *      integrations, automation scripts, CI pipelines). Only set
 *      API_SECRET_KEY in production if you actually need programmatic access —
 *      leave it unset to disable key-based auth entirely.
 *
 * Every admin route repeated this check verbatim, each with its own
 * `as any` on the session user. next-auth's Session type is not augmented
 * with our `role` field, so the cast has to live somewhere; keeping it here
 * means one narrow cast instead of one per route, and one place to change if
 * the rule ever grows beyond a single role comparison.
 */
export async function requireAdmin(): Promise<NextResponse | null> {
  // ── X-API-KEY (header-based) ─────────────────────────────────────────────
  // Short-circuit before reading the cookie/session when an API key is
  // present and matches. An unset or empty API_SECRET_KEY means key-based
  // auth is disabled (the env check below ensures we never accidentally
  // accept an empty string as a valid key).
  const apiSecretKey = process.env.API_SECRET_KEY;
  if (apiSecretKey) {
    const headersList = await headers();
    const providedKey = headersList.get("x-api-key");
    if (providedKey && secretsMatch(providedKey, apiSecretKey)) {
      return null; // Authorized via API key
    }
  }

  // ── Session (cookie-based) ────────────────────────────────────────────────
  const session = await auth();

  if (!session?.user || (session.user as { role?: string }).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
