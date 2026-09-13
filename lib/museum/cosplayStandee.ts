// lib/museum/cosplayStandee.ts
//
// The Cosplay Room's room-wide standee settings — the admin's way to replace
// CosplayStandee.tsx's procedural standee with their own .glb, and to tune the
// backdrop panel every cosplay's photo hangs on, without giving up the part
// that has to stay dynamic: the two photos, which are each cosplay's own
// uploads.
//
// Stored as a kind-marked singleton MuseumSceneObject on the Cosplay Room —
// the same lazy-provisioned pattern as the Stories Room's pedestal config (see
// storyPodiumModel.ts, which this is modelled on) and the Freedom Wall's
// banner. Room-scoped rather than per-cosplay on purpose: a room of twelve
// standees wants one standee design, not twelve.
//
// Like the podium config, this object is *configuration, not a placement* — it
// is never drawn where it "sits". Its position columns are unused; the standees
// themselves are positioned by MuseumRoomCosplay rows (see standeePlacement.ts).
// MuseumScene.tsx therefore skips it when building the room's decorative object
// list, or it would render as a stray prop floating at the origin.
//
// Client-safe (no prisma import) so both server code (the museum page, the
// scene-objects API route) and client code (MuseumScene, the Museum Scene
// Editor) can import these directly — the DB provisioning lives in
// cosplayRoom.ts's ensureCosplayStandeeModel, which imports this module.

export const COSPLAY_STANDEE_MODEL_KIND = "cosplay-standee-model";

/** How tall the printed cut-out on the procedural standee is, in metres —
 *  roughly life-size against EYE_HEIGHT (1.7), which is the whole point of a
 *  standee. Also the fallback for `cutoutHeight` below. */
export const DEFAULT_STANDEE_CUTOUT_HEIGHT = 1.75;

/** Default size of the backdrop panel behind each standee, in metres. Wider
 *  and taller than the cut-out so the standee reads as standing *in front of*
 *  a hung photo rather than covering it. */
export const DEFAULT_BACKDROP_WIDTH = 2.6;
export const DEFAULT_BACKDROP_HEIGHT = 2.0;

export interface CosplayStandeeConfig {
  /**
   * Optional tiled surface image for the *procedural* standee's base — the
   * same kind of upload a room's wall/floor/ceiling takes, tiled in the same
   * world units (roomConstants' TEXTURE_TILE_METERS), so a base finished in
   * the floor's material reads as one surface.
   *
   * Ignored when `url` below is set: an uploaded .glb brings its own
   * materials, and repainting them would fight whatever the model looks like.
   */
  textureUrl?: string | null;
  /** Supabase URL of an uploaded .glb replacing the procedural standee body.
   *  Null/absent = use the built-in standee (the default state of a freshly
   *  provisioned row). The cut-out photo is still drawn on top either way,
   *  since it is per-cosplay and can't live in a shared model. */
  url?: string | null;
  /**
   * How high the cut-out's *centre* sits once `url` is used.
   *
   * An uploaded model's own height can't be known here without parsing its
   * glTF bounding box, and getting it wrong means a photo floating above the
   * frame or sunk into it — so this is an admin-tuned number rather than
   * something inferred. Same convention as the podium's bookHeight: the
   * model's origin is on the floor.
   */
  cutoutHeight?: number;
  /** Whether the backdrop panel is drawn at all. Off means the standees stand
   *  in the room on their own — a plain-walls arrangement some admins will
   *  prefer, and the honest answer for a room whose cosplays have no second
   *  photo uploaded. */
  backdropEnabled?: boolean;
  backdropWidth?: number;
  backdropHeight?: number;
  /** Frame/mat colour of that panel. A single colour rather than a palette:
   *  the photo is the subject, the panel is what holds it. */
  backdropFrameColor?: string;
  /**
   * The outer border behind the frame — the same raised edge the Banner plaque
   * has (see lib/museum/sceneBanner.ts), and there for the same reason: one
   * flat frame colour disappears against a wall painted anything near it, and
   * there was no way to make a standee's backdrop read as a framed object
   * rather than a rectangle of photo.
   *
   * Always drawn. It shipped behind an on/off toggle and shouldn't have: an
   * edge is part of what a frame *is*, and "frame with no edge" is just the
   * old flat panel under a second name. Setting it to the same colour as
   * backdropFrameColor is the honest way to not have one, and needs no switch.
   */
  backdropEdgeColor?: string;
  /** How far the border stands out past the frame, in metres, per side. */
  backdropEdgeThickness?: number;

