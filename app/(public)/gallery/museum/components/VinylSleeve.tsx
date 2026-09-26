"use client";

// VinylSleeve.tsx
//
// One record on the Vinyl Room's wall: a square sleeve (the release cover as
// its texture, loaded through the same downscale+cache path as the wall
// frames) with a thin frame and, while the record is still in it, a dark
// disc peeking out of the top-right corner.
//
// The sleeve is a *case*, not a picture. Pressing [E] at it (MuseumScene's
// handleActivate) doesn't open a modal — it opens the object itself: the
// front cover swings on its left edge like a gatefold / CD case while the
// record slides out of the open right edge and turns on the spot. The
// record then goes to the visitor's hands (`taken`) and the cover relaxes to
// just ajar (AJAR), artwork still square to the room, so the wall reads at a
// glance as "that one is out" without the sleeve looking shut — and without
// the album art swinging out of view. Putting it back runs the same
// animation backwards.
//
// Both halves of that are driven from one eased progress ref in useFrame —
// no React state per frame, and `open` can flip mid-animation without a
// snap because the lerp only ever chases the current target.
//
// Placement follows ArtworkFrame.tsx exactly — a FramePlacement on the wall
// line, pushed FRAME_WALL_OFFSET into the room — so the Scene Editor's
// wall-snapped dragging works on sleeves unchanged.
import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { loadDownscaledTexture } from "@/lib/museum/loadDownscaledTexture";
import type { FramePlacement } from "./framePlacement";
import { FRAME_WALL_OFFSET, INTERACT_GLOW_COLOR } from "./roomConstants";
import { BannerShimmer } from "./BannerPanel";

/** Sleeve edge length, metres — a 12" record sleeve scaled up to read from
 *  across the room, the way the wall frames are. */
export const SLEEVE_SIZE = 1.15;
const DISC_RADIUS = SLEEVE_SIZE * 0.47;
/** How far the disc peeks out of the sleeve while the case is shut. */
const DISC_PEEK = 0.09;
/** How far the cover swings while the record slides out — past square, so
 *  the disc has a clear path and the open case reads as open from the side
 *  as well as head-on. */
const OPEN_ANGLE = 2.15;
/** Where the cover settles once the record is out, as a fraction of
 *  OPEN_ANGLE. Fully swung, the cover shows its bare reverse and the artwork
 *  faces the wall — from across the room an empty sleeve read as a closed one.
 *  This used to be 0.42 (~52°), which is far enough that walking up to a
 *  sleeve whose record you are carrying showed you the edge of the cover and
 *  the empty inner card rather than the album art: the cover looked gone. A
 *  shallow ~18° keeps the artwork square to the room and readable while the
 *  gap along the free edge still says "this one's out". */
const AJAR = 0.15;
/** Eased-approach constant for the open/close lerp. */
const EASE = 7;
/** How long the swing reads as finished, in ms — the eased approach never
 *  mathematically arrives, so this is where it's close enough to hand the
 *  record over. MuseumScene times its `heldVinyl` handover on this, which is
 *  why it lives here rather than as a number copied into that file. */
export const SLEEVE_OPEN_MS = 620;
/** Turns per second the record makes while it hangs out of the case. */
const DISC_SPIN = 0.45;

