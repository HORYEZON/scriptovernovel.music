// Deterministic placement for the Cosplay Room's standees — where each
// standee-plus-backdrop pair stands, by index and count alone.
//
// The one rule that shapes this file: **a hung photo needs a wall behind it.**
// Every other floor-standing room in the museum spreads its contents through
// the middle of the floor (podiumPlacement.ts's bays, cabinetPlacement.ts's
// grid) because a podium or a cabinet is a free-standing object. A cosplay
// entry isn't: it's a standee with that cosplay's second photo hanging on a
// panel directly behind it, so it belongs against a wall, facing in.
//
// So this walks the room's perimeter rather than laying out a floor grid — and
// it does that by reusing framePlacement.ts's own perimeter walk instead of
// reimplementing it, which is what keeps a standee lined up with the wall it
// stands against however the room is sized and whichever of its walls turn out
// to be doorways. Each wall slot that walk produces is converted here into a
// floor placement: same along-wall spot, pushed STANDEE_WALL_GAP into the room
// so the standee stands clear of its own backdrop panel, turned to face the way
// the wall faces.
//
// Room width/depth are passed in (not imported constants) since rooms come in
// different sizes — same convention as framePlacement.ts and podiumPlacement.ts.
import { computeFramePlacements } from "./framePlacement";
import { FRAME_WALL_OFFSET } from "./roomConstants";

export interface StandeePlacement {
  /** Room-local [x, y, z]. y is the standee's base — 0 unless raised. */
  position: [number, number, number];
  rotationY: number;
}

/**
 * How far the standee stands off the wall surface line.
 *
 * The backdrop panel hangs on the wall behind it (CosplayStandee.tsx draws it
 * at this same distance back in the group's own local space), so this doubles
 * as the gap between the standee's back and the photo — enough that the two
 * read as a standee *in front of* a picture rather than a photo with something
 * stuck to it, without pushing the standee so far out that it stops belonging
 * to the wall it came from.
 */
export const STANDEE_WALL_GAP = 0.95;

/**
 * How far behind *this particular* standee its backdrop panel can hang.
 *
 * STANDEE_WALL_GAP is the right answer at an auto slot, which is placed
 * precisely so the panel lands where a wall frame would. A standee the admin
 * has dragged is under no such guarantee: drag one nearer its wall than the
 * auto walk would have put it and the full gap carries the panel straight
 * through that wall's solid geometry, where it is completely occluded — the
 * uploaded backdrop photo just isn't in the room any more, with nothing on
 * screen to say why. (The Cosplay Room's first dragged standee did exactly
 * this: parked at x=9.05 in a 20m-wide room, its panel landed at x=10.0, a
 * full WALL_THICKNESS behind the east wall's inner face.)
 *
 * So the gap is a maximum, not a constant: the panel slides in toward the
 * standee as far as it must to keep its face FRAME_WALL_OFFSET clear of the
 * room boundary — the same clearance every hung frame keeps, and for the same
 * reason (see that constant's own note on walls being inset a full
 * WALL_THICKNESS). A standee out in the middle of the floor is unaffected: its
 * panel is nowhere near a wall, so nothing binds and it gets the full gap.
 *
 * `position` and `rotationY` are room-local, exactly as StandeePlacement
 * carries them.
 */
export function backdropDistance(
  position: [number, number, number],
  rotationY: number,
  roomWidth: number,
  roomDepth: number
): number {
  // A group's un-rotated forward is +Z, so "behind the standee" — where
  // CosplayStandee.tsx draws the panel, at local -Z — points this way in room
  // space once the standee's yaw is applied.
  const backX = -Math.sin(rotationY);
  const backZ = -Math.cos(rotationY);

  let allowed = STANDEE_WALL_GAP;
  const limit = (from: number, along: number, half: number) => {
    // Only the wall this component of the backward vector actually travels
    // toward can bind, and a component of ~0 never reaches one.
    if (Math.abs(along) < 1e-6) return;
    const boundary = (along > 0 ? half : -half) - Math.sign(along) * FRAME_WALL_OFFSET;
    allowed = Math.min(allowed, (boundary - from) / along);
  };
  limit(position[0], backX, roomWidth / 2);
  limit(position[2], backZ, roomDepth / 2);

  // Never negative: a standee stood right up against the wall gets its panel
  // flat behind it rather than flipped around to its front.
  return Math.max(0, allowed);
}

/**
 * Where each cosplay pair stands, in room-local coordinates.
 *
 * Spacing, wall choice and doorway avoidance are all framePlacement.ts's — see
 * this file's header for why that's a reuse rather than a shortcut. `maxWidth`
 * from those slots is deliberately dropped: a standee is a fixed, roughly
 * life-size object (it doesn't shrink to fit the way a hung frame does), so a
 * room packed past what its perimeter comfortably holds gets standees closer
 * together instead of smaller ones. That's the honest outcome, and it's what
 * RoomsTab.tsx's crowding notice warns the admin about — silently not showing
 * some cosplays would be worse.
 */
export function computeStandeePlacements(
  count: number,
  roomWidth: number,
  roomDepth: number,
  hasNorthOpening = false,
  hasSouthOpening = false
): StandeePlacement[] {
  if (count <= 0) return [];

  return computeFramePlacements(
    count,
    roomWidth,
    roomDepth,
    hasNorthOpening,
    hasSouthOpening
  ).map((slot) => {
    const [x, , z] = slot.position;
    const [nx, , nz] = slot.wallNormal;
    return {
      // The wall normal points into the room (see framePlacement's
      // WallDefinition), so adding it is what moves the standee off the wall
      // rather than through it.
      position: [x + nx * STANDEE_WALL_GAP, 0, z + nz * STANDEE_WALL_GAP] as [number, number, number],
      // A frame's rotationY already faces out of its wall into the room, and a
      // group's un-rotated forward is +Z — the same convention — so the standee
      // faces the visitor with no adjustment, and its backdrop (drawn at local
      // -Z) lands flat against the wall it came from.
      rotationY: slot.rotationY,
    };
  });
}