  // ── The standee's foot plaque ────────────────────────────────────────
  // Its colours and type were hardcoded, so a room themed away from the
  // default browns had a label that belonged to a different museum. Same set
  // of knobs the Banner offers, and named the same way, since an admin
  // switching between the two panels is doing the same job in both.

  /** The plaque's backing panel. */
  plaquePanelColor?: string;
  /** Its raised edge — the same relationship to the panel as the Banner's
   *  edgeColor has to its background. */
  plaqueEdgeColor?: string;
  /** The character/title line. The smaller lines under it (series, event,
   *  credits) are derived from this rather than each being separately
   *  settable: they are a hierarchy, and four independent colour pickers
   *  would let an admin build a label with no hierarchy left. */
  plaqueTextColor?: string;
  /** Font *path* from PLAQUE_FONT_OPTIONS (lib/museum/aboutRoomBlocks.ts),
   *  applied to the title line only — the sub-lines stay in the fixed regular
   *  face, the same way the Banner's eyebrow does. A display font at 0.042
   *  world units is unreadable. */
  plaqueFontFamily?: string;
  /** Multiplier on every line's own size, so the label scales as a unit and
   *  keeps its hierarchy. 1 = the sizes it shipped with. */
  plaqueFontScale?: number;

  // ── Billboard lights ─────────────────────────────────────────────────
  // The marquee bulbs that can ring a standee's backdrop panel (see
  // BillboardLights.tsx). *Which* standees have them is per-standee —
  // MuseumRoomCosplay.lightsEnabled — because that switch is the point of the
  // feature; how they look is room-wide, like everything else here, so a room
  // that lights three of its standees lights them the same way.

  /**
   * Which *fixture* a lit standee gets.
   *
   * "marquee" — the bulbs that ship as the default: a ring of them around the
   * backdrop panel, the cinema-billboard look this whole feature started as.
   *
   * "floodlight" — stage/monument uplights instead: a row of small fixtures
   * standing on the floor at the standee's feet, each throwing a visible
   * cone of light up the front of the print. A different fixture, not a
   * different colour of the same one, which is why it's a style rather than
   * another toggle: the two share almost none of their geometry, and a room
   * that wants its cosplays lit from below wants that for all of them.
   *
   * Colour, brightness, pattern and speed below are shared by both — they
   * mean the same thing to a bulb and to a lamp. The size/spacing settings
   * are marquee-only and the flood* ones are floodlight-only; the editor
   * shows whichever pair belongs to the style in use.
   */
  lightsStyle?: LightsStyle;
  /** Bulb (or lamp) colour when lit. Unlit bulbs are drawn as a dimmed
   *  version of it, the way a real marquee's dark bulbs are still visibly the
   *  same glass. */
  lightsColor?: string;
  /** Brightness of a lit bulb, 0–2. Below 1 the bulbs read as glass beads with
   *  the room's light on them; above 1 they read as switched on. */
  lightsIntensity?: number;
  /** Bulb radius in metres. */
  lightsBulbSize?: number;
  /** Distance between bulb centres along the frame, in metres. The real count
   *  is worked out from the frame's own perimeter so the spacing comes out even
   *  on all four sides — a fixed count would bunch up on a narrow panel. */
  lightsSpacing?: number;
  /** "static" — every bulb lit, the plainest sign. "chase" — a lit run
   *  travelling round the frame, the fairground/theatre marquee. "blink" — the
   *  whole ring pulsing together. */
  lightsAnimation?: LightsAnimation;
  /** How fast "chase"/"blink" run. 1 = the pace they shipped with; ignored by
   *  "static", which doesn't move. */
  lightsSpeed?: number;

