// lib/marquee.ts
//
// Single source of truth for the marquee ticker: the option lists the admin
// form offers, and the sanitiser the API routes run before touching the DB.
// Shared by the admin client, the public banner, and both API routes so the
// three can never drift apart.
//
// Note this file lives outside Tailwind's content globs, so every value here
// is raw CSS applied inline — never a class name, which purge would strip.

export interface Marquee {
  id: string;
  text: string;
  category: string;
  linkUrl: string | null;
  textColor: string;
  backgroundColor: string;
  fontSize: string;
  fontFamily: string;
  speed: number;
  separator: string;
  pauseOnHover: boolean;
  isActive: boolean;
  startDate: string | null;
  endDate: string | null;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

/** Suggested sections. Category is a free string — admins may type their own. */
export const MARQUEE_CATEGORIES = [
  "Product Promo",
  "Holiday Greeting",
  "System Alert",
  "General",
] as const;

export const MARQUEE_FONTS = [
  { label: "DM Sans", css: "var(--font-dm-sans), system-ui, sans-serif" },
  { label: "Plus Jakarta", css: "var(--font-plus-jakarta), system-ui, sans-serif" },
  { label: "Space Grotesk", css: "var(--font-space-grotesk), system-ui, sans-serif" },
  { label: "Cormorant", css: "var(--font-cormorant), Georgia, serif" },
  { label: "DM Mono", css: "var(--font-dm-mono), monospace" },
  { label: "Anime Ace", css: '"AnimeAce", serif' },
  { label: "BadaBoom", css: '"BadaBoomBB", serif' },
] as const;

export const MARQUEE_SIZES = [
  { label: "XS", css: "0.6875rem" },
  { label: "Small", css: "0.8125rem" },
  { label: "Medium", css: "0.9375rem" },
  { label: "Large", css: "1.125rem" },
  { label: "XL", css: "1.375rem" },
] as const;

/** Seconds for one full loop — lower is faster. */
export const MARQUEE_SPEEDS = [
  { label: "Slow", value: 45 },
  { label: "Normal", value: 24 },
  { label: "Fast", value: 12 },
] as const;

export const MIN_SPEED = 5;
export const MAX_SPEED = 120;

export const SEPARATORS = ["✦", "•", "—", "/", "★", "◆", "~"] as const;

export const MARQUEE_DEFAULTS = {
  text: "",
  category: "General",
  linkUrl: "",
  textColor: "#FAF8F3",
  backgroundColor: "#0D0D0D",
  fontSize: "0.8125rem",
  fontFamily: MARQUEE_FONTS[0].css,
  speed: 24,
  separator: "✦",
  pauseOnHover: true,
  isActive: true,
  startDate: "",
  endDate: "",
  priority: 0,
};

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Colours land in a `style` attribute, so anything non-hex is rejected outright. */
export function safeHex(value: unknown, fallback: string): string {
  return typeof value === "string" && HEX.test(value.trim())
    ? value.trim().toLowerCase()
    : fallback;
}

/** Same reasoning as safeHex: only values from our own option lists get through. */
function safeFromList(value: unknown, allowed: readonly string[], fallback: string): string {
  return typeof value === "string" && allowed.includes(value.trim()) ? value.trim() : fallback;
}

export function clampSpeed(value: unknown): number {
  const n = typeof value === "number" ? value : parseInt(String(value), 10);
  if (!Number.isFinite(n)) return MARQUEE_DEFAULTS.speed;
  return Math.min(MAX_SPEED, Math.max(MIN_SPEED, Math.round(n)));
}

/** Falsy → no bound. Otherwise parsed as a Date, invalid input included, so callers can isNaN-check it. */
function toDateOrNull(value: unknown): Date | null {
  if (!value) return null;
  return typeof value === "string" || typeof value === "number" || value instanceof Date
    ? new Date(value)
    : new Date(NaN);
}

/** Only http(s) — blocks javascript: URLs reaching an anchor href. */
export function safeUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const raw = value.trim();
  try {
    const url = new URL(raw, "https://placeholder.local");
    if (raw.startsWith("/")) return raw;
    return url.protocol === "http:" || url.protocol === "https:" ? raw : null;
  } catch {
    return null;
  }
}

