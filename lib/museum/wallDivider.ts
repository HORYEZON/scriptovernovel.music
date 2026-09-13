// lib/museum/wallDivider.ts
//
// "Divider" — a freestanding partition wall an admin drops into any room
// from the Museum Scene Editor (Add Divider, right next to Add Object), then
// drags, turns and resizes like a piece of furniture. It is the one scene
// object that changes the *shape* of a room rather than decorating it: a
// gallery can be split into two halves, an alcove carved out of a corner, a
// corridor narrowed — none of which was possible while every room was a bare
// box with art on its four walls.
//
// Stored as an ordinary MuseumSceneObject of kind "divider": positionX/Y/Z +
// rotationY place it (room-local, same space every other placement here uses)
// and the JSON blob below rides in the `modelUrl` column — the same
// config-in-modelUrl trick text labels (TextObjectConfig), the Freedom Wall
// plaque (BannerColors) and the Stories pedestal (PodiumModelConfig) already
// use, so a divider needs no schema migration to exist.
//
// Unlike a decorative .glb prop, a divider is solid by default: a wall you
// can walk through is not a wall. It is *not* the `solid` column's circular
// footprint, though — that model can't describe a 4m panel 30cm thick — so
// the public museum turns each divider into a rectangular barrier instead
// (see MuseumScene's dividerBarriers and PlayerControls' `barriers`).
//
// Client-safe (no prisma import) so the API routes, the public museum and
// the admin editor can all import it directly.

import { DEFAULT_WALL_COLOR } from "@/app/(public)/gallery/museum/components/roomConstants";

export const DIVIDER_KIND = "divider";

/** Shown in the editor's object list and confirm dialogs. */
export const DIVIDER_LABEL = "Divider Wall";

export interface WallDividerConfig {
  /** How wide the panel is, in metres (its long axis, before rotation). */
  width?: number;
  /** How tall it stands off the floor, in metres. */
  height?: number;
  /** How thick the slab is, in metres — the axis a visitor is blocked across. */
  thickness?: number;
  /**
   * Plain colour of the panel. Used on its own when `textureUrl` is unset
   * (the default state of a freshly added divider), and as the tint the
   * texture is multiplied by once one is uploaded — left at its near-white
   * default, that reads as "the texture, unmodified".
   */
  color?: string;
  /**
   * Optional tiled surface image — the same kind of upload a room's wall
   * takes, tiled in the same world units (roomConstants' TEXTURE_TILE_METERS)
   * so a divider finished in the room's own wall texture reads as part of the
   * building rather than a prop standing in it. Null = just the colour above.
   */
  textureUrl?: string | null;
  /**
   * Mirror alternate tiles of that texture (THREE.MirroredRepeatWrapping)
   * instead of repeating it flat. Every other tile is flipped, so the join
   * between two tiles becomes a reflection rather than a hard edge — what
   * makes a photographed concrete/wood surface tile cleanly across a panel
   * several metres wide. Ignored while no texture is uploaded.
   */
  mirrored?: boolean;
  /**
   * Whether visitors are blocked by this panel. True by default — a divider
   * exists to shape the room — but an admin can switch it off to use one as
   * a purely visual screen (a backdrop behind a standee, say).
   */
  solid?: boolean;
}

/** A new divider: taller than a visitor, wide enough to hide what's behind
 *  it, and as thick as the museum's own interior walls (WALL_THICKNESS). */
export const DEFAULT_DIVIDER_CONFIG: Required<WallDividerConfig> = {
  width: 4,
  height: 3,
  thickness: 0.3,
  color: DEFAULT_WALL_COLOR,
  textureUrl: null,
  mirrored: false,
  solid: true,
};

// Editor slider bounds. Height stops at ROOM_HEIGHT (5) — a divider taller
// than the room would poke through its ceiling — and the bottom of each
// range is "still visibly a wall" rather than zero, since a 0m panel is just
// an invisible barrier an admin can no longer find to select.
export const DIVIDER_MIN_WIDTH = 0.5;
export const DIVIDER_MAX_WIDTH = 20;
export const DIVIDER_MIN_HEIGHT = 0.5;
export const DIVIDER_MAX_HEIGHT = 5;
export const DIVIDER_MIN_THICKNESS = 0.05;
export const DIVIDER_MAX_THICKNESS = 1.5;

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

/** Parse the config JSON stored in the SceneObject's `modelUrl` column.
 *  Anything unparseable (or a row that somehow holds a bare URL) falls back
 *  to a default divider rather than rendering nothing — the same forgiving
 *  contract parsePodiumModelConfig and parseTextConfig keep. */
export function parseWallDividerConfig(raw: string | null | undefined): Required<WallDividerConfig> {
  if (!raw) return { ...DEFAULT_DIVIDER_CONFIG };
  try {
    const parsed = JSON.parse(raw) as WallDividerConfig;
    return {
      width: clampNumber(parsed.width, DIVIDER_MIN_WIDTH, DIVIDER_MAX_WIDTH, DEFAULT_DIVIDER_CONFIG.width),
      height: clampNumber(parsed.height, DIVIDER_MIN_HEIGHT, DIVIDER_MAX_HEIGHT, DEFAULT_DIVIDER_CONFIG.height),
      thickness: clampNumber(
        parsed.thickness, DIVIDER_MIN_THICKNESS, DIVIDER_MAX_THICKNESS, DEFAULT_DIVIDER_CONFIG.thickness
      ),
      color: typeof parsed.color === "string" && parsed.color ? parsed.color : DEFAULT_DIVIDER_CONFIG.color,
      textureUrl: typeof parsed.textureUrl === "string" && parsed.textureUrl ? parsed.textureUrl : null,
      mirrored: parsed.mirrored === true,
      // Absent means a row written before the toggle existed — those were all
      // solid, which is also the default for a newly added one.
      solid: parsed.solid !== false,
    };
  } catch {
    return { ...DEFAULT_DIVIDER_CONFIG };
  }
}

export function serializeWallDividerConfig(config: WallDividerConfig): string {
  return JSON.stringify({ ...DEFAULT_DIVIDER_CONFIG, ...config });
}
