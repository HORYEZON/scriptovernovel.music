// lib/museum/roomBanner.ts
//
// "Room Banner" — one room-wide style for every plaque a room draws.
//
// Each of these rooms already had a small titled panel under (or on) whatever
// it displays, and every one of them was hardcoded to the same browns:
//
//   • Stories   — the plaque under each pedestal (StoryPodium.tsx)
//   • Arcade    — the cabinet marquee and the poster's title strip
//                 (ArcadeCabinet.tsx / ArcadePoster.tsx)
//   • Services  — the price tag under each frame (ServicesRoomContents.tsx)
//   • About     — the Certificates / Calling Card / Gigs headings
//                 (AboutRoomContents.tsx's AboutBanner)
//   • Cosplay   — the standee's foot plaque (CosplayStandee.tsx)
//
// The Cosplay one was the only ever admin-editable one, through five flat
// `plaque*` keys on its own room config (see cosplayStandee.ts). This module is
// that idea finished: the same knobs, defined once, for all five rooms — so an
// admin themes a room away from the default browns and its labels come with it
// instead of belonging to a different museum.
//
// Stored as a kind-marked singleton MuseumSceneObject per room, the same
// lazy-provisioned pattern as the Stories pedestal (storyPodiumModel.ts), the
// Arcade cabinet (arcadeConfig.ts) and the Cosplay standee (cosplayStandee.ts).
// Like those, this row is *configuration, not a placement* — it is never drawn
// where it "sits", its position columns are unused, and MuseumScene.tsx skips
// it when building the room's decorative object list or it would render as a
// stray prop at the origin.
//
// Why one row per room rather than one per plaque: a room of twelve pedestals
// wants one label design, not twelve. Same reasoning that made the Cosplay
// standee config room-scoped.
//
// Client-safe (no prisma import) so the museum page, the scene-objects API
// route, the public scene and the Museum Scene Editor can all import it. The DB
// provisioning lives in roomBannerProvision.ts, which imports this module.

/** Rooms whose plaques this styles. Anything else has no banner to theme. */
export const ROOM_BANNER_KIND = "room-banner";

/**
 * Shown in the editor's object list and confirm dialogs.
 *
 * "Room Label Style" and not "Room Banner", which is what it was called when
 * it shipped: a room can also hold any number of Banners an admin added from
 * the toolbar (lib/museum/sceneBanner.ts), and once those grew the same glass
 * and shimmer controls this one has, two panels in the same sidebar both said
 * "Banner" while doing entirely different jobs — this restyles labels the room
 * already draws for you, that one is a sign with words you typed. The stored
 * `kind` stays "room-banner": renaming what an admin reads costs nothing,
 * renaming a column value in every existing row costs a migration.
 */
export const ROOM_BANNER_LABEL = "Room Label Style";

/**
 * The *finish* half of a plaque's style — everything BannerPanel.tsx actually
 * paints, with nothing about the type on it.
 *
 * Split out because two different things now wear the same surface: this
 * module's room-wide style (below), and each Banner an admin drops into a room
 * from the toolbar (lib/museum/sceneBanner.ts), which carries its own copy so
 * one sign can be glass while the room's built-in labels stay painted. Sharing
 * the shape is what lets both hand the same component to the same renderer
 * rather than growing a second, slightly different frosted panel.
 */
export interface BannerFinish {
  // ── Panel ───────────────────────────────────────────────────────────
  /** The backing panel behind the text. */
  panelColor: string;
  /** The raised edge behind that panel — the same relationship the Banner's
   *  edgeColor has to its background. Always drawn: an edge is part of what a
   *  plaque *is*, and setting it to panelColor is the honest way to not have
   *  one (same call the Cosplay backdrop edge already made). */
  edgeColor: string;
  /** How far the edge stands past the panel, in metres, per side. Trim, not
   *  structure — past a few centimetres it stops reading as a border and
   *  starts reading as a second, larger panel with a label stuck in it. */
  edgeThickness: number;

  // ── Surface ─────────────────────────────────────────────────────────
  /**
   * Optional image printed across the panel — brushed metal, wood, a paper
   * grain. Stretched to the panel rather than tiled in world units the way a
   * wall texture is: a plaque is one object an admin picked a finish for, not
   * a surface running the length of a room, and tiling a 2048px grain across a
   * 30cm price tag shows one meaningless corner of it.
   *
   * `panelColor` still applies on top as a tint (three multiplies map by
   * colour), so a white panel colour shows the image as uploaded and a warmer
   * one stains it — which is how an admin matches one upload to five rooms.
   */
  textureUrl: string | null;

