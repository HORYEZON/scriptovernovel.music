"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { MutableRefObject } from "react";
import { capturePanorama360, pickPanoramaWidth, type Panorama360Result } from "@/lib/museum/panorama360";

/** What the bridge ref resolves to — null when the scene has nothing to
 *  capture yet (no current room), otherwise the tagged JPEG. */
export type Share360Fn = () => Promise<Panorama360Result | null>;

/**
 * Where to stand and which way to face when the capture is taken. Resolved
 * at click time, never at render time, so the caller can read live state
 * (the player rig, the current room) without re-running this effect on
 * every step the visitor takes.
 *
 * `heading` follows lib/museum/panorama360.ts's convention — 0 faces −Z.
 * Omit it to centre the photo on whatever the R3F camera is looking at.
 */
export interface CaptureEye {
  position: THREE.Vector3;
  headingRad?: number;
  slug: string;
}

/**
 * Bridges "share this room as a 360°" out of the R3F tree, exactly the way
 * ScreenshotCapture.tsx bridges [R]: gl/scene/camera only exist inside
 * <Canvas>, the button lives in plain DOM outside it, and a ref is the
 * pipe between them. Mounted by both the public museum (MuseumScene.tsx)
 * and the admin Museum Editor (MuseumEditorScene.tsx), which differ only
 * in where the eye is and what to hide — hence `getEye` and `exclude`
 * rather than any knowledge of rooms here.
 *
 * The render itself is synchronous and happens before the first `await`
 * (see panorama360.ts) — the same drawing-buffer discipline as [R].
 */
export function Room360Capture({
  shareRef,
  getEye,
  exclude,
  stage,
  prepare,
  lowEnd = false,
}: {
  shareRef: MutableRefObject<Share360Fn | null>;
  getEye: () => CaptureEye | null;
  /** Scene objects to leave out of the photo — the editor's gizmo and
   *  alignment guides. The public museum has nothing to hide. */
  exclude?: (object: THREE.Object3D) => boolean;
  /** Temporary additions for the shot, with their cleanup — see
   *  RenderPanoramaOptions.stage. The editor fills its doorways with this. */
  stage?: (scene: THREE.Scene) => () => void;
  /**
   * Async counterpart to `stage`, for changes that have to go through React
   * and be *rendered* before the cube camera looks: it resolves once the
   * scene is ready and returns the undo. The public museum uses it to light
   * and load every room for the shot — normally only the neighbours are,
   * and a room two doorways away is otherwise a dark hole in the photo.
   */
  prepare?: () => Promise<() => void>;
  /** The phones MuseumScene.tsx already treats as low-end go straight to
   *  the smallest export — see pickPanoramaWidth for the full ladder. */
  lowEnd?: boolean;
}) {
  const { gl, scene, camera } = useThree();

  useEffect(() => {
    shareRef.current = async () => {
      const eye = getEye();
      if (!eye) return null;
      let heading = eye.headingRad;
      if (heading === undefined) {
        const dir = camera.getWorldDirection(new THREE.Vector3());
        heading = Math.atan2(dir.x, -dir.z);
      }
      const restore = await prepare?.();
      try {
        return await capturePanorama360(gl, scene, {
          position: eye.position,
          headingRad: heading,
          slug: eye.slug,
          width: pickPanoramaWidth(lowEnd),
          exclude,
          stage,
        });
      } finally {
        restore?.();
      }
    };
    return () => {
      shareRef.current = null;
    };
  }, [gl, scene, camera, shareRef, getEye, exclude, stage, prepare, lowEnd]);

  return null;
}
