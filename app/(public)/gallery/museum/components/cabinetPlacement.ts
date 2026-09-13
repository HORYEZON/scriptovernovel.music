// Deterministic floor-grid placement for the Arcade Room's cabinets — the
// arcade-cabinet counterpart to podiumPlacement.ts (read that first; this is
// the same algorithm, only the footprint constants differ).
//
// Same properties: placement depends on index and count alone (no measurement,
// nothing to reflow once an artwork texture resolves), and it works for any N
// including 1 with no special-casing.
//
// The one rule that shapes everything: **keep the walking lane clear.** Rooms
// chain along Z and every doorway is cut into the middle of the north/south
// wall, DOORWAY_WIDTH across. A cabinet standing in that lane blocks the only
// route through the room, so cabinets live in two bays either side of a
// reserved central corridor, never in it.
//
// Poster-mode games that an admin has dragged onto a wall in the Scene Editor
// use their own saved position instead; an un-dragged poster falls back to the
// same grid slot a cabinet would take (rendered as a standing framed panel).
import { DOORWAY_WIDTH, PLAYER_RADIUS } from "./roomConstants";

export interface CabinetPlacement {
  /** Room-local [x, y, z]. y is the cabinet's base — 0 unless raised. */
  position: [number, number, number];
  rotationY: number;
}

/** Half-width of a cabinet's own footprint, in metres (see ArcadeCabinet.tsx's
 *  body box). Slightly wider than a Stories podium. */
const CABINET_HALF_FOOTPRINT = 0.42;

/** Clear floor a visitor needs beside a cabinet to walk past it comfortably. */
const WALK_CLEARANCE = PLAYER_RADIUS + 0.45;

/** Gap kept between the reserved centre lane and the nearest cabinet. */
const LANE_MARGIN = CABINET_HALF_FOOTPRINT + WALK_CLEARANCE;

/** Gap kept between a side wall and the nearest cabinet. */
const WALL_MARGIN = CABINET_HALF_FOOTPRINT + WALK_CLEARANCE + 0.4;

/** Clearance at the north/south ends, so a cabinet never sits in a doorway's
 *  approach where a visitor arrives at walking speed. */
const END_MARGIN = 2.4;

/** Cabinet columns per bay — two a side (four total) is what a 20m-wide room
 *  fits with the lane and margins above still honoured. */
const COLUMNS_PER_BAY = 2;

/**
 * Where each cabinet stands, in room-local coordinates. Columns fill
 * inner-first (flanking the walkway); rows divide the usable depth evenly, so
 * as the arcade grows the rows pack closer rather than marching past the back
 * wall — exactly like podiumPlacement.ts.
 */
export function computeCabinetPlacements(
  count: number,
  roomWidth: number,
  roomDepth: number
): CabinetPlacement[] {
  if (count <= 0) return [];

  const halfWidth = roomWidth / 2;
  const halfLane = DOORWAY_WIDTH / 2;

  const bayInner = halfLane + LANE_MARGIN;
  const bayOuter = halfWidth - WALL_MARGIN;
  const bayWidth = Math.max(0, bayOuter - bayInner);

  const columnsPerBay =
    bayWidth >= (COLUMNS_PER_BAY - 1) * (CABINET_HALF_FOOTPRINT * 2 + WALK_CLEARANCE)
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

  // Interleave the two bays so filling order alternates left/right.
  const columnXs: number[] = [];
  for (const x of bayColumnXs) {
    columnXs.push(-x, x);
  }

  const columnCount = columnXs.length;
  const rows = Math.ceil(count / columnCount);

  const usableDepth = Math.max(0, roomDepth - END_MARGIN * 2);
  const rowZ = (row: number) =>
    rows === 1 ? 0 : -usableDepth / 2 + (usableDepth * row) / (rows - 1);

  const placements: CabinetPlacement[] = [];
  for (let i = 0; i < count; i++) {
    const column = i % columnCount;
    const row = Math.floor(i / columnCount);
    const x = columnXs[column];
    placements.push({
      position: [x, 0, rowZ(row)],
      // Face the aisle: a cabinet on the left of the lane turns to look right
      // (+X) and vice versa, so a visitor walking through sees screens rather
      // than backs. A group's un-rotated forward is +Z, hence ±90°.
      rotationY: x < 0 ? Math.PI / 2 : -Math.PI / 2,
    });
  }

  return placements;
}
