// lib/museum/useWallFocus.ts
//
// Shared "is the player standing near AND facing this part of the wall"
// check — the 3D equivalent of a CSS :hover for first-person navigation,
// where there's no mouse to hover with. Runs once per frame per target
// (skills plaque, portrait, cert wall, ...) and returns a smoothed 0..1
// focus value instead of a hard boolean so callers can ease effects in/out
// as the player turns past a wall rather than snapping.
//
// Returns a ref, not React state — a value that changes every frame has no
// business going through setState/re-render; callers read `.current` from
// their own useFrame loop and should skip animation work below some small
// epsilon (see AboutRoomContents.tsx) so idle rooms cost nothing.
"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export interface WallFocusTarget {
  /** World-space point the effect is centered on (plaque/portrait/cert-wall center). */
  point: [number, number, number];
  /**
   * The wall's outward-into-room normal — same convention as
   * framePlacement.ts's `wallNormal` (points away from the wall surface,
   * into the room the player stands in). A player facing the wall looks
   * roughly *opposite* this vector.
   */
  normal: [number, number, number];
  /** Distance at which focus has fully fallen to 0. Eases in from *0.7 of this. */
  maxDistance?: number;
  /** Minimum "facing" dot product before focus starts rising off 0. */
  minDot?: number;
  /** Damping time constant passed to THREE.MathUtils.damp — higher = slower ease. */
  smoothing?: number;
}

const DEFAULT_MAX_DISTANCE = 6;
const DEFAULT_MIN_DOT = 0.35;
const DEFAULT_SMOOTHING = 6;

export function useWallFocus({
  point,
  normal,
  maxDistance = DEFAULT_MAX_DISTANCE,
  minDot = DEFAULT_MIN_DOT,
  smoothing = DEFAULT_SMOOTHING,
}: WallFocusTarget) {
  const focusRef = useRef(0);

  // Target point/normal are fixed per room instance in every actual caller
  // here (plaque/portrait/cert-wall centers never move) — memoized so this
  // isn't an allocation inside the per-frame hot path below.
  const targetPoint = useMemo(
    () => new THREE.Vector3(point[0], point[1], point[2]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [point[0], point[1], point[2]]
  );
  const targetNormal = useMemo(
    () => new THREE.Vector3(normal[0], normal[1], normal[2]).normalize(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [normal[0], normal[1], normal[2]]
  );

  // Scratch vectors reused every frame — never `new`'d inside useFrame.
  const toTarget = useRef(new THREE.Vector3());
  const camForward = useRef(new THREE.Vector3());
  const camWorldPos = useRef(new THREE.Vector3());

  useFrame((state, delta) => {
    const { camera } = state;
    // `camera.position` is local to the player rig, not world space, under
    // the rig refactor (see Docs/Museum_VRMode.md §3.1) — not one of that
    // doc's listed call sites (it audited app/(public)/gallery/museum/
    // components only), but the same bug: this hook's every caller passes a
    // world-space `point`, so comparing against a rig-local camera position
    // would silently break the "is the player near/facing this wall" glow.
    camera.getWorldPosition(camWorldPos.current);
    toTarget.current.copy(targetPoint).sub(camWorldPos.current);
    const dist = toTarget.current.length();

    camera.getWorldDirection(camForward.current);
    // normal points into the room; facing the wall means looking roughly
    // opposite it, so this dot is ~1 when the player looks dead at it.
    const facingDot = -camForward.current.dot(targetNormal);

    const nearDistance = maxDistance * 0.7;
    const distanceScore = 1 - THREE.MathUtils.smoothstep(dist, nearDistance, maxDistance);
    const facingScore = THREE.MathUtils.smoothstep(facingDot, minDot, minDot + 0.25);
    const rawTarget = distanceScore * facingScore;

    focusRef.current = THREE.MathUtils.damp(focusRef.current, rawTarget, smoothing, delta);
  });

  return focusRef;
}

/** Below this, per-frame shimmer/glow math is skipped entirely — see callers. */
export const WALL_FOCUS_EPSILON = 0.01;
