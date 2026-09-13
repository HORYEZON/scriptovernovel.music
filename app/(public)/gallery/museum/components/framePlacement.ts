// Deterministic perimeter-walk placement — walks the room's four walls as
// one continuous loop and spaces N frames evenly along it by index alone
// (each slot's *position* never needs to reflow once a texture's real
// aspect ratio resolves — only that one frame's plane geometry updates in
// place), but each slot also carries a `maxWidth` derived from that even
// spacing (see computeFramePlacements below) so a frame can never render
// wider than the room actually has room for. Works for any N (including 1)
// with no per-wall-count special-casing. Room width/depth are passed in
// (not imported constants) since V2 rooms come in different sizes — see
// roomConstants.ts's getRoomSize.
import { CORNER_MARGIN, MAX_FRAME_WIDTH, FRAME_GAP, DOORWAY_WIDTH, FRAME_WALL_OFFSET } from "./roomConstants";

export interface FramePlacement {
  position: [number, number, number];
  rotationY: number;
  /** Which wall this frame sits on — used to offset it just off the surface. */
  wallNormal: [number, number, number];
  /**
   * Hard cap on this frame's rendered width (ArtworkFrame.tsx clamps to
   * it, scaling height to match so the image's real aspect ratio is
   * preserved rather than stretched) — min(MAX_FRAME_WIDTH, this slot's
   * even-spacing share minus FRAME_GAP). Shrinks automatically as more
   * artworks are added and the perimeter gets divided into more slots, so
   * neighbors — and corners, since CORNER_MARGIN is sized for
   * MAX_FRAME_WIDTH — can never overlap.
   */
  maxWidth: number;
}

interface Segment {
  length: number;
  point: (t: number) => { x: number; z: number };
  rotationY: number;
  wallNormal: [number, number, number];
}

function buildSegments(
  roomWidth: number,
  roomDepth: number,
  hasNorthOpening: boolean,
  hasSouthOpening: boolean
): Segment[] {
  const halfW = roomWidth / 2;
  const halfD = roomDepth / 2;
  const usableWidth = roomWidth - 2 * CORNER_MARGIN;
  const usableDepth = roomDepth - 2 * CORNER_MARGIN;
  const nx0 = -halfW + CORNER_MARGIN;
  const nx1 = halfW - CORNER_MARGIN;
  const nz0 = -halfD + CORNER_MARGIN;
  const nz1 = halfD - CORNER_MARGIN;

  // East/West are always solid (rooms only ever chain along Z — see
  // roomLayout.ts) and always usable. A North/South wall with a doorway
  // splits into the two segments flanking the opening (same clearance math
  // as doorwayFlankZones below, which the Museum Scene Editor's manual wall
  // picker already uses) instead of being excluded outright — a room with a
  // lot of artworks needs every scrap of usable perimeter it can get, and
  // leaving a doorway wall's flanks completely unused was a real
  // contributor to how cramped/tiny frames get in a busy room (see
  // MAX_FRAME_WIDTH/CORNER_MARGIN's shrink-with-count math below).
  const doorwayHalf = DOORWAY_WIDTH / 2 + DOORWAY_FRAME_CLEARANCE; // see that const's own doc comment further down this file
  const segments: Segment[] = [];
  if (hasNorthOpening) {
    // North wall (-Z), split around the doorway (centered on x=0), each
    // flank walked left → right same as the solid-wall case below.
    if (nx0 < -doorwayHalf) {
      segments.push({ length: -doorwayHalf - nx0, point: (t) => ({ x: nx0 + t, z: -halfD }), rotationY: 0, wallNormal: [0, 0, 1] });
    }
    if (doorwayHalf < nx1) {
      segments.push({ length: nx1 - doorwayHalf, point: (t) => ({ x: doorwayHalf + t, z: -halfD }), rotationY: 0, wallNormal: [0, 0, 1] });
    }
  } else {
    // North wall (-Z), left → right, faces +Z into the room.
    segments.push({ length: usableWidth, point: (t) => ({ x: nx0 + t, z: -halfD }), rotationY: 0, wallNormal: [0, 0, 1] });
  }
  // East wall (+X), front → back, faces -X into the room.
  segments.push({ length: usableDepth, point: (t) => ({ x: halfW, z: nz0 + t }), rotationY: -Math.PI / 2, wallNormal: [-1, 0, 0] });
  if (hasSouthOpening) {
    // South wall (+Z), split around the doorway, each flank walked
    // right → left same as the solid-wall case below.
    if (doorwayHalf < nx1) {
      segments.push({ length: nx1 - doorwayHalf, point: (t) => ({ x: nx1 - t, z: halfD }), rotationY: Math.PI, wallNormal: [0, 0, -1] });
    }
    if (nx0 < -doorwayHalf) {
      segments.push({ length: -doorwayHalf - nx0, point: (t) => ({ x: -doorwayHalf - t, z: halfD }), rotationY: Math.PI, wallNormal: [0, 0, -1] });
    }
  } else {
    // South wall (+Z), right → left, faces -Z into the room.
    segments.push({ length: usableWidth, point: (t) => ({ x: nx1 - t, z: halfD }), rotationY: Math.PI, wallNormal: [0, 0, -1] });
  }
  // West wall (-X), back → front, faces +X into the room.
  segments.push({ length: usableDepth, point: (t) => ({ x: -halfW, z: nz1 - t }), rotationY: Math.PI / 2, wallNormal: [1, 0, 0] });

  return segments;
}

