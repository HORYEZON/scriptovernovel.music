"use client";

// StoriesRoomContents.tsx
//
// The Stories Room's own layer. Unlike ServicesRoomContents (which only adds
// price plaques on top of frames MuseumScene already hangs), this component
// draws the room's actual contents: MuseumScene has nothing to hang here,
// because a story isn't an artwork and a podium isn't a wall frame.
//
// It also owns this room's [E] proximity tracking. PlayerControls.tsx only
// watches wall-frame placements, so anything that isn't a frame has to track
// the camera itself — the same arrangement AboutRoomContents.tsx uses for its
// certificates, down to the enter/exit hysteresis, and lifted to MuseumScene
// exactly the way onActiveCertChange is.
import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import {
  ROOM_HEIGHT,
  FRAME_WALL_OFFSET,
  INTERACT_PROXIMITY_ENTER,
  INTERACT_PROXIMITY_EXIT,
} from "./roomConstants";
import { StoryPodium, type PodiumStory } from "./StoryPodium";
import {
  DEFAULT_ROOM_BANNER_STYLE,
  type RoomBannerStyle,
} from "@/lib/museum/roomBanner";
import type { PodiumPlacement } from "./podiumPlacement";

const FONT_REGULAR = "/fonts/DMSans-Regular.woff";

/** How high off the floor the "is the visitor near this podium" test is taken
 *  — the distance that matters is along the floor, so this is a plain 2D
 *  measure like every other proximity check in the museum. */
export interface PodiumEntry {
  /** MuseumRoomStory row id — stable across re-renders and re-syncs. */
  entryId: string;
  story: PodiumStory;
  placement: PodiumPlacement;
}

export function StoriesRoomContents({
  podiums,
  depth,
  centerZ,
  baseY = 0,
  shouldLoad = true,
  activeEntryId,
  onActiveChange,
  podiumModelUrl,
  podiumBookHeight,
  podiumTextureUrl,
  scaleFor,
  banner = DEFAULT_ROOM_BANNER_STYLE,
}: {
  podiums: PodiumEntry[];
  /** The room's shared plaque style — see lib/museum/roomBanner.ts. */
  banner?: RoomBannerStyle;
  depth: number;
  centerZ: number;
  /** This room's own floor Y (roomLayout.ts's floorYSouth) — non-zero only
   *  when the Stories Room has been moved to the Second Floor. */
  baseY?: number;
  shouldLoad?: boolean;
  activeEntryId: string | null;
  onActiveChange: (entry: PodiumEntry | null) => void;
  /** Optional room-wide pedestal model + the height its book sits at. */
  podiumModelUrl?: string | null;
  podiumBookHeight?: number;
  /** Tiled surface image for the procedural pedestal — see StoryPodium. */
  podiumTextureUrl?: string | null;
  /** Per-podium scale override from the Scene Editor. */
  scaleFor?: (entryId: string) => number;
}) {
  const { camera } = useThree();
  // Read in the frame loop and written by it — deliberately a ref, not state:
  // this runs every frame and must not re-render the scene to remember which
  // podium it last reported.
  const activeRef = useRef<string | null>(null);
  // World-space camera position scratch — `camera.position` is local to the
  // player rig, not world space (see Docs/Museum_VRMode.md §3.1). Reused
  // every frame, not allocated.
  const scratchCamPos = useRef(new THREE.Vector3());

  // Nearest-podium-in-range tracking, with the same enter/exit hysteresis as
  // AboutRoomContents' certificates (INTERACT_PROXIMITY_ENTER to pick one up,
  // the wider EXIT to let it go) so the prompt doesn't flicker when a visitor
  // stands right on the boundary.
  useFrame(() => {
    if (!shouldLoad || podiums.length === 0) {
      if (activeRef.current !== null) {
        activeRef.current = null;
        onActiveChange(null);
      }
      return;
    }

    camera.getWorldPosition(scratchCamPos.current);

    let nearestIndex = -1;
    let nearestDist = Infinity;
    for (let i = 0; i < podiums.length; i++) {
      const [px, , pz] = podiums[i].placement.position;
      const dist = Math.hypot(scratchCamPos.current.x - px, scratchCamPos.current.z - (centerZ + pz));
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIndex = i;
      }
    }

    const current = activeRef.current;
    if (current === null) {
      if (nearestIndex >= 0 && nearestDist <= INTERACT_PROXIMITY_ENTER) {
        activeRef.current = podiums[nearestIndex].entryId;
        onActiveChange(podiums[nearestIndex]);
      }
      return;
    }

    const currentEntry = podiums.find((p) => p.entryId === current);
    if (!currentEntry) {
      // The podium we were tracking is gone (a re-sync removed it).
      activeRef.current = null;
      onActiveChange(null);
      return;
    }

    const [cx, , cz] = currentEntry.placement.position;
    const distToCurrent = Math.hypot(scratchCamPos.current.x - cx, scratchCamPos.current.z - (centerZ + cz));

    if (
      nearestIndex >= 0 &&
      podiums[nearestIndex].entryId !== current &&
      nearestDist <= INTERACT_PROXIMITY_ENTER &&
      nearestDist < distToCurrent
    ) {
      // Walked past one podium straight to a closer one.
      activeRef.current = podiums[nearestIndex].entryId;
      onActiveChange(podiums[nearestIndex]);
    } else if (distToCurrent > INTERACT_PROXIMITY_EXIT) {
      activeRef.current = null;
      onActiveChange(null);
    }
  });

  if (!shouldLoad) return null;

  // North wall surface Z in room-local space, same convention as
  // ServicesRoomContents/FreedomWallRoomContents.
  const northWallZ = -depth / 2 + FRAME_WALL_OFFSET;

  return (
    <group position={[0, baseY, centerZ]}>
      {podiums.map((entry) => (
        <StoryPodium
          key={entry.entryId}
          story={entry.story}
          position={entry.placement.position}
          rotationY={entry.placement.rotationY}
          scale={scaleFor?.(entry.entryId) ?? 1}
          active={activeEntryId === entry.entryId}
          shouldLoad={shouldLoad}
          modelUrl={podiumModelUrl}
          bookHeight={podiumBookHeight}
          textureUrl={podiumTextureUrl}
          banner={banner}
        />
      ))}

      {podiums.length === 0 && (
        // Deliberately high on the wall (above DOORWAY_HEIGHT) so it's never
        // sitting inside the doorway gap when the next room's opening is cut
        // into this wall — same placement as the Services Room's empty state.
        <Text
          position={[0, ROOM_HEIGHT * 0.76, northWallZ + 0.01]}
          fontSize={0.16}
          color="#c9c0ad"
          anchorX="center"
          anchorY="middle"
          textAlign="center"
          font={FONT_REGULAR}
        >
          {"No stories published yet.\nCheck back soon."}
        </Text>
      )}
    </group>
  );
}
