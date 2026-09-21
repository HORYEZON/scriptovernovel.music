// sleevePlacement.ts
//
// Where the Vinyl Room's sleeves hang when the admin hasn't placed them: an
// even spread along the room's solid side walls, the same deterministic
// index/count walk framePlacement.ts does for artworks, minus the wall the
// Lyrics Wall occupies and minus the north/south walls (a doorway can be cut
// into either; the Lyrics Wall defaults to north). Room-local coordinates,
// centre-Y at FRAME_CENTER_Y, so the result is a FramePlacement and
// VinylSleeve.tsx / the Scene Editor's wall-snapped dragging need nothing new.
import { CORNER_MARGIN, FRAME_GAP, ROOM_WIDTH } from "./roomConstants";
import { FRAME_CENTER_Y, type FramePlacement } from "./framePlacement";
import { SLEEVE_SIZE } from "./VinylSleeve";
import type { VinylRoomConfig } from "@/lib/museum/vinylConfig";

/** Where the deck stands when the admin hasn't dragged it: a little toward
 *  the Lyrics Wall, facing the room's long axis so a visitor sees its front
 *  from the south door. */
export function defaultTurntablePosition(depth: number, lyricsWall: VinylRoomConfig["lyricsWall"]["wall"]): { x: number; z: number; rotationY: number } {
  if (lyricsWall === "east") return { x: ROOM_WIDTH * 0.18, z: 0, rotationY: -Math.PI / 2 };
  if (lyricsWall === "west") return { x: -ROOM_WIDTH * 0.18, z: 0, rotationY: Math.PI / 2 };
  return { x: 0, z: -depth * 0.18, rotationY: 0 };
}

export function computeSleevePlacements(
  count: number,
  depth: number,
  lyricsWall: VinylRoomConfig["lyricsWall"]["wall"],
  lyricsWallEnabled: boolean,
  hasNorthOpening: boolean
): FramePlacement[] {
  if (count <= 0) return [];
  const halfW = ROOM_WIDTH / 2;
  const halfD = depth / 2;
  const usableDepth = depth - 2 * CORNER_MARGIN;
  const usableWidth = ROOM_WIDTH - 2 * CORNER_MARGIN;

  type Seg = { length: number; point: (t: number) => { x: number; z: number }; rotationY: number; normal: [number, number, number] };
  const segments: Seg[] = [];
  const blocked = lyricsWallEnabled ? lyricsWall : null;
  if (blocked !== "east") {
    segments.push({ length: usableDepth, point: (t) => ({ x: halfW, z: -halfD + CORNER_MARGIN + t }), rotationY: -Math.PI / 2, normal: [-1, 0, 0] });
  }
  if (blocked !== "west") {
    segments.push({ length: usableDepth, point: (t) => ({ x: -halfW, z: halfD - CORNER_MARGIN - t }), rotationY: Math.PI / 2, normal: [1, 0, 0] });
  }
  // The north wall only when the Lyrics Wall has moved off it and nothing is
  // cut into it.
  if (blocked !== "north" && blocked !== null && !hasNorthOpening) {
    segments.push({ length: usableWidth, point: (t) => ({ x: -halfW + CORNER_MARGIN + t, z: -halfD }), rotationY: 0, normal: [0, 0, 1] });
  }
  if (segments.length === 0) return [];

  const total = segments.reduce((s, seg) => s + seg.length, 0);
  const spacing = total / count;
  const maxWidth = Math.max(0.6, Math.min(SLEEVE_SIZE, spacing - FRAME_GAP));
  const out: FramePlacement[] = [];
  for (let i = 0; i < count; i += 1) {
    let d = (i + 0.5) * spacing;
    let chosen = segments[0];
    for (const seg of segments) {
      if (d <= seg.length || seg === segments[segments.length - 1]) {
        chosen = seg;
        break;
      }
      d -= seg.length;
    }
    const { x, z } = chosen.point(Math.max(0, Math.min(d, chosen.length)));
    out.push({ position: [x, FRAME_CENTER_Y, z], rotationY: chosen.rotationY, wallNormal: chosen.normal, maxWidth });
  }
  return out;
}

/** The wall normal for a stored rotationY — the sleeve's own override only
 *  records the yaw, and the normal is what pushes it off the surface. */
export function wallNormalForRotation(rotationY: number): [number, number, number] {
  return [Math.sin(rotationY), 0, Math.cos(rotationY)];
}