export function VinylSleeve({
  coverImageUrl,
  title,
  placement,
  active,
  taken,
  open = false,
  scale = 1,
  shouldLoad = true,
}: {
  coverImageUrl: string;
  title: string;
  placement: FramePlacement;
  active: boolean;
  /** The record is out of the sleeve — in the visitor's hands or on the deck. */
  taken: boolean;
  /** The case is open: cover swung back, record slid out (until `taken`). */
  open?: boolean;
  scale?: number;
  shouldLoad?: boolean;
}) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const flapRef = useRef<THREE.Group>(null);
  const discRef = useRef<THREE.Group>(null);
  // 0 = shut, 1 = wide open. A ref, not state: it changes every frame.
  const progress = useRef(0);

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

  useFrame((_, delta) => {
    // Frame-rate independent ease toward the target, so the swing takes the
    // same wall-clock time on a 144 Hz laptop and a throttled tab.
    const k = 1 - Math.exp(-Math.min(delta, 0.1) * EASE);
    // Wide open while the disc is on its way out, then relaxing to ajar once
    // it's gone — the same lerp, so the settle is the tail of the swing rather
    // than a second animation.
    const target = open ? (taken ? AJAR : 1) : 0;
    progress.current += (target - progress.current) * k;
    const p = progress.current;

    if (flapRef.current) {
      // Hinged on the sleeve's left edge: +Y rotation walks the free edge out
      // of the wall and then round to the left, like opening a book.
      flapRef.current.rotation.y = p * OPEN_ANGLE;
    }
    if (discRef.current) {
      // Out of the open right edge, forward off the wall, and settling to
      // centre height as it clears the sleeve.
      discRef.current.position.set(
        DISC_PEEK + p * (size * 0.72 - DISC_PEEK),
        DISC_PEEK * (1 - p),
        -0.008 + p * 0.105
      );
      discRef.current.rotation.z -= delta * DISC_SPIN * Math.PI * 2 * p;
      // A touch of tilt so it catches the room light rather than reading flat.
      discRef.current.rotation.y = p * 0.28;
    }
  });

  return (
    <group position={position} rotation={[0, placement.rotationY, 0]} name={`sleeve:${title}`}>
      <group scale={[scale, scale, scale]}>
        {/* Backing frame, strictly behind the sleeve plane (see ArtworkFrame). */}
        <mesh position={[0, 0, -0.03]}>
          <boxGeometry args={[size + 0.1, size + 0.1, 0.04]} />
          <meshStandardMaterial color={active ? INTERACT_GLOW_COLOR : "#2c2620"} roughness={0.6} />
        </mesh>

        {/* The case's back half — plain inner card, seen only once the cover
            swings off it. */}
        <mesh position={[0, 0, -0.012]}>
          <planeGeometry args={[size * 0.98, size * 0.98]} />
          <meshStandardMaterial color="#1a1613" roughness={0.95} />
        </mesh>

        {/* The disc. Parked inside the shut case, slid out and turning while
            the case is open, gone entirely once it's in the visitor's hands. */}
        {!taken && (
          <group ref={discRef} position={[DISC_PEEK, DISC_PEEK, -0.008]}>
            <mesh>
              <circleGeometry args={[DISC_RADIUS, 48]} />
              <meshStandardMaterial color="#0b0b0d" roughness={0.35} metalness={0.2} side={THREE.DoubleSide} />
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

        {/* The cover, hinged on its left edge. The outer group is the hinge
            (parked at -size/2); the inner one carries the art back out to
            centre, so rotating the hinge swings the whole face. */}
        <group ref={flapRef} position={[-size / 2, 0, 0.004]}>
          <group position={[size / 2, 0, 0]}>
            <mesh>
              <planeGeometry args={[size, size]} />
              <meshStandardMaterial
                key={texture ? texture.uuid : "placeholder"}
                map={texture}
                color={texture ? "#ffffff" : "#d8d3c6"}
                roughness={texture ? 0.9 : 1}
                toneMapped={false}
                side={THREE.DoubleSide}
              />
            </mesh>
            {/* The cover's reverse — bare card, so a swung-open case doesn't
                show a mirrored copy of the artwork. Nearer the viewer than
                the art once the flap passes 90°, so depth does the hiding. */}
            <mesh position={[0, 0, -0.003]} rotation={[0, Math.PI, 0]}>
              <planeGeometry args={[size, size]} />
              <meshStandardMaterial color="#2a241d" roughness={0.98} />
            </mesh>

            {active && (
              <BannerShimmer width={size} height={size} speed={1} strength={0.35} color="#f5f1e8" band={0.35} active />
            )}
          </group>
        </group>
      </group>
    </group>
  );
}
