// lib/museum/aboutRoomBlocks.ts
//
// The About ScriptOverNovel room's three admin-movable content blocks (Photo
// Slideshow, Bio & Skills Plaque, Certificates Strip) — the rest of that
// room's content stays exactly where AboutRoomContents.tsx's procedural
// layout puts it (individual skill chips are not independently movable; that
// would mean rebuilding that file's auto-wrapping logic for comparatively
// little benefit).
//
// Certificates are the exception, and a deliberate one: a single certificate
// can be nudged and resized on its own (see "Per-certificate placement"
// below) *without* the strip losing its even spread. Each override is a
// delta from where the spread put that certificate, so the strip's own Wall /
// Hang Width / Hang Height / Resize still move and scale all of them at once
// — "together" and "one at a time" are the same control at two levels, not
// two competing layouts.
//
// Each block is a real MuseumSceneObject row (kind "about-photo" |
// "about-plaque" | "about-certs"), lazily provisioned the same way a
// room's custom decorative objects are — see
// app/api/digital-museum/rooms/[id]/scene-objects/route.ts. Unlike a
// custom decorative object, whose positionX/Y/Z is an *absolute* world
// placement, these three store a *position offset*
// (default 0,0,0 — "use the designed layout, unmoved") that
// AboutRoomContents.tsx adds on top of each block's own hardcoded
// anchor. An offset made more sense than an absolute position here
// because each block's internal content (multiple Text/mesh elements)
// already positions itself relative to a shared local origin — nudging
// that whole origin is exactly what "move this block" means, with zero
// risk of fighting the internal layout math.
//
// Wall selection is encoded in the SceneObject's `rotationY` field (which
// was previously unused for About blocks) as a compass bearing:
//   0        → North (default for Photo + Plaque)
//   Math.PI/2 → West  (default for Certs)
//   Math.PI   → South
//  -Math.PI/2 → East
// This avoids a schema migration and keeps the existing PATCH API path
// unchanged — `rotationY` is already a float column on MuseumSceneObject.
//
// Extra plaque display config (brightness, logo scale, per-field font
// size/family) is stored as JSON in the `modelUrl` column of the
// about-plaque SceneObject, which is otherwise null for all About blocks.
import { FRAME_CENTER_Y } from "@/app/(public)/gallery/museum/components/framePlacement";
import { ROOM_WIDTH, FRAME_WALL_OFFSET } from "@/app/(public)/gallery/museum/components/roomConstants";

// Mirrors AboutRoomContents.tsx's own PORTRAIT_X/PLAQUE_X/PLAQUE_TOP_Y/
// CERT_LABEL_Y exactly — duplicated as plain numbers rather than
// imported from that file, since it's a "use client" component that
// pulls in three.js/@react-three/*; this module needs to stay importable
// from server code (the scene-objects API route's lazy provisioning)
// without dragging that whole graph along. If those anchors ever move in
// AboutRoomContents.tsx, update the matching numbers here too.
const ABOUT_PORTRAIT_X = -5.4;
const ABOUT_PLAQUE_X = -1.5;
const ABOUT_PLAQUE_TOP_Y = FRAME_CENTER_Y + 1.7;
// Mirrors AboutRoomContents.tsx's own CallingCard component — "FRAME_CENTER_Y
// + 0.3" there, same duplication convention as the three anchors above.
const ABOUT_CARD_Y = FRAME_CENTER_Y + 0.3;
// How far along the wall the plaque's glass panel's middle sits from the
// block's own origin — AboutRoomContents' PLAQUE_PANEL_CENTER_X − PLAQUE_X,
// i.e. half its PLAQUE_WIDTH. Same hand-kept mirror as the anchors above.
const ABOUT_PLAQUE_PANEL_CENTER_OFFSET = 8.6 / 2;

export const ABOUT_PHOTO_KIND = "about-photo";
export const ABOUT_PLAQUE_KIND = "about-plaque";
export const ABOUT_CERTS_KIND = "about-certs";
export const ABOUT_CARD_KIND = "about-card";
export const ABOUT_GIGS_KIND = "about-gigs";
export const ABOUT_BLOCK_KINDS = [ABOUT_PHOTO_KIND, ABOUT_PLAQUE_KIND, ABOUT_CERTS_KIND, ABOUT_CARD_KIND, ABOUT_GIGS_KIND] as const;

/**
 * The Contact Desk. Deliberately NOT one of ABOUT_BLOCK_KINDS above: those
 * hang on a wall and are placed by wall + along-wall + hang-height, whereas
 * this is furniture — it stands on the floor and is dragged and turned freely,
 * exactly like a Stories podium or an Arcade cabinet. So its row stores a real
 * absolute placement (positionX/Y/Z + rotationY + scale) rather than the
 * wall-relative offsets an About block keeps.
 */
