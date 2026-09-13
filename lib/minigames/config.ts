// lib/minigames/config.ts
//
// Validation and clamping for everything a human types — admin game
// configuration on one side, visitor display names and emails on the other.
// Same "single source of truth shared by the form and the API route" shape as
// lib/marquee.ts and lib/intro-splash.ts, so the admin UI's constraints and
// the server's can't drift apart.

import { DIFFICULTIES, type Difficulty, type DifferenceRegion } from "./types";

export const MAX_TIME_LIMIT_SEC = 3600;
export const MIN_SCORE_MULTIPLIER = 0.1;
export const MAX_SCORE_MULTIPLIER = 5;
export const MIN_LEADERBOARD_SIZE = 3;
export const MAX_LEADERBOARD_SIZE = 50;
export const MAX_REWARD_DESCRIPTION_LENGTH = 120;
export const MAX_DIFFERENCE_REGIONS = 12;
export const MIN_DIFFERENCE_RADIUS = 2;
export const MAX_DIFFERENCE_RADIUS = 20;

export const MIN_DISPLAY_NAME_LENGTH = 2;
export const MAX_DISPLAY_NAME_LENGTH = 20;
export const MAX_EMAIL_LENGTH = 254;

/** Preset time limits offered in the admin dropdown. 0 means untimed. */
export const TIME_LIMIT_PRESETS = [
  { label: "No time limit", value: 0 },
  { label: "1 minute", value: 60 },
  { label: "2 minutes", value: 120 },
  { label: "3 minutes", value: 180 },
  { label: "5 minutes", value: 300 },
  { label: "10 minutes", value: 600 },
] as const;

export function sanitizeDifficulty(value: unknown): Difficulty {
  return typeof value === "string" && (DIFFICULTIES as string[]).includes(value)
    ? (value as Difficulty)
    : "MEDIUM";
}

export function clampTimeLimit(value: unknown): number {
  const n = typeof value === "number" ? value : parseInt(String(value), 10);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(MAX_TIME_LIMIT_SEC, Math.round(n));
}

export function clampScoreMultiplier(value: unknown): number {
  const n = typeof value === "number" ? value : parseFloat(String(value));
  if (!Number.isFinite(n)) return 1;
  // One decimal place — the admin slider steps in 0.1, and letting arbitrary
  // precision through would make scores unreproducible from the UI.
  const rounded = Math.round(n * 10) / 10;
  return Math.min(
    MAX_SCORE_MULTIPLIER,
    Math.max(MIN_SCORE_MULTIPLIER, rounded)
  );
}

export function clampLeaderboardSize(value: unknown): number {
  const n = typeof value === "number" ? value : parseInt(String(value), 10);
  if (!Number.isFinite(n)) return 10;
  return Math.min(
    MAX_LEADERBOARD_SIZE,
    Math.max(MIN_LEADERBOARD_SIZE, Math.round(n))
  );
}

export function clampRewardThreshold(value: unknown): number {
  const n = typeof value === "number" ? value : parseInt(String(value), 10);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(1_000_000, Math.round(n));
}

export function sanitizeRewardDescription(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = stripControlChars(value)
    .trim()
    .slice(0, MAX_REWARD_DESCRIPTION_LENGTH);
  return trimmed || null;
}

/** A cuid, or null. Existence is checked separately against the Artwork table. */
export function sanitizeArtworkId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 64) return null;
  return /^[a-z0-9_-]+$/i.test(trimmed) ? trimmed : null;
}

/**
 * Coordinates arrive from an admin clicking a preview image, so they are
 * already percentages — this just rejects anything outside the image box and
 * caps how many hotspots one round can carry.
 */
export function sanitizeDifferenceRegions(value: unknown): DifferenceRegion[] {
  if (!Array.isArray(value)) return [];
  const out: DifferenceRegion[] = [];
  for (const raw of value.slice(0, MAX_DIFFERENCE_REGIONS)) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const x = toPercent(r.x);
    const y = toPercent(r.y);
    const radius = toNumber(r.radius);
    if (x === null || y === null || radius === null) continue;
    out.push({
      id:
        typeof r.id === "string" && r.id.trim()
          ? r.id.trim().slice(0, 40)
          : randomRegionId(),
      x: round2(x),
      y: round2(y),
      radius: round2(
        Math.min(MAX_DIFFERENCE_RADIUS, Math.max(MIN_DIFFERENCE_RADIUS, radius))
      ),
    });
  }
  return out;
}

/**
 * Leaderboard names are rendered as text by React (which escapes for us), but
 * they also reach the admin's inbox as HTML email, so angle brackets and
 * control characters are stripped at the door rather than trusted to every
 * downstream renderer.
 */
export function sanitizeDisplayName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = stripControlChars(value)
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_DISPLAY_NAME_LENGTH);
  return cleaned.length >= MIN_DISPLAY_NAME_LENGTH ? cleaned : null;
}

const EMAIL_RE = /^[^\s@<>]+@[^\s@<>.]+(\.[^\s@<>.]+)+$/;

export function sanitizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = stripControlChars(value).trim().toLowerCase();
  if (!cleaned || cleaned.length > MAX_EMAIL_LENGTH) return null;
  return EMAIL_RE.test(cleaned) ? cleaned : null;
}

// ── helpers ────────────────────────────────────────────────────────────

/**
 * Drops C0 controls and DEL. Written as a code-point scan rather than a
 * regex character class so the source file itself stays free of literal
 * control bytes.
 */
function stripControlChars(value: string): string {
  let out = "";
  for (const ch of value) {
    const code = ch.codePointAt(0) ?? 0;
    if (code < 32 || code === 127) continue;
    out += ch;
  }
  return out;
}

function toNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
}

function toPercent(value: unknown): number | null {
  const n = toNumber(value);
  if (n === null || n < 0 || n > 100) return null;
  return n;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function randomRegionId(): string {
  return `d_${Math.random().toString(36).slice(2, 10)}`;
}
