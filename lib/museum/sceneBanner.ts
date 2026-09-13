// lib/museum/sceneBanner.ts
//
// "Banner" — a freestanding titled plaque an admin drops into any room from
// the Museum Scene Editor (Add Banner, next to Add Divider), then drags,
// turns and re-colours like a piece of furniture.
//
// It is the Freedom Wall's event plaque made general. That plaque
// (lib/museum/freedomWallBanner.ts) already had exactly the look wanted here —
// a coloured backing with a raised edge, a small eyebrow line and a title —
// but three things kept it from being reusable as-is:
//
//   • It is auto-provisioned, exactly one per Freedom Wall room, and can only
//     exist there. A banner is added on demand, any number of times, anywhere.
//   • Its title is not admin-typed at all: it mirrors whichever
//     FreedomWallEvent is active, which is the entire point of that fixture
//     and the entire opposite of what this needs.
//   • Its eyebrow is the fixed string "FREEDOM WALL".
//
// So the *rendering* is shared — SceneBanner.tsx draws both, and the Freedom
// Wall plaque is now a call to it with its title and eyebrow supplied — while
// the config is its own thing, because "a caption the admin typed" and "the
// name of the active event" are different data with different lifetimes.
//
// Stored as an ordinary MuseumSceneObject of kind "banner": positionX/Y/Z +
// rotationY place it (room-local, the same space every other placement uses)
// and the JSON blob below rides in the `modelUrl` column — the same
// config-in-modelUrl trick text labels (TextObjectConfig), the divider walls
// (WallDividerConfig) and the Stories pedestal (PodiumModelConfig) already
// use, so a banner needs no schema migration to exist.
//
// Client-safe (no prisma import) so the API routes, the public museum and the
// admin editor can all import it directly.

import { DEFAULT_BANNER_COLORS } from "@/lib/museum/freedomWallBanner";
import {
  MIN_BANNER_EDGE,
  MAX_BANNER_EDGE,
  MIN_BANNER_GLASS_OPACITY,
  MAX_BANNER_GLASS_OPACITY,
  MIN_BANNER_SHIMMER_SPEED,
  MAX_BANNER_SHIMMER_SPEED,
  MIN_BANNER_SHIMMER_STRENGTH,
  MAX_BANNER_SHIMMER_STRENGTH,
  MIN_BANNER_BRIGHTNESS,
  MAX_BANNER_BRIGHTNESS,
  type BannerFinish,
} from "@/lib/museum/roomBanner";

export const BANNER_KIND = "banner";

/** Shown in the editor's object list and confirm dialogs. */
export const BANNER_LABEL = "Banner";

export interface SceneBannerConfig {
  /** The headline. One line — a banner is a sign, not a paragraph; an admin
   *  wanting body copy wants Add Text, which wraps and has no backing. */
  text?: string;
  /**
   * The small spaced-out line above the title. Empty string means no eyebrow
   * at all and the title centres in the plaque — which is the right look for
   * a one-word sign ("EXIT") where a second line would only crowd it.
   */
  eyebrow?: string;
  /** The backing panel. */
  backgroundColor?: string;
  /** Raised edge border, and the eyebrow line's colour. */
  edgeColor?: string;
  /** The title's colour. */
  textColor?: string;
  /** Font *path* from PLAQUE_FONT_OPTIONS (lib/museum/aboutRoomBlocks.ts) —
   *  applies to the title only. The eyebrow stays in the fixed bold sans, the
   *  same way the Freedom Wall plaque's does: it is a label, not a voice, and
   *  a decorative face at 0.085 world units is unreadable. */
  fontFamily?: string;
  /** World-unit size of the title, clamped to [BANNER_FONT_SIZE_MIN,
   *  BANNER_FONT_SIZE_MAX] below. */
  fontSize?: number;
  /**
   * How wide the plaque is, in metres — or null for "fit the text", which is
   * the default and what the Freedom Wall plaque always did: the width is
   * estimated from the character count so a short caption gets a short sign.
   * Set a number to override that when two banners need to match each other
   * rather than their own contents.
   */
  width?: number | null;
  /** How tall the plaque is, in metres. Fixed rather than fitted — the title
   *  is one line, so height is a style choice, not a consequence. */
  height?: number;