/** Center height (Y) frames are hung at — roughly eye level. */
export const FRAME_CENTER_Y = 1.9;

/**
 * One of a room's (up to 4, or 5/6 when a north/south doorway splits its
 * wall in two) solid placement zones, described as a fixed coordinate (the
 * wall's own surface line) plus a valid range for the other, free
 * coordinate — the shape the Museum Scene Editor's wall-snapped artwork
 * dragging needs (Docs/MuseumSceneEditor_Spec.md's later "artwork frames"
 * extension). Same wall equations `buildSegments` above already uses for
 * a room with no doorway on that side; a room *with* one doesn't lose that
 * wall entirely here (unlike the auto perimeter-walk layout, which always
 * excludes it to avoid computing partial segments) — an admin can still
 * deliberately hang something in the clearance flanking the doorway on
 * either side, just not across the opening itself.
 */
export interface WallDefinition {
  id: "north" | "south" | "east" | "west" | "divider";
  /** Only set when this wall has a doorway — which side of it this zone is. */
  segment?: "left" | "right";
  rotationY: number;
  wallNormal: [number, number, number];
  fixedAxis: "x" | "z";
  fixedValue: number;
  freeMin: number;
  freeMax: number;
  /**
   * Set only on the two faces of a divider wall (id "divider") — the
   * MuseumSceneObject id of the panel, so the editor can name the zone after
   * it and tell one divider's faces from another's.
   */
  dividerId?: string;
  /** Which face of that panel this zone is. */
  face?: "front" | "back";
  /**
   * A divider can stand at any angle, so its faces can't be described by the
   * fixedAxis/fixedValue pair above — which only ever names a room wall
   * squared to the world axes. These two carry the general form instead: the
   * face's centre point in room-local X/Z, and the unit direction its free
   * coordinate runs along, so a point on it is `anchor + along * free`. Use
   * wallPointAt/wallFreeCoord below rather than reading either directly, and
   * both stay undefined for the room's own walls.
   */
  anchor?: [number, number];
  along?: [number, number];
}

/** Where a `free` coordinate lands on this wall, in room-local X/Z. Handles
 *  both the room's axis-aligned walls (where "free" is literally the X or Z
 *  the fixed axis leaves open) and a divider's angled faces. */
export function wallPointAt(wall: WallDefinition, free: number): { x: number; z: number } {
  if (wall.anchor && wall.along) {
    return {
      x: wall.anchor[0] + wall.along[0] * free,
      z: wall.anchor[1] + wall.along[1] * free,
    };
  }
  return wall.fixedAxis === "x"
    ? { x: wall.fixedValue, z: free }
    : { x: free, z: wall.fixedValue };
}

