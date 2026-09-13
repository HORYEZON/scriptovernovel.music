// lib/museum/freedomWallNotePlacement.ts
//
// Pure math for mapping a Freedom Wall sticky note's stored `wall` +
// positionX/positionY (0-100%) to/from a room-local 3D position — no
// three.js/@react-three/* imports, same "stays safe to import from a
// synchronously-loaded bundle" contract framePlacement.ts itself keeps, so
// MuseumEditorClient.tsx (not dynamically loaded — see its own doc comment)
// can use this directly instead of pulling in FreedomWallRoomContents.tsx's
// three.js-dependent rendering just to reuse this math.
//
// FreedomWallRoomContents.tsx (public + the dynamically-loaded Museum Scene
// Editor scene) is the only place that actually renders a note — it imports
// this module for the placement math and layers <StickyNote3D> on top.
import { ROOM_WIDTH, FRAME_WALL_OFFSET } from "@/app/(public)/gallery/museum/components/roomConstants";
import { getWallDefinitions, type WallDefinition } from "@/app/(public)/gallery/museum/components/framePlacement";

// Vertical centre of the usable frame band — roughly eye-level (1.7 m) so
// the sticky notes sit in the same horizontal sweep as artwork frames in
// other rooms. Not exported from roomConstants because it's only meaningful
// to Freedom Wall note placement.
export const FRAME_CENTER_Y = 1.65;

// Vertical band a note's positionY (0-100%) is mapped across — unaffected
// by which of the 4 walls positionX addresses.
export const WALL_USABLE_H = 2.8;

export type NoteWallId = "north" | "south" | "east" | "west";

export interface NoteWallGeometry {
  /** This room's own depth (getRoomSize("FREEDOM_WALL").depth). */
  depth: number;
  hasNorthOpening?: boolean;
  hasSouthOpening?: boolean;
}

/** Every WallDefinition sharing one id — 1 entry normally, 2 when a doorway
 *  splits that side into flanking zones (see framePlacement.ts). Same
 *  underlying data an artwork frame's own wall picker groups by
 *  (MuseumEditorClient.tsx's wallGroups) — notes reuse it directly rather
 *  than keeping a second, note-only wall geometry around. */
function segmentsForWall(walls: WallDefinition[], id: NoteWallId): WallDefinition[] {
  return walls.filter((w) => w.id === id);
}

/** Resolves a note's stored `wall` + positionX to the actual WallDefinition
 *  segment it sits on. A note's 0–100 % positionX addresses the wall's full
 *  nominal run, split evenly across however many segments it actually has
 *  (2 when a doorway flanks it) — 0–50 % → the first segment, 50–100 % → the
 *  second, generalizing the halves convention this ever used for the north
 *  wall alone to whichever of the 4 is picked. `note.wall` defaults to
 *  "north" so every note that predates this column keeps rendering exactly
 *  where it always has. */
export function resolveNoteWallSegment(
  note: { positionX: number; wall?: string | null },
  { depth, hasNorthOpening = false, hasSouthOpening = false }: NoteWallGeometry
): { wallId: NoteWallId; segments: WallDefinition[]; segmentIndex: number; seg: WallDefinition } {
  const wallId = ((note.wall as NoteWallId) || "north");
  const walls = getWallDefinitions(ROOM_WIDTH, depth, hasNorthOpening, hasSouthOpening);
  const segments = segmentsForWall(walls, wallId);
  const segmentIndex = segments.length <= 1 ? 0 : (note.positionX <= 50 ? 0 : 1);
  return { wallId, segments, segmentIndex, seg: segments[segmentIndex] ?? segments[0] };
}

/** Room-local world position + facing rotation (before centerZ/baseY are
 *  added) for a note — reused by both the public room and the Museum Scene
 *  Editor's draggable EditableStickyNote so the two can never drift apart. */
export function notePercentToWorld(
  note: { positionX: number; positionY: number; wall?: string | null },
  geometry: NoteWallGeometry
): { position: [number, number, number]; rotationY: number } {
  const { segments, segmentIndex, seg } = resolveNoteWallSegment(note, geometry);
  const local = segments.length <= 1
    ? note.positionX
    : (segmentIndex === 0 ? note.positionX * 2 : (note.positionX - 50) * 2);
  const free = seg.freeMin + (Math.min(100, Math.max(0, local)) / 100) * (seg.freeMax - seg.freeMin);
  // Offset off the wall's exact surface line, into the room, along its own
  // normal — same convention as ArtworkFrame/AboutRoomContents.
  const normalComponent = seg.fixedAxis === "z" ? seg.wallNormal[2] : seg.wallNormal[0];
  const surface = seg.fixedValue + normalComponent * FRAME_WALL_OFFSET;
  const x = seg.fixedAxis === "z" ? free : surface;
  const z = seg.fixedAxis === "x" ? free : surface;
  const y = FRAME_CENTER_Y + ((note.positionY / 100) - 0.5) * WALL_USABLE_H;
  return { position: [x, y, z], rotationY: seg.rotationY };
}

// The halves convention above splits 0-100 % at exactly 50, and
// resolveNoteWallSegment reads `<= 50` as the *first* segment — so 50 itself
// belongs to segment 0 and segment 1 owns (50, 100]. Emitting a bare 50 for
// segment 1 (what a drag to the doorway-side edge of the right-hand flank
// produces) therefore round-trips as segment 0's far edge instead: the note
// jumped clean across the doorway to the other flank, a whole DOORWAY_WIDTH
// away. This nudge keeps segment 1's output strictly inside its own half.
// It is deliberately tiny — at a ~5 m flank it shifts the note by ~10 µm,
// far below anything renderable, and well clear of float64 rounding at 50.
const SEGMENT_1_MIN = 50 + 1e-4;

/** Inverse of notePercentToWorld's along-wall mapping — used by the Museum
 *  Scene Editor while dragging a note to turn its new position on the
 *  *currently assigned* wall/segment back into the 0–100 % positionX the
 *  database stores. `freeValue` is whichever world coordinate is free on
 *  that segment (world X for north/south, world Z for east/west — see
 *  `seg.fixedAxis`). Clamped so a drag past the segment's edge still saves a
 *  valid position instead of an out-of-range number — and so the result
 *  always resolves back to the segment it was measured on (see
 *  SEGMENT_1_MIN). */
export function noteFreeValueToPercentX(
  freeValue: number,
  segments: WallDefinition[],
  segmentIndex: number
): number {
  const seg = segments[segmentIndex] ?? segments[0];
  const local = Math.min(100, Math.max(0, ((freeValue - seg.freeMin) / (seg.freeMax - seg.freeMin)) * 100));
  if (segments.length <= 1) return local;
  return segmentIndex === 0 ? local / 2 : Math.max(SEGMENT_1_MIN, 50 + local / 2);
}

/** World Y ↔ positionY (0-100%) — unaffected by which wall a note is on. */
export function noteWorldYToPercentY(y: number): number {
  return Math.min(100, Math.max(0, (((y - FRAME_CENTER_Y) / WALL_USABLE_H) + 0.5) * 100));
}
