"use client";

// The "image" half of ChaseCompanion.tsx's two asset kinds — a flat image
// (as opposed to a .glb model, see CustomSceneObject.tsx) rendered as a
// small camera-facing billboard sprite via drei's <Billboard>, so a 2D
// mascot drawing always reads correctly no matter which side the visitor
// approaches it from. Same manual downscaled-texture load as
// ArtworkFrame.tsx (loadDownscaledTexture, not drei's useTexture — see
// that file for why) rather than a second image-loading path.
//
// GIF special-case: loadDownscaledTexture draws the image onto a canvas
// (for downscaling), which only ever captures the first GIF frame — the
// animation is baked away. For .gif URLs we instead build the THREE.Texture
// directly from the live <img> element the browser is already animating, then
// set needsUpdate = true every frame so Three.js re-reads whichever GIF frame
// the browser has advanced to. Non-GIF paths are unchanged.
import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Billboard } from "@react-three/drei";
import { loadDownscaledTexture } from "@/lib/museum/loadDownscaledTexture";

// World-unit height of the sprite — a small creature/character size, not a
// wall-sized image; width follows from the source image's own aspect ratio.
const HEIGHT = 1.3;

/** True when the URL points to a GIF (before any query string). */
function isGifUrl(url: string): boolean {
  return /\.gif($|\?)/i.test(url);
}

export function CompanionImage({ url }: { url: string }) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [aspect, setAspect] = useState(1);
  // Holds the texture only for GIF companions — useFrame checks this ref
  // and marks it dirty every tick so Three.js re-reads the browser's current
  // animated frame. Null for non-GIF companions (no per-frame work needed).
  const gifTextureRef = useRef<THREE.Texture | null>(null);

  const gif = isGifUrl(url);

  useEffect(() => {
    let cancelled = false;
    gifTextureRef.current = null; // clear any previous GIF texture immediately

    if (gif) {
      // Load via a plain <img> element so the browser keeps animating the
      // GIF natively. THREE.Texture wraps the live element; useFrame below
      // marks it needsUpdate every frame so Three.js re-uploads whichever
      // frame the browser has currently decoded.
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        if (cancelled) return;
        const tex = new THREE.Texture(img);
        tex.needsUpdate = true;
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.generateMipmaps = false;
        gifTextureRef.current = tex;
        setTexture(tex);
        setAspect(img.naturalWidth / img.naturalHeight);
      };
      img.onerror = () => {
        // Fail silently — same behaviour as the non-GIF path below.
      };
      img.src = url;
    } else {
      loadDownscaledTexture(url)
        .then((loaded) => {
          if (cancelled) return;
          setTexture(loaded.texture);
          setAspect(loaded.aspect);
        })
        .catch(() => {
          // Nothing to fall back to for a sprite (unlike a wall frame, there's
          // no border to still show) — it just stays invisible until/unless a
          // retry succeeds, same "fail quietly" choice as CustomSceneObject's
          // error boundary.
        });
    }

    return () => {
      cancelled = true;
      gifTextureRef.current = null;
    };
  }, [url, gif]);

  // Animated GIFs: mark the texture dirty every frame so Three.js re-reads
  // the browser's current GIF frame. This is a cheap ref check and is a
  // no-op for non-GIF companions (gifTextureRef stays null).
  useFrame(() => {
    if (gifTextureRef.current) gifTextureRef.current.needsUpdate = true;
  });

  if (!texture) return null;

  return (
    <Billboard position={[0, HEIGHT / 2, 0]}>
      <mesh>
        <planeGeometry args={[HEIGHT * aspect, HEIGHT]} />
        <meshBasicMaterial map={texture} transparent toneMapped={false} />
      </mesh>
    </Billboard>
  );
}