  // ── Finish ───────────────────────────────────────────────────────────
  // The same surface the room's built-in labels wear (lib/museum/roomBanner
  // .ts's BannerFinish, drawn by BannerPanel.tsx): an uploaded panel image,
  // frosted glass, a shimmer riding across it, brightness, and an edge width
  // that used to be a hardcoded constant in the renderer.
  //
  // Carried per banner rather than read off the room's own style, because a
  // banner is a sign an admin placed for a reason — "EXIT" in frosted glass
  // over a painted room of price tags is a legitimate thing to want, and a
  // room-wide finish could never express it. The cost is that matching a
  // banner to its room is a few controls rather than automatic, which is the
  // right way round: the room's labels are a set, a sign is one object.
  //
  // Every field is optional and defaults to the panel exactly as it drew
  // before these existed, so no banner already standing in a room changes.
  /** Optional image stretched across the panel. */
  textureUrl?: string | null;
  /** How far the edge stands past the face, per side, in metres. */
  edgeThickness?: number;
  /** Frosted-glass panel instead of a solid painted one. */
  glassEnabled?: boolean;
  /** How solid that glass reads, 0–1. */
  glassOpacity?: number;
  /** A band of light travelling across the glass. Glass-only. */
  shimmerEnabled?: boolean;
  /** Sweeps per second. */
  shimmerSpeed?: number;
  /** How hot the band burns, 0–1. */
  shimmerStrength?: number;
  /** Multiplier on the panel surface, 0–2. Never touches the text. */
  brightness?: number;
}

export const BANNER_FONT_SIZE_MIN = 0.1;
export const BANNER_FONT_SIZE_MAX = 0.9;
export const BANNER_MIN_WIDTH = 0.6;
export const BANNER_MAX_WIDTH = 18;
export const BANNER_MIN_HEIGHT = 0.3;
export const BANNER_MAX_HEIGHT = 4;
/** Half the renderer's old EDGE_INSET (0.05, which was added to the panel's
 *  total width) — the same trim, now expressed per side like every other
 *  plaque's edge, so a banner looks identical to how it always did until an
 *  admin moves the slider. */
export const BANNER_DEFAULT_EDGE = 0.025;

/** Where a freshly added banner spawns, in metres off the floor — eye level
 *  for a standing visitor plus a little, so a new banner reads as signage
 *  rather than as something lying on the ground. */
export const BANNER_DEFAULT_Y = 2.6;

/** A new banner. Inherits the Freedom Wall plaque's palette — a dark panel
 *  with a gold edge, legible against any admin-chosen wall colour — so the
 *  two read as the same object family when they share a room. */
export const DEFAULT_BANNER_CONFIG: Required<SceneBannerConfig> = {
  text: "Banner",
  eyebrow: "",
  backgroundColor: DEFAULT_BANNER_COLORS.backgroundColor,
  edgeColor: DEFAULT_BANNER_COLORS.edgeColor,
  textColor: DEFAULT_BANNER_COLORS.textColor,
  fontFamily: DEFAULT_BANNER_COLORS.fontFamily,
  fontSize: 0.3,
  width: null,
  height: 0.92,
  // The finish a banner drew with before it had any of these controls: a solid
  // painted panel with a thin edge and nothing else. BANNER_DEFAULT_EDGE is
  // half the renderer's old EDGE_INSET, which added to the panel's *total*
  // width while this is per side.
  textureUrl: null,
  edgeThickness: BANNER_DEFAULT_EDGE,
  glassEnabled: false,
  glassOpacity: 0.62,
  shimmerEnabled: false,
  shimmerSpeed: 0.5,
  shimmerStrength: 0.5,
  brightness: 1,
};