export const ABOUT_CONTACT_KIND = "about-contact";
export const CONTACT_DESK_LABEL = "Contact Desk";
export type AboutBlockKind = (typeof ABOUT_BLOCK_KINDS)[number];

export const ABOUT_BLOCK_LABEL: Record<AboutBlockKind, string> = {
  [ABOUT_PHOTO_KIND]: "Photo Slideshow",
  [ABOUT_PLAQUE_KIND]: "Bio & Skills Plaque",
  [ABOUT_CERTS_KIND]: "Certificates Strip",
  [ABOUT_CARD_KIND]: "Calling Card",
  [ABOUT_GIGS_KIND]: "Timeline & Gigs",
};

// --- Wall selection --------------------------------------------------------

export type AboutWall = "north" | "south" | "east" | "west";

// The rotationY angles that encode each wall in the SceneObject row.
// North = 0, matching the zero-rotation convention for objects placed on
// the room's back wall (facing the visitor as they enter).
export const WALL_ROT_Y: Record<AboutWall, number> = {
  north:  0,
  west:   Math.PI / 2,
  south:  Math.PI,
  east:  -Math.PI / 2,
};

// Tolerance for float equality when reading rotY back from the DB —
// double-precision round-tripping is exact for these values (0, π/2, π,
// -π/2), but guard against rare float drift anyway.
const WALL_ROT_TOL = 0.05;

export function rotYToWall(rotY: number): AboutWall {
  for (const [wall, angle] of Object.entries(WALL_ROT_Y) as [AboutWall, number][]) {
    if (Math.abs(rotY - angle) < WALL_ROT_TOL) return wall;
  }
  return "north"; // unknown value → default
}

// Default wall per block kind — used when the DB row has rotY = 0 (which
// was the only value before this feature was added).
export const DEFAULT_BLOCK_WALL: Record<AboutBlockKind, AboutWall> = {
  [ABOUT_PHOTO_KIND]: "north",
  [ABOUT_PLAQUE_KIND]: "north",
  [ABOUT_CERTS_KIND]: "west",
  [ABOUT_CARD_KIND]: "east",
  [ABOUT_GIGS_KIND]: "south",
};

// --- Plaque display config -------------------------------------------------

// Available self-hosted fonts exposed in the editor.
// Key = display label, value = path under /fonts/ (troika accepts .woff/.ttf).
export const PLAQUE_FONT_OPTIONS: Record<string, string> = {
  "DM Sans Regular":  "/fonts/DMSans-Regular.woff",
  "DM Sans Bold":     "/fonts/DMSans-Bold.woff",
  "DM Sans Italic":   "/fonts/DMSans-Italic.woff",
  "Anime Ace":        "/fonts/AnimeAce.ttf",
  "Bada Boom BB":     "/fonts/BadaBoomBB.ttf",
};

export interface PlaqueConfig {
  /** 0–2 multiplier applied to the glass backing panel's base opacity (0.62).
   *  < 1 = more transparent; > 1 = more opaque (clamped at 1.0). */
  brightness?: number;
  /** 0–1 — tints the frosted glass panel from its default light grey toward
   *  near-black (and firms up its opacity), so the plaque can read as a dark
   *  panel. The logo plate tracks the same tint. */
  darkness?: number;
  /** Multiplier applied to the default PLAQUE_LOGO_HEIGHT (0.6 world units).
   *  Range [0.25, 3.0]. */
  logoScale?: number;
  // Per-field font size overrides (world units) —
  // null/undefined → use the hardcoded default.
  nameSize?: number;
  headlineSize?: number;
  factsSize?: number;
  bioSize?: number;
  // Per-field font family overrides — value must be a key from PLAQUE_FONT_OPTIONS.
  nameFontFamily?: string;
  headlineFontFamily?: string;
  factsFontFamily?: string;
  bioFontFamily?: string;
  // Per-field hex text colour overrides.
  nameColor?: string;
  headlineColor?: string;
  factsColor?: string;
  bioColor?: string;
  // "Artist Skills" heading above the skill badges.
  skillsLabel?: string;
  skillsLabelSize?: number;
  skillsLabelColor?: string;
  skillsLabelFontFamily?: string;
  // Skill pill styling — uniform across every pill (no more per-skill
  // accent tint from ArtistSkill.hoverColor, which was left over from the
  // web About page's CSS :hover and read as noise in 3D).
  skillsPillFontFamily?: string;
  /** 0.35–2 multiplier on the pill/text size — shrinks further only if it
   *  wouldn't fit within 2 rows (see resolveSkillLayout). */
  skillsPillFontSize?: number;
  skillsPillTextColor?: string;
  skillsPillColor?: string;
  /** Row alignment within the plaque's text column. */
  skillsAlign?: "left" | "center";
  /**
   * How fast a band of light travels across the plaque's frosted-glass backing
   * panel — in sweeps per second, so 1 is one pass a second and 0 holds the
   * panel still.
   *
   * It needs no enabling: it runs at this default, and an admin only comes
   * here to slow it down, speed it up or switch it off. The sweep is confined
   * to the panel itself; nothing in front of it (name, bio, skill pills) is
   * touched, so text never flickers and the pills stay exactly as legible far
   * away as up close.
   */
  plaqueShimmerSpeed?: number;
  /**
   * How bright the band itself burns, 0–1. Separate from the speed because
   * they are separate complaints: a sweep can be the right pace and still be
   * too hot for a pale plaque, or too faint to see on a dark one. 0 is the
   * same as switching the shimmer off.
   */
  plaqueShimmerStrength?: number;
}

