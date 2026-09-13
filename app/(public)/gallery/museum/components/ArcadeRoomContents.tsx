"use client";

// ArcadeRoomContents.tsx
//
// The Arcade Room's own layer — a near-copy of StoriesRoomContents.tsx (read
// that first). Like the Stories Room, MuseumScene has nothing to hang here: a
// mini game isn't an artwork and a cabinet isn't a wall frame, so this
// component draws the room's actual contents.
//
// It also owns this room's [E] proximity tracking, with the same enter/exit
// hysteresis as StoriesRoomContents / AboutRoomContents, lifted to MuseumScene
// via onActiveChange exactly the way onActiveChange is there.
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
import { ArcadeCabinet, type ArcadeCabinetDisplay } from "./ArcadeCabinet";
import { ArcadePoster } from "./ArcadePoster";
import {
  DEFAULT_ROOM_BANNER_STYLE,
  type RoomBannerStyle,
} from "@/lib/museum/roomBanner";
import type { CabinetPlacement } from "./cabinetPlacement";
import type { PublicGame } from "@/lib/minigames/types";

const FONT_REGULAR = "/fonts/DMSans-Regular.woff";

export interface ArcadeEntry {
  /** MuseumRoomMiniGame row id — stable across re-renders and re-syncs. */
  entryId: string;
  /** Small subset used by the 3D cabinet/poster (title, screen image, difficulty). */
  display: ArcadeCabinetDisplay;
  /** Full public payload — what the info panel + GameSession need on [E]. */
  game: PublicGame;
  /** Resolved display mode (per-game override already folded in). */
  mode: "CABINET" | "POSTER";
  /** Auto grid slot or admin override — resolved by MuseumScene. */
  placement: CabinetPlacement;
}

export function ArcadeRoomContents({
  cabinets,
  depth,
  centerZ,
  baseY = 0,
  shouldLoad = true,
  activeEntryId,
  onActiveChange,
  scaleFor,
  cabinetModel,
  banner = DEFAULT_ROOM_BANNER_STYLE,
}: {
  cabinets: ArcadeEntry[];
  /** The room's shared plaque style — see lib/museum/roomBanner.ts. Painted on
   *  a cabinet's marquee and a poster's caption strip alike. */
  banner?: RoomBannerStyle;
  depth: number;
  centerZ: number;
  /** This room's own floor Y (roomLayout.ts's floorYSouth) — non-zero only
   *  when the Arcade Room has been moved to the Second Floor. */
  baseY?: number;
  shouldLoad?: boolean;
  activeEntryId: string | null;
  onActiveChange: (entry: ArcadeEntry | null) => void;
  /** Per-cabinet scale override from the Scene Editor. */
  scaleFor?: (entryId: string) => number;
  /** The room-wide cabinet body — an uploaded .glb, or the built-in one
   *  optionally re-surfaced (see lib/museum/arcadeConfig.ts). Posters ignore
   *  it: they hang on a wall and have no cabinet to replace. */
  cabinetModel?: {
    modelUrl: string | null;
    textureUrl: string | null;
    screenHeight: number;
    screenDepth: number;
  };
}) {
  const { camera } = useThree();
  const activeRef = useRef<string | null>(null);
  // World-space camera position scratch — under the player-rig refactor,
  // `camera.position` is local to the rig, not world space (see
  // Docs/Museum_VRMode.md §3.1). Reused every frame, not allocated.
  const scratchCamPos = useRef(new THREE.Vector3());

  // Nearest-cabinet-in-range tracking — identical to StoriesRoomContents'
  // podium tracker (INTERACT_PROXIMITY_ENTER to pick one up, the wider EXIT to
  // let it go, so the prompt doesn't flicker on the boundary).
  useFrame(() => {
    if (!shouldLoad || cabinets.length === 0) {
      if (activeRef.current !== null) {
        activeRef.current = null;
        onActiveChange(null);
      }
      return;
    }

    camera.getWorldPosition(scratchCamPos.current);

    let nearestIndex = -1;
    let nearestDist = Infinity;
    for (let i = 0; i < cabinets.length; i++) {
      const [px, , pz] = cabinets[i].placement.position;
      const dist = Math.hypot(scratchCamPos.current.x - px, scratchCamPos.current.z - (centerZ + pz));
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIndex = i;
      }
    }

    const current = activeRef.current;
    if (current === null) {
      if (nearestIndex >= 0 && nearestDist <= INTERACT_PROXIMITY_ENTER) {
        activeRef.current = cabinets[nearestIndex].entryId;
        onActiveChange(cabinets[nearestIndex]);
      }
      return;
    }

    const currentEntry = cabinets.find((c) => c.entryId === current);
    if (!currentEntry) {
      activeRef.current = null;
      onActiveChange(null);
      return;
    }

    const [cx, , cz] = currentEntry.placement.position;
    const distToCurrent = Math.hypot(scratchCamPos.current.x - cx, scratchCamPos.current.z - (centerZ + cz));

    if (
      nearestIndex >= 0 &&
      cabinets[nearestIndex].entryId !== current &&
      nearestDist <= INTERACT_PROXIMITY_ENTER &&
      nearestDist < distToCurrent
    ) {
      activeRef.current = cabinets[nearestIndex].entryId;
      onActiveChange(cabinets[nearestIndex]);
    } else if (distToCurrent > INTERACT_PROXIMITY_EXIT) {
      activeRef.current = null;
      onActiveChange(null);
    }
  });

  if (!shouldLoad) return null;

  const northWallZ = -depth / 2 + FRAME_WALL_OFFSET;

  return (
    <group position={[0, baseY, centerZ]}>
      {cabinets.map((entry) => {
        const common = {
          game: entry.display,
          position: entry.placement.position,
          rotationY: entry.placement.rotationY,
          scale: scaleFor?.(entry.entryId) ?? 1,
          active: activeEntryId === entry.entryId,
          shouldLoad,
          banner,
        };
        return entry.mode === "POSTER" ? (
          <ArcadePoster key={entry.entryId} {...common} />
        ) : (
          <ArcadeCabinet
            key={entry.entryId}
            {...common}
            modelUrl={cabinetModel?.modelUrl}
            textureUrl={cabinetModel?.textureUrl}
            screenHeight={cabinetModel?.screenHeight}
            screenDepth={cabinetModel?.screenDepth}
          />
        );
      })}

      {cabinets.length === 0 && (
        <Text
          position={[0, ROOM_HEIGHT * 0.76, northWallZ + 0.01]}
          fontSize={0.16}
          color="#c9c0ad"
          anchorX="center"
          anchorY="middle"
          textAlign="center"
          font={FONT_REGULAR}
        >
          {"No games available yet.\nCheck back soon."}
        </Text>
      )}
    </group>
  );
}
