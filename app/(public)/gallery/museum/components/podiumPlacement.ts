// Deterministic floor-grid placement for the Stories Room's podiums — the
// floor-standing counterpart to framePlacement.ts's perimeter wall walk.
//
// Same properties that file is built around, for the same reasons: placement
// depends on index and count alone (no measurement, nothing to reflow once a
// cover texture resolves), and it works for any N including 1 with no
// special-casing.
//
// The one rule that shapes everything here: **keep the walking lane clear.**
// Rooms chain along Z and every doorway is cut into the middle of the north/
// south wall, DOORWAY_WIDTH across (see roomLayout.ts / MuseumRoom.tsx). A
// podium standing in that lane blocks the only route through the room —
// worse here than anywhere else in the museum, because podiums are the one
// thing a visitor has to walk *between* rather than look at from a distance.
// So podiums live in two bays either side of a reserved central corridor,
// never in it.
//
// Room width/depth are passed in (not imported constants) since rooms come in
// different sizes — same convention as framePlacement.ts.
import { DOORWAY_WIDTH, PLAYER_RADIUS } from "./roomConstants";

export interface PodiumPlacement {
  /** Room-local [x, y, z]. y is the podium's base — 0 unless raised. */
  position: [number, number, number];
  rotationY: number;
}

/** Half-width of the podium's own footprint, in metres (see StoryPodium.tsx's
 *  base plinth). Used to keep podiums off the walls and out of the lane. */
const PODIUM_HALF_FOOTPRINT = 0.35;

/** Clear floor a visitor needs beside a podium to walk past it comfortably:
 *  their own radius plus a little breathing room. */
const WALK_CLEARANCE = PLAYER_RADIUS + 0.45;

/** Gap kept between the reserved centre lane and the nearest podium. */
const LANE_MARGIN = PODIUM_HALF_FOOTPRINT + WALK_CLEARANCE;

/** Gap kept between a side wall and the nearest podium — enough to squeeze
 *  behind one rather than being funnelled into the lane. */
const WALL_MARGIN = PODIUM_HALF_FOOTPRINT + WALK_CLEARANCE + 0.4;

/** Clearance at the north/south ends, so a podium never sits in a doorway's
 *  approach where a visitor arrives at walking speed. */
const END_MARGIN = 2.4;

/** Podium columns per bay. Two a side (four total) is what a 20m-wide room
 *  fits with the lane and margins above still honoured; more would mean
 *  columns closer together than WALK_CLEARANCE allows. */
const COLUMNS_PER_BAY = 2;

/**
 * Where each podium stands, in room-local coordinates.
 *
 * Columns are filled inner-first (flanking the walkway) so a library of two
 * or three books reads as a deliberate arrangement by the aisle rather than
 * items shoved against the far walls.
 *
 * Rows divide the usable depth *evenly*, exactly as framePlacement.ts divides
 * its perimeter: as the library grows the rows get closer together rather
 * than marching past the back wall. A large enough library therefore ends up
 * genuinely tightly packed — that's the honest outcome, and it's what
 * RoomsTab.tsx's crowding notice warns the admin about, since the alternative
 * (silently not showing some books) is worse.
 */
export function computePodiumPlacements(
  count: number,
  roomWidth: number,
  roomDepth: number
): PodiumPlacement[] {
  if (count <= 0) return [];

  const halfWidth = roomWidth / 2;
  const halfLane = DOORWAY_WIDTH / 2;

  // One bay = the strip between the lane edge and the side wall.
  const bayInner = halfLane + LANE_MARGIN;
  const bayOuter = halfWidth - WALL_MARGIN;
  const bayWidth = Math.max(0, bayOuter - bayInner);

  // Column offsets from the room's centre line, inner-first. A bay too narrow
  // for two columns collapses to one centred in it rather than overlapping.
  const columnsPerBay =
    bayWidth >= (COLUMNS_PER_BAY - 1) * (PODIUM_HALF_FOOTPRINT * 2 + WALK_CLEARANCE)
      ? COLUMNS_PER_BAY
      : 1;

  const bayColumnXs: number[] = [];
  for (let c = 0; c < columnsPerBay; c++) {
    bayColumnXs.push(
      columnsPerBay === 1
        ? bayInner + bayWidth / 2
        : bayInner + (bayWidth * c) / (columnsPerBay - 1)
    );
  }

  // Interleave the two bays so filling order alternates left/right and works
  // outward — a 2-book library sits symmetrically either side of the aisle.
  const columnXs: number[] = [];
  for (const x of bayColumnXs) {
    columnXs.push(-x, x);
  }

  const columnCount = columnXs.length;
  const rows = Math.ceil(count / columnCount);

  const usableDepth = Math.max(0, roomDepth - END_MARGIN * 2);
  const rowZ = (row: number) =>
    rows === 1 ? 0 : -usableDepth / 2 + (usableDepth * row) / (rows - 1);

  const placements: PodiumPlacement[] = [];
  for (let i = 0; i < count; i++) {
    const column = i % columnCount;
    const row = Math.floor(i / columnCount);
    const x = columnXs[column];
    placements.push({
      position: [x, 0, rowZ(row)],
      // Face the aisle: a podium on the left of the lane turns to look right
      // (+X) and vice versa, so a visitor walking through sees covers rather
      // than spines. A group's un-rotated forward is +Z, hence ±90°.
      rotationY: x < 0 ? Math.PI / 2 : -Math.PI / 2,
    });
  }

  return placements;
}