  // ── Glassmorphism ───────────────────────────────────────────────────
  /**
   * Frosted-glass panel instead of a solid one — the look the About room's
   * Bio & Skills plaque already wears (AboutRoomContents' PLAQUE_GLASS_*), now
   * available to every room's labels.
   *
   * A toggle rather than "just set the opacity low", because glass is more
   * than translucency here: it also drops the panel's roughness so it catches
   * a highlight, and it is what the shimmer below rides on.
   */
  glassEnabled: boolean;
  /** How solid the glass reads, 0–1. The About plaque's own frosted panel sits
   *  at 0.62, which is the default here for the same reason. */
  glassOpacity: number;

  // ── Shimmer ─────────────────────────────────────────────────────────
  /**
   * A soft band of light travelling across the panel. Its own switch rather
   * than "speed 0 means off" so an admin can park a tuned speed/strength and
   * flick the effect off without losing the numbers they settled on.
   *
   * Glass-only: on a solid painted panel the sweep reads as a rendering fault
   * rather than as light on a surface, so the renderer ignores it when
   * glassEnabled is false and the editor greys it out.
   */
  shimmerEnabled: boolean;
  /** Sweeps per second — 1 is one pass a second. */
  shimmerSpeed: number;
  /** How hot the band burns, 0–1. Separate from the speed because they are
   *  separate complaints: a sweep can be the right pace and still be too
   *  bright for a pale panel, or too faint to see on a dark one. */
  shimmerStrength: number;

  // ── Brightness ──────────────────────────────────────────────────────
  /**
   * Multiplier on the panel surface, 0–2. Below 1 the panel sits back into an
   * unlit corner; above 1 it reads as catching a light the room doesn't
   * actually have, which is what a sign in a dim room needs to stay readable.
   *
   * Applied to the panel only — never the text. Brightening a label's
   * background and its lettering together is a no-op on contrast, which is the
   * one thing an admin reaching for this control is trying to fix.
   */
  brightness: number;
}

export interface RoomBannerStyle extends BannerFinish {
  // ── Type ────────────────────────────────────────────────────────────
  /** Font *path* from PLAQUE_FONT_OPTIONS (lib/museum/aboutRoomBlocks.ts),
   *  applied to each plaque's title line only. The smaller lines under it
   *  (a story's author, a cosplay's series, a poster's subtitle) stay in the
   *  fixed regular face for the same reason the Banner's eyebrow does: a
   *  display face at 0.04 world units is unreadable. */
  fontFamily: string;
  /** Multiplier on every line's own size, so a plaque scales as a unit and
   *  keeps its hierarchy. 1 = the sizes each room shipped with. Deliberately a
   *  multiplier rather than an absolute size: the five rooms' plaques are not
   *  the same size to begin with, and one shared point size would either
   *  shrink the marquee or overflow the price tag. */
  fontScale: number;
  /** The title line's colour. The sub-lines are derived from it (mixed toward
   *  the panel) rather than each being separately settable — four independent
   *  pickers would let an admin build a label with no hierarchy left. */
  textColor: string;
}

// The values every one of these plaques was hardcoded to, so a freshly
// provisioned row changes nothing until an admin actually touches it — same
// contract ensureCosplayStandeeModel's defaults keep.
export const DEFAULT_ROOM_BANNER_STYLE: RoomBannerStyle = {
  fontFamily: "/fonts/DMSans-Bold.woff",
  fontScale: 1,
  textColor: "#f3e9d2",
  panelColor: "#3a3126",
  // The Banner plaque's gold (DEFAULT_BANNER_COLORS.edgeColor), so a room
  // using both reads as one design language rather than two accidents.
  edgeColor: "#c9a227",
  edgeThickness: 0.03,
  textureUrl: null,
  glassEnabled: false,
  glassOpacity: 0.62,
  shimmerEnabled: false,
  shimmerSpeed: 0.5,
  shimmerStrength: 0.5,
  brightness: 1,
};

/**
 * Room types that draw a plaque this styles — the string union rather than
 * Prisma's enum so this module stays importable from the browser without
 * pulling the client in.
 */
export type BannerRoomType = "STORIES" | "ARCADE" | "SERVICES" | "ABOUT" | "COSPLAY";