export interface SanitizedMarquee {
  text: string;
  category: string;
  linkUrl: string | null;
  textColor: string;
  backgroundColor: string;
  fontSize: string;
  fontFamily: string;
  speed: number;
  separator: string;
  pauseOnHover: boolean;
  isActive: boolean;
  startDate: Date | null;
  endDate: Date | null;
  priority: number;
}

export type SanitizeResult =
  | { ok: true; data: SanitizedMarquee }
  | { ok: false; error: string };

/**
 * Normalises a request body into DB-safe values. Returns a result instead of
 * throwing so the routes can map a failure straight to a 400.
 */
export function sanitizeMarquee(body: Record<string, unknown>): SanitizeResult {
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return { ok: false, error: "Marquee text is required." };
  if (text.length > 500) {
    return { ok: false, error: "Marquee text must be 500 characters or fewer." };
  }

  const category =
    typeof body.category === "string" && body.category.trim()
      ? body.category.trim().slice(0, 60)
      : MARQUEE_DEFAULTS.category;

  const startDate = toDateOrNull(body.startDate);
  const endDate = toDateOrNull(body.endDate);

  if (startDate && isNaN(startDate.getTime())) {
    return { ok: false, error: "Invalid start date." };
  }
  if (endDate && isNaN(endDate.getTime())) {
    return { ok: false, error: "Invalid end date." };
  }
  if (startDate && endDate && endDate <= startDate) {
    return { ok: false, error: "End date & time must be after start date & time." };
  }

  return {
    ok: true,
    data: {
      text,
      category,
      linkUrl: safeUrl(body.linkUrl),
      textColor: safeHex(body.textColor, MARQUEE_DEFAULTS.textColor),
      backgroundColor: safeHex(body.backgroundColor, MARQUEE_DEFAULTS.backgroundColor),
      fontSize: safeFromList(
        body.fontSize,
        MARQUEE_SIZES.map((s) => s.css),
        MARQUEE_DEFAULTS.fontSize
      ),
      fontFamily: safeFromList(
        body.fontFamily,
        MARQUEE_FONTS.map((f) => f.css),
        MARQUEE_DEFAULTS.fontFamily
      ),
      speed: clampSpeed(body.speed),
      separator: safeFromList(body.separator, SEPARATORS, MARQUEE_DEFAULTS.separator),
      pauseOnHover: body.pauseOnHover === undefined ? true : Boolean(body.pauseOnHover),
      isActive: body.isActive === undefined ? true : Boolean(body.isActive),
      startDate,
      endDate,
      priority: Number.isFinite(Number(body.priority)) ? Math.trunc(Number(body.priority)) : 0,
    },
  };
}

/**
 * Whether a marquee should be on screen right now. Null dates mean "no bound",
 * so an item with neither is simply always-on while isActive.
 */
export function isMarqueeLive(
  item: Pick<Marquee, "isActive" | "startDate" | "endDate">,
  now: Date = new Date()
): boolean {
  if (!item.isActive) return false;
  if (item.startDate && new Date(item.startDate) > now) return false;
  if (item.endDate && new Date(item.endDate) < now) return false;
  return true;
}

/**
 * Rough rendered height of a stack of bars, in px, from font size alone
 * (line-height 1.4 + 0.3rem padding each — see `.marquee-bar` in globals.css).
 *
 * Used only as the server-side fallback for `--marquee-h`, which the banner
 * replaces with a real measurement on mount. Its job is to stop the page
 * content jumping on first paint, not to be exact.
 */
export function estimateMarqueeHeight(
  items: Pick<Marquee, "fontSize">[],
  rootFontPx = 16
): number {
  return items.reduce((total, item) => {
    const rem = parseFloat(item.fontSize) || 0.8125;
    return total + Math.round(rem * rootFontPx * 1.4 + 0.6 * rootFontPx);
  }, 0);
}

export type MarqueeStatus = "ACTIVE" | "SCHEDULED" | "EXPIRED" | "INACTIVE";

export function marqueeStatus(
  item: Pick<Marquee, "isActive" | "startDate" | "endDate">,
  now: Date = new Date()
): MarqueeStatus {
  if (!item.isActive) return "INACTIVE";
  if (item.startDate && new Date(item.startDate) > now) return "SCHEDULED";
  if (item.endDate && new Date(item.endDate) < now) return "EXPIRED";
  return "ACTIVE";
}