export const DEFAULT_PLAQUE_CONFIG: Required<PlaqueConfig> = {
  brightness:          1,
  darkness:            0,
  logoScale:           1,
  nameSize:            0.34,
  headlineSize:        0.2,
  factsSize:           0.13,
  bioSize:             0.145,
  nameFontFamily:      "/fonts/DMSans-Bold.woff",
  headlineFontFamily:  "/fonts/DMSans-Italic.woff",
  factsFontFamily:     "/fonts/DMSans-Regular.woff",
  bioFontFamily:       "/fonts/DMSans-Regular.woff",
  nameColor:           "#f7f3ea",
  headlineColor:       "#8fd6b4",
  factsColor:          "#c7c1b0",
  bioColor:            "#ddd8c9",
  skillsLabel:         "ARTIST SKILLS",
  skillsLabelSize:     0.16,
  skillsLabelColor:    "#8fd6b4",
  skillsLabelFontFamily: "/fonts/DMSans-Bold.woff",
  skillsPillFontFamily: "/fonts/DMSans-Regular.woff",
  skillsPillFontSize:  1,
  skillsPillTextColor: "#b0a790",
  skillsPillColor:     "#b0a790",
  skillsAlign:         "left",
  plaqueShimmerSpeed:  0.5,
  plaqueShimmerStrength: 0.5,
};

/** Parse plaque config from the JSON stored in SceneObject.modelUrl.
 *  Returns DEFAULT_PLAQUE_CONFIG merged with any valid overrides. */
export function parsePlaqueConfig(raw: string | null | undefined): Required<PlaqueConfig> {
  if (!raw) return { ...DEFAULT_PLAQUE_CONFIG };
  try {
    const parsed = JSON.parse(raw) as Partial<PlaqueConfig>;
    const merged = { ...DEFAULT_PLAQUE_CONFIG, ...parsed };
    // The shimmer briefly shipped as a skill-pill effect under its own key
    // before moving to the plaque panel. Carry a speed saved back then over
    // rather than silently resetting it to the default.
    const legacySpeed = (parsed as { skillsShimmerSpeed?: unknown }).skillsShimmerSpeed;
    if (parsed.plaqueShimmerSpeed === undefined && typeof legacySpeed === "number") {
      merged.plaqueShimmerSpeed = legacySpeed;
    }
    return merged;
  } catch {
    return { ...DEFAULT_PLAQUE_CONFIG };
  }
}

// --- Text-label scene-object config ----------------------------------------
// Stored as JSON in SceneObject.modelUrl (same trick as PlaqueConfig).
// `fontFamily` is the font *path* value from PLAQUE_FONT_OPTIONS — not the
// display label — so it can be passed directly to drei's <Text font={...} />.

export interface TextObjectConfig {
  /** Text content to display (multi-line via \n). */
  text: string;
  /** Font size in world units. */
  fontSize: number;
  /** Font path (value from PLAQUE_FONT_OPTIONS). */
  fontFamily: string;
  /** Hex color string e.g. "#ffffff". */
  color: string;
  /** Max line width in world units before wrapping. */
  maxWidth: number;
}

export const DEFAULT_TEXT_CONFIG: Required<TextObjectConfig> = {
  text:       "Text Label",
  fontSize:   0.2,
  fontFamily: "/fonts/DMSans-Bold.woff",
  color:      "#ffffff",
  maxWidth:   3.0,
};

/** Parse text-object config from the JSON stored in SceneObject.modelUrl. */
export function parseTextConfig(raw: string | null | undefined): Required<TextObjectConfig> {
  if (!raw) return { ...DEFAULT_TEXT_CONFIG };
  try {
    const parsed = JSON.parse(raw) as Partial<TextObjectConfig>;
    return { ...DEFAULT_TEXT_CONFIG, ...parsed };
  } catch {
    return { ...DEFAULT_TEXT_CONFIG };
  }
}

