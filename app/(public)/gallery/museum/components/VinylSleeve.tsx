"use client";

// VinylSleeve.tsx
//
// One record on the Vinyl Room's wall: a square sleeve (the release cover as
// its texture, loaded through the same downscale+cache path as the wall
// frames) with a thin frame and, while the record is still in it, a dark
// disc peeking out of the top-right corner. Taking the record ([E] in
// VinylRoomContents / MuseumScene) drops the disc and dims the sleeve so the
// wall shows what's out.
//
// Placement follows ArtworkFrame.tsx exactly — a FramePlacement on the wall
// line, pushed FRAME_WALL_OFFSET into the room — so the Scene Editor's
// wall-snapped dragging works on sleeves unchanged.
import { useEffect, useState } from "react";
import * as THREE from "three";
import { loadDownscaledTexture } from "@/lib/museum/loadDownscaledTexture";
import type { FramePlacement } from "./framePlacement";
import { FRAME_WALL_OFFSET, INTERACT_GLOW_COLOR } from "./roomConstants";
import { BannerShimmer } from "./BannerPanel";

/** Sleeve edge length, metres — a 12" record sleeve scaled up to read from
 *  across the room, the way the wall frames are. */
export const SLEEVE_SIZE = 1.15;
const DISC_RADIUS = SLEEVE_SIZE * 0.47;
/** How far the disc peeks out of the sleeve. */
const DISC_PEEK = 0.09;

export function VinylSleeve({
  coverImageUrl,
  title,
  placement,
  active,
  taken,
  scale = 1,
  shouldLoad = true,
}: {
  coverImageUrl: string;
  title: string;
  placement: FramePlacement;
  active: boolean;
  /** The record is out of the sleeve — in the visitor's hands or on the deck. */
  taken: boolean;
  scale?: number;
  shouldLoad?: boolean;
}) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    if (!shouldLoad) return;
    let cancelled = false;
    loadDownscaledTexture(coverImageUrl)
      .then((loaded) => {
        if (!cancelled) setTexture(loaded.texture);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [coverImageUrl, shouldLoad]);

  const size = Math.min(SLEEVE_SIZE, placement.maxWidth);
  const [px, py, pz] = placement.position;
  const [nx, , nz] = placement.wallNormal;
  const position: [number, number, number] = [px + nx * FRAME_WALL_OFFSET, py, pz + nz * FRAME_WALL_OFFSET];

  return (
    <group position={position} rotation={[0, placement.rotationY, 0]} name={`sleeve:${title}`}>
      <group scale={[scale, scale, scale]}>
        {/* Backing frame, strictly behind the sleeve plane (see ArtworkFrame). */}
        <mesh position={[0, 0, -0.03]}>
          <boxGeometry args={[size + 0.1, size + 0.1, 0.04]} />
          <meshStandardMaterial color={active ? INTERACT_GLOW_COLOR : "#2c2620"} roughness={0.6} />
        </mesh>

        {/* The disc, peeking out of the sleeve's top-right while it's home. */}
        {!taken && (
          <group position={[DISC_PEEK, DISC_PEEK, -0.008]}>
            <mesh>
              <circleGeometry args={[DISC_RADIUS, 48]} />
              <meshStandardMaterial color="#0b0b0d" roughness={0.35} metalness={0.2} />
            </mesh>
            {/* Label — the same cover, small. */}
            <mesh position={[0, 0, 0.002]}>
              <circleGeometry args={[DISC_RADIUS * 0.36, 32]} />
              <meshStandardMaterial
                key={texture ? `${texture.uuid}-label` : "label"}
                map={texture}
                color={texture ? "#ffffff" : "#c8a96e"}
                roughness={0.8}
                toneMapped={false}
              />
            </mesh>
          </group>
        )}

        {/* The sleeve itself. */}
        <mesh>
          <planeGeometry args={[size, size]} />
          <meshStandardMaterial
            key={texture ? texture.uuid : "placeholder"}
            map={texture}
            color={texture ? (taken ? "#8a8479" : "#ffffff") : "#d8d3c6"}
            roughness={texture ? 0.9 : 1}
            toneMapped={false}
            side={THREE.DoubleSide}
            transparent={taken}
            opacity={taken ? 0.75 : 1}
          />
        </mesh>

        {active && !taken && (
          <BannerShimmer width={size} height={size} speed={1} strength={0.35} color="#f5f1e8" band={0.35} active />
        )}
      </group>
    </group>
  );
}
