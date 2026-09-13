// lib/minigames/rate-limit.ts
//
// The mini-games' slice of the shared limiter. The limiter itself moved to
// lib/rate-limit.ts once the public order-lookup endpoint needed it too —
// see that file for why there is exactly one copy of the counters. This
// module stays as the mini-games' import surface (so no call site changed)
// and owns the one genuinely game-specific thing: the per-endpoint budgets.
//
// The genuinely load-bearing protections for scores are not in here anyway:
// scores are computed server-side, sessions are single-use, and a submission
// has to carry a real solution to a server-issued puzzle. This is a speed
// bump on top of that, not the wall.
export {
  rateLimit,
  clientIp,
  tooManyRequests,
  type RateLimitResult,
} from "@/lib/rate-limit";

/** Per-endpoint budgets, all per-IP unless noted. */
export const LIMITS = {
  /** Starting rounds — generous, restarting a puzzle is normal play. */
  startSession: { limit: 30, windowMs: 60_000 },
  /** Finishing rounds — you cannot legitimately finish 20 games a minute. */
  submitScore: { limit: 20, windowMs: 60_000 },
  /** Reward claims — one per session anyway, this catches probing. */
  claimReward: { limit: 10, windowMs: 60_000 },
  /** Leaderboard reads — cheap, but not free. */
  readLeaderboard: { limit: 60, windowMs: 60_000 },
} as const;