/** Longest title kept in full; anything past this is ellipsised at render
 *  time rather than rejected on input, so pasting a long line degrades
 *  gracefully instead of silently losing what was typed. */
export const BANNER_MAX_CHARS = 60;
export const BANNER_EYEBROW_MAX_CHARS = 28;

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

/** Parse the config JSON stored in the SceneObject's `modelUrl` column.
 *  Anything unparseable (or a row that somehow holds a bare URL) falls back to
 *  a default banner rather than rendering nothing — the same forgiving
 *  contract parseWallDividerConfig and parseTextConfig keep. */
export function parseSceneBannerConfig(
  raw: string | null | undefined
): Required<SceneBannerConfig> {
  if (!raw) return { ...DEFAULT_BANNER_CONFIG };
  try {
    const parsed = JSON.parse(raw) as SceneBannerConfig;
    return {
      // An empty string is a legitimate choice for `text` (a purely
      // decorative coloured plaque), so this checks the type rather than
      // truthiness — `|| DEFAULT` would silently refuse to let it be cleared.
      text: typeof parsed.text === "string" ? parsed.text : DEFAULT_BANNER_CONFIG.text,
      eyebrow:
        typeof parsed.eyebrow === "string" ? parsed.eyebrow : DEFAULT_BANNER_CONFIG.eyebrow,
      backgroundColor:
        typeof parsed.backgroundColor === "string" && parsed.backgroundColor
          ? parsed.backgroundColor
          : DEFAULT_BANNER_CONFIG.backgroundColor,
      edgeColor:
        typeof parsed.edgeColor === "string" && parsed.edgeColor
          ? parsed.edgeColor
          : DEFAULT_BANNER_CONFIG.edgeColor,
      textColor:
        typeof parsed.textColor === "string" && parsed.textColor
          ? parsed.textColor
          : DEFAULT_BANNER_CONFIG.textColor,
      fontFamily:
        typeof parsed.fontFamily === "string" && parsed.fontFamily
          ? parsed.fontFamily
          : DEFAULT_BANNER_CONFIG.fontFamily,
      fontSize: clampNumber(
        parsed.fontSize,
        BANNER_FONT_SIZE_MIN,
        BANNER_FONT_SIZE_MAX,
        DEFAULT_BANNER_CONFIG.fontSize
      ),
      // null and undefined both mean "fit the text" — only a real number is
      // an override.
      width:
        typeof parsed.width === "number" && Number.isFinite(parsed.width)
          ? Math.min(BANNER_MAX_WIDTH, Math.max(BANNER_MIN_WIDTH, parsed.width))
          : null,
      height: clampNumber(
        parsed.height,
        BANNER_MIN_HEIGHT,
        BANNER_MAX_HEIGHT,
        DEFAULT_BANNER_CONFIG.height
      ),
      // The finish, clamped to the room-wide style's own bounds rather than a
      // second set of numbers — the two wear the same surface, so an edge or a
      // shimmer that is out of range on one has no business being in range on
      // the other.
      textureUrl:
        typeof parsed.textureUrl === "string" && parsed.textureUrl ? parsed.textureUrl : null,
      edgeThickness: clampNumber(
        parsed.edgeThickness,
        MIN_BANNER_EDGE,
        MAX_BANNER_EDGE,
        DEFAULT_BANNER_CONFIG.edgeThickness
      ),
      glassEnabled:
        typeof parsed.glassEnabled === "boolean"
          ? parsed.glassEnabled
          : DEFAULT_BANNER_CONFIG.glassEnabled,
      glassOpacity: clampNumber(
        parsed.glassOpacity,
        MIN_BANNER_GLASS_OPACITY,
        MAX_BANNER_GLASS_OPACITY,
        DEFAULT_BANNER_CONFIG.glassOpacity
      ),
      shimmerEnabled:
        typeof parsed.shimmerEnabled === "boolean"
          ? parsed.shimmerEnabled
          : DEFAULT_BANNER_CONFIG.shimmerEnabled,
      shimmerSpeed: clampNumber(
        parsed.shimmerSpeed,
        MIN_BANNER_SHIMMER_SPEED,
        MAX_BANNER_SHIMMER_SPEED,
        DEFAULT_BANNER_CONFIG.shimmerSpeed
      ),
      shimmerStrength: clampNumber(
        parsed.shimmerStrength,
        MIN_BANNER_SHIMMER_STRENGTH,
        MAX_BANNER_SHIMMER_STRENGTH,
        DEFAULT_BANNER_CONFIG.shimmerStrength
      ),
      brightness: clampNumber(
        parsed.brightness,
        MIN_BANNER_BRIGHTNESS,
        MAX_BANNER_BRIGHTNESS,
        DEFAULT_BANNER_CONFIG.brightness
      ),
    };
  } catch {
    return { ...DEFAULT_BANNER_CONFIG };
  }
}