// --- About-block label config (Certs banner / Calling Card title) ---------
// Stored as JSON in the certs / calling-card SceneObject's modelUrl — same
// trick as PlaqueConfig/TextObjectConfig/BannerColors. Makes the two
// hardcoded labels ("CERTIFICATES & AWARDS", "CALLING CARD") admin-editable
// the same way the Freedom Wall event plaque is (see freedomWallBanner.ts).

export interface AboutLabelConfig {
  /** Heading text. */
  text: string;
  /** Font path (value from PLAQUE_FONT_OPTIONS). */
  fontFamily: string;
  /** Font size in world units. */
  fontSize: number;
  /** Hex text color. */
  textColor: string;
  /** Hex color of the plate behind the text. */
  backgroundColor: string;
  /** Plate opacity 0–1 — 0 hides the plate entirely. */
  backgroundOpacity: number;
  /**
   * Timeline & Gigs only — a multiplier on the caption strip under the map
   * (the next event's name and, below it, its date and venue). 1 is the
   * designed size.
   *
   * A multiplier rather than a size per line, because those two lines are one
   * block of description: sized independently they stop reading as a heading
   * and its subtitle. The other two label kinds carry the field and ignore it,
   * which keeps this one shared config shape rather than a gigs-only variant.
   */
  descriptionScale: number;
}

export const DEFAULT_CERTS_LABEL_CONFIG: Required<AboutLabelConfig> = {
  text:              "CERTIFICATES & AWARDS",
  fontFamily:        "/fonts/DMSans-Regular.woff",
  fontSize:          0.15,
  textColor:         "#8fd6b4",
  backgroundColor:   "#d4d0c6",
  backgroundOpacity: 0.62,
  descriptionScale:  1,
};

export const DEFAULT_CARD_LABEL_CONFIG: Required<AboutLabelConfig> = {
  text:              "CALLING CARD",
  fontFamily:        "/fonts/DMSans-Regular.woff",
  fontSize:          0.1,
  textColor:         "#8fd6b4",
  backgroundColor:   "#d4d0c6",
  backgroundOpacity: 0,
  descriptionScale:  1,
};

export const DEFAULT_GIGS_LABEL_CONFIG: Required<AboutLabelConfig> = {
  text:              "TIMELINE & GIGS",
  fontFamily:        "/fonts/DMSans-Regular.woff",
  fontSize:          0.16,
  textColor:         "#8fd6b4",
  backgroundColor:   "#d4d0c6",
  backgroundOpacity: 0.62,
  descriptionScale:  1,
};

/** Default label config per block kind (the kinds that have a heading). */
export function defaultAboutLabelConfig(kind: AboutBlockKind): Required<AboutLabelConfig> {
  if (kind === ABOUT_CARD_KIND) return { ...DEFAULT_CARD_LABEL_CONFIG };
  if (kind === ABOUT_GIGS_KIND) return { ...DEFAULT_GIGS_LABEL_CONFIG };
  return { ...DEFAULT_CERTS_LABEL_CONFIG };
}

/** Parse label config from SceneObject.modelUrl JSON, merged over `defaults`. */
export function parseAboutLabelConfig(
  raw: string | null | undefined,
  defaults: Required<AboutLabelConfig>
): Required<AboutLabelConfig> {
  if (!raw) return { ...defaults };
  try {
    const parsed = JSON.parse(raw) as Partial<AboutLabelConfig>;
    return { ...defaults, ...parsed };
  } catch {
    return { ...defaults };
  }
}

// --- Per-certificate placement ---------------------------------------------
// Rides in the certs block's own modelUrl JSON, alongside its AboutLabelConfig
// (see mergeSceneObjectConfig below for how the two stay out of each other's
// way), keyed by Certificate id.
//
// Every value is a *delta* from the strip's automatic even spread, never an
// absolute spot on the wall. That is what lets the two levels of control
// coexist: moving or resizing the strip still moves and resizes every
// certificate with it, adding a certificate still re-spreads the row, and a
// nudged certificate keeps its nudge through both. It also gives "Reset" an
// obvious meaning — zero — instead of "whatever the spread would have said,
// which depends on how many certificates there are today".

/**
 * How many certificates the strip hangs. The rest of an artist's list is left
 * off the wall rather than crammed onto it — a ninth thumbnail makes every
 * other one smaller to no one's benefit, and the full list is on /about.
 *
 * Lives here rather than in AboutRoomContents.tsx (which owns every other
 * certificate constant) because the Scene Editor's per-certificate picker has
 * to list exactly the ones actually hung, and that panel cannot import from a
 * three.js "use client" component without dragging three into its bundle.
 */
export const MAX_WALL_CERTS = 8;

