// Computes where each room sits in one shared world space so the museum is
// a single walkable corridor instead of independent per-room scenes — a
// visitor walks north (-Z) through a doorway and the room around them
// changes, no teleport/remount involved. Rooms chain in the order they're
// given (already sorted by displayOrder — see page.tsx), room 0 centered at
// world Z=0, each next room's south wall touching the previous room's north
// wall. Every room shares ROOM_WIDTH (see roomConstants.ts), so there's
// never an X-axis misalignment at a doorway regardless of which room types
// are adjacent — only rooms at either *end* of the chain keep a solid
// south/north wall; every other room-to-room boundary gets a doorway.
import type { MuseumRoomPublic } from "@/types";
import { getRoomSize, RISE } from "./roomConstants";

export interface RoomLayout {
  room: MuseumRoomPublic;
  width: number;
  depth: number;
  centerZ: number;
  /** South (+Z, larger) edge of this room in world space. */
  southZ: number;
  /** North (-Z, smaller) edge of this room in world space. */
  northZ: number;
  /** True if this room connects to the previous one (i.e. it's not the first). */
  hasSouthOpening: boolean;
  /** True if this room connects to the next one (i.e. it's not the last). */
  hasNorthOpening: boolean;
  /**
   * Floor Y at this room's south/north edge — equal (flat floor) for every
   * room except the STAIRS connector, whose floor ramps from the previous
   * room's floor level up to RISE units higher by its north edge (see
   * roomConstants.ts's RISE and docs/SecondFloorStairs_Spec.md). Every room
   * after the ramp inherits its northY as a new flat floor level.
   */
  floorYSouth: number;
  floorYNorth: number;
}

export function computeRoomLayouts(rooms: MuseumRoomPublic[]): RoomLayout[] {
  const layouts: RoomLayout[] = [];

  rooms.forEach((room, i) => {
    const { width, depth } = getRoomSize(room.roomType);
    let southZ: number;
    let northZ: number;

    if (i === 0) {
      southZ = depth / 2;
      northZ = -depth / 2;
    } else {
      southZ = layouts[i - 1].northZ;
      northZ = southZ - depth;
    }

    // Every room's floor is flat at the previous room's north-edge level,
    // except STAIRS, whose floor ramps up by RISE across its own depth.
    const floorYSouth = i === 0 ? 0 : layouts[i - 1].floorYNorth;
    const floorYNorth = room.roomType === "STAIRS" ? floorYSouth + RISE : floorYSouth;

    layouts.push({
      room,
      width,
      depth,
      centerZ: (southZ + northZ) / 2,
      southZ,
      northZ,
      hasSouthOpening: i > 0,
      hasNorthOpening: i < rooms.length - 1,
      floorYSouth,
      floorYNorth,
    });
  });

  return layouts;
}

/**
 * The floor's Y height at a given world Z — flat within every ordinary
 * room, linearly interpolated across the STAIRS room's own southZ→northZ
 * span. Used by PlayerControls.tsx to keep the camera's eye height glued to
 * the (possibly sloped) floor instead of a single flat constant.
 */
export function getFloorYAt(layouts: RoomLayout[], z: number): number {
  if (layouts.length === 0) return 0;
  const layout = getLayoutAtZ(layouts, z);
  if (!layout) return 0;
  if (layout.floorYSouth === layout.floorYNorth) return layout.floorYSouth;
  // southZ > northZ (south is the larger Z) — t goes 0 at southZ to 1 at northZ.
  const t = clamp01((layout.southZ - z) / (layout.southZ - layout.northZ));
  return layout.floorYSouth + (layout.floorYNorth - layout.floorYSouth) * t;
}

// Tiny local clamp so this file doesn't need to import all of three.js just
// for Math.min/Math.max clamping.
function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/** The corridor's total walkable Z extent — south wall of the first room to north wall of the last. */
export function getChainZBounds(layouts: RoomLayout[]): { southZ: number; northZ: number } {
  if (layouts.length === 0) return { southZ: 0, northZ: 0 };
  return { southZ: layouts[0].southZ, northZ: layouts[layouts.length - 1].northZ };
}

/** Which room layout a given world Z position currently falls inside (clamped to the chain's ends). */
export function getLayoutAtZ(layouts: RoomLayout[], z: number): RoomLayout | undefined {
  if (layouts.length === 0) return undefined;
  const found = layouts.find((l) => z <= l.southZ && z >= l.northZ);
  if (found) return found;
  // Outside the corridor entirely (shouldn't happen once PlayerControls
  // clamps to getChainZBounds, but during the clamp's own edge frame this
  // keeps the lookup total instead of undefined).
  return z > layouts[0].southZ ? layouts[0] : layouts[layouts.length - 1];
}

/**
 * A "take me there" request from MuseumMap.tsx — click a room in the map,
 * land at its center. `token` (not just `roomId`) is what PlayerControls.tsx
 * actually watches: clicking the *same* room twice in a row needs to
 * re-trigger the teleport effect, which a plain roomId change wouldn't do
 * since React only re-runs an effect when a dependency actually differs.
 * Pure data, no three.js — safe to import from MuseumClient.tsx above the
 * dynamic-import boundary (see MuseumSceneLoader.tsx's docstring).
 */
export interface RoomTravelRequest {
  roomId: string;
  token: number;
}
