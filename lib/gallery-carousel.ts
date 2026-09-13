// lib/gallery-carousel.ts
//
// Single source of truth for the mobile Gallery carousel (the horizontally
// scrolling row of section cards on small screens — see GalleryClient.tsx).
// Shared by the admin Branding form and the public homepage data fetch, plus
// the /api/profile route's sanitizer, so the three can never drift apart.
// Mirrors the shape of lib/marquee.ts's speed controls on purpose — same
// feature category (an admin-tunable auto-scroll), same UI pattern.

export const CAROUSEL_MODES = [
  {
    value: "auto",
    label: "Auto-scroll",
    description: "Continuously drifts sideways on its own; pauses on touch.",
  },
  {
    value: "swipe",
    label: "Swipe Only",
    description: "No motion on its own — visitors swipe/scroll it manually.",
  },
  {
    value: "grid",
    label: "Grid",
    description: "Skips the carousel — same 2-column grid as desktop.",
  },
] as const;

export type CarouselMode = (typeof CAROUSEL_MODES)[number]["value"];
const CAROUSEL_MODE_VALUES = CAROUSEL_MODES.map((m) => m.value);

/** Seconds each card adds to one full loop — lower is faster. Only meaningful in "auto" mode. */
export const CAROUSEL_SPEED_PRESETS = [
  { label: "Slow", value: 8 },
  { label: "Normal", value: 5 },
  { label: "Fast", value: 3 },
] as const;

export const MIN_CAROUSEL_SPEED = 2;
export const MAX_CAROUSEL_SPEED = 12;

export const CAROUSEL_DEFAULTS = {
  carouselMode: "auto" as CarouselMode,
  carouselSpeed: 5,
};

export function clampCarouselSpeed(value: unknown): number {
  const n = typeof value === "number" ? value : parseInt(String(value), 10);
  if (!Number.isFinite(n)) return CAROUSEL_DEFAULTS.carouselSpeed;
  return Math.min(MAX_CAROUSEL_SPEED, Math.max(MIN_CAROUSEL_SPEED, Math.round(n)));
}

export function sanitizeCarouselMode(value: unknown): CarouselMode {
  return typeof value === "string" && (CAROUSEL_MODE_VALUES as string[]).includes(value)
    ? (value as CarouselMode)
    : CAROUSEL_DEFAULTS.carouselMode;
}

/**
 * Same floor-plus-scale shape GalleryClient already used before this was
 * admin-configurable (`Math.max(12, count * 5)`) — more cards still need
 * more time to traverse at a readable pace, just with the "5" now tunable.
 */
export function carouselLoopDuration(cardCount: number, secondsPerCard: number): number {
  return Math.max(12, cardCount * secondsPerCard);
}