  // ── Floodlights only (lightsStyle: "floodlight") ─────────────────────
  // The marquee's bulb size/spacing describe a ring of beads; a floodlight
  // rig is a handful of lamps and the beams they throw, so it needs its own
  // three numbers rather than reinterpreting those.

  /** How many lamps stand at the standee's feet, spread evenly across its
   *  front. Two reads as a pair flanking the print, four-plus as a strip. */
  floodCount?: number;
  /** How far up the front of the print each beam reaches, in metres. The
   *  beams are aimed automatically from this — see FloodLights.tsx — so an
   *  admin sets how *far* the light throws, never the angle, which is the
   *  part that can be got wrong. */
  floodBeamHeight?: number;
  /** How wide the cone opens at the top, in metres. This is the "V": small
   *  values are a tight spot up the middle of the print, larger ones a broad
   *  wash across the whole board. */
  floodBeamSpread?: number;
}

export type LightsAnimation = "static" | "chase" | "blink";

export const LIGHTS_ANIMATIONS: LightsAnimation[] = ["static", "chase", "blink"];

export type LightsStyle = "marquee" | "floodlight";

export const LIGHTS_STYLES: LightsStyle[] = ["marquee", "floodlight"];

/** What each style is called in the editor — "marquee"/"floodlight" are the
 *  stored values, and neither is what an admin would call it out loud. */
export const LIGHTS_STYLE_LABELS: Record<LightsStyle, string> = {
  marquee: "Marquee Bulbs",
  floodlight: "Floodlights",
};

export const DEFAULT_COSPLAY_STANDEE_CONFIG: Required<CosplayStandeeConfig> = {
  textureUrl: null,
  url: null,
  cutoutHeight: DEFAULT_STANDEE_CUTOUT_HEIGHT,
  backdropEnabled: true,
  backdropWidth: DEFAULT_BACKDROP_WIDTH,
  backdropHeight: DEFAULT_BACKDROP_HEIGHT,
  backdropFrameColor: "#2a2118",
  // The Banner's gold, so a room using both reads as one design language
  // rather than two accidents (DEFAULT_BANNER_COLORS.edgeColor).
  backdropEdgeColor: "#c9a227",
  backdropEdgeThickness: 0.06,
  // The values the plaque was hardcoded to, so nothing already placed changes.
  plaquePanelColor: "#3a3126",
  plaqueEdgeColor: "#c9a227",
  plaqueTextColor: "#f3e9d2",
  plaqueFontFamily: "/fonts/DMSans-Bold.woff",
  plaqueFontScale: 1,
  // A warm filament white rather than the Banner's gold: these are bulbs, and
  // a saturated bulb reads as a coloured gel over one. Admins who want the gold
  // marquee can still pick it.
  // The bulbs are what this feature shipped as, so a room that was already
  // lit keeps exactly the look it had when the second style arrived.
  lightsStyle: "marquee",
  lightsColor: "#ffe1a8",
  lightsIntensity: 1.35,
  lightsBulbSize: 0.05,
  lightsSpacing: 0.26,
  lightsAnimation: "chase",
  lightsSpeed: 1,
  // Three lamps: one up the middle of the print and one at each shoulder,
  // which is how a monument or a stage backdrop is actually lit. Two leaves
  // the centre dark, four starts to read as a strip light rather than
  // separate fixtures.
  floodCount: 3,
  // Just past the standee's own 1.75m print height, so the wash covers the
  // figure's head rather than stopping at its chin.
  floodBeamHeight: 2.1,
  floodBeamSpread: 0.62,
};

/** Bounds the editor's fields clamp to — a standee taller than the room or a
 *  panel wider than the wall it hangs on is never what was meant. */
