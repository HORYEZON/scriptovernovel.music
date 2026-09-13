// lib/museum/minimapHud.ts
//
// Single source of truth for how the museum's bottom-left radar card looks —
// the map canvas (MiniMapHud.tsx) and the counters stacked underneath it
// (AchievementHud.tsx), which visitors read as one card and an admin should
// be able to style as one thing.
//
// Stored as JSON in DigitalMuseum.minimapConfig rather than a column per
// knob: this is a dozen presentation values that only ever travel together,
// and the same config-in-one-column pattern the divider walls, the Arcade
// Room and the Contact Desk already use (lib/museum/wallDivider.ts and
// friends). Every field is optional on the way in and defaulted on the way
// out, so a museum configured before any of this existed — a null column —
// reads back as exactly the hard-coded look those two components shipped
// with, and adding a knob later never needs a migration.
//
// The defaults below are not invented: they are the literal values that were
// hard-coded in MiniMapHud.tsx / AchievementHud.tsx, so "Reset to defaults"
// restores today's museum rather than someone's idea of a nice one.

/** Which lucide icon a counter draws. Kept as a small curated list rather
 *  than "any icon name": the value is rendered by mapping to a real imported
 *  component (see MINIMAP_COUNTER_ICONS in AchievementHud.tsx), and an
 *  unrecognised name would render nothing at all. */
export const MINIMAP_ICON_NAMES = [
  "footprints",
  "eye",
  "clock",
  "heart",
  "star",
  "sparkles",
  "map-pin",
  "compass",
  "flag",
  "trophy",
  "bookmark",
  "activity",
] as const;

export type MinimapIconName = (typeof MINIMAP_ICON_NAMES)[number];

export interface MinimapHudConfig {
  /** Map canvas size in CSS pixels, desktop. Mobile's tap-to-expand panel
   *  (StatsMinimapPanel.tsx) keeps its own smaller pair — a phone screen is
   *  ~390px across, and a map sized for a desktop corner would take the view
   *  away rather than sit beside it. */
  width: number;
  height: number;
  /** Counter row size as a percentage of its designed size — one knob for
   *  the icons and the digits together, since scaling one without the other
   *  is never what an admin means by "make the counters bigger". */
  counterScale: number;
  /** The player's own facing wedge. */
  playerColor: string;
  /** Artwork frames hanging in the room, and Freedom Wall sticky notes,
   *  which deliberately share the artwork treatment. */
  artworkColor: string;
  /** Admin-placed .glb props — drawn dimmer and smaller than artwork dots so
   *  the pieces a visitor came to see stay the primary marks. */
  objectColor: string;
  /** The glow on whatever the visitor is standing close enough to open. */
  activeColor: string;
  /** Chase Companions sharing the room. */
  companionColor: string;
  /** The room outline, and the tick marking a doorway in it. */
  roomColor: string;
  doorColor: string;
  /** Icon per counter, in the order the card draws them. */
  stepsIcon: MinimapIconName;
  viewsIcon: MinimapIconName;
  timeIcon: MinimapIconName;
  wishlistIcon: MinimapIconName;
}

export const MINIMAP_HUD_DEFAULTS: MinimapHudConfig = {
  width: 240,
  height: 200,
  counterScale: 100,
  playerColor: "#34d399",
  artworkColor: "#ffffff",
  objectColor: "#ffffff",
  activeColor: "#facc15",
  companionColor: "#60a5fa",
  roomColor: "#ffffff",
  doorColor: "#34d399",
  stepsIcon: "footprints",
  viewsIcon: "eye",
  timeIcon: "clock",
  wishlistIcon: "heart",
};

export const MINIMAP_MIN_WIDTH = 160;
export const MINIMAP_MAX_WIDTH = 420;
export const MINIMAP_MIN_HEIGHT = 120;
export const MINIMAP_MAX_HEIGHT = 360;
export const MINIMAP_MIN_COUNTER_SCALE = 70;
export const MINIMAP_MAX_COUNTER_SCALE = 180;

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.round(Math.min(max, Math.max(min, n)));
}

/** Hex only — these are painted straight onto a canvas (and, for the dots,
 *  used as `shadowColor` too), so anything the browser can't parse silently
 *  draws nothing rather than failing loudly. */
function sanitizeHex(value: unknown, fallback: string): string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value.trim())
    ? value.trim().toLowerCase()
    : fallback;
}

function sanitizeIcon(value: unknown, fallback: MinimapIconName): MinimapIconName {
  return typeof value === "string" && (MINIMAP_ICON_NAMES as readonly string[]).includes(value)
    ? (value as MinimapIconName)
    : fallback;
}

/** Fills every field from a partial/unknown object. The one function both
 *  the API route and the two rendering components go through, so a value
 *  that reaches the canvas has already been bounded. */
export function sanitizeMinimapHudConfig(value: unknown): MinimapHudConfig {
  const raw = (value && typeof value === "object" ? value : {}) as Partial<MinimapHudConfig>;
  const d = MINIMAP_HUD_DEFAULTS;
  return {
    width: clampNumber(raw.width, MINIMAP_MIN_WIDTH, MINIMAP_MAX_WIDTH, d.width),
    height: clampNumber(raw.height, MINIMAP_MIN_HEIGHT, MINIMAP_MAX_HEIGHT, d.height),
    counterScale: clampNumber(
      raw.counterScale,
      MINIMAP_MIN_COUNTER_SCALE,
      MINIMAP_MAX_COUNTER_SCALE,
      d.counterScale
    ),
    playerColor: sanitizeHex(raw.playerColor, d.playerColor),
    artworkColor: sanitizeHex(raw.artworkColor, d.artworkColor),
    objectColor: sanitizeHex(raw.objectColor, d.objectColor),
    activeColor: sanitizeHex(raw.activeColor, d.activeColor),
    companionColor: sanitizeHex(raw.companionColor, d.companionColor),
    roomColor: sanitizeHex(raw.roomColor, d.roomColor),
    doorColor: sanitizeHex(raw.doorColor, d.doorColor),
    stepsIcon: sanitizeIcon(raw.stepsIcon, d.stepsIcon),
    viewsIcon: sanitizeIcon(raw.viewsIcon, d.viewsIcon),
    timeIcon: sanitizeIcon(raw.timeIcon, d.timeIcon),
    wishlistIcon: sanitizeIcon(raw.wishlistIcon, d.wishlistIcon),
  };
}

/** The stored column → a usable config. Null (never configured) and invalid
 *  JSON both mean "the look this shipped with", which is what the defaults
 *  above are. */
export function parseMinimapHudConfig(json: string | null | undefined): MinimapHudConfig {
  if (!json) return { ...MINIMAP_HUD_DEFAULTS };
  try {
    return sanitizeMinimapHudConfig(JSON.parse(json));
  } catch {
    return { ...MINIMAP_HUD_DEFAULTS };
  }
}

export function serializeMinimapHudConfig(config: MinimapHudConfig): string {
  return JSON.stringify(sanitizeMinimapHudConfig(config));
}

/**
 * A canvas fill/stroke colour at partial opacity.
 *
 * The map's marks were authored as rgba() strings — the room outline at 55%,
 * an artwork dot at 80%, a prop dot at 45% — and those opacities are doing
 * real work: they are what makes a prop dot recede behind an artwork dot
 * rather than compete with it. An admin picks a colour, not an alpha, so the
 * per-mark opacity stays in the drawing code and is applied here, which
 * keeps a default-coloured map pixel-identical to the one before any of this
 * was configurable.
 */
export function withAlpha(hex: string, alpha: number): string {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return hex;
  const int = parseInt(m[1], 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}