export interface CertPlacement {
  /** Slide along the wall from the spread position, in metres. */
  along: number;
  /** Hang-height delta from the strip's own height, in metres. */
  height: number;
  /** Size multiplier on top of the strip's Resize. 1 = as designed. */
  scale: number;
}

/** Keyed by MuseumAboutCertificate.id. A missing entry means "unmoved". */
export type CertPlacementMap = Record<string, CertPlacement>;

export const DEFAULT_CERT_PLACEMENT: CertPlacement = { along: 0, height: 0, scale: 1 };

// Bounds shared by the editor's sliders and the parser's clamp below, so
// neither can be widened without the other — the same convention
// CLOCK_GLOW_MIN/MAX follows. The nudge range is generous enough to walk a
// certificate to the far end of any wall (the widest room is 24m) and the
// scale range spans "a small badge" to "the centrepiece of the wall".
export const CERT_NUDGE_MIN = -12;
export const CERT_NUDGE_MAX = 12;
export const CERT_ITEM_SCALE_MIN = 0.3;
export const CERT_ITEM_SCALE_MAX = 3;

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

/** One certificate's override, clamped, with every missing field defaulted. */
export function resolveCertPlacement(
  placements: CertPlacementMap | undefined,
  certId: string
): CertPlacement {
  const stored = placements?.[certId];
  if (!stored) return { ...DEFAULT_CERT_PLACEMENT };
  return {
    along:  clampNumber(stored.along,  CERT_NUDGE_MIN, CERT_NUDGE_MAX, 0),
    height: clampNumber(stored.height, CERT_NUDGE_MIN, CERT_NUDGE_MAX, 0),
    scale:  clampNumber(stored.scale,  CERT_ITEM_SCALE_MIN, CERT_ITEM_SCALE_MAX, 1),
  };
}

/** True when a placement says "leave this one where the spread put it" — what
 *  the editor uses to mark which certificates have been moved, and what lets
 *  an untouched one be dropped from the JSON rather than stored as zeroes. */
export function isDefaultCertPlacement(placement: CertPlacement): boolean {
  return placement.along === 0 && placement.height === 0 && placement.scale === 1;
}

/** Parse the per-certificate overrides out of the certs block's modelUrl. */
export function parseCertPlacements(raw: string | null | undefined): CertPlacementMap {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as { certPlacements?: unknown };
    const stored = parsed?.certPlacements;
    if (!stored || typeof stored !== "object") return {};
    const out: CertPlacementMap = {};
    for (const [certId, value] of Object.entries(stored as Record<string, unknown>)) {
      if (!value || typeof value !== "object") continue;
      out[certId] = resolveCertPlacement({ [certId]: value as CertPlacement }, certId);
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Merge `patch` into whatever JSON a scene object's modelUrl already holds.
 *
 * The certs block is the first row to keep *two* unrelated configs in that one
 * column — its heading banner and these placements — and each is edited from
 * its own panel. Rewriting the column with only the half being edited (which
 * is what a plain JSON.stringify of one config does) would silently drop the
 * other, so both edit paths go through this instead. Unparseable JSON is
 * treated as empty: the patch still lands rather than being lost to a value
 * nothing can read anyway.
 */
export function mergeSceneObjectConfig(
  raw: string | null | undefined,
  patch: Record<string, unknown>
): string {
  let existing: Record<string, unknown> = {};
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        existing = parsed as Record<string, unknown>;
      }
    } catch {
      // fall through to {}
    }
  }
  return JSON.stringify({ ...existing, ...patch });
}

// --- Contact desk config ---------------------------------------------------
// The About room's one interactive prop: walk up, press [E], and the museum's
// own "Send an Email" form opens over the scene. Stored as JSON in the
// about-contact SceneObject's modelUrl, the same trick every other block
// config here uses.
//
// The model is swappable exactly the way the Stories Room's pedestal and the
// Arcade Room's cabinet are (see storyPodiumModel.ts / arcadeConfig.ts), and
// for the same reason: what the prop *looks* like is the artist's call, while
// what it *does* stays in code.

export interface ContactDeskConfig {
  /**
   * Optional tiled surface image for the *built-in* desk — the same kind of
   * upload a room's wall/floor/ceiling takes, tiled in the same world units.
   * Ignored when `url` is set: an uploaded .glb brings its own materials.
   */
  textureUrl?: string | null;
  /** Supabase URL of an uploaded .glb standing in for the built-in desk.
   *  Null = the built-in one, which is the default state of a fresh row. */
  url?: string | null;
  /** Heading on the panel the desk opens. */
  title?: string;
  /** The line under that heading. */
  subtitle?: string;
  /** What the walk-up prompt reads, in place of "Send an Email". */
  promptLabel?: string;
}

