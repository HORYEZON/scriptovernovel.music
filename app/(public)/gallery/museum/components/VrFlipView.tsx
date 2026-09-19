"use client";

// Phone-in-goggles fix: renders the stereo frame rotated 180°, with the two
// eyes swapped.
//
// A phone dropped into a Cardboard-style viewer sits in landscape — but
// *which* landscape is decided by the OS's auto-rotate from the phone's
// accelerometer, while Chrome's WebXR presentation lays the two eye images
// out assuming one fixed landscape. When the two disagree the OS rotates
// the whole display 180° and the visitor sees the museum upside down, with
// the eyes crossed; the only cure was to wear the goggles upside down, or
// turn auto-rotate off — which stops the session from presenting at all.
// The page can't lock the display orientation underneath an immersive
// session, so this counters the rotation in the one place it can: the
// render.
//
// Every frame, three's WebXRManager copies each XRView's pose into
// `gl.xr.getCamera().cameras[i].matrix` and its layer viewport into
// `.viewport` (onAnimationFrame), *before* R3F's frame callbacks run; then
// `render()` builds each eye's matrixWorld from that `.matrix` and draws
// into that `.viewport`. So a useFrame in between can post-multiply a 180°
// roll about each eye's own view axis (the image draws upside down) and
// swap the two viewports (left buffer ↔ right buffer). The OS's 180°
// display rotation then puts everything back: upright, correct eye,
// correct lens. Head tracking is untouched — the sensors never knew about
// the display rotation — and camera-anchored UI (VrHud, prompts, the
// vignette) hangs off the *user* camera, whose pose three derives from the
// un-rolled first view, so it rolls with the frame and lands upright too.
//
// A no-op outside a session and with a single view (AR). On a headset with
// the right orientation it simply turns the world upside down, which is why
// it's a visitor-facing switch (persisted — it's a property of their
// goggles, not of a visit) and not a detection.
import { useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

const scratchViewport = new THREE.Vector4();

export function VrFlipView({ enabled }: { enabled: boolean }) {
  const { gl } = useThree();
  const roll = useMemo(() => new THREE.Matrix4().makeRotationZ(Math.PI), []);

  useFrame(() => {
    if (!enabled || !gl.xr.isPresenting) return;
    const cameras = gl.xr.getCamera().cameras;
    if (cameras.length !== 2) return;
    for (const eye of cameras) {
      // Local-space post-multiply: a roll about the eye's own forward axis,
      // not the world's. `.matrix` is rewritten from the XRView next frame,
      // so this never accumulates.
      eye.matrix.multiply(roll);
      eye.matrix.decompose(eye.position, eye.quaternion, eye.scale);
    }
    scratchViewport.copy(cameras[0].viewport);
    cameras[0].viewport.copy(cameras[1].viewport);
    cameras[1].viewport.copy(scratchViewport);
  });

  return null;
}