export const MIN_CUTOUT_HEIGHT = 0.6;
export const MAX_CUTOUT_HEIGHT = 3.4;
export const MIN_BACKDROP_SIZE = 0.8;
export const MAX_BACKDROP_SIZE = 5;
// The edge is trim, not structure: past a few centimetres it stops reading as
// a border and starts reading as a second, larger panel with a photo stuck in
// the middle of it.
export const MIN_BACKDROP_EDGE = 0.01;
export const MAX_BACKDROP_EDGE = 0.3;
// The plaque is read at a standee's ankles from a metre or two away — below
// half size it is decoration, and past double it outgrows the base it sits on.
export const MIN_PLAQUE_FONT_SCALE = 0.5;
export const MAX_PLAQUE_FONT_SCALE = 2;
// Bulbs. Under 2cm they disappear at walking distance; past 12cm they stop
// being bulbs and start being lamps bolted to a photo. Spacing is bounded the
// same way — tighter than 10cm the spheres intersect at any usable size, and
// wider than 60cm there is no longer a run of lights, just four corners.
export const MIN_BULB_SIZE = 0.02;
export const MAX_BULB_SIZE = 0.12;
export const MIN_BULB_SPACING = 0.1;
export const MAX_BULB_SPACING = 0.6;
export const MIN_LIGHTS_INTENSITY = 0.4;
export const MAX_LIGHTS_INTENSITY = 2;
export const MIN_LIGHTS_SPEED = 0.25;
export const MAX_LIGHTS_SPEED = 3;
// Floodlights. One lamp is a spotlight, not a flood; past six they stop being
// separate fixtures at a standee's width and start being a light strip — and
// each one is real geometry drawn per lit standee, so the ceiling is a budget
// as much as a taste call.
export const MIN_FLOOD_COUNT = 1;
export const MAX_FLOOD_COUNT = 6;
// A beam shorter than half a metre never reaches the print it's aimed at;
// past 3.5m it overshoots the tallest standee the editor allows (see
// MAX_CUTOUT_HEIGHT) and washes the wall behind instead.
export const MIN_FLOOD_BEAM_HEIGHT = 0.5;
export const MAX_FLOOD_BEAM_HEIGHT = 3.5;
// The cone's radius where it lands. Below ~15cm it's a laser rather than a
// flood; past 1.6m neighbouring beams have merged into one glow and the V is
// gone, which is the shape the whole fixture is recognised by.
export const MIN_FLOOD_BEAM_SPREAD = 0.15;
export const MAX_FLOOD_BEAM_SPREAD = 1.6;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function numberOr(raw: unknown, fallback: number, min: number, max: number) {
  return typeof raw === "number" && Number.isFinite(raw) ? clamp(raw, min, max) : fallback;
}

/** Parse the config JSON stored in the SceneObject's modelUrl column — same
 *  trick PodiumModelConfig / TextObjectConfig / PlaqueConfig already use. A row
 *  holding a bare URL (rather than JSON) is treated as the model URL, so an
 *  object written by a plainer upload path still works. */