/** The inverse: how far along this wall a room-local position sits. For a
 *  divider face that's the projection onto its own axis; for a room wall it's
 *  the free coordinate itself. */
export function wallFreeCoord(wall: WallDefinition, x: number, z: number): number {
  if (wall.anchor && wall.along) {
    return (x - wall.anchor[0]) * wall.along[0] + (z - wall.anchor[1]) * wall.along[1];
  }
  return wall.fixedAxis === "x" ? z : x;
}

/**
 * The two hangable faces of one divider wall (lib/museum/wallDivider.ts) —
 * the same shape as a room wall so the Museum Scene Editor's wall picker can
 * offer them alongside North/South/East/West without a second code path.
 *
 * A divider stands wherever an admin dragged it, at whatever angle, so this
 * is derived from the panel's own placement rather than from the room's
 * geometry: `rotationY` is the panel's own yaw for the front face and half a
 * turn from it for the back, and each face's anchor is pushed out from the
 * panel's centre line by half its thickness so a frame hangs *on* the
 * surface rather than inside the slab.
 *
 * Not used by the auto perimeter-walk layout — dividers appear and move at
 * an admin's whim, and quietly reflowing every unplaced frame onto (and off
 * of) one would move art nobody asked to move. These zones exist for
 * deliberate placement only.
 */
export function getDividerWallDefinitions(
  dividers: {
    id: string;
    positionX: number;
    positionZ: number;
    rotationY: number;
    width: number;
    thickness: number;
  }[]
): WallDefinition[] {
  const out: WallDefinition[] = [];
  for (const divider of dividers) {
    const cos = Math.cos(divider.rotationY);
    const sin = Math.sin(divider.rotationY);
    // The panel's own axes in room-local X/Z: `along` runs the length of the
    // slab, `normal` points out of its front face (matching how a rotationY
    // of 0 leaves a frame facing +Z, the same convention the north wall uses).
    const along: [number, number] = [cos, -sin];
    const normal: [number, number] = [sin, cos];
    // Frames can't sit right at a divider's corners for the same reason they
    // can't at the room's — CORNER_MARGIN — but a short divider would end up
    // with no usable range at all, so it simply offers less rather than
    // inverting.
    const usableHalf = Math.max(0, divider.width / 2 - Math.min(CORNER_MARGIN, divider.width / 4));
    // Where the anchor has to sit for the frame to end up ON this face.
    //
    // ArtworkFrame.tsx pushes every frame FRAME_WALL_OFFSET out along its
    // wall normal, and that number is sized for the room's own walls: those
    // are drawn a full WALL_THICKNESS inside the room's boundary, and a
    // WallDefinition's fixedValue is the boundary, not the surface. A divider
    // has no such inset — the slab is exactly where it says it is — so
    // anchoring on the face and then letting ArtworkFrame add its offset hung
    // every frame 0.42m out in mid-air. That is the reported gap, and it was
    // not fixable by thickening the panel: growing the slab moves the face
    // out from under a frame that stays where it was stored, so one side
    // closes only by opening the other twice as wide.
    //
    // So the anchor is pulled back by that same offset and pushed out again
    // by just the clearance a frame's own backing box needs (it extends 0.04
    // behind the face; see FRAME_WALL_OFFSET's comment), leaving the frame
    // sitting on the panel however thick the panel is.
    const surface = divider.thickness / 2 - FRAME_WALL_OFFSET + DIVIDER_FRAME_CLEARANCE;
    for (const face of ["front", "back"] as const) {
      const side = face === "front" ? 1 : -1;
      out.push({
        id: "divider",
        dividerId: divider.id,
        face,
        rotationY: face === "front" ? divider.rotationY : divider.rotationY + Math.PI,
        wallNormal: [normal[0] * side, 0, normal[1] * side],
        // Kept filled in so anything still reading the older pair gets a
        // sane approximation rather than NaN; wallPointAt/wallFreeCoord use
        // anchor/along instead.
        fixedAxis: Math.abs(cos) > Math.abs(sin) ? "z" : "x",
        fixedValue: Math.abs(cos) > Math.abs(sin) ? divider.positionZ : divider.positionX,
        freeMin: -usableHalf,
        freeMax: usableHalf,
        anchor: [
          divider.positionX + normal[0] * surface * side,
          divider.positionZ + normal[1] * surface * side,
        ],
        // The back face is read from behind, so its own "left to right" runs
        // the other way — mirroring `along` keeps a frame's slider moving the
        // direction the admin sees it move.
        along: [along[0] * side, along[1] * side],
      });
    }
  }
  return out;
}

