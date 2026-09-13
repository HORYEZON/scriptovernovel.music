"use client";

import { forwardRef } from "react";
import type { ThreeElements } from "@react-three/fiber";
import type { Group } from "three";
import { XROrigin } from "@react-three/xr";

// The single group PlayerControls.tsx drives instead of writing the camera
// directly (see Docs/Museum_VRMode.md §2). Position lives here; rotation
// stays on the camera untouched, so `rig.rotation` must stay exactly
// (0, 0, 0) outside VR (a VR snap-turn is the one exception, and even that
// only ever touches rotation.y — see PlayerControls.tsx's own use of
// `useXRControllerLocomotion`) — that invariant is what keeps
// PointerLockControls and the touch look path working unmodified in 2D.
//
// `<XROrigin>` (Docs/Museum_VRMode.md's Phase 3) instead of a plain
// `<group>`: XROrigin *is* a group — same forwardRef<Group> shape, same
// props — plus one extra piece of wiring an ordinary group can't do: it
// parents three's own internal XR camera (`gl.xr.getCamera()`) onto itself,
// which is what makes the headset's pose land correctly relative to this
// rig instead of relative to the scene root. Outside a session it behaves
// exactly like the plain `<group>` Phase 1 used, so nothing about the 2D
// experience changes — this is the "one clear insertion point" that
// comment promised back when this was still just a `<group>`.
//
// Forwards every other <group> prop (MuseumScene.tsx uses this for an
// initial `position`, matching the pattern the old `<Canvas camera={{
// position: [...] }}>` prop used before the camera moved onto this rig —
// PlayerControls' own effects still set the authoritative position
// imperatively on mount/spawn).
export const PlayerRig = forwardRef<Group, ThreeElements["group"]>(function PlayerRig(
  { children, ...groupProps },
  ref
) {
  return (
    <XROrigin ref={ref} {...groupProps}>
      {children}
    </XROrigin>
  );
});
