// lib/release-notes.ts
//
// Single source of truth for Release Notes — the "what changed on the site"
// panel behind the navbar icon, next to the theme toggle.
//
// Shared by the admin form (Settings ▸ Release Notes), both API routes, and
// the public panel, so the option lists and the validation can never drift
// apart. Same arrangement as lib/marquee.ts.
//
// Scope, deliberately: a release note describes something a *visitor* can
// see. The Progress Timeline in Docs/ is the engineering record and covers
// admin-only work too; this is the visitor-facing subset, written by hand
// rather than generated from it, so the wording can be plain instead of
// technical.

export interface ReleaseNote {
  id: string;
  title: string;
  body: string;
  category: string;
  version: string | null;
  isPublished: boolean;
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * The parts of the public site a note can be filed under. Free text — the
 * admin may type their own — but these cover what exists today, and the
 * public panel colour-codes whatever it's given without needing to know it.
 */
export const RELEASE_NOTE_CATEGORIES = [
  "Digital Museum",
  "Gallery",
  "Stories",
  "Shop",
  "Freedom Wall",
  "Mini Games",
  "General",
] as const;

export const MAX_RELEASE_NOTE_TITLE = 120;
export const MAX_RELEASE_NOTE_BODY = 2000;
export const MAX_RELEASE_NOTE_CATEGORY = 40;
export const MAX_RELEASE_NOTE_VERSION = 20;

/**
 * How many notes the public panel shows at once. The visitor always sees the
 * newest N; publishing an N+1th pushes the oldest out of the list rather than
 * growing it — the panel is a "what's new", not an archive.
 */
export const RELEASE_NOTE_LIMIT_DEFAULT = 3;
export const RELEASE_NOTE_LIMIT_MIN = 1;
export const RELEASE_NOTE_LIMIT_MAX = 10;

export function clampReleaseNoteLimit(value: unknown): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return RELEASE_NOTE_LIMIT_DEFAULT;
  return Math.min(RELEASE_NOTE_LIMIT_MAX, Math.max(RELEASE_NOTE_LIMIT_MIN, n));
}

export function sanitizeReleaseNoteTitle(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, MAX_RELEASE_NOTE_TITLE) : "";
}

export function sanitizeReleaseNoteBody(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, MAX_RELEASE_NOTE_BODY) : "";
}

export function sanitizeReleaseNoteCategory(value: unknown): string {
  const raw = typeof value === "string" ? value.trim().slice(0, MAX_RELEASE_NOTE_CATEGORY) : "";
  return raw || "General";
}

/** Optional — a note doesn't have to name a version. Empty string reads as unset. */
export function sanitizeReleaseNoteVersion(value: unknown): string | null {
  if (value === null) return null;
  const raw = typeof value === "string" ? value.trim().slice(0, MAX_RELEASE_NOTE_VERSION) : "";
  return raw || null;
}

/**
 * A date the admin typed, or null if it's unusable. Publishing date is
 * admin-editable because a note is often written after the change shipped,
 * and the panel orders by it — so the newest change should be able to sit at
 * the top even when it was written last.
 */
export function sanitizeReleaseNoteDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Tailwind classes per category, with a neutral fallback for admin-typed ones. */
export function releaseNoteAccent(category: string): string {
  switch (category) {
    case "Digital Museum":
      return "bg-sepia/10 text-sepia border-sepia/25";
    case "Gallery":
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25";
    case "Stories":
      return "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/25";
    case "Shop":
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25";
    case "Freedom Wall":
      return "bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/25";
    case "Mini Games":
      return "bg-vermillion/10 text-vermillion border-vermillion/25";
    default:
      return "bg-black/5 dark:bg-white/10 text-ink-500 dark:text-ink-300 border-black/10 dark:border-white/15";
  }
}

/** "Sep 6, 2026" — stable across locales, since the panel is English-only. */
export function formatReleaseNoteDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
