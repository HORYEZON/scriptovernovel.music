"use client";

// app/(admin)/admin/artworks/MuseumPreviewCanvas.tsx
//
// Read-only 3D preview of one museum room — an orbit-controls view (same
// camera as MuseumEditorScene but no transform/select machinery) meant for
// the DigitalMuseumPanel right-sidebar. Loaded via next/dynamic({ ssr:
// false }) from MuseumPreviewSidebar.tsx so Three.js/@react-three/* stay
// out of the server bundle.
//
// Artworks are auto-placed using computeFramePlacements (the same path the
// public museum takes for rooms with no custom overrides), so what you see
// here is the real default layout a visitor walks into.
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { MuseumRoom } from "@/app/(public)/gallery/museum/components/MuseumRoom";
import { ArtworkFrame } from "@/app/(public)/gallery/museum/components/ArtworkFrame";
import { AboutRoomContents } from "@/app/(public)/gallery/museum/components/AboutRoomContents";
import { FreedomWallRoomContents } from "@/app/(public)/gallery/museum/components/FreedomWallRoomContents";
import {
  getRoomSize,
  SCENE_BACKGROUND_DARK,
  SCENE_BACKGROUND_LIGHT,
} from "@/app/(public)/gallery/museum/components/roomConstants";
import { computeFramePlacements } from "@/app/(public)/gallery/museum/components/framePlacement";
import type { MuseumArtwork, MuseumRoomType, MuseumAboutData, FreedomWallNotePublic } from "@/types";

export interface PreviewRoomShell {
  roomType: MuseumRoomType;
  wallColor: string;
  floorColor: string;
  ceilingColor: string;
  wallTexture: string | null;
  floorTexture: string | null;
  ceilingTexture: string | null;
  /** The room's ceiling lights — see MuseumRoom.tsx. Optional: the
   *  provisioned rooms' preview shells don't carry them and draw the
   *  room type's own colour and the built-in lamp. */
  lightColor?: string | null;
  lightScale?: number;
  lightModelUrl?: string | null;
}

export interface PreviewArtworkEntry {
  id: string;
  title: string;
  imageUrl: string;
}

// Minimal MuseumArtwork stand-in — ArtworkFrame only needs imageUrl + title
// for the texture/label it actually renders; price/medium/etc. are only used
// by ArtworkInfoPanel (opened by the visitor, not this static preview).
function toMuseumArtwork(entry: PreviewArtworkEntry): MuseumArtwork {
  return {
    id: entry.id,
    title: entry.title,
    description: "",
    imageUrl: entry.imageUrl,
    videoUrl: null,
    slug: null,
    medium: null,
    dimensions: null,
    year: null,
    status: "AVAILABLE",
    product: null,
  };
}

export function MuseumPreviewCanvas({
  room,
  artworks,
  darkMode = false,
  brightness = 50,
  aboutData,
  freedomWallNotes,
}: {
  room: PreviewRoomShell;
  artworks: PreviewArtworkEntry[];
  darkMode?: boolean;
  /** 0–100 (50 = baseline). Passed to MuseumRoom → getRoomLighting. */
  brightness?: number;
  /** About room content — rendered when roomType is "ABOUT". */
  aboutData?: MuseumAboutData | null;
  /** Freedom Wall notes — rendered when roomType is "FREEDOM_WALL". */
  freedomWallNotes?: FreedomWallNotePublic[];
}) {
  const { width, depth } = getRoomSize(room.roomType);

  // Rooms that will have openings in the public museum — the About room
  // always has a south opening (the corridor comes in from the south), and
  // regular rooms may have both. For the preview we just show one room in
  // isolation: entry room has no south (it's the first), About has no north.
  // Simplest neutral choice: treat every preview room as having north + south
  // openings so the doorway geometry matches what a visitor typically sees
  // walking through it — avoids a sealed south wall reading as "wrong".
  const hasNorthOpening = room.roomType !== "ABOUT";
  const hasSouthOpening = true;

  const placements = computeFramePlacements(
    artworks.length,
    width,
    depth,
    hasNorthOpening,
    hasSouthOpening
  );

  return (
    <Canvas
      camera={{
        fov: 55,
        near: 0.1,
        far: 100,
        position: [0, depth * 0.55, depth * 0.75],
      }}
    >
      <color
        attach="background"
        args={[darkMode ? SCENE_BACKGROUND_DARK : SCENE_BACKGROUND_LIGHT]}
      />
      <ambientLight intensity={0.6} />
      <hemisphereLight args={["#ffffff", "#444444", 0.6]} />
      <pointLight position={[0, 4, 0]} intensity={0.8} />

      <MuseumRoom
        roomType={room.roomType}
        depth={depth}
        centerZ={0}
        hasNorthOpening={hasNorthOpening}
        hasSouthOpening={hasSouthOpening}
        wallColor={room.wallColor}
        floorColor={room.floorColor}
        ceilingColor={room.ceilingColor}
        wallTexture={room.wallTexture}
        floorTexture={room.floorTexture}
        ceilingTexture={room.ceilingTexture}
        lightColor={room.lightColor ?? null}
        lightScale={room.lightScale ?? 1}
        lightModelUrl={room.lightModelUrl ?? null}
        darkMode={darkMode}
        brightness={brightness}
        lightsEnabled
        quality="full"
        shouldLoad
      />

      {artworks.map((entry, i) => {
        const placement = placements[i];
        if (!placement) return null;
        return (
          <ArtworkFrame
            key={entry.id}
            artwork={toMuseumArtwork(entry)}
            placement={placement}
            active={false}
            scale={1}
            shouldLoad
          />
        );
      })}

      {/* About ScriptOverNovel room 3D content — only shown once the data is fetched */}
      {room.roomType === "ABOUT" && aboutData && (
        <AboutRoomContents
          data={aboutData}
          depth={depth}
          centerZ={0}
          shouldLoad
        />
      )}

      {/* Freedom Wall sticky notes */}
      {room.roomType === "FREEDOM_WALL" && (
        <FreedomWallRoomContents
          notes={freedomWallNotes ?? []}
          depth={depth}
          centerZ={0}
          hasNorthOpening={hasNorthOpening}
          // Must ride along with hasNorthOpening: a note's positionX is
          // measured against whichever wall it's pinned to, and a doorway
          // splits that wall into two flanking zones. Leaving this at its
          // `false` default drew every south-wall note against a solid span
          // this preview doesn't actually render — the same note then sat
          // somewhere else in the real room and in the Scene Editor.
          hasSouthOpening={hasSouthOpening}
          shouldLoad
        />
      )}

      {/* Auto-rotate-enabled orbit so the admin can freely inspect the room
          without having to know Three.js controls — same as MuseumEditorScene. */}
      <OrbitControls
        makeDefault
        target={[0, 1.5, 0]}
        minDistance={1}
        maxDistance={depth * 1.2}
        minPolarAngle={Math.PI * 0.1}
        maxPolarAngle={Math.PI * 0.8}
      />
    </Canvas>
  );
}