/**
 * What a given room's banner *starts* at.
 *
 * These five plaques were each hardcoded to their own colours, so one shared
 * default would have quietly repainted three rooms the first time this shipped.
 * Each room instead starts at the values it already had, and an admin who wants
 * them to match now has the controls to say so — which is the entire point.
 *
 * Two deliberate exceptions, both inside the Arcade Room, whose two plaques
 * disagreed with each other before this existed: a cabinet's marquee was purple
 * with white lettering and a poster's caption strip was the same brown as
 * everywhere else. One room, one label design — so the room takes the marquee's
 * purple, since CABINET is the room's own default display mode (see
 * arcadeConfig.ts) and the marquee is the plaque most visitors actually see.
 * The poster strips follow it. That is the one visible change this feature
 * makes on its own, and it is the change it was asked for.
 */
export function defaultRoomBannerStyle(roomType: BannerRoomType): RoomBannerStyle {
  switch (roomType) {
    case "ARCADE":
      // ArcadeCabinet.tsx's ACCENT_COLOR, and the white its marquee text was.
      return {
        ...DEFAULT_ROOM_BANNER_STYLE,
        panelColor: "#5b21b6",
        textColor: "#ffffff",
        edgeThickness: 0,
      };
    case "ABOUT":
      // The About headings' own plate/type (DEFAULT_CERTS_LABEL_CONFIG). Note
      // the About room keeps per-heading text, size, face and colour on each
      // block's own config — this row supplies that room's *finish* (edge,
      // texture, glass, shimmer, brightness). See AboutRoomContents' AboutBanner.
      return {
        ...DEFAULT_ROOM_BANNER_STYLE,
        panelColor: "#d4d0c6",
        textColor: "#8fd6b4",
        fontFamily: "/fonts/DMSans-Regular.woff",
        edgeThickness: 0,
      };
    case "COSPLAY":
      // The only one of the five that already had a raised edge (CosplayStandee
      // .tsx's PLAQUE_EDGE). Its colours are the shared defaults already.
      return { ...DEFAULT_ROOM_BANNER_STYLE, edgeThickness: 0.03 };
    case "STORIES":
    case "SERVICES":
    default:
      // Both were the shared browns with no edge at all — adding a gold border
      // to a price tag that never had one is not a default, it's a redesign.
      return { ...DEFAULT_ROOM_BANNER_STYLE, edgeThickness: 0 };
  }
}

// Bounds the editor's fields clamp to.
// Below half size a plaque is decoration rather than a label; past double it
// outgrows whatever it is attached to. Same range the Cosplay plaque's own
// scale already used, kept identical so the two behave the same.
export const MIN_BANNER_FONT_SCALE = 0.5;
export const MAX_BANNER_FONT_SCALE = 2;
export const MIN_BANNER_EDGE = 0;
export const MAX_BANNER_EDGE = 0.2;
export const MIN_BANNER_GLASS_OPACITY = 0.05;
export const MAX_BANNER_GLASS_OPACITY = 1;
// Slower than a sweep every four seconds reads as a stuck highlight rather
// than a moving one; faster than three a second is a flicker.
export const MIN_BANNER_SHIMMER_SPEED = 0.25;
export const MAX_BANNER_SHIMMER_SPEED = 3;
export const MIN_BANNER_SHIMMER_STRENGTH = 0;
export const MAX_BANNER_SHIMMER_STRENGTH = 1;
// 0 is a black panel, which is a legitimate (if extreme) choice; past 2 the
// panel blows out to flat white and takes the text's contrast with it.
export const MIN_BANNER_BRIGHTNESS = 0;
export const MAX_BANNER_BRIGHTNESS = 2;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function numberOr(raw: unknown, fallback: number, min: number, max: number): number {
  return typeof raw === "number" && Number.isFinite(raw) ? clamp(raw, min, max) : fallback;
}

function stringOr(raw: unknown, fallback: string): string {
  return typeof raw === "string" && raw ? raw : fallback;
}

function boolOr(raw: unknown, fallback: boolean): boolean {
  return typeof raw === "boolean" ? raw : fallback;
}

/**
 * Coerce a parsed blob into a complete style.
 *
 * `defaults` exists for the Cosplay Room, which reaches this module carrying
 * five years of already-set `plaque*` values it must not lose — it passes them
 * in as the fallbacks so an admin's existing plaque keeps exactly the look it
 * had the first time this row is read. Every other room passes nothing and
 * gets DEFAULT_ROOM_BANNER_STYLE.
 */
