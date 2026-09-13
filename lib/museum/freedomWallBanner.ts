// lib/museum/freedomWallBanner.ts
//
// The Freedom Wall room's event-title plaque — a real, admin-movable/
// deletable MuseumSceneObject (kind: FREEDOM_WALL_BANNER_KIND), auto-
// provisioned once per Freedom Wall room (see ensureFreedomWallBanner in
// freedomWallRoom.ts) the same lazy way the About room's 3 content blocks
// are (see aboutRoomBlocks.ts).
//
// Previously this doubled as a generic admin-editable Text Label (its own
// content/font/size override) — dropped as redundant with the Museum Scene
// Editor's actual "Add Text" feature, and confusing alongside it: an admin
// renaming a FreedomWallEvent had no reason to expect a *second*,
// independently-typed override to be silently winning over that rename.
// The plaque now shows exactly one thing — whichever FreedomWallEvent is
// currently active — and the only thing left admin-editable about it here
// is its color scheme (background/edge/text), via this scene object's
// modelUrl JSON. Position/removal stay the Scene Editor's job, same as any
// other placed object.
//
// Client-safe (no prisma import) so both server code (page.tsx, the
// scene-objects API route) and client code (MuseumScene.tsx, the Museum
// Scene Editor) can import these constants/helpers directly — the actual
// DB provisioning lives in freedomWallRoom.ts's ensureFreedomWallBanner,
// which imports this module, not the other way around.
import { FRAME_WALL_OFFSET } from "@/app/(public)/gallery/museum/components/roomConstants";

export const FREEDOM_WALL_BANNER_KIND = "freedom-wall-banner";

// Default height — clear of the note band's top edge and of a north-wall
// doorway opening, well under the room's ceiling.
export const FREEDOM_WALL_BANNER_DEFAULT_Y = 3.75;

/** Default room-local placement for a freshly-provisioned plaque — flush
 *  against the room's north wall, centered. `depth` is the Freedom Wall
 *  room's own depth (getRoomSize("FREEDOM_WALL").depth). */
export function freedomWallBannerDefaultPosition(depth: number): {
  positionX: number;
  positionY: number;
  positionZ: number;
  rotationY: number;
} {
  return {
    positionX: 0,
    positionY: FREEDOM_WALL_BANNER_DEFAULT_Y,
    positionZ: -depth / 2 + FRAME_WALL_OFFSET + 0.01,
    rotationY: 0,
  };
}

// The plaque's admin-editable look — 3 colors plus the event title's font —
// stored as JSON in the SceneObject's modelUrl column, same trick
// TextObjectConfig/PlaqueConfig already use.
export interface BannerColors {
  /** The plaque's own backing panel. */
  backgroundColor?: string;
  /** Raised edge border, and the "FREEDOM WALL" eyebrow line above the title. */
  edgeColor?: string;
  /** The event title itself. */
  textColor?: string;
  /** Font *path* value from PLAQUE_FONT_OPTIONS (lib/museum/aboutRoomBlocks.ts)
   *  — only ever applies to the event title, never the fixed "FREEDOM WALL"
   *  eyebrow above it. */
  fontFamily?: string;
  /** World-unit font size for the event title only, same unit
   *  TextObjectConfig.fontSize uses. Clamped client-side to
   *  [PLAQUE_FONT_SIZE_MIN, PLAQUE_FONT_SIZE_MAX] below — wide enough to
   *  matter, narrow enough that the title never outgrows the plaque's
   *  fixed backing height or collides with the eyebrow above it. */
  fontSize?: number;
}

export const PLAQUE_FONT_SIZE_MIN = 0.14;
export const PLAQUE_FONT_SIZE_MAX = 0.4;

// Matches the original hand-painted look this replaces — a dark plaque with
// a gold edge, legible on any admin-chosen wall color, in the same bold
// sans and size the rest of the museum's plaques default to.
export const DEFAULT_BANNER_COLORS: Required<BannerColors> = {
  backgroundColor: "#241f1a",
  edgeColor: "#c9a227",
  textColor: "#f5efe2",
  fontFamily: "/fonts/DMSans-Bold.woff",
  fontSize: 0.26,
};

/** Parse banner colors from the JSON stored in SceneObject.modelUrl.
 *  Returns DEFAULT_BANNER_COLORS merged with any valid overrides. */
export function parseBannerColors(raw: string | null | undefined): Required<BannerColors> {
  if (!raw) return { ...DEFAULT_BANNER_COLORS };
  try {
    const parsed = JSON.parse(raw) as BannerColors;
    return { ...DEFAULT_BANNER_COLORS, ...parsed };
  } catch {
    return { ...DEFAULT_BANNER_COLORS };
  }
}
