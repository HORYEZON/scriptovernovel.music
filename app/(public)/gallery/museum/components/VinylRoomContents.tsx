"use client";

// VinylRoomContents.tsx
//
// The Vinyl Room's own layer — a near-copy of CosplayRoomContents.tsx (read
// that first). Draws the sleeves on the walls, the deck, and the Lyrics
// Wall, and owns this room's [E] proximity tracking: the nearest sleeve or
// the deck, with the same enter/exit hysteresis the other rooms use, lifted
// to MuseumScene via onActiveChange. The deck is one more candidate in the
// same nearest-thing loop rather than a separate tracker, so the prompt can
// never offer a sleeve and the deck at once.
//
// What a press of [E] *does* (take / put back / put on / open the deck)
// lives in MuseumScene's handleActivate — this component only knows what
// the visitor is standing at.
import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import { ROOM_HEIGHT, FRAME_WALL_OFFSET, INTERACT_PROXIMITY_ENTER, INTERACT_PROXIMITY_EXIT } from "./roomConstants";
import { VinylSleeve } from "./VinylSleeve";
import { Turntable } from "./Turntable";
import { LyricsWall } from "./LyricsWall";
import type { FramePlacement } from "./framePlacement";
import type { MuseumVinylSleeve, VinylRoomConfigPublic } from "@/types";

const FONT_REGULAR = "/fonts/DMSans-Regular.woff";

export interface SleeveEntry {
  /** MuseumRoomVinyl row id — stable across re-renders and re-syncs. */
  entryId: string;
  vinyl: MuseumVinylSleeve;
  placement: FramePlacement;
  scale: number;
}

export type VinylTarget = { kind: "sleeve"; entry: SleeveEntry } | { kind: "deck" };

export interface LyricsWallState {
  currentLine: string | null;
  previousLine: string | null;
  nextLine: string | null;
  caption: string | null;
  glow: number;
}

export function VinylRoomContents({
  sleeves,
  depth,
  centerZ,
  baseY = 0,
  shouldLoad = true,
  config,
  turntable,
  activeTarget,
  onActiveChange,
  takenEntryIds,
  deckVinyl,
  deckPlaying,
  deckRpm,
  lyrics,
}: {
  sleeves: SleeveEntry[];
  depth: number;
  centerZ: number;
  baseY?: number;
  shouldLoad?: boolean;
  config: VinylRoomConfigPublic;
  /** Resolved deck placement (room-local) — config override or the default. */
  turntable: { x: number; z: number; rotationY: number };
  activeTarget: VinylTarget | null;
  onActiveChange: (target: VinylTarget | null) => void;
  /** Sleeves whose record is out (held or on the deck). */
  takenEntryIds: ReadonlySet<string>;
  deckVinyl: MuseumVinylSleeve | null;
  deckPlaying: boolean;
  deckRpm: number;
  lyrics: LyricsWallState;
}) {
  const { camera } = useThree();
  const activeRef = useRef<string | null>(null);
  const scratchCamPos = useRef(new THREE.Vector3());

  // Candidate positions: every sleeve plus the deck, keyed by id ("deck" for
  // the turntable). Same nearest-in-range + hysteresis loop as the standees.
  useFrame(() => {
    if (!shouldLoad) {
      if (activeRef.current !== null) {
        activeRef.current = null;
        onActiveChange(null);
      }
      return;
    }
    camera.getWorldPosition(scratchCamPos.current);
    const cx = scratchCamPos.current.x;
    const cz = scratchCamPos.current.z;

    let nearestId: string | null = null;
    let nearestDist = Infinity;
    for (const s of sleeves) {
      const [px, , pz] = s.placement.position;
      const d = Math.hypot(cx - px, cz - (centerZ + pz));
      if (d < nearestDist) {
        nearestDist = d;
        nearestId = s.entryId;
      }
    }
    const deckDist = Math.hypot(cx - turntable.x, cz - (centerZ + turntable.z));
    if (deckDist < nearestDist) {
      nearestDist = deckDist;
      nearestId = "deck";
    }

    const resolve = (id: string): VinylTarget | null => {
      if (id === "deck") return { kind: "deck" };
      const entry = sleeves.find((s) => s.entryId === id);
      return entry ? { kind: "sleeve", entry } : null;
    };
    const distTo = (id: string) => {
      if (id === "deck") return deckDist;
      const entry = sleeves.find((s) => s.entryId === id);
      if (!entry) return Infinity;
      const [px, , pz] = entry.placement.position;
      return Math.hypot(cx - px, cz - (centerZ + pz));
    };

    const current = activeRef.current;
    if (current === null) {
      if (nearestId && nearestDist <= INTERACT_PROXIMITY_ENTER) {
        activeRef.current = nearestId;
        onActiveChange(resolve(nearestId));
      }
      return;
    }
    const distToCurrent = distTo(current);
    if (!Number.isFinite(distToCurrent)) {
      activeRef.current = null;
      onActiveChange(null);
      return;
    }
    if (nearestId && nearestId !== current && nearestDist <= INTERACT_PROXIMITY_ENTER && nearestDist < distToCurrent) {
      activeRef.current = nearestId;
      onActiveChange(resolve(nearestId));
    } else if (distToCurrent > INTERACT_PROXIMITY_EXIT) {
      activeRef.current = null;
      onActiveChange(null);
    }
  });

  if (!shouldLoad) return null;

  const northWallZ = -depth / 2 + FRAME_WALL_OFFSET;
  const activeSleeveId = activeTarget?.kind === "sleeve" ? activeTarget.entry.entryId : null;

  return (
    <group position={[0, baseY, centerZ]}>
      {sleeves.map((entry) => (
        <VinylSleeve
          key={entry.entryId}
          coverImageUrl={entry.vinyl.coverImageUrl}
          title={entry.vinyl.title}
          placement={entry.placement}
          scale={entry.scale}
          active={activeSleeveId === entry.entryId}
          taken={takenEntryIds.has(entry.entryId)}
          shouldLoad={shouldLoad}
        />
      ))}

      <Turntable
        position={[turntable.x, 0, turntable.z]}
        rotationY={turntable.rotationY}
        modelUrl={config.turntableModelUrl}
        recordCoverUrl={deckVinyl?.coverImageUrl ?? null}
        playing={deckPlaying}
        rpm={deckRpm}
        active={activeTarget?.kind === "deck"}
        shouldLoad={shouldLoad}
      />

      {config.lyricsWall.enabled && (
        <LyricsWall
          wall={config.lyricsWall.wall}
          depth={depth}
          style={config.lyricsWall}
          currentLine={lyrics.currentLine}
          previousLine={lyrics.previousLine}
          nextLine={lyrics.nextLine}
          caption={lyrics.caption}
          glow={lyrics.glow}
        />
      )}

      {sleeves.length === 0 && (
        <Text
          position={[0, ROOM_HEIGHT * 0.76, northWallZ + 0.01]}
          fontSize={0.16}
          color="#c9c0ad"
          anchorX="center"
          anchorY="middle"
          textAlign="center"
          font={FONT_REGULAR}
        >
          {"No records on the wall yet.\nCheck back soon."}
        </Text>
      )}
    </group>
  );
}
