"use client";

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { DOORWAY_WIDTH, DOORWAY_HEIGHT, WALL_THICKNESS } from "./roomConstants";

// ── Geometry constants ──────────────────────────────────────────────────────
// Each panel covers half the opening; together they span DOORWAY_WIDTH.
const PANEL_W = DOORWAY_WIDTH / 2;       // 2.25 units
const PANEL_H = DOORWAY_HEIGHT;          // 3.2 units
const GLASS_D = WALL_THICKNESS * 0.35;  // ~0.07 — thin but opaque-ish glass pane
const HEADER_H = 0.07;                   // guide-rail / header beam height

// ── Behaviour constants ─────────────────────────────────────────────────────
// Door starts opening when the visitor is within OPEN_DIST units (Z-axis) of
// the wall, then closes again once they're back outside that radius. The lerp
// constant LERP_K drives the exponential smoothing — higher = snappier.
const OPEN_DIST = 4.2;           // units — generous enough to open before the wall
const SLIDE    = PANEL_W + 0.05; // how far each panel slides (clears the opening)
const LERP_K   = 9;              // animation speed: ≈ 0.7 s to full open at 60 fps

interface GlassDoorwayProps {
  /** World-space Z of the wall boundary this door lives in. */
  doorZ: number;
  /** World-space floor Y at this doorway — see roomLayout.ts's floorYNorth.
   * Non-zero only when the room north of this doorway sits on the Second
   * Floor (or is the STAIRS room's own north edge) — without this the door
   * rendered stuck at the Ground Floor's y=0 regardless of the corridor's
   * actual elevation there, invisible from the elevated room. */
  baseY?: number;
  darkMode?: boolean;
}

/**
 * A pair of automatically-sliding glass panels set into an internal doorway
 * opening — proximity-triggered, smooth exponential-lerp animation.
 *
 * Each panel slides outward into the solid wall posts when the visitor is
 * within OPEN_DIST units of the doorway Z, then slides closed again once
 * they've moved away. Purely visual — the hard-wall collision that keeps the
 * visitor from clipping through the solid posts is handled separately in
 * PlayerControls.tsx.
 */
export function GlassDoorway({ doorZ, baseY = 0, darkMode = false }: GlassDoorwayProps) {
  const { camera } = useThree();
  // 0 = fully closed, 1 = fully open — interpolated every frame.
  const openT    = useRef(0);
  const leftRef  = useRef<THREE.Group>(null);
  const rightRef = useRef<THREE.Group>(null);
  // World-space camera position — `camera.position` is local to the player
  // rig, not world space (see Docs/Museum_VRMode.md §3.1/§4.2). Reused
  // every frame, not allocated.
  const scratchCamPos = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    camera.getWorldPosition(scratchCamPos.current);
    const near = Math.abs(scratchCamPos.current.z - doorZ) < OPEN_DIST;
    // Exponential lerp: smooth regardless of frame rate, clamps delta to
    // avoid huge jumps on a first frame after a long pause.
    openT.current = THREE.MathUtils.lerp(
      openT.current,
      near ? 1 : 0,
      1 - Math.exp(-LERP_K * Math.min(delta, 0.1))
    );
    const dx = openT.current * SLIDE;
    if (leftRef.current)  leftRef.current.position.x  = -dx;
    if (rightRef.current) rightRef.current.position.x =  dx;
  });

  // Glass tint: cool blue-gray in light mode, deeper blue-slate in dark mode.
  const glassColor   = darkMode ? "#6b8fa8" : "#cde4f3";
  const glassOpacity = darkMode ? 0.18 : 0.24;
  // Metal parts: brushed aluminum feel in light mode, slightly darker in dark.
  const metalColor   = darkMode ? "#6a7880" : "#9db0bc";

  const panelCenterY = PANEL_H / 2;
  // Horizontal push-rail on each pane — sits at 62 % of door height, the
  // natural hand-reach point, and reads like a functional element rather than
  // pure decoration. Width is slightly inset from the panel edges.
  const gripY = PANEL_H * 0.62;
  const gripW = PANEL_W * 0.54;
  const gripH = 0.038;
  const gripD = GLASS_D + 0.024; // proud of both glass faces

  return (
    <group position={[0, baseY, doorZ]}>
      {/* ── Left panel — starts on left half, slides further left ─── */}
      <group ref={leftRef}>
        {/* Glass pane */}
        <mesh position={[-PANEL_W / 2, panelCenterY, 0]}>
          <boxGeometry args={[PANEL_W, PANEL_H, GLASS_D]} />
          <meshStandardMaterial
            color={glassColor}
            roughness={0.04}
            metalness={0.06}
            transparent
            opacity={glassOpacity}
            side={THREE.DoubleSide}
          />
        </mesh>
        {/* Grip rail */}
        <mesh position={[-PANEL_W / 2, gripY, 0]}>
          <boxGeometry args={[gripW, gripH, gripD]} />
          <meshStandardMaterial color={metalColor} roughness={0.24} metalness={0.68} />
        </mesh>
      </group>

      {/* ── Right panel — starts on right half, slides further right ─ */}
      <group ref={rightRef}>
        {/* Glass pane */}
        <mesh position={[PANEL_W / 2, panelCenterY, 0]}>
          <boxGeometry args={[PANEL_W, PANEL_H, GLASS_D]} />
          <meshStandardMaterial
            color={glassColor}
            roughness={0.04}
            metalness={0.06}
            transparent
            opacity={glassOpacity}
            side={THREE.DoubleSide}
          />
        </mesh>
        {/* Grip rail */}
        <mesh position={[PANEL_W / 2, gripY, 0]}>
          <boxGeometry args={[gripW, gripH, gripD]} />
          <meshStandardMaterial color={metalColor} roughness={0.24} metalness={0.68} />
        </mesh>
      </group>

      {/* ── Fixed header — the guide rail the panels slide along ─────── */}
      {/* Spans the full opening width, sits flush against the underside
          of the lintel (Y = PANEL_H → PANEL_H + HEADER_H). The extra 0.04
          width overlaps the posts slightly so there's no visible gap at the
          corners where post meets rail. */}
      <mesh position={[0, PANEL_H + HEADER_H / 2, 0]}>
        <boxGeometry args={[DOORWAY_WIDTH + 0.04, HEADER_H, GLASS_D + 0.06]} />
        <meshStandardMaterial color={metalColor} roughness={0.24} metalness={0.68} />
      </mesh>
    </group>
  );
}
