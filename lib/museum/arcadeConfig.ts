// lib/museum/arcadeConfig.ts
//
// The Arcade Room's room-wide settings: whether a game with no per-game
// override renders as a floor-standing arcade CABINET (the default) or a
// framed wall POSTER, and what that cabinet is actually made of — the
// built-in procedural box, optionally re-surfaced with a tiled image, or an
// uploaded .glb standing in its place. A per-game display-mode override lives
// on the MuseumRoomMiniGame row itself (`displayMode`); this is only the
// fallback for rows that leave it null.
//
// The cabinet model is room-scoped for the same reason the Stories Room's
// pedestal is (see storyPodiumModel.ts): an arcade wants one cabinet design,
// not one per game. What stays per-game is what has to — the screen image and
// the marquee name — which ArcadeCabinet.tsx keeps drawing on top of whatever
// cabinet is in use.
//
// Stored as a kind-marked singleton MuseumSceneObject on the Arcade Room — the
// exact same lazy-provisioned "config, not a placement" pattern as the Stories
// Room's pedestal model (see storyPodiumModel.ts): its position columns are
// unused and MuseumScene.tsx skips it when building the room's decorative
// objects, or it would render as a stray prop at the origin.
//
// Client-safe (no prisma import) so the museum page, the scene-objects API
// route, MuseumScene and the Museum Scene Editor can all import it directly.
// DB provisioning lives in arcadeRoom.ts's ensureArcadeConfig.

export const ARCADE_CONFIG_KIND = "arcade-config";

export type ArcadeDisplayMode = "CABINET" | "POSTER";

// Where the built-in cabinet puts its screen — mirrors ArcadeCabinet.tsx's own
// SCREEN_Y / BODY_D, duplicated as plain numbers rather than imported for the
// reason aboutRoomBlocks.ts documents: that file is a "use client" component
// pulling in three.js, and this module has to stay importable from server code.
// If those move there, update these too.
export const DEFAULT_CABINET_SCREEN_HEIGHT = 1.16;
export const DEFAULT_CABINET_SCREEN_DEPTH = 0.35;

export interface ArcadeConfig {
  /** Fallback display mode for games that don't set their own. */
  defaultMode: ArcadeDisplayMode;
  /**
   * Optional tiled surface image for the *procedural* cabinet body — the same
   * kind of upload a room's wall/floor/ceiling takes, tiled in the same world
   * units (roomConstants' TEXTURE_TILE_METERS), so a cabinet finished in the
   * room's own material reads as one surface.
   *
   * Ignored when `cabinetModelUrl` is set: an uploaded .glb brings its own
   * materials, and repainting them would fight whatever the model looks like.
   */
  cabinetTextureUrl: string | null;
  /** Supabase URL of an uploaded .glb standing in for the procedural cabinet.
   *  Null = use the built-in one (the default state of a fresh row). */
  cabinetModelUrl: string | null;
  /**
   * Where the game screen — and, just above it, the marquee — sit once
   * `cabinetModelUrl` is in use.
   *
   * An uploaded model's own dimensions can't be known here without parsing its
   * glTF bounding box, and guessing wrong means a screen floating in front of
   * the cabinet or buried inside it — so these are admin-tuned rather than
   * inferred. The agreed convention for the model: its origin sits on the floor
   * at the centre of the cabinet, facing +Z.
   */
  screenHeight: number;
  /** How far forward of that origin the screen plane sits. */
  screenDepth: number;
}

export const DEFAULT_ARCADE_CONFIG: ArcadeConfig = {
  defaultMode: "CABINET",
  cabinetTextureUrl: null,
  cabinetModelUrl: null,
  screenHeight: DEFAULT_CABINET_SCREEN_HEIGHT,
  screenDepth: DEFAULT_CABINET_SCREEN_DEPTH,
};

function finiteOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function urlOrNull(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

/** Parse the config JSON stored in the SceneObject's modelUrl column — same
 *  trick TextObjectConfig / PlaqueConfig / PodiumModelConfig already use. */
export function parseArcadeConfig(raw: string | null | undefined): ArcadeConfig {
  if (!raw) return { ...DEFAULT_ARCADE_CONFIG };
  try {
    const parsed = JSON.parse(raw) as Partial<ArcadeConfig>;
    return {
      defaultMode: parsed.defaultMode === "POSTER" ? "POSTER" : "CABINET",
      cabinetTextureUrl: urlOrNull(parsed.cabinetTextureUrl),
      cabinetModelUrl: urlOrNull(parsed.cabinetModelUrl),
      screenHeight: finiteOr(parsed.screenHeight, DEFAULT_CABINET_SCREEN_HEIGHT),
      screenDepth: finiteOr(parsed.screenDepth, DEFAULT_CABINET_SCREEN_DEPTH),
    };
  } catch {
    return { ...DEFAULT_ARCADE_CONFIG };
  }
}

export function serializeArcadeConfig(config: ArcadeConfig): string {
  return JSON.stringify({
    defaultMode: config.defaultMode === "POSTER" ? "POSTER" : "CABINET",
    cabinetTextureUrl: config.cabinetTextureUrl ?? null,
    cabinetModelUrl: config.cabinetModelUrl ?? null,
    screenHeight: finiteOr(config.screenHeight, DEFAULT_CABINET_SCREEN_HEIGHT),
    screenDepth: finiteOr(config.screenDepth, DEFAULT_CABINET_SCREEN_DEPTH),
  });
}

/** A raw string coerced to a valid display mode, or null if it's neither. */
export function normalizeArcadeMode(
  value: string | null | undefined
): ArcadeDisplayMode | null {
  if (value === "CABINET") return "CABINET";
  if (value === "POSTER") return "POSTER";
  return null;
}

/** Resolve one game's effective display mode: its own override, else the
 *  room-wide default. */
export function resolveArcadeMode(
  perGame: string | null | undefined,
  roomDefault: ArcadeDisplayMode
): ArcadeDisplayMode {
  return normalizeArcadeMode(perGame) ?? roomDefault;
}