export const DEFAULT_CONTACT_DESK_CONFIG: Required<ContactDeskConfig> = {
  textureUrl:  null,
  url:         null,
  title:       "Send an Email",
  subtitle:    "Questions, commissions, collaborations — this reaches the artist directly.",
  promptLabel: "Send an Email",
};

/** Where a freshly provisioned desk stands: against the east wall, beside the
 *  Calling Card, turned to face into the room. Room-local; the admin drags it
 *  anywhere from there. */
export function defaultContactDeskPlacement(): {
  positionX: number;
  positionY: number;
  positionZ: number;
  rotationY: number;
} {
  return {
    positionX: ROOM_WIDTH / 2 - FRAME_WALL_OFFSET - CONTACT_DESK_WALL_GAP,
    positionY: 0,
    positionZ: 0,
    // Facing west, into the room, since it stands on the east wall.
    rotationY: -Math.PI / 2,
  };
}

/** How far off a wall the default placement above stands the desk — it is
 *  furniture with real depth, not a hanging. */
const CONTACT_DESK_WALL_GAP = 0.46;

export function parseContactDeskConfig(
  raw: string | null | undefined
): Required<ContactDeskConfig> {
  if (!raw) return { ...DEFAULT_CONTACT_DESK_CONFIG };
  try {
    const parsed = JSON.parse(raw) as Partial<ContactDeskConfig>;
    return { ...DEFAULT_CONTACT_DESK_CONFIG, ...parsed };
  } catch {
    return { ...DEFAULT_CONTACT_DESK_CONFIG };
  }
}

export function serializeContactDeskConfig(config: Partial<ContactDeskConfig>): string {
  return JSON.stringify({ ...DEFAULT_CONTACT_DESK_CONFIG, ...config });
}

// --- Digital wall clock ----------------------------------------------------
// A working clock hanging in the About room: it reads the real current time,
// every second, for as long as a visitor is standing there.
//
// Placed the same free way the Contact Desk is — a real absolute placement,
// dragged, turned and resized in the Scene Editor — rather than as one of the
// wall-anchored About blocks, because unlike them it has no designed home:
// where a clock belongs is entirely the artist's call, and half the point of
// hanging one is choosing the wall a visitor will glance at.
//
// Its config rides in the row's modelUrl as JSON, the same trick every other
// block config here uses. There is no model to swap: the clock is drawn by
// code so the digits can actually keep time.

export const ABOUT_CLOCK_KIND = "about-clock";
export const WALL_CLOCK_LABEL = "Digital Wall Clock";

export interface WallClockConfig {
  /** Small caption above the digits (a city, a studio name). Blank hides it. */
  label?: string;
  /** 24-hour ("16:05") instead of 12-hour with an AM/PM suffix. */
  use24Hour?: boolean;
  /** Show a ticking seconds field. Off = the display only changes each minute. */
  showSeconds?: boolean;
  /** Show the date line under the time. */
  showDate?: boolean;
  /**
   * IANA time zone the clock reads in (e.g. "Asia/Manila"). Blank = the
   * visitor's own device time, which is the honest default for a museum
   * anyone can walk into; set it to show the *artist's* local time instead,
   * which is what makes a clock on this particular wall worth reading.
   */
  timeZone?: string;
  /** Hex colour of the digits. */
  digitColor?: string;
  /** Hex colour of the screen behind them. */
  screenColor?: string;
  /** Hex colour of the case around it. */
  frameColor?: string;
  /** 0–2 — how hard the digits glow. 0 is a plain unlit readout. */
  glow?: number;
}

export const DEFAULT_WALL_CLOCK_CONFIG: Required<WallClockConfig> = {
  label:       "",
  use24Hour:   false,
  showSeconds: true,
  showDate:    true,
  timeZone:    "",
  digitColor:  "#8fd6b4",
  screenColor: "#12151a",
  frameColor:  "#2a2f38",
  glow:        1,
};

/** Bounds for the glow slider — shared by the editor's control and the
 *  renderer's clamp so neither can be widened without the other. */
export const CLOCK_GLOW_MIN = 0;
export const CLOCK_GLOW_MAX = 2;

/**
 * Longest caption the clock face can hold. At its drawn size and letter
 * spacing this is about as much as fits inside the screen; past it the
 * caption overruns the case. Shared with the editor's field so an admin is
 * stopped at the same point the renderer would have truncated them, rather
 * than typing a line that silently loses its tail.
 */
export const MAX_CLOCK_LABEL = 16;

/** How high above eye level a freshly provisioned clock hangs — where a wall
 *  clock goes in a real room: above the things you stand and read. */