/**
 * How far a frame's face stands off a divider's surface, in metres.
 *
 * Small on purpose: a divider is furniture, and art hung on one should touch
 * it the way it touches a room wall. This only has to clear the frame's own
 * backing box (0.04 deep, centred just behind the face) so the two don't
 * z-fight — everything else about the offset is undone in `surface` above.
 */
const DIVIDER_FRAME_CLEARANCE = 0.06;

/** How close to a divider's face a frame has to be before it counts as hung
 *  on that panel rather than merely near it. About arm's reach: wide enough to
 *  catch a frame stored before `surface` existed (those sit a fixed
 *  FRAME_WALL_OFFSET out from the panel), narrow enough that art on the room
 *  wall behind a panel is never claimed by it. */
export const DIVIDER_FACE_MATCH_DISTANCE = 0.75;

/**
 * Pull a stored placement back onto the divider face it belongs to — or say it
 * belongs to none.
 *
 * A frame's override is a bare room-local point; nothing in it records which
 * panel it was hung on. So a divider that is dragged, turned or resized used
 * to leave its art behind in mid-air, and frames placed before divider faces
 * anchored on the panel's real surface are stored a fixed 0.42m out in front
 * of it (the gap this is here to close). Matching by "same facing, and close
 * to this face's line" recovers the association well enough to keep the art
 * where the panel now is, and returning null for everything else means a frame
 * on the room's own wall is never touched.
 *
 * Shared by the museum (which applies it while rendering, so an existing
 * placement is corrected without anyone re-saving) and the Scene Editor
 * (which writes the corrected point back).
 */
export function snapToDividerFace(
  walls: WallDefinition[],
  item: { x: number; z: number; rotationY: number }
): { x: number; z: number; rotationY: number; wall: WallDefinition } | null {
  let best: WallDefinition | null = null;
  let bestDistance = DIVIDER_FACE_MATCH_DISTANCE;
  for (const wall of walls) {
    if (wall.id !== "divider" || !wall.anchor || !wall.along) continue;
    // Same facing, measured as a real angle difference so ±π wraps correctly.
    const diff = Math.abs(
      Math.atan2(
        Math.sin(item.rotationY - wall.rotationY),
        Math.cos(item.rotationY - wall.rotationY)
      )
    );
    if (diff > 0.1) continue;
    // Distance from the face's own line: the part of the offset that doesn't
    // run along it. A frame sitting on the face has none.
    const dx = item.x - wall.anchor[0];
    const dz = item.z - wall.anchor[1];
    const along = dx * wall.along[0] + dz * wall.along[1];
    const perpendicular = Math.hypot(dx - along * wall.along[0], dz - along * wall.along[1]);
    if (perpendicular < bestDistance) {
      bestDistance = perpendicular;
      best = wall;
    }
  }
  if (!best) return null;
  // Keep how far along the face it hangs; take everything else from the face
  // as it stands now.
  const free = Math.min(
    best.freeMax,
    Math.max(best.freeMin, wallFreeCoord(best, item.x, item.z))
  );
  const { x, z } = wallPointAt(best, free);
  return { x, z, rotationY: best.rotationY, wall: best };
}

// Extra clearance beyond the doorway opening's own edge before a frame can
// start — keeps a hung piece from reading as "crowding the doorway" even
// though it's technically clear of the opening itself.
const DOORWAY_FRAME_CLEARANCE = 0.3;

/**
 * A doorway wall split into its two flanking zones — omitted entirely if
 * the room is too narrow for either side to fit anything (a very short
 * room combined with the fixed DOORWAY_WIDTH), same "don't offer a wall
 * with no usable room on it" principle as the auto layout's own solid-wall
 * check above.
 */
