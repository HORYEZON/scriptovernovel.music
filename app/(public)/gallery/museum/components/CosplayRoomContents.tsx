"use client";

// CosplayRoomContents.tsx
//
// The Cosplay Room's own layer — a near-copy of StoriesRoomContents.tsx (read
// that first). Like the Stories Room, this component draws the room's actual
// contents rather than decorating frames MuseumScene already hung: MuseumScene
// has nothing to hang here, because a cosplay isn't an artwork and a standee
// isn't a wall frame.
//
// It also owns this room's [E] proximity tracking, with the same enter/exit
// hysteresis as StoriesRoomContents / AboutRoomContents, lifted to MuseumScene
// via onActiveChange exactly the way those do — PlayerControls.tsx only watches
// wall-frame placements, so anything that isn't a frame has to track the camera
// itself.
import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import {
  ROOM_HEIGHT,
  ROOM_WIDTH,
  FRAME_WALL_OFFSET,
  INTERACT_PROXIMITY_ENTER,
  INTERACT_PROXIMITY_EXIT,
} from "./roomConstants";
import { CosplayStandee, type StandeeCosplay } from "./CosplayStandee";
import { backdropDistance, type StandeePlacement } from "./standeePlacement";
import type { LightsAnimation, LightsStyle } from "@/lib/museum/cosplayStandee";
import type { RoomBannerStyle } from "@/lib/museum/roomBanner";

const FONT_REGULAR = "/fonts/DMSans-Regular.woff";

export interface StandeeEntry {
  /** MuseumRoomCosplay row id — stable across re-renders and re-syncs. */
  entryId: string;
  cosplay: StandeeCosplay;
  placement: StandeePlacement;
  /** This standee's own billboard-lights switch — see
   *  MuseumRoomCosplay.lightsEnabled. Per-standee, unlike every other light
   *  setting below, which is room-wide. */
  lightsEnabled?: boolean;
}

