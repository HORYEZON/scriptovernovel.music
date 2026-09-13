"use client";

// A playful, toggleable easter egg (Settings ▸ Digital Museum ▸ General —
// see DigitalMuseumPanel.tsx's Chase Companion section and prisma/schema
// .prisma's DigitalMuseum comment): one friendly object idling near the
// entry room's center, drifting toward the visitor whenever they wander
// close, and drifting back to its idle spot once they move away again —
// same enter/exit-distance hysteresis as every other proximity feature in
// this scene (roomConstants.ts's INTERACT_PROXIMITY_ENTER/EXIT), just
// applied to *its own* movement instead of an interaction prompt.
//
// Deliberately not a chase in the "catches and stops you" sense: it never
// registers with PlayerControls.tsx's collision system at all, and always
// eases to a stop a couple meters short of the camera rather than closing
// the last of the distance — an ambient companion to notice and enjoy, not
// an obstacle. Reads state.camera.position directly inside its own
// useFrame rather than threading the player's position down as a prop —
// every component mounted inside MuseumScene.tsx's <Canvas> shares the
// same R3F frame loop, so this needs no extra wiring back to
// PlayerControls at all.
import { useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CustomSceneObject } from "./CustomSceneObject";
import { CompanionImage } from "./CompanionImage";
import { getFloorYAt, type RoomLayout } from "./roomLayout";

const APPROACH_DISTANCE = 6; // start drifting toward the visitor within this range
const RETREAT_DISTANCE = 8; // drift back to its idle spot once they're this far (hysteresis, avoids flickering right at one fixed radius)
const FOLLOW_STOP_DISTANCE = 2; // never closes closer than this — stays in view without ever clipping the camera
const DRIFT_SPEED = 1.6; // units/sec — gentle, a mascot ambling over, not a jump-scare charge
const BOB_HEIGHT = 0.15;
const BOB_SPEED = 1.4;

export function ChaseCompanion({
  originPosition,
  angleOffset = 0,
  assetType,
  assetUrl,
  layouts,
  positionRef,
}: {
  /** World-space idle spot — the entry room's center (see MuseumScene.tsx). */
  originPosition: [number, number, number];
  /** Radians rotated onto this companion's approach direction before
   * computing its stop point — without this, several companions with
   * nearby idle spots all approaching the same distant visitor end up
   * with nearly identical directions-to-player, so they'd all stop at
   * nearly the same point and visibly stack. Each companion gets its own
   * fixed offset (see MuseumScene.tsx) so up to 5 settle into a small
   * spread arc around the visitor instead of one pile. */
  angleOffset?: number;
  assetType: "model" | "image";
  assetUrl: string;
  /** Same corridor layout PlayerControls.tsx uses — needed so this
   * companion's own Y follows the floor height (see roomLayout.ts's
   * getFloorYAt) instead of staying pinned to its Ground Floor origin
   * forever. Without this it stayed at its idle Y while chasing across the
   * Stairs room's ramp (visibly sinking into/clipping through the slope)
   * and couldn't reach the visitor's height at all once they'd walked up
   * onto the Second Floor. */
  layouts: RoomLayout[];
  /** MuseumScene.tsx's own per-companion Vector3, written every frame with
   * this companion's live world position — MiniMapTracker.tsx reads these
   * (keyed by companion id) so the minimap can plot however many active
   * companions currently exist, dynamically following each one, without
   * this component needing to know the minimap exists at all. */
  positionRef?: MutableRefObject<THREE.Vector3>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  // Plain mutable refs, not React state — this updates every frame, and a
  // re-render on every tick for a purely visual drift would be wasteful
  // (same reasoning as PlayerControls.tsx's own movement refs).
  const current = useRef(new THREE.Vector3(originPosition[0], originPosition[1], originPosition[2]));
  const chasing = useRef(false);
  const elapsed = useRef(0);
  const scratchToPlayer = useRef(new THREE.Vector3());
  const scratchTarget = useRef(new THREE.Vector3());
  // World-space camera position — under the player-rig refactor,
  // `camera.position` is local to the rig, not world space (see
  // Docs/Museum_VRMode.md §3.1/§4.2). Filled fresh each frame below instead
  // of aliasing the live vector the old `state.camera.position` read did.
  const scratchPlayerPos = useRef(new THREE.Vector3());

  useFrame((state, delta) => {
    const group = groupRef.current;
    if (!group) return;
    elapsed.current += delta;

    const player = state.camera.getWorldPosition(scratchPlayerPos.current);
    const toPlayer = scratchToPlayer.current.set(player.x - current.current.x, 0, player.z - current.current.z);
    const distanceToPlayer = toPlayer.length();

    if (chasing.current && distanceToPlayer > RETREAT_DISTANCE) chasing.current = false;
    else if (!chasing.current && distanceToPlayer < APPROACH_DISTANCE) chasing.current = true;

    let targetX: number;
    let targetZ: number;
    if (chasing.current && distanceToPlayer > 0.001) {
      // Stop just short of the player, not on top of them — rotated by
      // this companion's own angleOffset so several companions chasing
      // the same visitor spread into an arc instead of converging on one
      // point (see the angleOffset doc comment above).
      const dirX = toPlayer.x / distanceToPlayer;
      const dirZ = toPlayer.z / distanceToPlayer;
      const cos = Math.cos(angleOffset);
      const sin = Math.sin(angleOffset);
      const rotatedX = dirX * cos - dirZ * sin;
      const rotatedZ = dirX * sin + dirZ * cos;
      targetX = player.x - rotatedX * FOLLOW_STOP_DISTANCE;
      targetZ = player.z - rotatedZ * FOLLOW_STOP_DISTANCE;
    } else {
      targetX = originPosition[0];
      targetZ = originPosition[2];
    }

    const toTarget = scratchTarget.current.set(targetX - current.current.x, 0, targetZ - current.current.z);
    const dist = toTarget.length();
    if (dist > 0.01) {
      const move = Math.min(DRIFT_SPEED * delta, dist);
      current.current.x += (toTarget.x / dist) * move;
      current.current.z += (toTarget.z / dist) * move;
      // Face the direction it's drifting — a mascot sliding sideways while
      // moving would read as broken rather than charming.
      group.rotation.y = Math.atan2(toTarget.x, toTarget.z);
    }

    const bob = Math.sin(elapsed.current * BOB_SPEED) * BOB_HEIGHT;
    // originPosition[1] was always an absolute Y (MuseumScene.tsx hardcodes
    // 1 for every companion) back when the floor was always flat at 0 — it
    // was really "1 unit above the floor," just written as if the floor
    // were always exactly 0. Re-read as that same offset added to the
    // *actual* floor height here (see roomLayout.ts's getFloorYAt) instead
    // of replacing it outright — without the offset the companion's origin
    // sat exactly at floor level, embedding its lower body into the Stairs
    // room's steps instead of resting visibly on top of them.
    const floorY = getFloorYAt(layouts, current.current.z);
    group.position.set(current.current.x, floorY + originPosition[1] + bob, current.current.z);
    positionRef?.current.set(current.current.x, floorY, current.current.z);
  });

  return (
    <group ref={groupRef} position={originPosition}>
      {assetType === "model" ? <CustomSceneObject url={assetUrl} /> : <CompanionImage url={assetUrl} />}
    </group>
  );
}