export function coerceRoomBannerStyle(
  parsed: Partial<RoomBannerStyle> | null | undefined,
  defaults: RoomBannerStyle = DEFAULT_ROOM_BANNER_STYLE
): RoomBannerStyle {
  const p = parsed ?? {};
  return {
    fontFamily: stringOr(p.fontFamily, defaults.fontFamily),
    fontScale: numberOr(p.fontScale, defaults.fontScale, MIN_BANNER_FONT_SCALE, MAX_BANNER_FONT_SCALE),
    textColor: stringOr(p.textColor, defaults.textColor),
    panelColor: stringOr(p.panelColor, defaults.panelColor),
    edgeColor: stringOr(p.edgeColor, defaults.edgeColor),
    edgeThickness: numberOr(p.edgeThickness, defaults.edgeThickness, MIN_BANNER_EDGE, MAX_BANNER_EDGE),
    // Only a real string is an upload; null and "" both mean "no texture".
    textureUrl: typeof p.textureUrl === "string" && p.textureUrl ? p.textureUrl : null,
    glassEnabled: boolOr(p.glassEnabled, defaults.glassEnabled),
    glassOpacity: numberOr(
      p.glassOpacity,
      defaults.glassOpacity,
      MIN_BANNER_GLASS_OPACITY,
      MAX_BANNER_GLASS_OPACITY
    ),
    shimmerEnabled: boolOr(p.shimmerEnabled, defaults.shimmerEnabled),
    shimmerSpeed: numberOr(
      p.shimmerSpeed,
      defaults.shimmerSpeed,
      MIN_BANNER_SHIMMER_SPEED,
      MAX_BANNER_SHIMMER_SPEED
    ),
    shimmerStrength: numberOr(
      p.shimmerStrength,
      defaults.shimmerStrength,
      MIN_BANNER_SHIMMER_STRENGTH,
      MAX_BANNER_SHIMMER_STRENGTH
    ),
    brightness: numberOr(
      p.brightness,
      defaults.brightness,
      MIN_BANNER_BRIGHTNESS,
      MAX_BANNER_BRIGHTNESS
    ),
  };
}

/** Parse the config JSON stored in the SceneObject's `modelUrl` column. Same
 *  forgiving contract every other config-in-modelUrl parser keeps: anything
 *  unparseable falls back to the defaults rather than rendering nothing. */
export function parseRoomBannerStyle(
  raw: string | null | undefined,
  defaults: RoomBannerStyle = DEFAULT_ROOM_BANNER_STYLE
): RoomBannerStyle {
  if (!raw) return { ...defaults };
  try {
    return coerceRoomBannerStyle(JSON.parse(raw) as Partial<RoomBannerStyle>, defaults);
  } catch {
    return { ...defaults };
  }
}

/**
 * Serialize back to the JSON stored in that column.
 *
 * Note the shape — coerce first, then stringify the whole thing. Listing keys
 * explicitly here is how the Cosplay backdrop edge once shipped broken: a field
 * added to the interface and the defaults was silently *dropped on every save*,
 * so the editor showed the control working and the value never survived a
 * reload. Going through coerceRoomBannerStyle makes a new field work by default
 * and an omission impossible.
 */
export function serializeRoomBannerStyle(style: Partial<RoomBannerStyle>): string {
  return JSON.stringify(coerceRoomBannerStyle(style));
}

/**
 * How the sub-lines under a title are tinted: the title colour mixed toward the
 * panel by `amount`, so the hierarchy survives whatever pair of colours an
 * admin picks. Kept here rather than in each renderer so a Stories author line
 * and a Cosplay series line are dimmed by the same rule.
 *
 * Hex in, hex out — the callers hand these straight to drei's <Text color>,
 * which is happiest with a string, and doing it here avoids five copies of the
 * same channel maths.
 */
export function mixBannerHex(from: string, to: string, amount: number): string {
  const parse = (hex: string): [number, number, number] => {
    const clean = hex.replace("#", "");
    const full =
      clean.length === 3
        ? clean.split("").map((c) => c + c).join("")
        : clean.padEnd(6, "0").slice(0, 6);
    return [
      parseInt(full.slice(0, 2), 16),
      parseInt(full.slice(2, 4), 16),
      parseInt(full.slice(4, 6), 16),
    ];
  };
  const t = clamp(amount, 0, 1);
  const [r1, g1, b1] = parse(from);
  const [r2, g2, b2] = parse(to);
  const mix = (a: number, b: number) =>
    Math.round(a + (b - a) * t)
      .toString(16)
      .padStart(2, "0");
  return `#${mix(r1, r2)}${mix(g1, g2)}${mix(b1, b2)}`;
}
