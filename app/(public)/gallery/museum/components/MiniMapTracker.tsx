"use client";

// A headless component (renders nothing) mounted inside MuseumScene.tsx's
// <Canvas> purely to feed MiniMapHud.tsx (the bottom-left "radar" widget,
// desktop only) a live read of the current room + player position/facing —
// same non-invasive "read state.camera directly in useFrame" trick
// StepTracker.tsx and ChaseCompanion.tsx already use, rather than threading
// anything through PlayerControls.tsx.
//
// Writes into a plain ref every frame instead of React state — a dot that
// needs to feel like a live radar has to update at frame rate, and a
// setState that often would repaint the whole HUD tree 60x/sec for no
// reason. MiniMapHud.tsx reads this same ref from its own independent
// requestAnimationFrame loop (outside the R3F render loop entirely) and
// paints straight onto a plain 2D <canvas> — no React re-render involved
// on either side.
import { useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { getLayoutAtZ, type RoomLayout } from "./roomLayout";

export interface MiniMapFrameState {
  roomId: string;
  /** Which storey the room is on (MuseumRoom.floor — 0 ground, 1 second) and
   * its type, together enough for MiniMapHud.tsx to pick the floor label
   * (lib/museum/minimapHud.ts's floorLabelFor). The STAIRS connector is
   * stored as floor 0 but labelled as its own thing, hence both. */
  roomFloor: number;
  roomType: string;
  roomWidth: number;
  roomDepth: number;
  hasNorthOpening: boolean;
  hasSouthOpening: boolean;
  /** Player position relative to the room's own center — rooms are always
   * centered at world X=0, so localX is just world X; localZ subtracts the
   * room's centerZ (see roomLayout.ts). */
  localX: number;
  localZ: number;
  /** Facing angle in radians, 0 = due north (-Z), increasing clockwise —
   * matches how the canvas is painted (north at the top). */
  yaw: number;
  /** Every artwork frame actually hung in this room, room-local (same
   * space as localX/localZ above) — MiniMapHud.tsx plots these as small
   * dots so the minimap reflects where pieces are on the walls, not just
   * the room's bare shape. */
  artworkPositions: { x: number; z: number; active: boolean }[];
  /** Admin-placed .glb props standing in this room (MuseumSceneObject with
   * kind "custom" — the Museum Scene Editor's uploads), room-local like
   * everything else here. Plotted the same way the artwork dots are, so the
   * minimap reflects what's actually in the room rather than only what's on
   * its walls. Wherever the admin dropped a model is where its dot lands,
   * with no separate bookkeeping: these are the very same coordinates
   * MuseumScene.tsx renders the model from. */
  objectPositions: { x: number; z: number; active: boolean }[];
  /** Freedom Wall sticky notes in this room, room-local like everything else
   *  here — same source coordinates FreedomWallRoomContents.tsx itself
   *  renders from (see lib/museum/freedomWallNotePlacement.ts), so a dot can
   *  never drift from the note it represents. Empty for every room but the
   *  Freedom Wall. */
  stickyNotePositions: { x: number; z: number }[];
  /** Whichever active Chase Companions currently happen to be standing in
   * this same room, room-local (same space as everything else here) — see
   * MuseumScene.tsx's companionPositionRefs. Only ever as many as are
   * actually enabled (page.tsx already filters to enabled companions
   * before any of this renders), and only the ones physically in this
   * room, not every companion site-wide. */
  companionPositions: { x: number; z: number }[];
}

/**
 * One plotted thing, as MuseumScene.tsx hands it over.
 *
 * `id` matches whatever the scene already calls the thing — an artwork's own
 * id, a standee's entry id, the Contact Desk's kind — so the dot for whatever
 * [E] is currently offering can be picked out by matching `activeInteractId`.
 * That is the default and the one that should be preferred: the dot then lights
 * at exactly the moment the object itself does, in every room.
 *
 * `litWhenNear` is the exception, for the About room's wall blocks: they have
 * no per-item [E] target to match against, so they light on plain distance.
 */
export interface MiniMapDot {
  id: string;
  x: number;
  z: number;
  /** Light this dot up whenever the visitor is standing within
   *  NEAR_DISTANCE of it, rather than when it's the active [E] target.
   *
   *  Only for things with no [E] target of their own. Anything a visitor can
   *  actually press [E] at should match by id instead — NEAR_DISTANCE is twice
   *  the [E] range on purpose (see below), so using it for an interactable
   *  lights its dot while the visitor is still metres too far to interact,
   *  which reads as the map being wrong rather than generous. */
  litWhenNear?: boolean;
}

/**
 * How close counts as "at" one of those, in world units. Deliberately wider
 * than the [E] range an artwork uses: several of the About room's blocks are
 * metres across (the plaque runs most of a wall) while their dot marks one
 * point on it, so a visitor is standing right at the thing well before they
 * are that close to the point marking it.
 *
 * That is the *only* case it fits. See `litWhenNear` above.
 */
const NEAR_DISTANCE = 5;

export function MiniMapTracker({
  layouts,
  roomArtworkLocalPositions,
  roomObjectLocalPositions,
  roomStickyNoteLocalPositions,
  activeInteractId,
  companionPositionRefs,
  stateRef,
}: {
  layouts: RoomLayout[];
  /** Room id → each of its artwork frames' room-local {id,x,z} — computed
   * once in MuseumScene.tsx (the same placement math already used to
   * actually render the frames), not per-frame here; this just looks up
   * whichever room the player currently stands in. */
  roomArtworkLocalPositions: Map<string, MiniMapDot[]>;
  /** Room id → its .glb props' room-local {x,z}, built in MuseumScene.tsx
   * from the same customObjects entries it renders the models from — so a
   * dot can never drift from the object it represents. */
  roomObjectLocalPositions: Map<string, MiniMapDot[]>;
  /** Room id → its Freedom Wall notes' room-local {x,z} — only ever
   *  non-empty for the one Freedom Wall room, built the same way as the
   *  object map above. */
  roomStickyNoteLocalPositions: Map<string, { x: number; z: number }[]>;
  /** Whatever [E] is currently offering, as an id — the artwork frame
   * PlayerControls.tsx has in range, or the standee/desk one of the rooms'
   * own trackers has. MiniMapHud.tsx glows that one dot yellow instead of the
   * plain white. One value because only one thing is ever offered at a time
   * (handleActivate picks exactly one), which is what makes the map agree with
   * the prompt by construction. */
  activeInteractId: string | null;
  /** Companion id → its own live world-space Vector3, written every frame
   * by each ChaseCompanion.tsx instance — read here (not owned here) so
   * this stays a plain lookup, same non-invasive pattern as reading
   * state.camera directly instead of threading position through props. */
  companionPositionRefs: MutableRefObject<Map<string, THREE.Vector3>>;
  stateRef: MutableRefObject<MiniMapFrameState | null>;
}) {
  const scratchDir = useRef(new THREE.Vector3());
  // World-space camera position scratch — `camera.position` is local to
  // the player rig, not world space (see Docs/Museum_VRMode.md §3.1).
  // `getWorldDirection` below is already world-space by definition and is
  // left alone.
  const scratchPos = useRef(new THREE.Vector3());

  useFrame(({ camera }) => {
    camera.getWorldPosition(scratchPos.current);
    const layout = getLayoutAtZ(layouts, scratchPos.current.z);
    if (!layout) {
      stateRef.current = null;
      return;
    }
    camera.getWorldDirection(scratchDir.current);

    const companionPositions: { x: number; z: number }[] = [];
    for (const pos of companionPositionRefs.current.values()) {
      // Only companions physically standing within this room's own Z span
      // — one that's still idling in a distant room shouldn't show up on a
      // minimap that only ever depicts the room the visitor is in.
      if (pos.z <= layout.southZ && pos.z >= layout.northZ) {
        companionPositions.push({ x: pos.x, z: pos.z - layout.centerZ });
      }
    }

    const localX = scratchPos.current.x;
    const localZ = scratchPos.current.z - layout.centerZ;
    // A dot is lit either because it *is* the thing [E] is currently offering
    // (an artwork frame, a cosplay standee, the Contact Desk) or because the
    // visitor is simply standing at it (the About room's wall blocks, which
    // have no per-item [E] target of their own). Both end up as the same
    // yellow on the map, which is the point: "you're on this" reads the same
    // in every room — and so must the distance at which it lights, which is
    // why matching by id is the default and NEAR_DISTANCE the exception.
    const plot = (dot: MiniMapDot) => ({
      x: dot.x,
      z: dot.z,
      active: dot.litWhenNear
        ? Math.hypot(dot.x - localX, dot.z - localZ) <= NEAR_DISTANCE
        : dot.id === activeInteractId,
    });

    stateRef.current = {
      roomId: layout.room.id,
      roomFloor: layout.room.floor,
      roomType: layout.room.roomType,
      roomWidth: layout.width,
      roomDepth: layout.depth,
      hasNorthOpening: layout.hasNorthOpening,
      hasSouthOpening: layout.hasSouthOpening,
      localX,
      localZ,
      yaw: Math.atan2(scratchDir.current.x, -scratchDir.current.z),
      artworkPositions: (roomArtworkLocalPositions.get(layout.room.id) ?? []).map(plot),
      objectPositions: (roomObjectLocalPositions.get(layout.room.id) ?? []).map(plot),
      stickyNotePositions: roomStickyNoteLocalPositions.get(layout.room.id) ?? [],
      companionPositions,
    };
  });

  return null;
}
