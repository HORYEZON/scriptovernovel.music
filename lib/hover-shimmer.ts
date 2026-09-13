// lib/hover-shimmer.ts
//
// Single source of truth for the hover light-sweep on the public grids — the
// Gallery's section cards, the Tales shelf's book covers and the Shop's
// product cards. Shared by the admin Branding form (Settings → Preferences →
// Hover Shimmer), the /api/profile sanitizer and the three public pages, so
// the four can never drift apart. Same shape as lib/gallery-carousel.ts on
// purpose: same feature category (a per-grid admin-tunable effect), same
// Profile column pattern — one Json column (Profile.hoverShimmer) rather
// than nine scalar ones, since the three surfaces always travel together.
//
// The sweep itself is the `animate-shimmer` keyframe every badge and button
// on the site already uses (tailwind.config.ts) — a gradient band that
// translates across the card. What's tunable here is the band's colour, how
// long one pass takes, and how bright its peak is.

import type { CSSProperties } from "react";
import { withAlpha } from "@/lib/museum/minimapHud";

export const SHIMMER_SURFACES = [
  {
    id: "gallery",
    label: "Gallery",
    description: "The light sweep across a section card on the homepage Gallery when it's hovered.",
  },
  {
    id: "stories",
    label: "Tales",
    description: "The light sweep across a book cover on the Tales shelf when it's hovered.",
  },
  {
    id: "shop",
    label: "Shop",
    description: "The light sweep across a product card in the Shop when it's hovered.",
  },
] as const;

export type ShimmerSurface = (typeof SHIMMER_SURFACES)[number]["id"];
const SURFACE_IDS = SHIMMER_SURFACES.map((s) => s.id) as readonly string[];

export interface ShimmerSettings {
  /** Six-digit hex — the colour of the band itself. */
  color: string;
  /** Seconds one pass takes to cross the card. Lower is faster. */
  speed: number;
  /** Peak opacity of the band at its centre, 0–100. 0 turns the sweep off. */
  brightness: number;
}

export type HoverShimmerSettings = Record<ShimmerSurface, ShimmerSettings>;

export const MIN_SHIMMER_SPEED = 0.5;
export const MAX_SHIMMER_SPEED = 6;
export const MIN_SHIMMER_BRIGHTNESS = 0;
export const MAX_SHIMMER_BRIGHTNESS = 100;

export const SHIMMER_SPEED_PRESETS = [
  { label: "Slow", value: 4 },
  { label: "Normal", value: 2.5 },
  { label: "Fast", value: 1.2 },
] as const;

// White at a third strength, a touch slower than the 3s badge sweep — reads
// as a glint passing over the artwork rather than a flash on top of it. The
// Shop's default, and what the "White" button in the admin resets to.
export const DEFAULT_SHIMMER: ShimmerSettings = {
  color: "#FFFFFF",
  speed: 2.5,
  brightness: 35,
};

// The Gallery and Tales cards already swept before this was configurable —
// gilded (sepia-light) and azure (azure-light) respectively, both at 25%
// over the 3s badge timing, see tailwind.config.ts for the two palettes.
// Those stay their defaults so an un-customised site (or one saved with
// these untouched) renders exactly as it did; only the Shop, which had no
// sweep, starts on the white one above.
export const DEFAULT_HOVER_SHIMMER: HoverShimmerSettings = {
  gallery: { color: "#E8D5A8", speed: 3, brightness: 25 },
  stories: { color: "#A8CBE8", speed: 3, brightness: 25 },
  shop: { ...DEFAULT_SHIMMER },
};

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

// Each sanitizer takes the fallback it should land on, since "invalid" means
// something different per surface — the Gallery's missing colour is gold,
// the Shop's is white (DEFAULT_HOVER_SHIMMER above).
export function sanitizeShimmerColor(value: unknown, fallback = DEFAULT_SHIMMER.color): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  // Accept the short form the colour input never emits but a hand-typed
  // value might, expanding it so withAlpha() always sees six digits.
  const short = /^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/.exec(trimmed);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`.toUpperCase();
  return HEX_RE.test(trimmed) ? trimmed.toUpperCase() : fallback;
}

export function clampShimmerSpeed(value: unknown, fallback = DEFAULT_SHIMMER.speed): number {
  const n = typeof value === "number" ? value : parseFloat(String(value));
  if (!Number.isFinite(n)) return fallback;
  // One decimal — the slider steps by 0.1 and anything finer is noise.
  return Math.round(Math.min(MAX_SHIMMER_SPEED, Math.max(MIN_SHIMMER_SPEED, n)) * 10) / 10;
}

export function clampShimmerBrightness(value: unknown, fallback = DEFAULT_SHIMMER.brightness): number {
  const n = typeof value === "number" ? value : parseInt(String(value), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(MAX_SHIMMER_BRIGHTNESS, Math.max(MIN_SHIMMER_BRIGHTNESS, Math.round(n)));
}

export function sanitizeShimmerSettings(
  value: unknown,
  fallback: ShimmerSettings = DEFAULT_SHIMMER
): ShimmerSettings {
  const v = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  return {
    color: sanitizeShimmerColor(v.color, fallback.color),
    speed: clampShimmerSpeed(v.speed, fallback.speed),
    brightness: clampShimmerBrightness(v.brightness, fallback.brightness),
  };
}

/**
 * The whole Profile.hoverShimmer column, field-by-field. A missing or partial
 * value — every row from before the column existed is null — resolves to
 * that surface's own default, and a surface the stored JSON doesn't mention
 * gets its default too, so adding a fourth grid later never reads as "no
 * shimmer" on it.
 */
export function sanitizeHoverShimmer(value: unknown): HoverShimmerSettings {
  const v = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const out = {} as HoverShimmerSettings;
  for (const id of SURFACE_IDS as ShimmerSurface[]) {
    out[id] = sanitizeShimmerSettings(v[id], DEFAULT_HOVER_SHIMMER[id]);
  }
  return out;
}

/**
 * Inline style for the sweep band — pair it with the `animate-shimmer`
 * class on an `absolute inset-0` span inside an `overflow-hidden` box.
 * The class supplies the keyframes and timing function; this supplies the
 * gradient and overrides the class's fixed 3s with the admin's speed.
 * Brightness is the band's peak alpha, so 0 renders a fully transparent
 * band — visually "off" without a second prop to thread through.
 */
export function shimmerBandStyle(settings: ShimmerSettings): CSSProperties {
  const peak = withAlpha(settings.color, settings.brightness / 100);
  return {
    background: `linear-gradient(90deg, transparent 0%, ${peak} 50%, transparent 100%)`,
    animationDuration: `${settings.speed}s`,
  };
}