function doorwayFlankZones(
  id: "north" | "south",
  halfW: number,
  rotationY: number,
  wallNormal: [number, number, number],
  fixedValue: number
): WallDefinition[] {
  const doorwayHalf = DOORWAY_WIDTH / 2 + DOORWAY_FRAME_CLEARANCE;
  const zones: WallDefinition[] = [];
  const leftMax = -doorwayHalf;
  const leftMin = -halfW + CORNER_MARGIN;
  if (leftMin < leftMax) {
    zones.push({ id, segment: "left", rotationY, wallNormal, fixedAxis: "z", fixedValue, freeMin: leftMin, freeMax: leftMax });
  }
  const rightMin = doorwayHalf;
  const rightMax = halfW - CORNER_MARGIN;
  if (rightMin < rightMax) {
    zones.push({ id, segment: "right", rotationY, wallNormal, fixedAxis: "z", fixedValue, freeMin: rightMin, freeMax: rightMax });
  }
  return zones;
}

export function getWallDefinitions(
  roomWidth: number,
  roomDepth: number,
  hasNorthOpening: boolean,
  hasSouthOpening: boolean
): WallDefinition[] {
  const halfW = roomWidth / 2;
  const halfD = roomDepth / 2;
  const xRange = { freeMin: -halfW + CORNER_MARGIN, freeMax: halfW - CORNER_MARGIN };
  const zRange = { freeMin: -halfD + CORNER_MARGIN, freeMax: halfD - CORNER_MARGIN };

  const walls: WallDefinition[] = [];
  if (hasNorthOpening) {
    walls.push(...doorwayFlankZones("north", halfW, 0, [0, 0, 1], -halfD));
  } else {
    walls.push({ id: "north", rotationY: 0, wallNormal: [0, 0, 1], fixedAxis: "z", fixedValue: -halfD, ...xRange });
  }
  // East/West are always solid — see buildSegments' comment above.
  walls.push({ id: "east", rotationY: -Math.PI / 2, wallNormal: [-1, 0, 0], fixedAxis: "x", fixedValue: halfW, ...zRange });
  if (hasSouthOpening) {
    walls.push(...doorwayFlankZones("south", halfW, Math.PI, [0, 0, -1], halfD));
  } else {
    walls.push({ id: "south", rotationY: Math.PI, wallNormal: [0, 0, -1], fixedAxis: "z", fixedValue: halfD, ...xRange });
  }
  walls.push({ id: "west", rotationY: Math.PI / 2, wallNormal: [1, 0, 0], fixedAxis: "x", fixedValue: -halfW, ...zRange });
  return walls;
}

export function computeFramePlacements(
  count: number,
  roomWidth: number,
  roomDepth: number,
  hasNorthOpening = false,
  hasSouthOpening = false
): FramePlacement[] {
  if (count <= 0) return [];

  const segments = buildSegments(roomWidth, roomDepth, hasNorthOpening, hasSouthOpening);
  if (segments.length === 0) return [];
  const totalPerimeter = segments.reduce((sum, s) => sum + s.length, 0);
  const spacing = totalPerimeter / count;
  // A floor under the shrinking, not a promise it's always met — a packed
  // room with dozens of artworks will still crowd frames closer together
  // than this once spacing itself drops below it. That's an intentional
  // last resort (a slightly-too-cozy room) over frames shrinking to
  // illegibility or the math producing a negative width.
  const maxWidth = Math.max(0.6, Math.min(MAX_FRAME_WIDTH, spacing - FRAME_GAP));

  const placements: FramePlacement[] = [];
  for (let i = 0; i < count; i++) {
    let distance = (i + 0.5) * spacing;
    let chosen = segments[0];
    for (const segment of segments) {
      if (distance <= segment.length || segment === segments[segments.length - 1]) {
        chosen = segment;
        break;
      }
      distance -= segment.length;
    }
    const { x, z } = chosen.point(Math.max(0, Math.min(distance, chosen.length)));
    placements.push({
      position: [x, FRAME_CENTER_Y, z],
      rotationY: chosen.rotationY,
      wallNormal: chosen.wallNormal,
      maxWidth,
    });
  }
  return placements;
}
