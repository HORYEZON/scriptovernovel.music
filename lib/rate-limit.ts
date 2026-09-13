// lib/rate-limit.ts
//
// A deliberately small fixed-window limiter held in process memory.
//
// On Vercel each serverless instance keeps its own counters, so this is a
// speed bump rather than a global quota — which is the right trade for an art
// portfolio. The alternative (Redis/Upstash) adds a paid dependency and an
// availability risk to features whose worst case is a spammed leaderboard the
// admin can clear in one click.
//
// This lived in lib/minigames/rate-limit.ts until the public order-lookup
// endpoint needed the same speed bump; nothing in here was ever mini-game
// specific, so it moved up a level rather than being copied. The mini-games
// module now re-exports these and keeps only its own LIMITS table, so every
// existing import path still resolves — and, more importantly, every caller
// still shares ONE `windows` map. A second copy of this file would mean a
// second set of counters and a limiter that quietly allows double the
// configured budget.

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

/** Drop expired entries once the map gets big, so it can't grow unbounded. */
function sweep(now: number) {
  if (windows.size < 5000) return;
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}

export interface RateLimitResult {
  ok: boolean;
  retryAfterSec: number;
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = windows.get(key);
  if (!existing || existing.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: 0 };
  }

  existing.count++;
  if (existing.count > limit) {
    return {
      ok: false,
      retryAfterSec: Math.ceil((existing.resetAt - now) / 1000),
    };
  }
  return { ok: true, retryAfterSec: 0 };
}

/**
 * Best-effort client IP. Vercel always sets x-forwarded-for; the fallback
 * keeps local development working (where every request looks like one host,
 * which is correct — it is).
 */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function tooManyRequests(retryAfterSec: number): Response {
  return new Response(
    JSON.stringify({
      error: "You're going a little fast — try again in a moment.",
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(Math.max(1, retryAfterSec)),
      },
    }
  );
}
