"use client";

import { useEffect, useState } from "react";
import * as THREE from "three";
import { loadDownscaledTexture } from "@/lib/museum/loadDownscaledTexture";
import type { MuseumArtwork } from "@/types";
import type { FramePlacement } from "./framePlacement";
import { FALLBACK_ASPECT, FRAME_HEIGHT, FRAME_WALL_OFFSET, INTERACT_GLOW_COLOR } from "./roomConstants";
import { BannerShimmer } from "./BannerPanel";
import { ARTWORK_SHIMMER_DEFAULTS, type ArtworkShimmerConfig } from "@/lib/museum/artworkShimmer";

// One wall-mounted artwork. Its *position* along the wall is fixed up front
// (see framePlacement.ts — deterministic, based on index/count only), so
// only this frame's own plane geometry needs to update once its texture's
// real aspect ratio is known; nothing else on the wall reflows.
export function ArtworkFrame({
  artwork,
  placement,
  active,
  scale = 1,
  shouldLoad = true,
  shimmer = ARTWORK_SHIMMER_DEFAULTS,
}: {
  artwork: MuseumArtwork;
  placement: FramePlacement;
  active: boolean;
  /** The light sweep that plays across the image while this is the frame the
   *  visitor is standing at (`active`) — museum-wide, set in General Settings
   *  (lib/museum/artworkShimmer.ts). Off, or while not active, nothing is
   *  drawn: the sweep is one extra plane and a scrolling texture, and only
   *  one frame in the museum is ever active. */
  shimmer?: ArtworkShimmerConfig;
  /** Admin-set resize multiplier (MuseumRoomArtwork.scale — Museum Scene
   * Editor) — applied via a nested group *inside* the outer positioned/
   * rotated group below, not by scaling this component's own render
   * output from outside, so it grows/shrinks the frame around its own
   * center without disturbing where that center actually sits on the
   * wall. 1 = default size. */
  scale?: number;
  /** Perf: the frame/placeholder always renders (a room should never have
   * gaps where its art belongs), but the actual image only starts
   * downloading once this room is the one the visitor is in/near — see
   * MuseumScene.tsx's nearbyRoomIds. Every artwork across every room used
   * to fetch its full-resolution image on page load regardless of which
   * room it was in; on a museum with dozens of artworks that's tens of MB
   * competing for bandwidth/GPU memory before a visitor has taken a single
   * step. Once true, stays loaded even if the room falls out of range
   * again — no reload thrashing from walking back and forth. */
  shouldLoad?: boolean;
}) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [aspect, setAspect] = useState(FALLBACK_ASPECT);

  useEffect(() => {
    if (!shouldLoad) return;
    let cancelled = false;
    loadDownscaledTexture(artwork.imageUrl)
      .then((loaded) => {
        if (cancelled) return;
        setTexture(loaded.texture);
        setAspect(loaded.aspect);
      })
      .catch(() => {
        // Leave the placeholder plane up — a failed texture shouldn't crash
        // the scene or leave a gap where the frame should be.
      });
    return () => {
      cancelled = true;
    };
  }, [artwork.imageUrl, shouldLoad]);

  // Natural size at the fixed FRAME_HEIGHT, then scaled down (both
  // dimensions together, so the true aspect ratio is preserved rather than
  // stretched) whenever that would exceed this slot's maxWidth — the cap
  // that keeps a wide/panoramic artwork from overlapping its neighbors or
  // wrapping into a corner (see roomConstants.ts and framePlacement.ts).
  const rawWidth = FRAME_HEIGHT * aspect;
  const shrink = Math.min(1, placement.maxWidth / rawWidth);
  const width = rawWidth * shrink;
  const height = FRAME_HEIGHT * shrink;
  const [px, py, pz] = placement.position;
  const [nx, , nz] = placement.wallNormal;
  const position: [number, number, number] = [
    px + nx * FRAME_WALL_OFFSET,
    py,
    pz + nz * FRAME_WALL_OFFSET,
  ];

  return (
    <group position={position} rotation={[0, placement.rotationY, 0]}>
      <group scale={[scale, scale, scale]}>
        {/* Backing frame border, slightly larger than the artwork plane. Its
            own depth is centered here at local z=-0.03 (not -0.02) so its
            front face lands at -0.01, strictly behind the plane at z=0 —
            otherwise the two are exactly coplanar and z-fight, and the plane
            (texture or fallback color) consistently loses to this dark box. */}
        <mesh position={[0, 0, -0.03]}>
          <boxGeometry args={[width + 0.14, height + 0.14, 0.04]} />
          <meshStandardMaterial color={active ? INTERACT_GLOW_COLOR : "#3a3126"} roughness={0.6} />
        </mesh>

        <mesh>
          <planeGeometry args={[width, height]} />
          <meshStandardMaterial
            // Keyed on the texture's identity (not just its presence) so a
            // fresh material — and shader — is created whenever `map` goes
            // from null to a texture. Flipping `.map` on an already-mounted
            // material doesn't recompile its shader on its own; without this
            // key the plane keeps rendering the flat fallback color forever,
            // even once `texture` is genuinely loaded and attached.
            key={texture ? texture.uuid : "placeholder"}
            map={texture}
            color={texture ? "#ffffff" : "#d8d3c6"}
            roughness={texture ? 0.9 : 1}
            toneMapped={false}
            side={THREE.DoubleSide}
          />
        </mesh>

        {active && shimmer.enabled && (
          <BannerShimmer
            width={width}
            height={height}
            speed={shimmer.speed}
            strength={shimmer.strength}
            color={shimmer.color}
            band={shimmer.bandWidth}
            active
          />
        )}
      </group>
    </group>
  );
}
