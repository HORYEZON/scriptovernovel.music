"use client";

// The freestanding partition wall an admin places from the Museum Scene
// Editor — see lib/museum/wallDivider.ts for what it is and how it's stored.
// One component for both sides: the public museum renders it from a
// MuseumSceneObject placement, and the editor renders the *same* thing under
// its drag gizmo, so what an admin sizes and textures is what a visitor walks
// into rather than a proxy box that only approximates it.
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useSurfaceTexture, tiledClone } from "./MuseumRoom";
import { TEXTURE_TILE_METERS } from "./roomConstants";
import { type WallDividerConfig } from "@/lib/museum/wallDivider";

/** tiledClone, plus the mirrored-wrap option a divider adds on top of it.
 *  Mirrored repeat flips every other tile, so the join between two tiles is a
 *  reflection instead of a hard seam — the difference between a photographed
 *  surface reading as one wall and reading as a grid of stamps. */
function dividerTile(
  base: THREE.Texture | null,
  repeatX: number,
  repeatY: number,
  mirrored: boolean
): THREE.Texture | null {
  const tex = tiledClone(base, repeatX, repeatY);
  if (tex && mirrored) {
    tex.wrapS = tex.wrapT = THREE.MirroredRepeatWrapping;
    tex.needsUpdate = true;
  }
  return tex;
}

export function WallDivider({
  config,
  position = [0, 0, 0],
  rotationY = 0,
  shouldLoad = true,
}: {
  config: Required<WallDividerConfig>;
  /** Room-local (editor) or world (public museum) position of the panel's
   *  *base* — Y is the floor it stands on, not its centre, so raising a
   *  divider's Y lifts it off the floor rather than sinking half of it. */
  position?: [number, number, number];
  rotationY?: number;
  /** Same texture gate as every other surface here (ArtworkFrame's
   *  shouldLoad): the panel always draws in its plain colour, the uploaded
   *  image only fetches once this room is nearby. */
  shouldLoad?: boolean;
}) {
  const { width, height, thickness, color, textureUrl, mirrored } = config;
  const base = useSurfaceTexture(textureUrl, shouldLoad);

  // One clone per face size, tiled in the same world units as a room's own
  // wall texture (TEXTURE_TILE_METERS) so a divider finished in the room's
  // wall material lines up with it instead of showing its own scale. The two
  // broad faces share one clone (both are width × height); the narrow ends
  // and the top get their own, since stretching the front face's repeat
  // around a 30cm edge would smear it.
  const faceTex = useMemo(
    () => dividerTile(base, width / TEXTURE_TILE_METERS, height / TEXTURE_TILE_METERS, mirrored),
    [base, width, height, mirrored]
  );
  const edgeTex = useMemo(
    () => dividerTile(base, thickness / TEXTURE_TILE_METERS, height / TEXTURE_TILE_METERS, mirrored),
    [base, thickness, height, mirrored]
  );
  const capTex = useMemo(
    () => dividerTile(base, width / TEXTURE_TILE_METERS, thickness / TEXTURE_TILE_METERS, mirrored),
    [base, width, thickness, mirrored]
  );

  // Every clone is its own GPU upload (three gives a clone a fresh uuid, so
  // WebGLTextures can't dedupe it against the base) — released here for the
  // same reason MuseumRoom releases its own, so resizing a divider on a
  // slider doesn't leave a trail of resident textures behind it.
  useEffect(() => {
    const clones = [faceTex, edgeTex, capTex];
    return () => {
      for (const clone of clones) clone?.dispose();
    };
  }, [faceTex, edgeTex, capTex]);

  // BoxGeometry's material order: +X, -X, +Y, -Y, +Z, -Z. The panel's long
  // axis is X and its thickness is Z, so ±Z are the two broad faces, ±X the
  // narrow ends, and ±Y the top and bottom caps.
  const materials = useMemo(
    () =>
      [edgeTex, edgeTex, capTex, capTex, faceTex, faceTex].map(
        (map) =>
          new THREE.MeshStandardMaterial({
            color,
            map: map ?? null,
            roughness: 0.9,
            metalness: 0,
          })
      ),
    [faceTex, edgeTex, capTex, color]
  );
  useEffect(() => {
    return () => {
      for (const material of materials) material.dispose();
    };
  }, [materials]);

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Raised by half its height so `position` is the panel's footing —
          the value the editor's drag gizmo and the Height slider both read
          most naturally ("this divider stands here, and is this tall"). */}
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow material={materials}>
        <boxGeometry args={[width, height, thickness]} />
      </mesh>
    </group>
  );
}