export function parseCosplayStandeeConfig(
  raw: string | null | undefined
): Required<CosplayStandeeConfig> {
  if (!raw) return { ...DEFAULT_COSPLAY_STANDEE_CONFIG };
  try {
    const parsed = JSON.parse(raw) as CosplayStandeeConfig;
    return {
      textureUrl:
        typeof parsed.textureUrl === "string" && parsed.textureUrl ? parsed.textureUrl : null,
      url: typeof parsed.url === "string" && parsed.url ? parsed.url : null,
      cutoutHeight: numberOr(
        parsed.cutoutHeight,
        DEFAULT_STANDEE_CUTOUT_HEIGHT,
        MIN_CUTOUT_HEIGHT,
        MAX_CUTOUT_HEIGHT
      ),
      backdropEnabled:
        typeof parsed.backdropEnabled === "boolean"
          ? parsed.backdropEnabled
          : DEFAULT_COSPLAY_STANDEE_CONFIG.backdropEnabled,
      backdropWidth: numberOr(
        parsed.backdropWidth,
        DEFAULT_BACKDROP_WIDTH,
        MIN_BACKDROP_SIZE,
        MAX_BACKDROP_SIZE
      ),
      backdropHeight: numberOr(
        parsed.backdropHeight,
        DEFAULT_BACKDROP_HEIGHT,
        MIN_BACKDROP_SIZE,
        MAX_BACKDROP_SIZE
      ),
      backdropEdgeColor:
        typeof parsed.backdropEdgeColor === "string" && parsed.backdropEdgeColor
          ? parsed.backdropEdgeColor
          : DEFAULT_COSPLAY_STANDEE_CONFIG.backdropEdgeColor,
      backdropEdgeThickness: numberOr(
        parsed.backdropEdgeThickness,
        DEFAULT_COSPLAY_STANDEE_CONFIG.backdropEdgeThickness,
        MIN_BACKDROP_EDGE,
        MAX_BACKDROP_EDGE
      ),
      plaquePanelColor:
        typeof parsed.plaquePanelColor === "string" && parsed.plaquePanelColor
          ? parsed.plaquePanelColor
          : DEFAULT_COSPLAY_STANDEE_CONFIG.plaquePanelColor,
      plaqueEdgeColor:
        typeof parsed.plaqueEdgeColor === "string" && parsed.plaqueEdgeColor
          ? parsed.plaqueEdgeColor
          : DEFAULT_COSPLAY_STANDEE_CONFIG.plaqueEdgeColor,
      plaqueTextColor:
        typeof parsed.plaqueTextColor === "string" && parsed.plaqueTextColor
          ? parsed.plaqueTextColor
          : DEFAULT_COSPLAY_STANDEE_CONFIG.plaqueTextColor,
      plaqueFontFamily:
        typeof parsed.plaqueFontFamily === "string" && parsed.plaqueFontFamily
          ? parsed.plaqueFontFamily
          : DEFAULT_COSPLAY_STANDEE_CONFIG.plaqueFontFamily,
      plaqueFontScale: numberOr(
        parsed.plaqueFontScale,
        DEFAULT_COSPLAY_STANDEE_CONFIG.plaqueFontScale,
        MIN_PLAQUE_FONT_SCALE,
        MAX_PLAQUE_FONT_SCALE
      ),
      backdropFrameColor:
        typeof parsed.backdropFrameColor === "string" && parsed.backdropFrameColor
          ? parsed.backdropFrameColor
          : DEFAULT_COSPLAY_STANDEE_CONFIG.backdropFrameColor,
      // Same guard as lightsAnimation below, and for the same reason: an
      // unknown style would render no fixture at all, with nothing on screen
      // to say why.
      lightsStyle: LIGHTS_STYLES.includes(parsed.lightsStyle as LightsStyle)
        ? (parsed.lightsStyle as LightsStyle)
        : DEFAULT_COSPLAY_STANDEE_CONFIG.lightsStyle,
      lightsColor:
        typeof parsed.lightsColor === "string" && parsed.lightsColor
          ? parsed.lightsColor
          : DEFAULT_COSPLAY_STANDEE_CONFIG.lightsColor,
      lightsIntensity: numberOr(
        parsed.lightsIntensity,
        DEFAULT_COSPLAY_STANDEE_CONFIG.lightsIntensity,
        MIN_LIGHTS_INTENSITY,
        MAX_LIGHTS_INTENSITY
      ),
      lightsBulbSize: numberOr(
        parsed.lightsBulbSize,
        DEFAULT_COSPLAY_STANDEE_CONFIG.lightsBulbSize,
        MIN_BULB_SIZE,
        MAX_BULB_SIZE
      ),
      lightsSpacing: numberOr(
        parsed.lightsSpacing,
        DEFAULT_COSPLAY_STANDEE_CONFIG.lightsSpacing,
        MIN_BULB_SPACING,
        MAX_BULB_SPACING
      ),
      // Anything that isn't one of the three known modes falls back rather
      // than being trusted into the frame loop, where an unknown mode would
      // just leave the bulbs dark with no way to tell why.
      lightsAnimation: LIGHTS_ANIMATIONS.includes(parsed.lightsAnimation as LightsAnimation)
        ? (parsed.lightsAnimation as LightsAnimation)
        : DEFAULT_COSPLAY_STANDEE_CONFIG.lightsAnimation,
      lightsSpeed: numberOr(
        parsed.lightsSpeed,
        DEFAULT_COSPLAY_STANDEE_CONFIG.lightsSpeed,
        MIN_LIGHTS_SPEED,
        MAX_LIGHTS_SPEED
      ),
      // Rounded as well as clamped — a lamp count is a count, and a stored
      // 2.5 would otherwise reach the geometry and place half a fixture.
      floodCount: Math.round(
        numberOr(
          parsed.floodCount,
          DEFAULT_COSPLAY_STANDEE_CONFIG.floodCount,
          MIN_FLOOD_COUNT,
          MAX_FLOOD_COUNT
        )
      ),
      floodBeamHeight: numberOr(
        parsed.floodBeamHeight,
        DEFAULT_COSPLAY_STANDEE_CONFIG.floodBeamHeight,
        MIN_FLOOD_BEAM_HEIGHT,
        MAX_FLOOD_BEAM_HEIGHT
      ),
      floodBeamSpread: numberOr(
        parsed.floodBeamSpread,
        DEFAULT_COSPLAY_STANDEE_CONFIG.floodBeamSpread,
        MIN_FLOOD_BEAM_SPREAD,
        MAX_FLOOD_BEAM_SPREAD
      ),
    };
  } catch {
    return raw.startsWith("http")
      ? { ...DEFAULT_COSPLAY_STANDEE_CONFIG, url: raw }
      : { ...DEFAULT_COSPLAY_STANDEE_CONFIG };
  }
}

