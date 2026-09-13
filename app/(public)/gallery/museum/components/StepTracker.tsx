"use client";

// A headless component (renders nothing) mounted inside MuseumScene.tsx's
// <Canvas> purely to feed the Digital Museum Achievements "steps walked"
// counter (lib/museum/useMuseumAchievements.ts) — reads state.camera
// .position directly in its own useFrame, same non-invasive trick
// ChaseCompanion.tsx uses, rather than threading anything through
// PlayerControls.tsx (which has no idea this exists).
//
// Distance traveled in the XZ plane (Y ignored — the jump arc's vertical
// bob shouldn't count as ground covered) is accumulated and converted to
// whole "steps" via STEP_LENGTH, an approximate stride length in world
// units. A single frame's distance is capped before being added — without
// that, a MuseumMap "take me there" teleport (PlayerControls.tsx snapping
// the camera clear across the corridor in one frame) would register as
// hundreds of steps at once.
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// Roughly a walking stride, tuned against MOVE_SPEED/roomConstants.ts
// rather than a real-world meter conversion — this is a fun counter, not
// a pedometer.
const STEP_LENGTH = 0.6;
// MOVE_SPEED (4.5 units/sec) × the largest delta PlayerControls itself
// clamps to (0.1s) is ~0.45 units of *legitimate* per-frame movement —
// twice that comfortably covers a slow frame without letting a teleport
// through.
const MAX_FRAME_DISTANCE = 1.0;

export function StepTracker({ onStepsChange }: { onStepsChange: (totalSteps: number) => void }) {
  const lastPosition = useRef<{ x: number; z: number } | null>(null);
  const accumulatedDistance = useRef(0);
  const totalSteps = useRef(0);
  // World-space camera position scratch — `camera.position` is local to
  // the player rig, not world space (see Docs/Museum_VRMode.md §3.1).
  // Reused every frame, not allocated.
  const scratchCamPos = useRef(new THREE.Vector3());

  useFrame((state) => {
    const { x, z } = state.camera.getWorldPosition(scratchCamPos.current);
    const last = lastPosition.current;
    lastPosition.current = { x, z };
    if (!last) return;

    const distance = Math.min(Math.hypot(x - last.x, z - last.z), MAX_FRAME_DISTANCE);
    accumulatedDistance.current += distance;

    const newSteps = Math.floor(accumulatedDistance.current / STEP_LENGTH);
    if (newSteps > totalSteps.current) {
      totalSteps.current = newSteps;
      onStepsChange(newSteps);
    }
  });

  return null;
}