const CLOCK_HANG_HEIGHT = 1.05;
/**
 * Its along-wall spot on the north wall. Right of everything else that hangs
 * there by default: the Photo Slideshow sits around x = -5.4, and the Bio &
 * Skills Plaque's glass panel runs from about -1.9 out to 7.5 (PLAQUE_X plus
 * PLAQUE_WIDTH and its padding — see AboutRoomContents). 8.5 clears that edge
 * with room to spare and still keeps most of a metre between the clock and
 * the corner.
 */
const CLOCK_DEFAULT_X = 8.5;

/**
 * Where a freshly provisioned clock hangs: high on the north wall, right of
 * the plaque, facing into the room. Room-local; the admin drags it anywhere
 * from there.
 */
export function defaultWallClockPlacement(depth: number): {
  positionX: number;
  positionY: number;
  positionZ: number;
  rotationY: number;
} {
  return {
    positionX: CLOCK_DEFAULT_X,
    positionY: FRAME_CENTER_Y + CLOCK_HANG_HEIGHT,
    positionZ: -depth / 2 + FRAME_WALL_OFFSET,
    // North wall — the same zero-rotation "facing the visitor as they enter"
    // convention WALL_ROT_Y encodes.
    rotationY: WALL_ROT_Y.north,
  };
}

export function parseWallClockConfig(
  raw: string | null | undefined
): Required<WallClockConfig> {
  if (!raw) return { ...DEFAULT_WALL_CLOCK_CONFIG };
  try {
    const parsed = JSON.parse(raw) as Partial<WallClockConfig>;
    return { ...DEFAULT_WALL_CLOCK_CONFIG, ...parsed };
  } catch {
    return { ...DEFAULT_WALL_CLOCK_CONFIG };
  }
}

export function serializeWallClockConfig(config: Partial<WallClockConfig>): string {
  return JSON.stringify({ ...DEFAULT_WALL_CLOCK_CONFIG, ...config });
}

// --- Block meta (placement + wall + optional per-block config) ------------

export interface AboutBlockMeta {
  /** `[alongWall, height, 0]`. `offset[0]` slides the block along its wall
   *  (the wall picker's rotation turns local X into the along-wall axis),
   *  `offset[1]` is the hang-height delta added to the designed anchor Y.
   *  `offset[2]` is always 0 — the perpendicular axis comes from the wall.
   *  About blocks are placed like an artwork frame: wall + width + height +
   *  resize, never a free 3D drag/rotate. */
  offset: [number, number, number];
  /** Which wall this block is mounted on (defaults to the designed wall). */
  wall: AboutWall;
  /** Uniform resize multiplier (SceneObject.scale) — 1 = designed size. */
  scale: number;
  /**
   * The admin switched this block off in the Scene Editor ("Hide from
   * Museum"). Carried as a flag rather than by leaving the entry out,
   * because for these five kinds a missing entry already means something
   * else — "no admin has moved this block, draw it where the design puts
   * it" — so omission would restore the block instead of hiding it.
   *
   * Every consumer has to honour it: the block's own render, the minimap dot
   * that stands for it, and any proximity tracker that lights it up.
   */
  hidden?: boolean;
  /** Only set for ABOUT_PLAQUE_KIND — parsed from SceneObject.modelUrl JSON. */
  plaqueConfig?: Required<PlaqueConfig>;
  /** Only set for ABOUT_CERTS_KIND / ABOUT_CARD_KIND — parsed from
   *  SceneObject.modelUrl JSON. */
  labelConfig?: Required<AboutLabelConfig>;
  /** Only set for ABOUT_CERTS_KIND — per-certificate nudges, out of the same
   *  modelUrl JSON as labelConfig. Empty/absent = every certificate sits
   *  exactly where the strip's even spread puts it. */
  certPlacements?: CertPlacementMap;
}

export interface AboutBlockOffsets {
  [ABOUT_PHOTO_KIND]?: AboutBlockMeta;
  [ABOUT_PLAQUE_KIND]?: AboutBlockMeta;
  [ABOUT_CERTS_KIND]?: AboutBlockMeta;
  [ABOUT_CARD_KIND]?: AboutBlockMeta;
  [ABOUT_GIGS_KIND]?: AboutBlockMeta;
}

/**
 * Same per-wall X/Z/rotationY resolution as AboutRoomContents.tsx's own
 * (deliberately duplicated, not imported — that file is a "use client"
 * component pulling in three.js/@react-three/*, and this module needs to
 * stay importable from server code; keep the two in sync by hand if the
 * room's wall geometry ever changes) local `wallGeometry` helper — the
 * axis perpendicular to the wall (snapped to the wall face) and the axis
 * along it (the caller adds its own offset/anchor shift on top).
 */