export function CosplayRoomContents({
  standees,
  depth,
  centerZ,
  baseY = 0,
  shouldLoad = true,
  activeEntryId,
  onActiveChange,
  standeeModelUrl,
  standeeCutoutHeight,
  standeeTextureUrl,
  backdropEnabled,
  backdropWidth,
  backdropHeight,
  backdropFrameColor,
  backdropEdgeColor,
  backdropEdgeThickness,
  banner,
  lightsStyle,
  lightsColor,
  lightsIntensity,
  lightsBulbSize,
  lightsSpacing,
  lightsAnimation,
  lightsSpeed,
  floodCount,
  floodBeamHeight,
  floodBeamSpread,
  scaleFor,
}: {
  standees: StandeeEntry[];
  depth: number;
  centerZ: number;
  /** This room's own floor Y (roomLayout.ts's floorYSouth) — non-zero only when
   *  the Cosplay Room has been moved to the Second Floor. */
  baseY?: number;
  shouldLoad?: boolean;
  activeEntryId: string | null;
  onActiveChange: (entry: StandeeEntry | null) => void;
  /** Room-wide standee + backdrop settings — see lib/museum/cosplayStandee.ts. */
  standeeModelUrl?: string | null;
  standeeCutoutHeight?: number;
  standeeTextureUrl?: string | null;
  backdropEnabled?: boolean;
  backdropWidth?: number;
  backdropHeight?: number;
  backdropFrameColor?: string;
  backdropEdgeColor?: string;
  backdropEdgeThickness?: number;
  /** The room's shared plaque style — see lib/museum/roomBanner.ts. */
  banner?: RoomBannerStyle;
  /** Billboard-lights look — room-wide, same as the backdrop/plaque settings
   *  above. See lib/museum/cosplayStandee.ts. */
  lightsStyle?: LightsStyle;
  lightsColor?: string;
  lightsIntensity?: number;
  lightsBulbSize?: number;
  lightsSpacing?: number;
  lightsAnimation?: LightsAnimation;
  lightsSpeed?: number;
  floodCount?: number;
  floodBeamHeight?: number;
  floodBeamSpread?: number;
  /** Per-standee scale override from the Scene Editor. */
  scaleFor?: (entryId: string) => number;
}) {
  const { camera } = useThree();
  // Read in the frame loop and written by it — deliberately a ref, not state:
  // this runs every frame and must not re-render the scene to remember which
  // standee it last reported.
  const activeRef = useRef<string | null>(null);
  // World-space camera position scratch — `camera.position` is local to the
  // player rig, not world space (see Docs/Museum_VRMode.md §3.1). Reused
  // every frame, not allocated.
  const scratchCamPos = useRef(new THREE.Vector3());

  // Nearest-standee-in-range tracking, identical to StoriesRoomContents'
  // (INTERACT_PROXIMITY_ENTER to pick one up, the wider EXIT to let it go) so
  // the prompt doesn't flicker when a visitor stands right on the boundary.
  useFrame(() => {
    if (!shouldLoad || standees.length === 0) {
      if (activeRef.current !== null) {
        activeRef.current = null;
        onActiveChange(null);
      }
      return;
    }

    camera.getWorldPosition(scratchCamPos.current);

    let nearestIndex = -1;
    let nearestDist = Infinity;
    for (let i = 0; i < standees.length; i++) {
      const [px, , pz] = standees[i].placement.position;
      const dist = Math.hypot(scratchCamPos.current.x - px, scratchCamPos.current.z - (centerZ + pz));
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIndex = i;
      }
    }

    const current = activeRef.current;
    if (current === null) {
      if (nearestIndex >= 0 && nearestDist <= INTERACT_PROXIMITY_ENTER) {
        activeRef.current = standees[nearestIndex].entryId;
        onActiveChange(standees[nearestIndex]);
      }
      return;
    }

    const currentEntry = standees.find((s) => s.entryId === current);
    if (!currentEntry) {
      // The standee we were tracking is gone (a re-sync removed it).
      activeRef.current = null;
      onActiveChange(null);
      return;
    }

    const [cx, , cz] = currentEntry.placement.position;
    const distToCurrent = Math.hypot(scratchCamPos.current.x - cx, scratchCamPos.current.z - (centerZ + cz));

    if (
      nearestIndex >= 0 &&
      standees[nearestIndex].entryId !== current &&
      nearestDist <= INTERACT_PROXIMITY_ENTER &&
      nearestDist < distToCurrent
    ) {
      // Walked past one standee straight to a closer one.
      activeRef.current = standees[nearestIndex].entryId;
      onActiveChange(standees[nearestIndex]);
    } else if (distToCurrent > INTERACT_PROXIMITY_EXIT) {
      activeRef.current = null;
      onActiveChange(null);
    }
  });

  if (!shouldLoad) return null;

  // North wall surface Z in room-local space, same convention as
  // StoriesRoomContents/ServicesRoomContents.
  const northWallZ = -depth / 2 + FRAME_WALL_OFFSET;

  return (
    <group position={[0, baseY, centerZ]}>
      {standees.map((entry) => (
        <CosplayStandee
          key={entry.entryId}
          cosplay={entry.cosplay}
          position={entry.placement.position}
          rotationY={entry.placement.rotationY}
          scale={scaleFor?.(entry.entryId) ?? 1}
          active={activeEntryId === entry.entryId}
          shouldLoad={shouldLoad}
          modelUrl={standeeModelUrl}
          cutoutHeight={standeeCutoutHeight}
          textureUrl={standeeTextureUrl}
          backdropEnabled={backdropEnabled}
          backdropWidth={backdropWidth}
          backdropHeight={backdropHeight}
          backdropFrameColor={backdropFrameColor}
          backdropEdgeColor={backdropEdgeColor}
          backdropEdgeThickness={backdropEdgeThickness}
          banner={banner}
          lightsEnabled={entry.lightsEnabled}
          lightsStyle={lightsStyle}
          lightsColor={lightsColor}
          lightsIntensity={lightsIntensity}
          lightsBulbSize={lightsBulbSize}
          lightsSpacing={lightsSpacing}
          lightsAnimation={lightsAnimation}
          lightsSpeed={lightsSpeed}
          floodCount={floodCount}
          floodBeamHeight={floodBeamHeight}
          floodBeamSpread={floodBeamSpread}
          // Worked out per standee rather than left at the constant, so a
          // standee dragged in close to its wall doesn't hang its photo inside
          // that wall — see backdropDistance()'s own note.
          backdropDistance={backdropDistance(
            entry.placement.position,
            entry.placement.rotationY,
            ROOM_WIDTH,
            depth
          )}
        />
      ))}

      {standees.length === 0 && (
        // Deliberately high on the wall (above DOORWAY_HEIGHT) so it's never
        // sitting inside the doorway gap when the next room's opening is cut
        // into this wall — same placement as the Stories Room's empty state.
        <Text
          position={[0, ROOM_HEIGHT * 0.76, northWallZ + 0.01]}
          fontSize={0.16}
          color="#c9c0ad"
          anchorX="center"
          anchorY="middle"
          textAlign="center"
          font={FONT_REGULAR}
        >
          {"No cosplays published yet.\nCheck back soon."}
        </Text>
      )}
    </group>
  );
}