/**
 * Serialize back to the JSON stored in the SceneObject's modelUrl column.
 *
 * Note the shape: spread `merged` first, then override only the fields that
 * need clamping. It used to list every key explicitly instead — which meant
 * adding a field to the interface and to the defaults left it silently
 * *dropped on every save*, with the editor showing the new control working
 * (local state updated) and the value never surviving a reload. That is
 * exactly how the backdrop edge shipped broken. Spreading makes a new field
 * work by default and an omission impossible.
 */
export function serializeCosplayStandeeConfig(config: CosplayStandeeConfig): string {
  const merged = { ...DEFAULT_COSPLAY_STANDEE_CONFIG, ...config };
  return JSON.stringify({
    ...merged,
    textureUrl: merged.textureUrl ?? null,
    url: merged.url ?? null,
    cutoutHeight: clamp(merged.cutoutHeight, MIN_CUTOUT_HEIGHT, MAX_CUTOUT_HEIGHT),
    backdropWidth: clamp(merged.backdropWidth, MIN_BACKDROP_SIZE, MAX_BACKDROP_SIZE),
    backdropHeight: clamp(merged.backdropHeight, MIN_BACKDROP_SIZE, MAX_BACKDROP_SIZE),
    backdropEdgeThickness: clamp(merged.backdropEdgeThickness, MIN_BACKDROP_EDGE, MAX_BACKDROP_EDGE),
    plaqueFontScale: clamp(merged.plaqueFontScale, MIN_PLAQUE_FONT_SCALE, MAX_PLAQUE_FONT_SCALE),
    lightsIntensity: clamp(merged.lightsIntensity, MIN_LIGHTS_INTENSITY, MAX_LIGHTS_INTENSITY),
    lightsBulbSize: clamp(merged.lightsBulbSize, MIN_BULB_SIZE, MAX_BULB_SIZE),
    lightsSpacing: clamp(merged.lightsSpacing, MIN_BULB_SPACING, MAX_BULB_SPACING),
    lightsSpeed: clamp(merged.lightsSpeed, MIN_LIGHTS_SPEED, MAX_LIGHTS_SPEED),
    floodCount: Math.round(clamp(merged.floodCount, MIN_FLOOD_COUNT, MAX_FLOOD_COUNT)),
    floodBeamHeight: clamp(
      merged.floodBeamHeight,
      MIN_FLOOD_BEAM_HEIGHT,
      MAX_FLOOD_BEAM_HEIGHT
    ),
    floodBeamSpread: clamp(
      merged.floodBeamSpread,
      MIN_FLOOD_BEAM_SPREAD,
      MAX_FLOOD_BEAM_SPREAD
    ),
  });
}