export function serializeSceneBannerConfig(config: SceneBannerConfig): string {
  return JSON.stringify({ ...DEFAULT_BANNER_CONFIG, ...config });
}

/**
 * A plain painted panel with the default trim and nothing else — the finish for
 * a plaque that has only its two colours to give. The Freedom Wall's event
 * plaque is the one such caller: it shares this renderer but not this config,
 * and it has never had a texture or a glass mode of its own.
 */
export function solidBannerFinish(panelColor: string, edgeColor: string): BannerFinish {
  return {
    panelColor,
    edgeColor,
    edgeThickness: BANNER_DEFAULT_EDGE,
    textureUrl: null,
    glassEnabled: false,
    glassOpacity: DEFAULT_BANNER_CONFIG.glassOpacity,
    shimmerEnabled: false,
    shimmerSpeed: DEFAULT_BANNER_CONFIG.shimmerSpeed,
    shimmerStrength: DEFAULT_BANNER_CONFIG.shimmerStrength,
    brightness: 1,
  };
}

/**
 * This banner's surface, in the shape BannerPanel.tsx draws.
 *
 * A banner names its own two colours `backgroundColor` / `edgeColor` (it has
 * since the Freedom Wall plaque it grew out of) while a room's labels call the
 * same two `panelColor` / `edgeColor`. Rather than rename a field in every
 * stored row, the mapping lives here — one function, so the renderer never has
 * to know that these two config shapes disagree about a word.
 */
export function bannerFinish(config: Required<SceneBannerConfig>): BannerFinish {
  return {
    panelColor: config.backgroundColor,
    edgeColor: config.edgeColor,
    edgeThickness: config.edgeThickness,
    textureUrl: config.textureUrl,
    glassEnabled: config.glassEnabled,
    glassOpacity: config.glassOpacity,
    shimmerEnabled: config.shimmerEnabled,
    shimmerSpeed: config.shimmerSpeed,
    shimmerStrength: config.shimmerStrength,
    brightness: config.brightness,
  };
}

/**
 * How wide the plaque should be drawn, in metres.
 *
 * drei's <Text> can't be measured before it lays out, so an explicit width is
 * estimated from an average-glyph ratio (~0.55 em) plus padding — the same
 * estimate the Freedom Wall plaque has always used, kept here so both callers
 * size identically. Clamped so a one-word banner still reads as a plaque and
 * a long one can't overrun the room it stands in.
 */
export function bannerWidth(
  config: Required<SceneBannerConfig>,
  roomWidth: number
): number {
  if (config.width !== null) return Math.min(config.width, roomWidth - 0.4);
  const label = config.text.slice(0, BANNER_MAX_CHARS);
  const eyebrowNeeds = config.eyebrow
    ? config.eyebrow.slice(0, BANNER_EYEBROW_MAX_CHARS).length * 0.11 + 0.8
    : 0;
  return Math.min(
    roomWidth - 1.2,
    Math.max(1.6, label.length * config.fontSize * 0.55 + 1.1, eyebrowNeeds)
  );
}
