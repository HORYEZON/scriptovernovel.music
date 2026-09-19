"use client";

// A single wall-hung frame, lit and shimmering exactly as the museum draws
// it, so the Artwork Shimmer section in General Settings shows the sweep on
// a real artwork rather than describing it. Client-only (three.js) — the
// section dynamic-imports this with ssr:false, the way MuseumPreviewSidebar
// loads MuseumPreviewCanvas.
//
// The artwork on the wall is whatever the admin picked to preview with; the
// pick lives in the section's own state and is never saved — it is a stand-in
// for "any artwork a visitor walks up to", not a setting.

import { Canvas } from "@react-three/fiber";
import { ArtworkFrame } from "@/app/(public)/gallery/museum/components/ArtworkFrame";
import type { FramePlacement } from "@/app/(public)/gallery/museum/components/framePlacement";
import { FRAME_CENTER_Y } from "@/app/(public)/gallery/museum/components/framePlacement";
import { MAX_FRAME_WIDTH } from "@/app/(public)/gallery/museum/components/roomConstants";
import type { ArtworkShimmerConfig } from "@/lib/museum/artworkShimmer";
import type { MuseumArtwork } from "@/types";

// One slot on a north wall at the origin, facing the camera — the same
// shape framePlacement.ts hands every real frame, minus the room around it.
const PLACEMENT: FramePlacement = {
  position: [0, FRAME_CENTER_Y, 0],
  rotationY: 0,
  wallNormal: [0, 0, 1],
  maxWidth: MAX_FRAME_WIDTH,
};

export function ArtworkShimmerPreview({
  artwork,
  config,
}: {
  artwork: { id: string; title: string; imageUrl: string };
  config: ArtworkShimmerConfig;
}) {
  const museumArtwork: MuseumArtwork = {
    id: artwork.id,
    title: artwork.title,
    description: "",
    imageUrl: artwork.imageUrl,
    videoUrl: null,
    slug: null,
    medium: null,
    dimensions: null,
    year: null,
    status: "AVAILABLE",
    product: null,
  };

  return (
    <Canvas camera={{ fov: 40, near: 0.1, far: 20, position: [0, FRAME_CENTER_Y, 3.2] }}>
      <color attach="background" args={["#141210"]} />
      {/* A gallery's worth of light on one wall: the GALLERY preset's own
          ambient/hemisphere values, so the image reads the way it will in a
          standard room, plus one warm point light where a ceiling lamp sits. */}
      <ambientLight intensity={0.55} />
      <hemisphereLight args={["#ffffff", "#94897a", 0.35]} />
      <pointLight position={[0, FRAME_CENTER_Y + 2.2, 2]} intensity={14} distance={12} decay={2} color="#fff6e0" />
      {/* The wall behind it, so the frame's glow and the sweep have something
          to sit against. */}
      <mesh position={[0, FRAME_CENTER_Y, -0.06]}>
        <planeGeometry args={[8, 5]} />
        <meshStandardMaterial color="#ece7db" roughness={0.9} />
      </mesh>
      {/* Always `active`: the preview is of the walked-up-to state. */}
      <ArtworkFrame artwork={museumArtwork} placement={PLACEMENT} active shimmer={config} />
    </Canvas>
  );
}