function getWallGeometry(wall: AboutWall, depth: number): { x: number; z: number; rotationY: number } {
  const northZ = -depth / 2 + FRAME_WALL_OFFSET;
  const southZ = depth / 2 - FRAME_WALL_OFFSET;
  const westX = -ROOM_WIDTH / 2 + FRAME_WALL_OFFSET;
  const eastX = ROOM_WIDTH / 2 - FRAME_WALL_OFFSET;
  switch (wall) {
    case "north": return { x: 0, z: northZ, rotationY: 0 };
    case "south": return { x: 0, z: southZ, rotationY: Math.PI };
    case "west": return { x: westX, z: 0, rotationY: Math.PI / 2 };
    case "east": return { x: eastX, z: 0, rotationY: -Math.PI / 2 };
  }
}

/**
 * One block's designed anchor point (room-local, before centerZ is added)
 * for whichever wall it's *actually* mounted on — the Museum Scene
 * Editor's placeholder proxies render at anchor + offset so an admin sees
 * roughly where a block actually sits, not just an offset-from-nothing.
 *
 * Previously this ignored `wall` entirely and always returned the block's
 * *default* wall's anchor (About ScriptOverNovel's Photo/Plaque assumed north,
 * Certs assumed west) — so picking a different wall in the editor visibly
 * did nothing: the wireframe placeholder stayed put at the old anchor
 * while only its rotation changed, reading as "East/West don't work, it
 * just stays on North/South." Taking `wall` as its own parameter (instead
 * of just `depth`) is the actual fix — same wall resolution
 * AboutRoomContents.tsx's own wallGeometry already used correctly on the
 * public site the whole time, this just catches the editor's preview up
 * to it.
 */
export function getAboutBlockAnchor(kind: AboutBlockKind, wall: AboutWall, depth: number): [number, number, number] {
  const geo = getWallGeometry(wall, depth);
  // Photo/Plaque have a designed off-centre "along the wall" position, but
  // only on north/south — on east/west they sit centred. That along-wall
  // value is resolved onto the wall via its rotation (local X → room-local
  // XZ), exactly as AboutRoomContents.tsx's alongWallShift does, so this
  // stays in lockstep with the public render.
  const onNorthSouth = wall === "north" || wall === "south";
  const designedAlong =
    kind === ABOUT_PHOTO_KIND  ? (onNorthSouth ? ABOUT_PORTRAIT_X : 0)
    : kind === ABOUT_PLAQUE_KIND ? (onNorthSouth ? ABOUT_PLAQUE_X : 0)
    : 0;
  const x = geo.x + designedAlong * Math.cos(geo.rotationY);
  const z = geo.z - designedAlong * Math.sin(geo.rotationY);
  const y =
    kind === ABOUT_PLAQUE_KIND ? ABOUT_PLAQUE_TOP_Y
    : kind === ABOUT_CARD_KIND ? ABOUT_CARD_Y
    : FRAME_CENTER_Y; // photo + certs + gigs sit at eye level
  return [x, y, z];
}

/**
 * Where one About block actually hangs, room-local, on the floor plan: its
 * designed anchor for the wall it's mounted on, plus the admin's "Hang Width"
 * slide resolved along that wall. Y is dropped — this is the coordinate space
 * MiniMapFrameState wants (see MiniMapTracker.tsx), where the minimap plots a
 * dot per wall hanging exactly as it does for a curated room's artwork frames.
 *
 * Same two lines AboutRoomContents.tsx composes for its own render (wall
 * geometry + alongWallShift), factored out here so a dot on the minimap can
 * never drift from the block it stands for — and so the math stays reachable
 * from code that must not import that "use client" three.js component.
 */
export function getAboutBlockLocalXZ(
  kind: AboutBlockKind,
  meta: AboutBlockMeta | undefined,
  depth: number
): { x: number; z: number } {
  const wall = meta?.wall ?? DEFAULT_BLOCK_WALL[kind];
  const [anchorX, , anchorZ] = getAboutBlockAnchor(kind, wall, depth);
  // Every block but the plaque is drawn centred on its anchor, so the anchor
  // is where its dot belongs. The plaque is the exception: its origin is the
  // top-left of the name, and the glass panel runs from there most of the way
  // across the wall, so the anchor is near one end of a nine-metre block.
  // Left uncorrected, its dot marked the wrong spot and — since the dot is
  // also what the map measures "the visitor is at this" against — it only lit
  // up while they stood at the plaque's left-hand end.
  const along =
    (meta?.offset[0] ?? 0) +
    (kind === ABOUT_PLAQUE_KIND ? ABOUT_PLAQUE_PANEL_CENTER_OFFSET * (meta?.scale ?? 1) : 0);
  const rotY = WALL_ROT_Y[wall];
  return {
    x: anchorX + along * Math.cos(rotY),
    z: anchorZ - along * Math.sin(rotY),
  };
}
