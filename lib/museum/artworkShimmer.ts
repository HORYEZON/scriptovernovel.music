// lib/museum/artworkShimmer.ts
//
// The light sweep that plays across an artwork when a visitor walks up to
// it in the Digital Museum — the same band-of-light the room labels' glass
// carries (BannerPanel.tsx's BannerShimmer), here riding on the artwork
// itself while it is the one the visitor could open with [E].
//
// Museum-wide, stored as one JSON column (DigitalMuseum.artworkShimmerConfig)
// like the Minimap HUD and Filter Vision: a handful of presentation values
// that only ever travel together. Null means these defaults, so a museum
// that has never touched the setting still gets the sweep. The admin picks
// an artwork to *preview* the sweep on in General Settings; that pick is a
// preview aid and is not part of this config.

export interface ArtworkShimmerConfig {
  /** Off leaves the artwork exactly as before: the frame's glow is the only
   *  sign it can be opened. */
  enabled: boolean;
  /** Sweeps per second across the artwork. */
  speed: number;
  /** How bright the band burns, 0–1. Additive over the image, so on a pale
   *  artwork the same number reads stronger than on a dark one. */
  strength: number;
  /** Tint of the band. White is a plain sheen; a colour reads as stage light. */
  color: string;
  /** How wide the band is, as a fraction of the artwork's width. */
  bandWidth: number;
}

export const ARTWORK_SHIMMER_DEFAULTS: ArtworkShimmerConfig = {
  enabled: true,
  speed: 0.6,
  strength: 0.45,
  color: "#ffffff",
  bandWidth: 0.12,
};

export const ARTWORK_SHIMMER_MIN_SPEED = 0.1;
export const ARTWORK_SHIMMER_MAX_SPEED = 3;
export const ARTWORK_SHIMMER_MIN_STRENGTH = 0;
export const ARTWORK_SHIMMER_MAX_STRENGTH = 1;
export const ARTWORK_SHIMMER_MIN_BAND = 0.04;
export const ARTWORK_SHIMMER_MAX_BAND = 0.4;

const HEX = /^#[0-9a-fA-F]{6}$/;

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function sanitizeArtworkShimmerConfig(value: unknown): ArtworkShimmerConfig {
  const raw = (value && typeof value === "object" ? value : {}) as Partial<ArtworkShimmerConfig>;
  const d = ARTWORK_SHIMMER_DEFAULTS;
  return {
    enabled: typeof raw.enabled === "boolean" ? raw.enabled : d.enabled,
    speed: clampNumber(raw.speed, ARTWORK_SHIMMER_MIN_SPEED, ARTWORK_SHIMMER_MAX_SPEED, d.speed),
    strength: clampNumber(raw.strength, ARTWORK_SHIMMER_MIN_STRENGTH, ARTWORK_SHIMMER_MAX_STRENGTH, d.strength),
    color: typeof raw.color === "string" && HEX.test(raw.color) ? raw.color.toLowerCase() : d.color,
    bandWidth: clampNumber(raw.bandWidth, ARTWORK_SHIMMER_MIN_BAND, ARTWORK_SHIMMER_MAX_BAND, d.bandWidth),
  };
}

export function parseArtworkShimmerConfig(json: string | null | undefined): ArtworkShimmerConfig {
  if (!json) return { ...ARTWORK_SHIMMER_DEFAULTS };
  try {
    return sanitizeArtworkShimmerConfig(JSON.parse(json));
  } catch {
    return { ...ARTWORK_SHIMMER_DEFAULTS };
  }
}

export function serializeArtworkShimmerConfig(config: ArtworkShimmerConfig): string {
  return JSON.stringify(sanitizeArtworkShimmerConfig(config));
}
