"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import type { ArtworkShimmerConfig } from "@/lib/museum/artworkShimmer";
import { Canvas, useThree } from "@react-three/fiber";
import { PerformanceMonitor, AdaptiveDpr, AdaptiveEvents, PerspectiveCamera, Text, useProgress } from "@react-three/drei";
import * as THREE from "three";
import type { MuseumArtwork, MuseumStory, MuseumCosplay, MuseumRoomPublic, MuseumAboutData, MuseumAboutCertificate, MuseumChaseCompanion, FreedomWallNotePublic, MuseumVinylSleeve } from "@/types";
import { ChaseCompanion } from "./ChaseCompanion";
import { StepTracker } from "./StepTracker";
import { MiniMapTracker, type MiniMapFrameState, type MiniMapDot } from "./MiniMapTracker";
import { MuseumRoom } from "./MuseumRoom";
import { ArtworkFrame } from "./ArtworkFrame";
import { PlayerControls } from "./PlayerControls";
import { PlayerRig } from "./PlayerRig";
import { VrArtworkPanel } from "./VrArtworkPanel";
import { VrCertificatePanel } from "./VrCertificatePanel";
import { VrStoryPanel } from "./VrStoryPanel";
import { VrCosplayPanel } from "./VrCosplayPanel";
import { VrGamePanel } from "./VrGamePanel";
import { VrGigsPanel } from "./VrGigsPanel";
import { VrContactPanel } from "./VrContactPanel";
import { VrInteractionPrompt } from "./VrInteractionPrompt";
import { VrHud, type VrHudProps } from "./VrHud";
import { VrMapPanel } from "./VrMapPanel";
import { VrPrompt } from "./VrPrompt";
import { XR, createXRStore } from "@react-three/xr";
import { TouchControls } from "./TouchControls";
import { InteractionPrompt } from "./InteractionPrompt";
import { ContactPanel } from "./ContactPanel";
import { CONTACT_DESK_COLLIDER_RADIUS } from "./ContactDesk";
import { ArtworkInfoPanel } from "./ArtworkInfoPanel";
import { CertificateInfoPanel } from "./CertificateInfoPanel";
import { AboutRoomContents } from "./AboutRoomContents";
import { AboutRoomCorner } from "./AboutRoomCorner";
import { GigsPanel } from "./GigsPanel";
import { FreedomWallRoomContents, FreedomWallPlaque } from "./FreedomWallRoomContents";
import { SceneBanner } from "./SceneBanner";
import { FreedomWallCorner } from "./FreedomWallCorner";
import { ServicesRoomContents, type ServicesPriceTag } from "./ServicesRoomContents";
import { StoriesRoomContents, type PodiumEntry } from "./StoriesRoomContents";
import { computePodiumPlacements } from "./podiumPlacement";
import { PODIUM_COLLIDER_RADIUS } from "./StoryPodium";
import { ArcadeRoomContents, type ArcadeEntry } from "./ArcadeRoomContents";
import { computeCabinetPlacements } from "./cabinetPlacement";
import { CABINET_COLLIDER_RADIUS } from "./ArcadeCabinet";
import { CosplayRoomContents, type StandeeEntry } from "./CosplayRoomContents";
import { computeStandeePlacements } from "./standeePlacement";
import { STANDEE_COLLIDER_RADIUS } from "./CosplayStandee";
import { CosplayInfoPanel } from "./CosplayInfoPanel";
import { VinylRoomContents, type SleeveEntry, type VinylTarget } from "./VinylRoomContents";
import { computeSleevePlacements, defaultTurntablePosition, wallNormalForRotation } from "./sleevePlacement";
import { TURNTABLE_COLLIDER_RADIUS } from "./Turntable";
import { TurntablePanel } from "./TurntablePanel";
import { HeldVinylHud } from "./HeldVinylHud";
import { createVinylPlayer, type VinylPlayer, type VinylPlayerState } from "@/lib/museum/vinylAudio";
import { DEFAULT_VINYL_CONFIG, DEFAULT_VINYL_EFFECTS, sanitizeVinylEffects, type VinylEffects } from "@/lib/museum/vinylConfig";
import { buildLyricsTimeline, lineIndexAt, trackIndexAt } from "@/lib/museum/lyricsTimeline";
import { pauseMuseumMusicForVinyl, resumeMuseumMusicAfterVinyl } from "@/lib/museum/museumMusicController";
import { StoryReader } from "@/components/public/StoryReader";
import { GamePreviewModal } from "@/components/public/minigames/GamePreviewModal";
import { GameSession } from "@/components/public/minigames/GameSession";
import { GAME_REGISTRY } from "@/lib/minigames/registry";
import { DIFFICULTY_LABELS, type PublicGame } from "@/lib/minigames/types";
import { CustomSceneObject } from "./CustomSceneObject";
import { WallClock } from "./WallClock";
import { ScreenshotCapture } from "./ScreenshotCapture";
import { Room360Capture, type CaptureEye, type Share360Fn } from "./Room360Capture";
import { GlassDoorway } from "./GlassDoorway";
import { isLowEndDevice } from "@/lib/museum/deviceTier";
import {
  computeFramePlacements,
  getDividerWallDefinitions,
  snapToDividerFace,
  type FramePlacement,
} from "./framePlacement";
import { computeRoomLayouts, getLayoutAtZ, type RoomTravelRequest } from "./roomLayout";
import {
  EYE_HEIGHT,
  SCENE_BACKGROUND_LIGHT,
  SCENE_BACKGROUND_DARK,
  MAX_FRAME_WIDTH,
  ROOM_WIDTH,
  FAR_TEXTURE_DELAY_MS,
  FAR_TEXTURE_CEILING_MS,
  colliderWorldRadius,
  colliderWorldOffset,
  colliderWorldHeight,
  colliderWorldBaseY,
} from "./roomConstants";
import { KeyGuide } from "./KeyGuide";
import {
  parseTextConfig,
  DEFAULT_CONTACT_DESK_CONFIG,
  getAboutBlockLocalXZ,
  ABOUT_PHOTO_KIND,
  ABOUT_PLAQUE_KIND,
  ABOUT_CERTS_KIND,
  ABOUT_CARD_KIND,
  ABOUT_GIGS_KIND,
  ABOUT_CLOCK_KIND,
  ABOUT_CONTACT_KIND,
  parseWallClockConfig,
  type AboutBlockKind,
} from "@/lib/museum/aboutRoomBlocks";
import { FREEDOM_WALL_BANNER_KIND, parseBannerColors } from "@/lib/museum/freedomWallBanner";
import { STORY_PODIUM_MODEL_KIND, parsePodiumModelConfig } from "@/lib/museum/storyPodiumModel";
import {
  ROOM_BANNER_KIND,
  defaultRoomBannerStyle,
  parseRoomBannerStyle,
  type BannerRoomType,
} from "@/lib/museum/roomBanner";
import { isConfigOnlyKind } from "@/lib/museum/sceneObjectKinds";
import { DIVIDER_KIND, parseWallDividerConfig } from "@/lib/museum/wallDivider";
import { BANNER_KIND, bannerWidth, bannerFinish, parseSceneBannerConfig } from "@/lib/museum/sceneBanner";
import { WallDivider } from "./WallDivider";
import { notePercentToWorld } from "@/lib/museum/freedomWallNotePlacement";
import { formatPriceRange } from "@/lib/utils";

// Fixed offsets (not dependent on how many companions are actually
// enabled) so a given companion's idle spot never shifts around just
// because the admin toggled a different one on/off — index 0 always sits
// center, the rest fan out around it. Five entries covers the full cap
// (see prisma/schema.prisma's ChaseCompanion comment).
const CHASE_ORIGIN_OFFSETS: [number, number][] = [
  [0, 0],
  [1.8, 1.2],
  [-1.8, 1.2],
  [1.8, -1.2],
  [-1.8, -1.2],
];

// Forces the WebGL renderer + camera to the real, measured viewport pixels
// on every mobile orientation flip — a plain child of <Canvas> so it can
// reach the renderer/camera via useThree(). This exists because R3F's own
// automatic sizing (a ResizeObserver on the canvas's parent element,
// resolving that parent's CSS percentage box) was found to sometimes not
// keep up with a real device orientation change on mobile: the canvas kept
// its old portrait width even after the phone physically rotated to
// landscape, rendering the 3D scene into only half the actual screen (the
// other half staying solid black) — reported after MuseumClient.tsx's own
// pixel-pinning fix on the *container* div didn't resolve it, meaning the
// renderer itself needed telling directly rather than hoping the size
// change propagated down through CSS/observers on its own. `width`/`height`
// come from MuseumClient.tsx's own window.innerWidth/innerHeight tracking
// (already needed there for the forced-landscape CSS hack), so this is
// just wiring the same already-correct numbers straight into Three.js
// instead of trusting a second, independent measurement path to agree.
function CanvasResizeSync({ width, height }: { width?: number; height?: number }) {
  const { gl, camera, invalidate } = useThree();
  useEffect(() => {
    if (!width || !height) return;
    // While an XR session is presenting, the device owns both the canvas
    // size and the projection matrix — the headset's compositor dictates
    // its own render-target resolution and per-eye FOV, and overwriting
    // either from here fights it every frame, producing distortion or a
    // black eye. Not reachable yet (no <XR> wrapper exists), but cheap to
    // guard now while this file is already open (see Docs/Museum_VRMode.md).
    if (gl.xr.isPresenting) return;
    // `true` (the default) also updates the <canvas> element's own CSS
    // width/height directly — the part that actually fixes the visible
    // black gap, since it no longer depends on the surrounding divs'
    // percentage sizing being correctly recomputed.
    gl.setSize(width, height, true);
    if ("aspect" in camera) {
      (camera as THREE.PerspectiveCamera).aspect = width / height;
      camera.updateProjectionMatrix();
    }
    invalidate();
  }, [width, height, gl, camera, invalidate]);
  return null;
}

// Composition root for the actual 3D experience — everything here (and only
// this subtree) ever touches `three`/`@react-three/*`. No DB/API calls occur
// anywhere below this component; `rooms` is the one server-fetched payload
// from page.tsx, passed straight through as a prop.
//
// Every enabled room renders simultaneously in one connected corridor (see
// roomLayout.ts) — there's no per-room remount/teleport anymore. A visitor
// walks from one room into the next through a real doorway; which room
// they're "in" is derived live from their world position (PlayerControls'
// onRoomChange), not from any switch/selection state.
export function MuseumScene({
  rooms,
  isCoarsePointer,
  landscapeMode = false,
  gyroEnabled = false,
  rotatedViewport = false,
  viewportSize,
  onRoomChange,
  darkMode = false,
  brightnessLight = 50,
  brightnessDark = 50,
  onToggleDarkMode,
  lightModeLabel,
  artworkShimmer,
  onToggleMap,
  onToggleHud,
  activeFilterCss,
  onCycleVisionFilter,
  hudHidden = false,
  captureRef,
  share360Ref,
  aboutRoomId,
  aboutData,
  chaseCompanions,
  onStepsChange,
  onArtworkViewed,
  travelRequest,
  freedomWallRoomId,
  freedomWallNotes = [],
  freedomWallEventTitle = null,
  freedomWallAcceptingNotes = false,
  onFreedomWallNoteAdded,
  minimapRef,
  vrMode = false,
  onVrPresentingChange,
  onToggleVrMode,
  vrHud,
}: {
  rooms: MuseumRoomPublic[];
  isCoarsePointer?: boolean;
  /** MuseumClient.tsx's forced-landscape toggle — forwarded straight to
   * TouchControls.tsx, see that file's doc comment. */
  landscapeMode?: boolean;
  /** MuseumClient.tsx's gyroscope toggle — forwarded straight to
   * TouchControls.tsx. */
  gyroEnabled?: boolean;
  /** True only while MuseumClient.tsx's forced-landscape CSS `rotate(90deg)`
   * is actually applied (not merely preferred — landscapeMode above is the
   * preference). Forwarded to TouchControls.tsx, which needs it to read
   * touch *vectors* in the rotated content's axes rather than the screen's. */
  rotatedViewport?: boolean;
  /** This canvas's target size in CSS pixels, measured by MuseumClient.tsx
   * (window.innerWidth/innerHeight, swapped while the forced-landscape
   * rotate is applied so it describes the pre-rotation box) — fed straight
   * into CanvasResizeSync below so the renderer/camera get told the real
   * size directly on a mobile orientation flip, instead of relying only on
   * R3F's own automatic (and, on this exact transition, unreliable)
   * ResizeObserver-based sizing. */
  viewportSize?: { w: number; h: number };
  /** Bubbles up to MuseumClient.tsx's HUD (current room label + progress dots) — separate from the internal handleRoomChange below. */
  onRoomChange?: (roomId: string) => void;
  /** Visitor-toggled ambiance, owned by MuseumClient.tsx (persisted across the session) — dims every room's lighting plus the background/fog, see roomConstants.ts. */
  darkMode?: boolean;
  /** The VR HUD's wording for the lighting button — see VrHud.tsx. */
  lightModeLabel?: string;
  /** The light sweep on the artwork the visitor is standing at — passed to
   *  every ArtworkFrame, which only draws it while it is the active one. */
  artworkShimmer?: ArtworkShimmerConfig;
  /** Admin-set brightness for light mode (0–100, 50 = baseline). */
  brightnessLight?: number;
  /** Admin-set brightness for dark mode (0–100, 50 = baseline). */
  brightnessDark?: number;
  onToggleDarkMode?: () => void;
  /** [M] key — opens/closes MuseumClient.tsx's Map overlay, same toggle action as its HUD button. */
  onToggleMap?: () => void;
  /** [H] key — same screenshot-mode toggle as MuseumClient.tsx's HUD button. */
  onToggleHud?: () => void;
  /** The CSS `filter` currently on the scene, or null. Passed only to
   *  ScreenshotCapture — the filter is applied by MuseumClient.tsx on a
   *  wrapper *outside* the canvas, so it isn't in the WebGL buffer and a
   *  capture has to re-apply it to match what the visitor sees. */
  activeFilterCss?: string | null;
  /** [Q] key — cycles Filter Vision, same action as MuseumClient.tsx's HUD
   *  button. Undefined when the museum has the feature off. */
  onCycleVisionFilter?: () => void;
  /** Suppresses every overlay this component renders itself (legend, prompts, exhibition intro, corner card) — see MuseumClient.tsx's hudHidden declaration for why this exists. */
  hudHidden?: boolean;
  /** [R] key / MuseumClient.tsx's "Save Photo" button call this to trigger a
   * canvas capture+download — see ScreenshotCapture.tsx for why the ref
   * lives outside this component instead of a plain callback prop. */
  captureRef?: MutableRefObject<(() => void) | null>;
  /** MuseumClient.tsx's "Share 360°" button — resolves to a tagged
   * equirectangular JPEG of the room the visitor is standing in, taken from
   * where they stand. See Room360Capture.tsx / lib/museum/panorama360.ts. */
  share360Ref?: MutableRefObject<Share360Fn | null>;
  /** Id of the auto-generated "About ScriptOverNovel" room (see page.tsx) — compared against currentRoomId to know which layout is that room's, and when to show AboutRoomCorner. */
  aboutRoomId?: string;
  aboutData?: MuseumAboutData;
  /** Id of the Freedom Wall room — null/undefined when disabled. */
  freedomWallRoomId?: string | null;
  /** Server-fetched notes, extended optimistically as visitors submit. */
  freedomWallNotes?: FreedomWallNotePublic[];
  /** Active event's name — painted on the wall and shown in the note form. */
  freedomWallEventTitle?: string | null;
  /** True when a visitor can actually submit notes (active event set). */
  freedomWallAcceptingNotes?: boolean;
  onFreedomWallNoteAdded?: (note: FreedomWallNotePublic) => void;
  /** Only the *enabled* ones — see page.tsx and ChaseCompanion.tsx. Up to 5. */
  chaseCompanions?: MuseumChaseCompanion[];
  /** Digital Museum Achievements' "steps walked" counter — see StepTracker.tsx and lib/museum/useMuseumAchievements.ts. */
  onStepsChange?: (totalSteps: number) => void;
  /** Fires once each time a new artwork's info panel opens — Digital Museum Achievements' "views" counter. */
  onArtworkViewed?: () => void;
  /** MuseumMap.tsx room click — forwarded straight to PlayerControls.tsx, which owns the camera and resolves roomId to a world position via `layouts`. */
  travelRequest?: RoomTravelRequest | null;
  /** MuseumClient.tsx's MiniMapHud.tsx (bottom-left radar) reads this same
   * ref from its own rAF loop — written every frame by MiniMapTracker below,
   * never through React state (see that file's doc comment). */
  minimapRef?: MutableRefObject<MiniMapFrameState | null>;
  /** MuseumClient.tsx's VR button — whether the visitor has asked to enter
   *  VR (Docs/Museum_VRMode.md's Phase 3). The actual XR store/session
   *  lives entirely in this file (see the `xrStore` useMemo below) — this
   *  is the one prop that crosses the ssr:false boundary in either
   *  direction; onVrPresentingChange carries the real state back out. */
  vrMode?: boolean;
  /** Fires whenever the XR session's actual presenting state changes —
   *  including a headset's own "Exit VR" UI, which ends the session
   *  without this component's `vrMode` prop ever changing. */
  onVrPresentingChange?: (presenting: boolean) => void;
  /** [V] key — same toggle as MuseumClient.tsx's HUD/dropdown VR button.
   *  Undefined when the museum has no way to use VR at all, same "the key
   *  just does nothing" pattern as onCycleVisionFilter. */
  onToggleVrMode?: () => void;
  /** The in-headset HUD's inputs — see VrHud.tsx's VrHudProps. Undefined
   *  means no HUD in VR (nothing upstream threaded it). */
  vrHud?: VrHudProps;
}) {
  const layouts = useMemo(() => computeRoomLayouts(rooms), [rooms]);

  // Every room's frames flattened into one world-space list — placement
  // math runs per-room (each room only knows its own local size/openings)
  // then gets offset by that room's centerZ so PlayerControls can treat the
  // whole corridor as a single space. `keys` is tracked alongside: the same
  // artwork can be added to more than one room (nothing stops that — it's
  // still just a reference, not a copy), so `artwork.id` alone isn't unique
  // across this flattened list the way it was back when V1 had only one
  // room. Each frame's React key is `${roomId}-${artworkId}` instead.
  //
  // An artwork with an admin-set placement override (see MuseumRoomPublic
  // .artworkPlacementOverrides — the Museum Scene Editor's wall-snapped
  // drag-to-place, Docs/MuseumSceneEditor_Spec.md) replaces its auto-
  // computed even-spacing position/rotation
  // entirely rather than blending with it — wallNormal is re-derived from
  // the override's rotationY via the same [sin, 0, cos] relationship
  // framePlacement.ts's WallDefinition uses, and maxWidth widens to the
  // room's full MAX_FRAME_WIDTH since it's no longer sharing an
  // evenly-divided slot with its neighbors. `scales` is a separate parallel
  // array (independent of position) — see the render loop below, which
  // applies it as a wrapping group's scale rather than touching
  // ArtworkFrame.tsx's own geometry math.
  const { placements, artworks, keys, roomIds, scales } = useMemo(() => {
    const flatPlacements: FramePlacement[] = [];
    const flatArtworks: MuseumArtwork[] = [];
    const flatKeys: string[] = [];
    const flatRoomIds: string[] = [];
    const flatScales: number[] = [];
    for (const layout of layouts) {
      const roomPlacements = computeFramePlacements(
        layout.room.artworks.length,
        layout.width,
        layout.depth,
        layout.hasNorthOpening,
        layout.hasSouthOpening
      );
      // This room's divider faces, so a placement stored on one can be pulled
      // back onto the panel wherever it now stands. A frame's override is a
      // bare point with no record of which panel it belongs to, so without
      // this a divider that had been moved, turned or resized — or simply one
      // whose art was placed before divider faces anchored on the panel's real
      // surface — left its frames hanging in mid-air beside it.
      const dividerWalls = getDividerWallDefinitions(
        layout.room.customObjects
          .filter((o) => o.kind === DIVIDER_KIND)
          .map((o) => {
            const cfg = parseWallDividerConfig(o.modelUrl);
            return {
              id: o.id,
              positionX: o.positionX,
              positionZ: o.positionZ,
              rotationY: o.rotationY,
              width: cfg.width,
              thickness: cfg.thickness,
            };
          })
      );
      layout.room.artworks.forEach((artwork, i) => {
        const override = layout.room.artworkPlacementOverrides[artwork.id];
        const p = roomPlacements[i];
        if (override?.position) {
          const snapped =
            dividerWalls.length > 0
              ? snapToDividerFace(dividerWalls, {
                  x: override.position.x,
                  z: override.position.z,
                  rotationY: override.position.rotationY,
                })
              : null;
          const { x, z, rotationY } = snapped ?? override.position;
          const { y } = override.position;
          flatPlacements.push({
            // + layout.floorYSouth — a curated room can now live on the
            // second floor (see roomLayout.ts), so a frame's stored height
            // is relative to *this room's own* floor level, not always
            // world y=0. Flat rooms (every room except STAIRS) have
            // floorYSouth === floorYNorth, so this is a no-op on the ground
            // floor exactly as before.
            position: [x, y + layout.floorYSouth, z + layout.centerZ],
            rotationY,
            wallNormal: [Math.sin(rotationY), 0, Math.cos(rotationY)],
            maxWidth: MAX_FRAME_WIDTH,
          });
        } else {
          flatPlacements.push({
            ...p,
            position: [p.position[0], p.position[1] + layout.floorYSouth, p.position[2] + layout.centerZ],
          });
        }
        flatArtworks.push(artwork);
        flatKeys.push(`${layout.room.id}-${artwork.id}`);
        flatRoomIds.push(layout.room.id);
        flatScales.push(override?.scale ?? 1);
      });
    }
    return { placements: flatPlacements, artworks: flatArtworks, keys: flatKeys, roomIds: flatRoomIds, scales: flatScales };
  }, [layouts]);

  // Room id → each of its artwork frames' room-local {x,z} — MiniMapHud.tsx's
  // dots. Kept separate from the flattened `placements` above (which is
  // world-space and floor-offset for actually rendering the frames) since
  // this only ever needs room-local coordinates, looked up per-room rather
  // than flattened across the whole corridor.
  const roomArtworkLocalPositions = useMemo(() => {
    const map = new Map<string, MiniMapDot[]>();
    for (const layout of layouts) {
      const roomPlacements = computeFramePlacements(
        layout.room.artworks.length,
        layout.width,
        layout.depth,
        layout.hasNorthOpening,
        layout.hasSouthOpening
      );
      const positions: MiniMapDot[] = layout.room.artworks.map((artwork, i) => {
        const override = layout.room.artworkPlacementOverrides[artwork.id];
        if (override?.position) return { id: artwork.id, x: override.position.x, z: override.position.z };
        const p = roomPlacements[i];
        return { id: artwork.id, x: p.position[0], z: p.position[2] };
      });
      // About ScriptOverNovel hangs content blocks rather than artwork frames, so
      // without this its minimap drew an empty room — no sense of which wall
      // the photos, the plaque, the certificates, the calling card or the
      // gigs board are on, in the one room where a visitor most has to go
      // looking. They're wall hangings like any other room's pieces, so they
      // plot as the same white dots rather than a marker of their own.
      //
      // Only the blocks that actually render: AboutRoomContents draws the
      // photo slideshow, certificates strip and calling card conditionally on
      // there being something to show, and a dot for a block that isn't there
      // would send a visitor to a blank wall. The plaque and the gigs board
      // always render, so they're always plotted.
      if (layout.room.roomType === "ABOUT" && aboutData) {
        const offsets = layout.room.aboutBlockOffsets;
        const hung: AboutBlockKind[] = [ABOUT_PLAQUE_KIND, ABOUT_GIGS_KIND];
        if (aboutData.images.length > 0) hung.push(ABOUT_PHOTO_KIND);
        if (aboutData.certificates.length > 0) hung.push(ABOUT_CERTS_KIND);
        if (aboutData.callingCardFront) hung.push(ABOUT_CARD_KIND);
        for (const kind of hung) {
          // A block switched off in the Scene Editor ("Hide from Museum")
          // isn't drawn, so it mustn't be plotted either — the same reason
          // the list above only includes blocks that have content: a dot
          // standing for nothing sends a visitor to a blank wall.
          if (offsets?.[kind]?.hidden) continue;
          const { x, z } = getAboutBlockLocalXZ(kind, offsets?.[kind], layout.depth);
          // litWhenNear, because these light up on plain distance instead of
          // on being the active [E] target: this room has no per-block [E]
          // target to compare an id against, and a visitor walking up to the
          // certificates should see the same yellow on the map that walking
          // up to an artwork gives them in any other room.
          positions.push({ id: kind, x, z, litWhenNear: true });
        }
        // The wall clock hangs like they do, but from a placement of its own
        // rather than a wall anchor — its row already stores the room-local
        // coordinates the minimap wants.
        if (layout.room.aboutClock) {
          positions.push({
            id: ABOUT_CLOCK_KIND,
            x: layout.room.aboutClock.position[0],
            z: layout.room.aboutClock.position[2],
            litWhenNear: true,
          });
        }
      }
      map.set(layout.room.id, positions);
    }
    return map;
  }, [layouts, aboutData]);

  // The same idea for admin-uploaded .glb props, so the minimap shows what's
  // standing *in* a room and not only what's hung on its walls. Simpler than
  // the artwork map above because there's no placement algorithm to re-run:
  // customObjects already store room-local coordinates (see types/index.ts),
  // which is exactly the space MiniMapFrameState wants, so this is a filter
  // and a rename rather than any real math.
  //
  // Only kind "custom" — a "text" entry is an admin-authored floating label
  // (see textPlacements below), not an object a visitor would walk up to, so
  // it isn't something the map should suggest is there.
  // ── Stories Room ───────────────────────────────────────────────────────
  // The library (lib/museum/storiesRoom.ts). Unlike every other room's
  // contents these stand on the floor rather than hanging on a wall, so
  // there's nothing in the flattened frame list above to reuse: placements
  // are computed here (rather than inside StoriesRoomContents) so the minimap
  // can plot the same podiums without recomputing them.
  const storiesLayout = layouts.find((l) => l.room.roomType === "STORIES") ?? null;
  const storyPodiums = useMemo((): PodiumEntry[] => {
    if (!storiesLayout) return [];
    const entries = storiesLayout.room.stories;
    const auto = computePodiumPlacements(
      entries.length,
      ROOM_WIDTH,
      storiesLayout.depth
    );
    return entries.map((entry, i) => ({
      entryId: entry.entryId,
      story: {
        id: entry.story.id,
        title: entry.story.title,
        type: entry.story.type,
        coverImageUrl: entry.story.coverImageUrl,
      },
      // An admin-dragged podium (Museum Scene Editor) overrides its grid
      // slot; everything else falls through to the auto layout, same
      // "override else fall back" convention as the wall frames'.
      placement:
        entry.positionX !== null && entry.positionY !== null && entry.positionZ !== null && entry.rotationY !== null
          ? {
              position: [entry.positionX, entry.positionY, entry.positionZ] as [number, number, number],
              rotationY: entry.rotationY,
            }
          : auto[i],
    }));
  }, [storiesLayout]);

  // ── Arcade Room ────────────────────────────────────────────────────────
  // The Mini Games (lib/museum/arcadeRoom.ts). Same "contents stand on the
  // floor, placements computed here so the minimap can reuse them" handling as
  // the Stories Room above.
  const arcadeLayout = layouts.find((l) => l.room.roomType === "ARCADE") ?? null;
  const arcadeCabinets = useMemo((): ArcadeEntry[] => {
    if (!arcadeLayout) return [];
    const entries = arcadeLayout.room.miniGames;
    const roomDefault = arcadeLayout.room.arcadeDefaultMode ?? "CABINET";
    const auto = computeCabinetPlacements(entries.length, ROOM_WIDTH, arcadeLayout.depth);
    return entries.map((entry, i) => ({
      entryId: entry.entryId,
      game: entry.game,
      display: {
        title: entry.game.name,
        imageUrl: entry.game.artwork?.imageUrl ?? null,
        subtitle: DIFFICULTY_LABELS[entry.game.difficulty],
      },
      mode: entry.displayMode ?? roomDefault,
      placement:
        entry.positionX !== null && entry.positionY !== null && entry.positionZ !== null && entry.rotationY !== null
          ? {
              position: [entry.positionX, entry.positionY, entry.positionZ] as [number, number, number],
              rotationY: entry.rotationY,
            }
          : auto[i],
    }));
  }, [arcadeLayout]);

  // ── Cosplay Room ───────────────────────────────────────────────────────
  // The costume standees (lib/museum/cosplayRoom.ts). Same "contents stand on
  // the floor, placements computed here so the minimap can reuse them" handling
  // as the Stories and Arcade rooms above. The one difference: its auto layout
  // hugs the walls rather than filling floor bays (see standeePlacement.ts), so
  // it needs the room's real doorway flags the way the wall frames do — a
  // standee standing in a doorway would block the only route through.
  const cosplayLayout = layouts.find((l) => l.room.roomType === "COSPLAY") ?? null;
  const cosplayStandees = useMemo((): StandeeEntry[] => {
    if (!cosplayLayout) return [];
    const entries = cosplayLayout.room.cosplays;
    const auto = computeStandeePlacements(
      entries.length,
      ROOM_WIDTH,
      cosplayLayout.depth,
      cosplayLayout.hasNorthOpening,
      cosplayLayout.hasSouthOpening
    );
    return entries.map((entry, i) => ({
      entryId: entry.entryId,
      cosplay: {
        id: entry.cosplay.id,
        title: entry.cosplay.title,
        character: entry.cosplay.character,
        series: entry.cosplay.series,
        standeeImageUrl: entry.cosplay.standeeImageUrl,
        backdropImageUrl: entry.cosplay.backdropImageUrl,
        // The plaque's lower lines — see CosplayStandee.tsx. Everything the
        // Cosplays module's Edit Details form can set now reads on the standee
        // itself except the description, which stays behind [E].
        year: entry.cosplay.year,
        event: entry.cosplay.event,
        cosplayer: entry.cosplay.cosplayer,
        photographer: entry.cosplay.photographer,
      },
      lightsEnabled: entry.lightsEnabled,
      placement:
        entry.positionX !== null && entry.positionY !== null && entry.positionZ !== null && entry.rotationY !== null
          ? {
              position: [entry.positionX, entry.positionY, entry.positionZ] as [number, number, number],
              rotationY: entry.rotationY,
            }
          : auto[i],
    }));
  }, [cosplayLayout]);

  // ── Vinyl Room ─────────────────────────────────────────────────────────
  // The records (lib/museum/vinylRoom.ts). Sleeves hang on the walls like
  // frames (a FramePlacement each — admin override else the side-wall walk
  // in sleevePlacement.ts), the deck stands where the config row says (else
  // the default), and the Lyrics Wall takes one wall. The audio side — the
  // player, what's held, what's on the deck — is state further down.
  const vinylLayout = layouts.find((l) => l.room.roomType === "VINYL") ?? null;
  const vinylConfig = vinylLayout?.room.vinylConfig ?? DEFAULT_VINYL_CONFIG;
  const sleeveEntries = useMemo((): SleeveEntry[] => {
    if (!vinylLayout) return [];
    const entries = vinylLayout.room.vinyls;
    const auto = computeSleevePlacements(
      entries.length,
      vinylLayout.depth,
      vinylConfig.lyricsWall.wall,
      vinylConfig.lyricsWall.enabled,
      vinylLayout.hasNorthOpening
    );
    return entries.map((entry, i) => ({
      entryId: entry.entryId,
      vinyl: entry,
      scale: entry.scale ?? 1,
      placement:
        entry.positionX !== null && entry.positionY !== null && entry.positionZ !== null && entry.rotationY !== null
          ? {
              position: [entry.positionX, entry.positionY, entry.positionZ] as [number, number, number],
              rotationY: entry.rotationY,
              wallNormal: wallNormalForRotation(entry.rotationY),
              maxWidth: auto[i]?.maxWidth ?? MAX_FRAME_WIDTH,
            }
          : auto[i],
    }));
  }, [vinylLayout, vinylConfig]);
  const turntablePlacement = useMemo(
    () => vinylConfig.turntable ?? defaultTurntablePosition(vinylLayout?.depth ?? 18, vinylConfig.lyricsWall.wall),
    [vinylConfig, vinylLayout]
  );

  const roomObjectLocalPositions = useMemo(() => {
    const map = new Map<string, MiniMapDot[]>();
    for (const layout of layouts) {
      // No litWhenNear on an uploaded .glb prop: it's scenery, and lighting
      // it up would promise a visitor something to do there.
      const positions: MiniMapDot[] = layout.room.customObjects
        // Config rows travel on this same list but stand nowhere — their
        // position columns are unused, so plotting one puts a dot on the
        // room's origin for an object no visitor can walk up to. See
        // lib/museum/sceneObjectKinds.ts.
        .filter((o) => o.kind !== "text" && !isConfigOnlyKind(o.kind))
        .map((o) => ({ id: o.id, x: o.positionX, z: o.positionZ }));
      // Podiums count as objects standing in the room for the same reason
      // .glb props do — they're something a visitor walks up to, and a map
      // that omitted them would suggest the Stories Room was empty. Uses the
      // same placements the scene renders (auto grid or admin override).
      if (layout.room.roomType === "STORIES") {
        for (const podium of storyPodiums) {
          positions.push({ id: podium.entryId, x: podium.placement.position[0], z: podium.placement.position[2] });
        }
      }
      // Same reasoning for the Arcade Room's cabinets.
      if (layout.room.roomType === "ARCADE") {
        for (const cab of arcadeCabinets) {
          positions.push({ id: cab.entryId, x: cab.placement.position[0], z: cab.placement.position[2] });
        }
      }
      // And the Cosplay Room's standees. Unlike a podium (whose dot is one of
      // many in a floor grid) a standee lines the wall, and the map's job here
      // is to tell a visitor which one they're standing at — so its dot lights
      // like an artwork frame's, keyed to the entry [E] is actually offering.
      // It used to ask for litWhenNear instead, which lit the dot at
      // NEAR_DISTANCE (5m, twice the [E] range): the standee was still two
      // metres out of reach by the time the map called it. Only the standee is
      // plotted, not the photo hung behind it: they're one thing to walk up to,
      // and two dots a metre apart would read as two.
      if (layout.room.roomType === "COSPLAY") {
        for (const standee of cosplayStandees) {
          positions.push({
            id: standee.entryId,
            x: standee.placement.position[0],
            z: standee.placement.position[2],
          });
        }
      }
      // And the Vinyl Room: every sleeve (a wall hanging, like a frame) and
      // the deck, which is the one thing there a visitor walks to.
      if (layout.room.roomType === "VINYL") {
        for (const sleeve of sleeveEntries) {
          positions.push({ id: sleeve.entryId, x: sleeve.placement.position[0], z: sleeve.placement.position[2] });
        }
        positions.push({ id: "vinyl-deck", x: turntablePlacement.x, z: turntablePlacement.z });
      }
      // And for the About room's Contact Desk — furniture standing on the
      // floor, not a wall hanging, so it belongs with the podiums and
      // cabinets rather than with the block dots above. Its row already
      // stores room-local coordinates, the same ones AboutRoomContents
      // renders it from.
      if (layout.room.roomType === "ABOUT" && layout.room.aboutContact) {
        positions.push({
          id: ABOUT_CONTACT_KIND,
          x: layout.room.aboutContact.position[0],
          z: layout.room.aboutContact.position[2],
          // The one thing in this room a visitor presses [E] at — so, like the
          // standees above, it lights when [E] is actually offering it rather
          // than on the wall blocks' wider NEAR_DISTANCE. A desk is a discrete
          // object a metre or so across; the blocks' "your dot marks one point
          // on a wall-wide plaque" problem simply isn't its problem.
        });
      }
      if (positions.length > 0) map.set(layout.room.id, positions);
    }
    return map;
  }, [layouts, storyPodiums, arcadeCabinets, cosplayStandees, sleeveEntries, turntablePlacement]);

  // Sticky notes' room-local {x,z} — same "MiniMapHud.tsx dot" idea as the
  // artwork/object maps above, just always keyed to whichever room actually
  // has freedomWallRoomId (there's only ever one Freedom Wall room) rather
  // than looped across every layout, since every other room's list here is
  // always empty anyway.
  const roomStickyNoteLocalPositions = useMemo(() => {
    const map = new Map<string, { x: number; z: number }[]>();
    if (!freedomWallRoomId) return map;
    const layout = layouts.find((l) => l.room.id === freedomWallRoomId);
    if (!layout) return map;
    const positions = freedomWallNotes.map((note) => {
      const { position } = notePercentToWorld(note, {
        depth: layout.depth,
        hasNorthOpening: layout.hasNorthOpening,
        hasSouthOpening: layout.hasSouthOpening,
      });
      return { x: position[0], z: position[2] };
    });
    if (positions.length > 0) map.set(freedomWallRoomId, positions);
    return map;
  }, [layouts, freedomWallRoomId, freedomWallNotes]);

  const entryLayout = layouts.find((l) => l.room.isEntryRoom) ?? layouts[0];
  const spawnZ = entryLayout?.centerZ ?? 0;
  const aboutLayout = layouts.find((l) => l.room.id === aboutRoomId);
  // The Contact Desk's admin config — its panel title/subtitle and the words
  // on the walk-up prompt. Read here rather than inside AboutRoomContents
  // because the prompt and the panel both live at this level.
  const aboutContact = aboutLayout?.room.aboutContact;
  const contactConfig = aboutContact?.config ?? DEFAULT_CONTACT_DESK_CONFIG;

  // The shop wall (lib/museum/servicesRoom.ts). Its products are already in
  // the flattened frame list above — they're ordinary MuseumRoomArtwork rows,
  // so they get the same perimeter layout, the same Scene Editor overrides
  // and the same [E] proximity handling as any hung artwork. The only extra
  // is a price plaque under each one, built here from those same placements
  // so a frame and its price can never drift apart.
  const servicesLayout = layouts.find((l) => l.room.roomType === "SERVICES") ?? null;
  const servicesRoomId = servicesLayout?.room.id ?? null;
  const servicesPriceTags = useMemo((): ServicesPriceTag[] => {
    if (!servicesLayout) return [];
    const tags: ServicesPriceTag[] = [];
    for (let i = 0; i < artworks.length; i++) {
      if (roomIds[i] !== servicesLayout.room.id) continue;
      const product = artworks[i].product;
      if (!product) continue;
      tags.push({
        id: keys[i],
        // A product with sizes gets the span, not its base price — that
        // figure isn't payable on its own once variants exist. The plaque
        // sizes itself from the label's length, so a longer range just
        // widens the plate.
        label: formatPriceRange(product.price, product.variants.map((v) => v.price)),
        position: placements[i].position,
        wallNormal: placements[i].wallNormal,
        rotationY: placements[i].rotationY,
      });
    }
    return tags;
  }, [servicesLayout, artworks, roomIds, keys, placements]);

  // The room's optional pedestal .glb + the height its book sits at. Absent
  // (or holding no URL) means every podium uses StoryPodium.tsx's procedural
  // pedestal, which is the default state.
  const podiumModel = useMemo(() => {
    const row = storiesLayout?.room.customObjects.find((o) => o.kind === STORY_PODIUM_MODEL_KIND);
    return parsePodiumModelConfig(row?.modelUrl);
  }, [storiesLayout]);

  // Each room's shared plaque style (lib/museum/roomBanner.ts) — the podium
  // plaques, the arcade marquees, the price tags, the About headings and the
  // cosplay foot plaques all read their colours/type/finish from this one row.
  // Parsed here rather than inside each contents component for the same reason
  // podiumModel is: the row arrives on the room's own customObjects list, and
  // one parse per room beats one per plaque in a room of twelve.
  //
  // A room whose row hasn't been provisioned yet (or was deleted) parses to the
  // defaults, which are the values these plaques were hardcoded to — so there
  // is no state in which a missing row means an unstyled label.
  const bannerStyles = useMemo(() => {
    const styleOf = (
      layout: (typeof layouts)[number] | null | undefined,
      roomType: BannerRoomType
    ) =>
      parseRoomBannerStyle(
        layout?.room.customObjects.find((o) => o.kind === ROOM_BANNER_KIND)?.modelUrl,
        // Each room falls back to its *own* historical look rather than one
        // shared default — see defaultRoomBannerStyle for why three rooms
        // would otherwise repaint themselves the first time this loaded.
        defaultRoomBannerStyle(roomType)
      );
    return {
      stories: styleOf(storiesLayout, "STORIES"),
      arcade: styleOf(arcadeLayout, "ARCADE"),
      services: styleOf(servicesLayout, "SERVICES"),
      about: styleOf(aboutLayout, "ABOUT"),
      cosplay: styleOf(cosplayLayout, "COSPLAY"),
    };
  }, [storiesLayout, arcadeLayout, servicesLayout, aboutLayout, cosplayLayout]);

  // Podiums as solid obstacles, in world space — the only floor-standing
  // thing in the museum a visitor shouldn't be able to walk through (see
  // PlayerControls' `obstacles`). Radius covers the pedestal's own footprint
  // plus its scale override.
  const podiumObstacles = useMemo(() => {
    if (!storiesLayout) return [];
    return storyPodiums.map((podium) => {
      const scale =
        storiesLayout.room.stories.find((e) => e.entryId === podium.entryId)?.scale ?? 1;
      return {
        x: podium.placement.position[0],
        z: podium.placement.position[2] + storiesLayout.centerZ,
        radius: PODIUM_COLLIDER_RADIUS * scale,
      };
    });
  }, [storyPodiums, storiesLayout]);

  // Admin-marked "solid" custom .glb props, as the same circular floor
  // obstacles the podiums above produce (see the Museum Scene Editor's
  // Solid toggle). Room-local X/Z lifted into world space with the room's
  // centerZ, footprint = the stored collider radius scaled by the prop's
  // own size override. `colliderRadius` is normally filled in by the
  // editor from the model's bounding box; the fallback only matters for a
  // prop switched solid before its model finished measuring.
  const customObstacles = useMemo(() => {
    const out: { x: number; z: number; radius: number; minY?: number; maxY?: number }[] = [];
    for (const layout of layouts) {
      for (const o of layout.room.customObjects) {
        if (o.kind !== "custom" || !o.solid) continue;
        // The footprint's offset from the prop's origin is stored in the
        // prop's *own* frame (that is the frame an admin nudges it in, and
        // the frame the editor's ring is drawn in — a child of the object's
        // rotated group). Turning the prop has to turn its footprint with
        // it, or a circle placed under an octopus would swing off it the
        // moment the prop was rotated. Same Y-rotation three.js applies to
        // the group itself.
        const dx = colliderWorldOffset(o.colliderOffsetX, o.scale);
        const dz = colliderWorldOffset(o.colliderOffsetZ, o.scale);
        const cos = Math.cos(o.rotationY);
        const sin = Math.sin(o.rotationY);
        // How tall the column stands, or null for the floor-to-ceiling
        // default. Measured up from the prop's own base in this room, which
        // on the second floor is that floor's level, not world zero — the
        // same floorYSouth every placement in this scene is lifted by.
        const height = colliderWorldHeight(o.colliderHeight, o.scale);
        // Where the column starts. Lifting it is what lets an archway's
        // crossbeam or a hanging lamp be solid only where it actually is,
        // with open air underneath — shrinking the height alone could only
        // ever make a shorter obstacle still rooted to the floor.
        const baseY =
          o.positionY + layout.floorYSouth + colliderWorldBaseY(o.colliderBaseY, o.scale);
        out.push({
          x: o.positionX + dx * cos + dz * sin,
          z: o.positionZ + layout.centerZ - dx * sin + dz * cos,
          // Resized with the prop and clamped in metres, for the reason
          // colliderWorldRadius documents: a bad measurement stored before
          // that clamp existed would otherwise be a museum-wide invisible
          // wall, and a model not authored in metres would get a footprint
          // nothing like the thing a visitor can see.
          radius: colliderWorldRadius(o.colliderRadius, o.scale),
          // Both omitted (not zeroed) when there is no height set, so
          // PlayerControls keeps treating it as solid at every height.
          ...(height == null ? null : { minY: baseY, maxY: baseY + height }),
        });
      }
    }
    return out;
  }, [layouts]);

  // Arcade cabinets as solid obstacles, same circular-footprint model as the
  // Stories podiums above. Posters get a smaller footprint but the same
  // treatment — a poster on a stand is still something you bump into.
  const cabinetObstacles = useMemo(() => {
    if (!arcadeLayout) return [];
    return arcadeCabinets.map((cab) => {
      const scale =
        arcadeLayout.room.miniGames.find((e) => e.entryId === cab.entryId)?.scale ?? 1;
      return {
        x: cab.placement.position[0],
        z: cab.placement.position[2] + arcadeLayout.centerZ,
        radius: (cab.mode === "POSTER" ? 0.3 : CABINET_COLLIDER_RADIUS) * scale,
      };
    });
  }, [arcadeCabinets, arcadeLayout]);

  // The Contact Desk, on the same footing as a podium or a cabinet: always
  // solid at its own known radius rather than admin-toggled. It is furniture
  // standing in the open, and walking through a desk to reach the letter on
  // it reads as a bug however the prop got there.
  const contactObstacles = useMemo(() => {
    if (!aboutLayout || !aboutContact) return [];
    return [{
      x: aboutContact.position[0],
      z: aboutContact.position[2] + aboutLayout.centerZ,
      radius: CONTACT_DESK_COLLIDER_RADIUS * aboutContact.scale,
    }];
  }, [aboutLayout, aboutContact]);

  // Cosplay standees as solid obstacles, same circular-footprint model as the
  // podiums and cabinets above. Only the standee's own base is blocked — the
  // photo panel behind it hangs on a wall the visitor already can't cross, and
  // walling off the metre of floor between the two would stop a visitor stepping
  // in for a close look at the print, which is the whole point of the room.
  const standeeObstacles = useMemo(() => {
    if (!cosplayLayout) return [];
    return cosplayStandees.map((standee) => {
      const scale =
        cosplayLayout.room.cosplays.find((e) => e.entryId === standee.entryId)?.scale ?? 1;
      return {
        x: standee.placement.position[0],
        z: standee.placement.position[2] + cosplayLayout.centerZ,
        radius: STANDEE_COLLIDER_RADIUS * scale,
      };
    });
  }, [cosplayStandees, cosplayLayout]);

  // The Vinyl Room's deck — the stand plus both speakers, one circle.
  const turntableObstacles = useMemo(() => {
    if (!vinylLayout) return [];
    return [{ x: turntablePlacement.x, z: turntablePlacement.z + vinylLayout.centerZ, radius: TURNTABLE_COLLIDER_RADIUS }];
  }, [vinylLayout, turntablePlacement]);

  const obstacles = useMemo(
    () => [...podiumObstacles, ...cabinetObstacles, ...standeeObstacles, ...turntableObstacles, ...customObstacles, ...contactObstacles],
    [podiumObstacles, cabinetObstacles, standeeObstacles, turntableObstacles, customObstacles, contactObstacles]
  );

  const [activePodium, setActivePodium] = useState<PodiumEntry | null>(null);
  const [panelStory, setPanelStory] = useState<MuseumStory | null>(null);

  // Cosplay Room — `activeStandee` = a standee is in [E] range, `panelCosplay` =
  // its info panel is open. Same shape as the artwork/story activeX/panelX pairs.
  const [activeStandee, setActiveStandee] = useState<StandeeEntry | null>(null);
  const [panelCosplay, setPanelCosplay] = useState<MuseumCosplay | null>(null);

  // Vinyl Room — `activeVinylTarget` = a sleeve or the deck is in [E] range;
  // `heldVinyl` = the record in the visitor's hands; `deckVinyl` = the record
  // on the platter; `panelDeck` = the turntable panel is open. Unlike every
  // other room's panel, closing this one doesn't stop anything: the record
  // keeps playing until it's taken off, which is the point of the room.
  const [activeVinylTarget, setActiveVinylTarget] = useState<VinylTarget | null>(null);
  const [heldVinyl, setHeldVinyl] = useState<MuseumVinylSleeve | null>(null);
  const [deckVinyl, setDeckVinyl] = useState<MuseumVinylSleeve | null>(null);
  const [panelDeck, setPanelDeck] = useState(false);
  const [deckState, setDeckState] = useState<VinylPlayerState>({ playing: false, currentTime: 0, duration: 0, ended: false, error: null });
  // Effects start from the room's defaults; a visitor's tweaks persist for
  // the visit (sessionStorage) so leaving and re-entering keeps their sound.
  const [vinylEffects, setVinylEffects] = useState<VinylEffects>(() => {
    if (typeof window === "undefined") return vinylConfig.defaultEffects;
    try {
      const raw = window.sessionStorage.getItem("museum:vinylEffects");
      return raw ? sanitizeVinylEffects({ ...vinylConfig.defaultEffects, ...JSON.parse(raw) }) : vinylConfig.defaultEffects;
    } catch {
      return vinylConfig.defaultEffects;
    }
  });
  // One player per museum visit, built lazily on the first record (an
  // AudioContext wants a user gesture behind it) and disposed on unmount.
  const vinylPlayerRef = useRef<VinylPlayer | null>(null);
  const getVinylPlayer = useCallback(() => {
    if (!vinylPlayerRef.current) {
      const player = createVinylPlayer(vinylEffects);
      player.subscribe(setDeckState);
      vinylPlayerRef.current = player;
    }
    return vinylPlayerRef.current;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    return () => {
      vinylPlayerRef.current?.dispose();
      vinylPlayerRef.current = null;
      resumeMuseumMusicAfterVinyl();
    };
  }, []);
  const applyVinylEffects = useCallback((next: Partial<VinylEffects>) => {
    setVinylEffects((prev) => {
      const merged = sanitizeVinylEffects({ ...prev, ...next });
      vinylPlayerRef.current?.setEffects(merged);
      try {
        window.sessionStorage.setItem("museum:vinylEffects", JSON.stringify(merged));
      } catch {
        /* private mode */
      }
      return merged;
    });
  }, []);
  const takeRecordOffDeck = useCallback((toHands: boolean) => {
    const player = vinylPlayerRef.current;
    player?.stop();
    resumeMuseumMusicAfterVinyl();
    setPanelDeck(false);
    setDeckVinyl((current) => {
      if (toHands && current) setHeldVinyl(current);
      return null;
    });
  }, []);
  // The sleeves whose record is out — held or on the deck — so the wall
  // shows the gap.
  const takenEntryIds = useMemo(() => {
    const ids = new Set<string>();
    if (heldVinyl) ids.add(heldVinyl.entryId);
    if (deckVinyl) ids.add(deckVinyl.entryId);
    return ids;
  }, [heldVinyl, deckVinyl]);
  // Lyrics: which line the wall (and the panel) should show now — see
  // lib/museum/lyricsTimeline.ts for how honest that guess is.
  const lyricsTimeline = useMemo(() => (deckVinyl ? buildLyricsTimeline(deckVinyl.tracks) : []), [deckVinyl]);
  const lyricsLineIndex = deckVinyl ? lineIndexAt(lyricsTimeline, deckState.currentTime, deckState.duration) : -1;
  const currentTrackIndex = deckVinyl ? trackIndexAt(deckVinyl.tracks, deckState.currentTime, deckState.duration) : -1;
  const lyricsWallState = useMemo(() => {
    const line = lyricsLineIndex >= 0 ? lyricsTimeline[lyricsLineIndex] : null;
    const trackTitle = deckVinyl && currentTrackIndex >= 0 ? deckVinyl.tracks[currentTrackIndex]?.title ?? null : null;
    return {
      currentLine: line?.text ?? (deckVinyl && deckState.playing ? "…" : null),
      previousLine: lyricsLineIndex > 0 ? lyricsTimeline[lyricsLineIndex - 1].text : null,
      nextLine: lyricsLineIndex >= 0 && lyricsLineIndex < lyricsTimeline.length - 1 ? lyricsTimeline[lyricsLineIndex + 1].text : null,
      caption: deckVinyl ? [deckVinyl.title, trackTitle].filter(Boolean).join(" — ") : null,
      glow: Math.min(1, 0.2 + vinylEffects.reverb * 0.5 + vinylEffects.lofi * 0.3),
    };
  }, [lyricsLineIndex, lyricsTimeline, deckVinyl, currentTrackIndex, deckState.playing, vinylEffects]);

  // Arcade Room — `activeArcadeGame` = a cabinet is in [E] range,
  // `panelGame` = its info panel (GamePreviewModal) is open, `playingGame` = a
  // round (GameSession) is running on top of the museum. Same shape as the
  // artwork/story activeX/panelX pairs above.
  const [activeArcadeGame, setActiveArcadeGame] = useState<ArcadeEntry | null>(null);
  const [panelGame, setPanelGame] = useState<PublicGame | null>(null);
  const [playingGame, setPlayingGame] = useState<PublicGame | null>(null);

  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  // MiniMapHud.tsx glows whichever artwork dot matches this — the same
  // "nearest frame in interact range" PlayerControls.tsx already tracks
  // (activeIndex above), just resolved to an artwork id so
  // MiniMapTracker.tsx can match it against its own room-local list by id
  // rather than a flattened cross-room index.
  const activeArtworkId = activeIndex !== null ? artworks[activeIndex]?.id ?? null : null;
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(entryLayout?.room.id ?? null);
  const [locked, setLocked] = useState(false);
  // Esc both shows *and* hides the "Click to look around" legend now — the
  // first Esc (or just never having locked yet) unlocks the pointer, which
  // already reveals the card; a second Esc while still unlocked dismisses it
  // instead of sitting there inert, same toggle pattern as [M] for the map.
  // Re-armed the moment the pointer locks again so the next unlock shows it
  // fresh (see the effect below).
  const [legendDismissed, setLegendDismissed] = useState(false);
  const [panelArtwork, setPanelArtwork] = useState<MuseumArtwork | null>(null);
  // Whether the open panel's frame is hanging in the Services Room — the one
  // place a frame is a *listing*, so its panel gets the price and a link to
  // /shop. Captured when the panel opens rather than derived from the artwork
  // itself: the same artwork can also hang in an ordinary gallery room, where
  // it's a work on a wall and shouldn't be sold at the visitor.
  const [panelIsListing, setPanelIsListing] = useState(false);
  // Nearest certificate in the About room within [E]-interact range, and the
  // open info panel for one — same shape as activeIndex/panelArtwork above,
  // just fed by AboutRoomContents.tsx's own proximity tracker instead of
  // PlayerControls' (the About room carries zero MuseumRoomArtwork entries,
  // so PlayerControls never sees these — see that file's class doc).
  const [activeCert, setActiveCert] = useState<MuseumAboutCertificate | null>(null);
  const [panelCert, setPanelCert] = useState<MuseumAboutCertificate | null>(null);
  // About-room social-links drawer (AboutRoomCorner). Lifted here so it can
  // release the pointer while open, same as the artwork/cert panels.
  const [aboutDrawerOpen, setAboutDrawerOpen] = useState(false);
  // Timeline & Gigs wall board — `activeGigs` = player is in [E] range,
  // `panelGigs` = the events map overlay (GigsPanel) is open.
  const [activeGigs, setActiveGigs] = useState(false);
  const [panelGigs, setPanelGigs] = useState(false);
  // The Contact Desk, same two-state shape: `activeContact` = player is in
  // [E] range, `panelContact` = the "Send an Email" form is open.
  const [activeContact, setActiveContact] = useState(false);

  // What the minimap glows, in every room: whatever [E] is offering right now.
  // Only ever one of these at a time — handleActivate below picks exactly one
  // from the same set, so the lit dot and the on-screen prompt can't disagree
  // about which thing the visitor is standing at, or about how close counts.
  const activeInteractId =
    activeArtworkId
    ?? activeStandee?.entryId
    ?? (activeVinylTarget?.kind === "sleeve" ? activeVinylTarget.entry.entryId : activeVinylTarget?.kind === "deck" ? "vinyl-deck" : null)
    ?? (activeContact ? ABOUT_CONTACT_KIND : null);
  const [panelContact, setPanelContact] = useState(false);
  const inAboutRoom = aboutRoomId != null && currentRoomId === aboutRoomId;
  // Leaving the About room (travel / teleport) clears its gig interaction
  // state even if AboutRoomContents' proximity tracker didn't get a frame to
  // fire the exit.
  useEffect(() => {
    if (!inAboutRoom) {
      setActiveGigs(false);
      setPanelGigs(false);
      setActiveContact(false);
      setPanelContact(false);
    }
  }, [inAboutRoom]);
  const freedomWallLayout = freedomWallRoomId != null
    ? layouts.find((l) => l.room.id === freedomWallRoomId) ?? null
    : null;
  const inFreedomWallRoom = freedomWallRoomId != null && currentRoomId === freedomWallRoomId;
  // Perf: whichever device is struggling gets fewer point lights (see
  // MuseumRoom.tsx's `quality` prop) — driven by drei's PerformanceMonitor
  // down in the Canvas below, not a device/UA guess, so a capable phone or
  // desktop never sees this kick in.
  const [lowPower, setLowPower] = useState(false);

  // The static counterpart to `lowPower`, for the handful of settings that
  // are fixed when the WebGL context is created and so can't wait for a
  // measurement — see lib/museum/deviceTier.ts, whose thresholds are set
  // deliberately low so only genuinely old phones qualify. Read once per
  // mount: the answer can't change mid-session, and letting it vary would
  // mean recreating the canvas.
  const lowEnd = useMemo(() => isLowEndDevice(), []);

  // "A phone, held in landscape" — the condition the HUD's short-screen
  // layouts key off. Distinct from Tailwind's `landscape:` variant, which is
  // a *physical* orientation media query and so stays false throughout the
  // forced-landscape mode (a CSS rotate on a browser that still considers
  // itself portrait), i.e. false in exactly the case that needs it most.
  const touchLandscape = Boolean(isCoarsePointer) && landscapeMode;

  // Perf: only the room a visitor is actually in (plus one room on either
  // side, since they could be mid-walk toward a doorway) gets its point
  // lights turned on and its artworks' full-resolution textures fetched —
  // see MuseumRoom.tsx's lightsEnabled and ArtworkFrame.tsx's shouldLoad.
  // Every other room still renders its walls/frame borders (cheap
  // primitive geometry, and a room should never look like it has holes in
  // it), just without the expensive parts. Without this, a museum with
  // dozens of artworks across several rooms fetched every single image and
  // lit every single room on page load regardless of which one a visitor
  // was actually standing in.
  const currentRoomIndex = useMemo(
    () => layouts.findIndex((l) => l.room.id === currentRoomId),
    [layouts, currentRoomId]
  );
  // While a 360° is being taken, every room is *lit* — see prepareShare360
  // below. Only lit: this deliberately doesn't widen nearbyRoomIds, which
  // also gates artwork/prop loads, because flipping those for the whole
  // museum at once started every texture download in the building in the
  // same instant — which on a phone is the out-of-memory crash that was
  // reported ("Aw, Snap" on Chrome Android), not the sharper photo.
  const [capturing360, setCapturing360] = useState(false);
  const nearbyRoomIds = useMemo(() => {
    const set = new Set<string>();
    if (currentRoomIndex === -1) {
      // Not resolved yet (very first render, before PlayerControls reports
      // in) — fall back to the spawn room so the entry room's images start
      // loading immediately instead of waiting a frame for nothing.
      if (entryLayout) set.add(entryLayout.room.id);
      return set;
    }
    for (let i = Math.max(0, currentRoomIndex - 1); i <= Math.min(layouts.length - 1, currentRoomIndex + 1); i++) {
      set.add(layouts[i].room.id);
    }
    return set;
  }, [layouts, currentRoomIndex, entryLayout]);
  // Every room's wall/floor/ceiling texture loads eagerly (see MuseumRoom's
  // shouldLoad below), but a browser only opens a handful of concurrent
  // connections per origin — mounted in plain corridor order, a distant
  // room's texture fetch can sit queued behind several earlier rooms' own
  // fetches, so the entry room's own texture visibly popped in late on
  // spawn/hard-refresh (only "ready" by the time a visitor had walked far
  // enough for the queue to clear — not actually tied to walking at all).
  // Rendering nearby rooms first (stable sort — everything else keeps its
  // relative order) gets their fetches *issued* first, without changing
  // which rooms load or gating anything.
  // Distant rooms' textures are held back for one beat after mount. Every
  // room's wall/floor/ceiling texture is fetched eagerly (see the gate on
  // MuseumRoom below and why it stopped being tied to walking), but a
  // browser only opens ~6 connections per origin — so on a museum with a
  // dozen rooms the entry room's own textures were competing with two dozen
  // other requests it doesn't need yet, and the room the visitor is actually
  // standing in finished last. Ordering the mounts (roomRenderLayouts below)
  // decides which requests are *issued* first but not how many contend.
  //
  // This gives the near rooms an uncontended head start, then releases the
  // rest. Nothing is permanently gated: a visitor who teleports across the
  // corridor within the delay still finds those textures loading, because
  // this flips true on its own rather than waiting on where they walk.
  //
  // The head start is measured from *the entry room finishing*, not from a
  // fixed delay after mount. It used to be a flat 600ms, which on a phone is
  // long before the entry room's own textures are anywhere near done — so the
  // wave it releases competed with them for the same ~6 connections, which is
  // the exact contention the paragraph above says this exists to prevent.
  //
  // It also broke MuseumClient's EntryLoadGate. That overlay waits for
  // THREE.DefaultLoadingManager to fall idle, and the manager cannot tell the
  // entry room's assets apart from every other room's — so releasing the far
  // wave at 600ms folded the whole museum into the batch the gate was waiting
  // on, and a visitor sat behind the loading bar until *every* room had
  // downloaded. That read as "it hangs, and only a refresh fixes it": on the
  // second load every file is served from the browser cache (uploads carry a
  // one-year Cache-Control, see lib/storage/server.ts) so the same wait
  // collapses to nothing.
  //
  // Keying off the manager going idle fixes both: the entry room loads
  // uncontended, the gate lifts on that alone, and the rest streams in behind
  // it while the visitor is already walking around.
  const { active: assetsLoading } = useProgress();
  const loadingStartedRef = useRef(false);
  if (assetsLoading) loadingStartedRef.current = true;

  const [farTexturesReady, setFarTexturesReady] = useState(false);
  useEffect(() => {
    // Ceiling, for the museum that never registers a load at all (every room
    // on plain colours, nothing to fetch) and for a stalled request that keeps
    // the manager permanently busy. Neither should mean the far rooms stay
    // flat forever.
    const ceiling = setTimeout(() => setFarTexturesReady(true), FAR_TEXTURE_CEILING_MS);
    return () => clearTimeout(ceiling);
  }, []);
  useEffect(() => {
    if (farTexturesReady || !loadingStartedRef.current || assetsLoading) return;
    // Same settle the gate uses, and deliberately longer than it: the manager
    // reports idle in the gap between two bursts as readily as at the end of
    // one, and this should land *after* the overlay has lifted rather than
    // adding a new wave to the batch the gate is still measuring.
    const timer = setTimeout(() => setFarTexturesReady(true), FAR_TEXTURE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [assetsLoading, farTexturesReady]);

  const roomRenderLayouts = useMemo(
    () => [...layouts].sort((a, b) => (nearbyRoomIds.has(a.room.id) ? 0 : 1) - (nearbyRoomIds.has(b.room.id) ? 0 : 1)),
    [layouts, nearbyRoomIds]
  );
  // Bridge refs between TouchControls.tsx (an HTML sibling of <Canvas>) and
  // PlayerControls.tsx (inside it) — see TouchControls.tsx's docstring.
  const moveRef = useRef({ x: 0, y: 0 });
  const lookRef = useRef({ x: 0, y: 0 });
  // A discrete tap flag (not a held/analog value) — see TouchControls.tsx's
  // jump button and PlayerControls.tsx's jumpRef doc comments.
  const jumpRef = useRef(false);
  // The player rig — see PlayerRig.tsx and Docs/Museum_VRMode.md §2.
  // PlayerControls.tsx writes position here instead of onto the camera
  // directly; the camera below is its child and only ever has its rotation
  // touched (PointerLockControls / the touch look path), never its position.
  const rigRef = useRef<THREE.Group>(null);

  // Dev-only: a window handle the headless verification script reads (rig
  // position, what's in [E] range, what's held / on the deck). Never set in
  // production builds.
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const w = window as unknown as { __museumDebug?: () => unknown };
    w.__museumDebug = () => ({
      x: rigRef.current?.position.x ?? null,
      z: rigRef.current?.position.z ?? null,
      vinylTarget: activeVinylTarget?.kind === "sleeve" ? `sleeve:${activeVinylTarget.entry.vinyl.title}` : activeVinylTarget?.kind ?? null,
      held: heldVinyl?.title ?? null,
      deck: deckVinyl?.title ?? null,
      playing: deckState.playing,
      currentTime: deckState.currentTime,
      duration: deckState.duration,
      error: deckState.error,
      line: lyricsWallState.currentLine,
      effects: vinylEffects,
    });
    return () => {
      delete w.__museumDebug;
    };
  }, [activeVinylTarget, heldVinyl, deckVinyl, deckState, lyricsWallState, vinylEffects]);

  // Where a 360° share is taken from: the rig's own position — the visitor
  // frames the shot by walking to a spot, the same way [R] frames a flat
  // one — tagged with the room they're in for the file name and deep link.
  // Room identity comes from the *rig's* z, not currentRoomId: that state
  // updates on PlayerControls' next report, and this is read at click time.
  // Lights the whole corridor for the shot. Point lights are normally
  // gated to the current room ± 1 — right for walking, since anything
  // further is behind a doorway or two, but a 360° sees down the corridor
  // in both directions at once, and a room two doorways away lit by
  // ambient alone is a dark rectangle in the photo. Two animation frames
  // is enough for React to commit the extra lights and R3F to draw them
  // once; far artworks that haven't fetched yet show their light
  // placeholder plane, which reads fine at that distance (and see
  // capturing360 above for why their loads are left alone). Reverted the
  // moment the cube render is done.
  const prepareShare360 = useCallback(async () => {
    setCapturing360(true);
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    return () => setCapturing360(false);
  }, []);

  const getShare360Eye = useCallback((): CaptureEye | null => {
    const rig = rigRef.current;
    if (!rig) return null;
    const layout = getLayoutAtZ(layouts, rig.position.z);
    if (!layout) return null;
    return { position: rig.position.clone(), slug: layout.room.slug };
  }, [layouts]);

  // The XR store — Docs/Museum_VRMode.md's Phase 3. Created once per mount,
  // not per render; `foveation` is the one performance lever worth setting
  // up front (Phase 5) since it costs nothing to a visitor who never
  // touches VR at all and needs no runtime measurement to be a safe
  // default, unlike frameBufferScaling/dpr, which the doc's own Phase 5
  // section says need real headset measurement this environment can't do.
  const xrStore = useMemo(() => createXRStore({ foveation: 0.5 }), []);

  // `vrMode` (the button) drives the session; the session's *actual* state
  // is reported back out below, independently — see onVrPresentingChange's
  // doc comment on why these two can disagree.
  useEffect(() => {
    if (vrMode) {
      xrStore.enterVR().catch(() => {
        // Rejected (permission denied, no runtime, visitor backed out of
        // the browser's own prompt) — the subscription below still syncs
        // `vrMode` back to false since no session ever started.
      });
    } else if (xrStore.getState().session) {
      xrStore.getState().session?.end();
    }
  }, [vrMode, xrStore]);

  useEffect(() => {
    if (!onVrPresentingChange) return;
    return xrStore.subscribe((state) => onVrPresentingChange(state.session != null));
  }, [xrStore, onVrPresentingChange]);

  // This component's own copy of "is a session actually presenting", for
  // gating handleActivate/the DOM panels/the perf profile below. Can't use
  // `useXR()` for this — that hook only works *inside* the `<XR>` element
  // this component renders further down its own JSX, not in this same
  // component's top-level body — so it subscribes to the vanilla store
  // directly instead, the same way onVrPresentingChange does.
  const [isPresenting, setIsPresenting] = useState(false);
  useEffect(() => xrStore.subscribe((state) => setIsPresenting(state.session != null)), [xrStore]);

  const handleActiveChange = useCallback((index: number | null) => setActiveIndex(index), []);
  const handleRoomChange = useCallback(
    (roomId: string) => {
      setCurrentRoomId(roomId);
      onRoomChange?.(roomId);
    },
    [onRoomChange]
  );

  // [E] (or its touch button) both opens *and* closes the panel now — press
  // it again while already open to dismiss, same as walking away does.
  // Artworks and certificates are checked independently (both can never be
  // active at once in practice — the About room carries zero
  // MuseumRoomArtwork entries, see AboutRoomContents.tsx's class doc — but
  // artwork wins the tie if that ever changed) rather than merging them
  // into one list, since they're different shapes with different panels.
  // Opening a panel hands the mouse back. On desktop the museum holds pointer
  // lock so mouse movement turns the camera, which also means there is no
  // visible cursor — so a panel with buttons in it ("View in Gallery", the
  // reader's page arrows) opened over a locked pointer can be looked at but
  // not clicked. Releasing the lock is the same thing Esc already does, so
  // PlayerControls' existing unlock path (and its re-lock cooldown) handles
  // the rest; clicking the scene again after closing re-locks as before.
  // No-op on touch, which never locks in the first place.
  const releasePointer = useCallback(() => {
    if (typeof document !== "undefined" && document.pointerLockElement) {
      document.exitPointerLock();
    }
  }, []);

  const handleActivate = useCallback(() => {
    // A running mini-game round owns the screen and its own keys — [E] must
    // not reopen the preview modal underneath it.
    if (playingGame) return;
    if (panelArtwork) setPanelArtwork(null);
    else if (panelCert) setPanelCert(null);
    else if (panelStory) setPanelStory(null);
    else if (panelCosplay) setPanelCosplay(null);
    else if (panelDeck) setPanelDeck(false);
    else if (panelGame) setPanelGame(null);
    else if (panelGigs) setPanelGigs(false);
    else if (panelContact) setPanelContact(false);
    // Every branch below is the same in and out of VR: the panel state it
    // sets is rendered by a DOM modal outside a session and by that modal's
    // in-world mirror inside one (see the <XR> block and VrUi.tsx). A
    // session ended mid-panel simply hands the same open panel to the DOM.
    else if (activeArcadeGame) {
      releasePointer();
      // The full public game payload already travelled with the room — see
      // page.tsx's arcade block — so opening costs no request.
      setPanelGame(activeArcadeGame.game);
    }
    else if (activeGigs) {
      releasePointer();
      setPanelGigs(true);
    }
    else if (activeContact) {
      releasePointer();
      setPanelContact(true);
    }
    else if (activeIndex !== null) {
      releasePointer();
      setPanelArtwork(artworks[activeIndex]);
      setPanelIsListing(servicesRoomId != null && roomIds[activeIndex] === servicesRoomId);
      // Digital Museum Achievements' "views" counter — fires on the actual
      // open, not just walking into proximity range (activeIndex going
      // non-null on its own doesn't mean they looked at it).
      onArtworkViewed?.();
    } else if (activeCert) {
      releasePointer();
      setPanelCert(activeCert);
    } else if (activePodium) {
      releasePointer();
      // The full story payload (pages included) already travelled with the
      // room — see STORY_SELECT in page.tsx — so opening costs no request,
      // same as every other panel here.
      const entry = storiesLayout?.room.stories.find((e) => e.entryId === activePodium.entryId);
      if (entry) setPanelStory(entry.story);
    } else if (activeStandee) {
      releasePointer();
      // Both photos and every credit line already travelled with the room (see
      // COSPLAY_SELECT in page.tsx), so this too costs no request.
      const entry = cosplayLayout?.room.cosplays.find((e) => e.entryId === activeStandee.entryId);
      if (entry) setPanelCosplay(entry.cosplay);
    } else if (activeVinylTarget?.kind === "sleeve") {
      const sleeve = activeVinylTarget.entry.vinyl;
      if (heldVinyl && heldVinyl.entryId === sleeve.entryId) {
        // Put it back where it came from.
        setHeldVinyl(null);
      } else if (!heldVinyl && !takenEntryIds.has(sleeve.entryId)) {
        // Take it off the wall — the held-item HUD shows it from here.
        setHeldVinyl(sleeve);
      }
      // Holding a different record, or this one is on the deck: nothing to do
      // at this sleeve (the prompt already says so).
    } else if (activeVinylTarget?.kind === "deck") {
      if (heldVinyl) {
        // Put it on — and play. The click/keypress that got us here is the
        // user gesture the AudioContext needs.
        const record = heldVinyl;
        const player = getVinylPlayer();
        if (deckVinyl) {
          // Swap: the record already on the deck goes back to the wall.
          player.stop();
        }
        setHeldVinyl(null);
        setDeckVinyl(record);
        player.load(record.audioUrl);
        player.setEffects(vinylEffects);
        pauseMuseumMusicForVinyl();
        void player.play();
        releasePointer();
        setPanelDeck(true);
      } else if (deckVinyl) {
        releasePointer();
        setPanelDeck(true);
      }
      // Empty deck, empty hands: nothing to do.
    }
  }, [panelArtwork, panelCert, panelStory, panelCosplay, panelDeck, panelGame, playingGame, panelGigs, activeGigs, panelContact, activeContact, activeArcadeGame, activeIndex, artworks, activeCert, activePodium, storiesLayout, activeStandee, cosplayLayout, activeVinylTarget, heldVinyl, deckVinyl, takenEntryIds, vinylEffects, getVinylPlayer, onArtworkViewed, roomIds, servicesRoomId, releasePointer]);

  // Report the starting room immediately — PlayerControls' onRoomChange
  // only fires on a *change*, so without this the HUD wouldn't know the
  // spawn room until the visitor's first step.
  useEffect(() => {
    if (entryLayout) onRoomChange?.(entryLayout.room.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Never hijack a keystroke meant for a text field — the Achievement
      // claim form's Name/Email inputs (AchievementBanner.tsx) sit on top
      // of this same scene, and any letter in what someone types could
      // otherwise double as a shortcut (typing an email with an "r" and
      // an "m" in it, e.g. "jryan.briz@gmail.com", was triggering Save
      // Photo [R] and Map [M] mid-keystroke).
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      // While a mini-game round is open (GameSession, z-[80]) the museum's
      // shortcuts ([L] dark mode, [M] map, [R] screenshot, …) are out of
      // scope — the round has its own keys.
      if (playingGame) return;
      if (e.code === "KeyE") handleActivate();
      else if (e.code === "KeyL") onToggleDarkMode?.();
      else if (e.code === "KeyM") onToggleMap?.();
      else if (e.code === "KeyH") onToggleHud?.();
      else if (e.code === "KeyR") captureRef?.current?.();
      else if (e.code === "KeyQ") onCycleVisionFilter?.();
      else if (e.code === "KeyV") onToggleVrMode?.();
      // Only while already unlocked — the Esc press that *causes* the
      // unlock is consumed by the Pointer Lock API itself, not seen here.
      else if (e.code === "Escape" && !locked) setLegendDismissed((prev) => !prev);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleActivate, onToggleDarkMode, onToggleMap, onToggleHud, onCycleVisionFilter, onToggleVrMode, captureRef, locked, playingGame]);

  // Re-arm the legend for next time the moment the pointer locks again, so
  // walking away and re-locking doesn't leave it permanently dismissed.
  useEffect(() => {
    if (locked) setLegendDismissed(false);
  }, [locked]);

  // Walking far enough away from the open artwork's frame (or certificate)
  // closes its panel on its own — activeIndex/activeCert going null is
  // exactly PlayerControls'/AboutRoomContents' existing proximity-exit
  // signal, so this reuses it rather than tracking a second distance check.
  useEffect(() => {
    if (activeIndex === null) setPanelArtwork(null);
  }, [activeIndex]);
  useEffect(() => {
    if (activePodium === null) setPanelStory(null);
  }, [activePodium]);
  useEffect(() => {
    if (activeStandee === null) setPanelCosplay(null);
  }, [activeStandee]);
  // Walking away from the deck closes its panel — the record keeps playing.
  useEffect(() => {
    if (activeVinylTarget?.kind !== "deck") setPanelDeck(false);
  }, [activeVinylTarget]);
  // Walking away from a cabinet closes its info panel — but never mid-round
  // (a running GameSession owns the screen; the visitor isn't walking).
  useEffect(() => {
    if (activeArcadeGame === null && !playingGame) setPanelGame(null);
  }, [activeArcadeGame, playingGame]);
  useEffect(() => {
    if (activeCert === null) setPanelCert(null);
  }, [activeCert]);

  // Custom scene objects (Museum Scene Editor) — any room can have a few.
  // Split by kind: "custom" = 3D .glb prop; "text" = admin-authored text
  // label; the Freedom Wall plaque gets its own dedicated render (see
  // FreedomWallPlaque) rather than sharing the generic text pipeline — its
  // content always tracks the active event, not admin-typed text; and the
  // respawn room's wall clock gets its own too, since it is drawn by code
  // rather than loaded from a model. Same room-local-to-world conversion as
  // everything else here.
  const {
    modelPlacements,
    textPlacements,
    bannerPlacements,
    sceneBannerPlacements,
    clockPlacements,
    dividerPlacements,
  } = useMemo(() => {
    // `scale` only matters for the .glb props in modelList — text labels and
    // the Freedom Wall banner size via their own JSON config — but the shared
    // `entry` below is pushed into whichever list matches, so all three carry
    // the field.
    const modelList:  { id: string; modelUrl: string; position: [number, number, number]; rotationY: number; scale: number }[] = [];
    const textList:   { id: string; modelUrl: string; position: [number, number, number]; rotationY: number; scale: number }[] = [];
    const bannerList: { id: string; modelUrl: string; position: [number, number, number]; rotationY: number; scale: number }[] = [];
    // Admin-placed banners. Same code-drawn-from-config story as a divider,
    // so a separate list from the .glb props for the same reason.
    const sceneBannerList: { id: string; modelUrl: string; position: [number, number, number]; rotationY: number; scale: number }[] = [];
    // The wall clock in the visitor's respawn room. Carries its room's id as
    // well, because unlike everything else here it has to know whether the
    // visitor is anywhere near: a clock rooms away has nothing to keep in
    // time (see WallClock's `ticking`).
    const clockList: { id: string; roomId: string; modelUrl: string; position: [number, number, number]; rotationY: number; scale: number }[] = [];
    // Divider walls. Carries its room's id for the same reason the clock does
    // — its uploaded surface texture is gated behind the nearby-room check,
    // like every other texture in the museum.
    const dividerList: { id: string; roomId: string; modelUrl: string; position: [number, number, number]; rotationY: number; scale: number }[] = [];
    for (const layout of layouts) {
      for (const object of layout.room.customObjects) {
        const entry = {
          id: object.id,
          modelUrl: object.modelUrl,
          position: [object.positionX, object.positionY + layout.floorYSouth, object.positionZ + layout.centerZ] as [number, number, number],
          rotationY: object.rotationY,
          scale: object.scale,
        };
        if (object.kind === "text") textList.push(entry);
        // A divider is a wall, not a prop: it is drawn by code from its own
        // config (see lib/museum/wallDivider.ts) rather than loaded as a
        // model, so it gets its own list like the plaque and the clock do.
        else if (object.kind === DIVIDER_KIND) dividerList.push({ ...entry, roomId: layout.room.id });
        else if (object.kind === FREEDOM_WALL_BANNER_KIND) bannerList.push(entry);
        // A banner is the Freedom Wall's plaque made general — code-drawn
        // from its own config JSON (see lib/museum/sceneBanner.ts), so it
        // gets its own list rather than being loaded as a model.
        else if (object.kind === BANNER_KIND) sceneBannerList.push(entry);
        // The About room's own clock never reaches this list (page.tsx keeps
        // it out — that room draws its contents itself), so this only ever
        // renders the respawn room's.
        else if (object.kind === ABOUT_CLOCK_KIND) clockList.push({ ...entry, roomId: layout.room.id });
        // Configuration, not a placement — the Stories Room's pedestal model,
        // the Cosplay Room's standee/backdrop, the room-wide plaque style.
        // Each describes how the room draws something else and stands nowhere
        // itself; without this skip the catch-all below would render it as a
        // stray .glb at the room's origin. See lib/museum/sceneObjectKinds.ts,
        // which the minimap's own list reads from too so the two can't drift.
        else if (isConfigOnlyKind(object.kind)) continue;
        else modelList.push(entry);
      }
    }
    return {
      modelPlacements: modelList,
      textPlacements: textList,
      bannerPlacements: bannerList,
      sceneBannerPlacements: sceneBannerList,
      clockPlacements: clockList,
      dividerPlacements: dividerList,
    };
  }, [layouts]);

  // Divider walls as rectangular barriers (PlayerControls' `barriers`) —
  // the only obstacle in the museum that isn't a circle, because a partition
  // wall isn't one. A divider is solid unless its own toggle says otherwise;
  // a walk-through one is a visual screen, so it contributes nothing here.
  const dividerBarriers = useMemo(() => {
    const out: { x: number; z: number; halfWidth: number; halfDepth: number; rotationY: number }[] = [];
    for (const divider of dividerPlacements) {
      const cfg = parseWallDividerConfig(divider.modelUrl);
      if (!cfg.solid) continue;
      out.push({
        x: divider.position[0],
        z: divider.position[2],
        halfWidth: cfg.width / 2,
        halfDepth: cfg.thickness / 2,
        rotationY: divider.rotationY,
      });
    }
    return out;
  }, [dividerPlacements]);

  // Where Chase Companions idle when no visitor is nearby — all spread
  // around the entry room's own center (falling back to the very first
  // room in corridor order if, somehow, no room is marked as the entry
  // room), same room-local-to-world Z conversion as every other per-room
  // placement above. Recomputed only when the layout chain itself
  // changes, not every frame — ChaseCompanion.tsx owns its own continuous
  // drift from there.
  const chaseCompanionOrigins = useMemo((): [number, number, number][] => {
    const entryLayout = layouts.find((l) => l.room.isEntryRoom) ?? layouts[0];
    const centerZ = entryLayout?.centerZ ?? 0;
    return CHASE_ORIGIN_OFFSETS.map(([x, z]) => [x, 1, centerZ + z] as [number, number, number]);
  }, [layouts]);

  // MiniMapHud.tsx's companion dots — each ChaseCompanion.tsx instance
  // writes its own live world position into its own Vector3 here every
  // frame (see that file's positionRef prop); MiniMapTracker.tsx reads the
  // whole map each frame to plot however many are actually in the current
  // room. Plain ref (not state) for the same reason every other per-frame
  // value in this file is — this would otherwise re-render on every tick.
  const companionPositionRefs = useRef<Map<string, THREE.Vector3>>(new Map());
  function getCompanionPositionRef(id: string) {
    let ref = companionPositionRefs.current.get(id);
    if (!ref) {
      ref = new THREE.Vector3();
      companionPositionRefs.current.set(id, ref);
    }
    return { current: ref };
  }

  // "Title · Medium · Year" (whichever of those exist) for the approach
  // prompt's subtitle — a lighter version of ArtworkInfoPanel's plaque,
  // visible before the visitor has even opened the artwork. The 🎬 suffix
  // is the only hint a video exists *before* pressing [E] — the museum
  // wall itself only ever shows the static image (see MuseumArtwork's
  // videoUrl comment in types/index.ts), so without this a visitor would
  // have no reason to expect one inside the panel.
  const activeLabel = useMemo(() => {
    if (activeIndex === null) return undefined;
    const artwork = artworks[activeIndex];
    if (!artwork) return undefined;
    const base = [artwork.title, artwork.medium, artwork.year].filter(Boolean).join(" · ");
    return artwork.videoUrl ? `${base} · 🎬` : base;
  }, [activeIndex, artworks]);

  // Same idea for a certificate's approach prompt — "Title · Issuer".
  const activeCertLabel = useMemo(() => {
    if (!activeCert) return undefined;
    return [activeCert.title, activeCert.issuer].filter(Boolean).join(" · ");
  }, [activeCert]);

  // The [E] prompt, resolved once for both of its renderers — the DOM
  // InteractionPrompt below and, while presenting, VrInteractionPrompt
  // inside the canvas (a headset never sees the DOM one). One resolution
  // so the two can never disagree about what's on offer or what it's
  // called. `promptTarget` is "is anything in range with nothing open";
  // the DOM pill additionally hides behind hudHidden and waits for pointer
  // lock, neither of which exists in VR.
  const anyPanelOpen = Boolean(
    panelArtwork || panelCert || panelStory || panelCosplay || panelDeck || panelGame || playingGame || panelGigs || panelContact
  );
  // What [E] would do at the Vinyl Room's sleeve or deck right now — null
  // when nothing (empty deck with empty hands; a sleeve whose record is out
  // and isn't the one in hand), so the prompt doesn't offer a dead press.
  const vinylPrompt: { label: string; title: string } | null = (() => {
    if (!activeVinylTarget) return null;
    if (activeVinylTarget.kind === "sleeve") {
      const sleeve = activeVinylTarget.entry.vinyl;
      if (heldVinyl?.entryId === sleeve.entryId) return { label: "Put Back", title: sleeve.title };
      if (heldVinyl) return null;
      if (takenEntryIds.has(sleeve.entryId)) return { label: "On the deck", title: sleeve.title };
      return { label: "Take Record", title: sleeve.title };
    }
    if (heldVinyl) return { label: deckVinyl ? "Swap Record" : "Put On", title: heldVinyl.title };
    if (deckVinyl) return { label: "Open Deck", title: deckVinyl.title };
    return { label: "Turntable", title: "Bring a record from the wall" };
  })();
  const promptTarget =
    !anyPanelOpen &&
    (activeIndex !== null || activeCert !== null || activePodium !== null || activeStandee !== null || activeArcadeGame !== null || vinylPrompt !== null || activeGigs || activeContact);
  const promptLabel = activeCert
    ? "View Certificate"
    : activePodium
      ? "Read Tale"
      : activeStandee
        ? "View Cosplay"
        : vinylPrompt
          ? vinylPrompt.label
        : activeArcadeGame
          ? "View Game"
          : activeGigs
            ? "Explore Gigs"
            : activeContact
              ? contactConfig.promptLabel
              : activeIndex !== null && servicesRoomId != null && roomIds[activeIndex] === servicesRoomId
                ? "View Product"
                : "View Artwork";
  const promptTitle = activeCert
    ? activeCertLabel
    : activePodium
      ? activePodium.story.title
      : activeStandee
        // The character, then what they're from — the same two lines the
        // standee's own plaque carries, so the prompt confirms what the
        // visitor is already reading rather than naming it differently.
        ? [activeStandee.cosplay.character || activeStandee.cosplay.title, activeStandee.cosplay.series]
            .filter(Boolean)
            .join(" · ")
        : vinylPrompt
          ? vinylPrompt.title
        : activeArcadeGame
          ? activeArcadeGame.display.title
          : activeGigs
            ? "Timeline & Gigs"
            : activeContact
              ? contactConfig.title
              : activeIndex !== null
                ? activeLabel
                : undefined;

  return (
    <div className="relative w-full h-full">
      <Canvas
        // No `camera` prop here anymore — the camera is declared explicitly
        // below, as a child of PlayerRig, so its *position* is local to the
        // rig instead of world space (see Docs/Museum_VRMode.md §2/§3.1).
        // Its fov/near/far stay exactly what this prop used to set.
        // preserveDrawingBuffer: WebGL clears/swaps its drawing buffer after
        // each frame by default (a perf optimization) — without this, a
        // capture via ScreenshotCapture.tsx's toDataURL() would read back
        // an already-cleared (blank/black) buffer instead of the last
        // rendered frame. Small, standard trade-off for a screenshot feature.
        // Three context-creation options that can only be chosen once, up
        // front — see lib/museum/deviceTier.ts for why they can't wait for
        // PerformanceMonitor's measured verdict, and why `lowEnd` is
        // deliberately hard to trigger. Every one of these is a no-op on
        // desktop and on any current phone: `lowEnd` is false there, so this
        // reads exactly as it did before.
        //
        //  - antialias: MSAA costs extra samples on every pixel. At the 2–3x
        //    pixel density of a phone screen it buys almost nothing visually,
        //    and it's the single most expensive thing here for a weak GPU.
        //  - preserveDrawingBuffer: forces the browser to keep the drawing
        //    buffer alive after compositing instead of discarding it, which
        //    blocks driver optimisations and costs bandwidth *every frame* —
        //    all to serve one button. ScreenshotCapture.tsx now renders
        //    explicitly right before it reads the pixels, so captures work
        //    with this off; it stays on elsewhere purely to avoid changing
        //    anything about a device that isn't struggling.
        gl={{
          antialias: !lowEnd,
          powerPreference: "high-performance",
          preserveDrawingBuffer: !lowEnd,
        }}
        // The ceiling, not a fixed value — AdaptiveDpr still scales within
        // this range. Capping at 1.5 rather than 2 cuts an old phone's
        // fragment work by ~44% before it has had a chance to stutter, where
        // AdaptiveDpr only reacts after it already has.
        //
        // Not extended with an isPresenting case for Phase 5: this dpr prop
        // sizes the ordinary 2D canvas, not a session's per-eye render
        // target — that's `frameBufferScaling` (a createXRStore option, see
        // the xrStore useMemo above), which the doc's own Phase 5 section
        // says needs real headset measurement to size correctly, not a
        // guessed number. `foveation` is the one XR-specific lever set
        // there, since it's safe without that measurement.
        dpr={lowEnd ? [1, 1.5] : [1, 2]}
        // offsetSize makes R3F measure this canvas's box with
        // offsetWidth/offsetHeight instead of getBoundingClientRect(), and
        // that difference is the whole reason the half-black screen kept
        // coming back after it was first fixed.
        //
        // R3F auto-sizes the renderer from a ResizeObserver (plus window
        // resize and scroll) on the canvas's own wrapper. getBoundingClientRect
        // reports the *transformed*, screen-space box, so under
        // MuseumClient.tsx's forced-landscape rotate(90deg) it hands back the
        // rotated footprint — width and height swapped relative to the actual
        // layout box — and R3F then calls gl.setSize() with them, undoing
        // CanvasResizeSync below and blacking out the part of the screen the
        // undersized canvas no longer covers.
        //
        // That's why it was intermittent and why toggling orientation cleared
        // it: nothing was wrong until something made the observer fire again
        // (opening a modal, the soft keyboard resizing the viewport, the
        // Android URL bar collapsing on scroll), and flipping orientation
        // changed viewportPx, which re-ran CanvasResizeSync and put the right
        // size back until the next observer tick. offsetWidth/offsetHeight are
        // layout values that ignore transforms entirely, so R3F's own
        // measurement now agrees with ours instead of fighting it.
        resize={{ offsetSize: true }}
      >
      {/* Docs/Museum_VRMode.md Phase 3 — everything the museum renders lives
          inside <XR>, whether or not a session is ever started. <XR> is a
          no-op wrapper outside a session (see @react-three/xr's own source);
          nothing here behaves differently until a visitor actually enters. */}
      <XR store={xrStore}>
        <CanvasResizeSync width={viewportSize?.w} height={viewportSize?.h} />
        {/* The rig PlayerControls.tsx drives; the camera is its child and
            stays at local (0, 0, 0) — position lives entirely on the rig
            (see PlayerRig.tsx). Initial position here only covers the very
            first frame, before PlayerControls' spawn effect runs, mirroring
            the old <Canvas camera={{ position }}> prop this replaces. */}
        <PlayerRig ref={rigRef} position={[0, EYE_HEIGHT, spawnZ]}>
          <PerspectiveCamera makeDefault fov={70} near={0.1} far={100} />
        </PlayerRig>
        {captureRef && (
          <ScreenshotCapture
            captureRef={captureRef}
            logoUrl={aboutData?.logoImage}
            isCoarsePointer={isCoarsePointer}
            filterCss={activeFilterCss}
          />
        )}
        {share360Ref && (
          <Room360Capture shareRef={share360Ref} getEye={getShare360Eye} prepare={prepareShare360} lowEnd={lowEnd} filterCss={activeFilterCss} />
        )}
        {/* Perf regression trio — all read/drive R3F's own internal
            `state.performance`, not a device/UA sniff: PerformanceMonitor
            watches real frame timing and calls regress() when it's
            struggling; AdaptiveDpr answers by rendering at a lower
            resolution (the single biggest lever for a light-heavy scene —
            fewer pixels means fewer per-fragment light calculations too);
            AdaptiveEvents thins out pointer-move raycasting the same way.
            A capable desktop or phone never regresses, so full quality
            stays exactly as designed there. */}
        <PerformanceMonitor
          onDecline={() => setLowPower(true)}
          onIncline={() => setLowPower(false)}
          onFallback={() => setLowPower(true)}
        />
        <AdaptiveDpr pixelated />
        <AdaptiveEvents />
        <color attach="background" args={[darkMode ? SCENE_BACKGROUND_DARK : SCENE_BACKGROUND_LIGHT]} />
        {roomRenderLayouts.map((layout) => (
          <MuseumRoom
            key={layout.room.id}
            roomType={layout.room.roomType}
            depth={layout.depth}
            centerZ={layout.centerZ}
            floorYSouth={layout.floorYSouth}
            floorYNorth={layout.floorYNorth}
            hasNorthOpening={layout.hasNorthOpening}
            hasSouthOpening={layout.hasSouthOpening}
            wallColor={layout.room.wallColor}
            floorColor={layout.room.floorColor}
            ceilingColor={layout.room.ceilingColor}
            wallTexture={layout.room.wallTexture}
            floorTexture={layout.room.floorTexture}
            ceilingTexture={layout.room.ceilingTexture}
            lightColor={layout.room.lightColor}
            lightScale={layout.room.lightScale}
            lightModelUrl={layout.room.lightModelUrl}
            darkMode={darkMode}
            brightness={darkMode ? brightnessDark : brightnessLight}
            lightsEnabled={nearbyRoomIds.has(layout.room.id) || capturing360}
            // Ambient/hemisphere are scene-global, so exactly one room may
            // contribute them — the one the visitor is in (the spawn room
            // until PlayerControls reports in). See MuseumRoom's prop doc for
            // the twelve-fold over-lighting this replaces.
            ambientEnabled={layout.room.id === (currentRoomId ?? entryLayout?.room.id)}
            // Halves this room's point lights (4 -> 2, see MuseumRoom.tsx).
            // Point lights are the dominant per-fragment cost in the whole
            // scene, so this is the biggest single lever available at runtime.
            //
            // Was `lowPower && layout.room.id === currentRoomId`, which
            // reduced lights in exactly one room — the one the visitor is
            // standing in and looking at — while every *other* lit room
            // (lightsEnabled covers the current room plus one on each side,
            // so up to three are lit at once) stayed at full count. That
            // spent the visual cost where it showed most and saved the least.
            // Applying it to every lit room instead roughly halves the total
            // light count for the same trade.
            //
            // `lowPower` is measured, not guessed, so a capable device only
            // reaches this if it genuinely dropped frames, and recovers via
            // PerformanceMonitor's onIncline. `lowEnd` additionally starts an
            // old phone here rather than making it stutter first. `isPresenting`
            // does the same unconditionally — Docs/Museum_VRMode.md's Phase 5:
            // stereo rendering (two views, every point light's per-fragment
            // cost effectively doubled) at 72-90Hz is a far tighter budget
            // than a single 2D view ever was, tight enough that it isn't
            // worth waiting for PerformanceMonitor to actually observe the
            // drop first.
            quality={lowPower || lowEnd || isPresenting ? "low" : "full"}
            // Wall/floor/ceiling textures: always load eagerly for all rooms —
            // they're at most 3 textures per room, downscaled to ≤1024px and
            // cache-deduplicated by loadDownscaledTexture, so loading them all
            // upfront is cheap. The old nearbyRoomIds gate caused textures to
            // stay white when a visitor teleported past a room (shouldLoad
            // stayed false until they physically walked in). lightsEnabled above
            // still restricts the expensive per-fragment point lights to nearby
            // rooms only — that gate is unchanged.
            // Near rooms immediately; everything else a beat later, so the
            // room the visitor is standing in isn't queued behind the whole
            // corridor. See farTexturesReady above.
            shouldLoad={nearbyRoomIds.has(layout.room.id) || farTexturesReady}
          />
        ))}
        {/* Glass doors — one per internal doorway (rooms that connect north).
            Purely visual; collision is handled by PlayerControls.tsx. */}
        {layouts
          .filter((l) => l.hasNorthOpening)
          .map((l) => (
            <GlassDoorway
              key={`glass-door-${l.room.id}`}
              doorZ={l.northZ}
              baseY={l.floorYNorth}
              darkMode={darkMode}
            />
          ))}
        {/* Every room's contents below sit behind their own <Suspense>. drei's
            <Text> *suspends* (suspend-react) the first time it meets a font +
            characters pair it hasn't preloaded, and the room contents mount
            their plaques lazily as the visitor approaches — so the first walk
            into, say, the Tales Room threw a suspension with no boundary
            nearer than MuseumSceneLoader's dynamic import. That showed the
            museum's loading screen mid-walk and remounted the whole scene,
            which put the visitor back at the spawn point; the second visit
            was fine only because the font was cached by then. A boundary per
            room keeps a late font load to a blink of that room's own props. */}
        {artworks.map((artwork, i) => (
          <ArtworkFrame
            key={keys[i]}
            artwork={artwork}
            placement={placements[i]}
            active={activeIndex === i}
            scale={scales[i]}
            shouldLoad={nearbyRoomIds.has(roomIds[i])}
            shimmer={artworkShimmer}
          />
        ))}
        {modelPlacements.map((o) => (
          <group key={o.id} position={o.position} rotation={[0, o.rotationY, 0]}>
            <CustomSceneObject url={o.modelUrl} scale={o.scale} recenter />
          </group>
        ))}
        {/* Divider walls — admin-placed partitions that reshape a room (see
            lib/museum/wallDivider.ts). Solid ones also feed dividerBarriers
            above, so a visitor is stopped by the same panel they can see. */}
        {dividerPlacements.map((o) => (
          <WallDivider
            key={o.id}
            config={parseWallDividerConfig(o.modelUrl)}
            position={o.position}
            rotationY={o.rotationY}
            shouldLoad={nearbyRoomIds.has(o.roomId)}
          />
        ))}
        {/* The respawn room's wall clock — the same fixture the About room
            hangs, drawn from the same component and configured from the same
            Scene Editor panel. `ticking` follows the nearby-room gate every
            other per-room cost here uses: a clock the visitor is nowhere near
            has nothing to keep in time, and it catches up the instant they
            walk back in. */}
        {clockPlacements.map((o) => (
          <group key={o.id} position={o.position} rotation={[0, o.rotationY, 0]} scale={o.scale}>
            <Suspense fallback={null}>
              <WallClock
                config={parseWallClockConfig(o.modelUrl)}
                ticking={nearbyRoomIds.has(o.roomId)}
              />
            </Suspense>
          </group>
        ))}
        {textPlacements.map((o) => {
          const cfg = parseTextConfig(o.modelUrl);
          return (
            <group key={o.id} position={o.position} rotation={[0, o.rotationY, 0]} scale={o.scale}>
              <Text
                fontSize={cfg.fontSize}
                maxWidth={cfg.maxWidth}
                color={cfg.color}
                font={cfg.fontFamily}
                anchorX="center"
                anchorY="middle"
                textAlign="center"
              >
                {cfg.text}
              </Text>
            </group>
          );
        })}
        {bannerPlacements.map((o) => (
          <FreedomWallPlaque
            key={o.id}
            title={freedomWallEventTitle ?? "Freedom Wall"}
            colors={parseBannerColors(o.modelUrl)}
            position={o.position}
            rotationY={o.rotationY}
          />
        ))}
        {sceneBannerPlacements.map((o) => {
          const cfg = parseSceneBannerConfig(o.modelUrl);
          return (
            <Suspense fallback={null} key={o.id}>
              <SceneBanner
                text={cfg.text}
                eyebrow={cfg.eyebrow}
                // Sized against the room's own width so a wide banner can't
                // overrun the walls it hangs between — see bannerWidth().
                width={bannerWidth(cfg, ROOM_WIDTH)}
                height={cfg.height}
                finish={bannerFinish(cfg)}
                textColor={cfg.textColor}
                fontFamily={cfg.fontFamily}
                fontSize={cfg.fontSize}
                position={o.position}
                rotationY={o.rotationY}
              />
            </Suspense>
          );
        })}
        {chaseCompanions?.map((companion, i) => (
          <ChaseCompanion
            key={companion.id}
            originPosition={chaseCompanionOrigins[i % chaseCompanionOrigins.length]}
            // Spreads up to 5 companions into a fan around the visitor
            // instead of converging on one spot — see ChaseCompanion.tsx's
            // angleOffset doc comment.
            angleOffset={(i / CHASE_ORIGIN_OFFSETS.length) * Math.PI * 2}
            assetType={companion.assetType}
            assetUrl={companion.assetUrl}
            layouts={layouts}
            positionRef={getCompanionPositionRef(companion.id)}
          />
        ))}
        {onStepsChange && <StepTracker onStepsChange={onStepsChange} />}
        {minimapRef && (
          <MiniMapTracker
            layouts={layouts}
            roomArtworkLocalPositions={roomArtworkLocalPositions}
            roomObjectLocalPositions={roomObjectLocalPositions}
            roomStickyNoteLocalPositions={roomStickyNoteLocalPositions}
            activeInteractId={activeInteractId}
            companionPositionRefs={companionPositionRefs}
            stateRef={minimapRef}
          />
        )}
        {aboutData && aboutLayout && (
          <Suspense fallback={null}>
            <AboutRoomContents
              data={aboutData}
              depth={aboutLayout.depth}
              centerZ={aboutLayout.centerZ}
              baseY={aboutLayout.floorYSouth}
              shouldLoad={nearbyRoomIds.has(aboutLayout.room.id)}
              onActiveCertChange={setActiveCert}
              onGigsProximityChange={(near) => setActiveGigs(near && (aboutData.gigs?.length ?? 0) > 0)}
              onContactProximityChange={setActiveContact}
              contact={aboutContact}
              clock={aboutLayout.room.aboutClock}
              blockOffsets={aboutLayout.room.aboutBlockOffsets}
              banner={bannerStyles.about}
            />
          </Suspense>
        )}
        {servicesLayout && (
          <Suspense fallback={null}>
            <ServicesRoomContents
              tags={servicesPriceTags}
              depth={servicesLayout.depth}
              centerZ={servicesLayout.centerZ}
              baseY={servicesLayout.floorYSouth}
              isEmpty={servicesLayout.room.artworks.length === 0}
              shouldLoad={nearbyRoomIds.has(servicesLayout.room.id)}
              banner={bannerStyles.services}
            />
          </Suspense>
        )}
        {storiesLayout && (
          <Suspense fallback={null}>
            <StoriesRoomContents
              podiums={storyPodiums}
              depth={storiesLayout.depth}
              centerZ={storiesLayout.centerZ}
              baseY={storiesLayout.floorYSouth}
              shouldLoad={nearbyRoomIds.has(storiesLayout.room.id)}
              activeEntryId={activePodium?.entryId ?? null}
              onActiveChange={setActivePodium}
              podiumModelUrl={podiumModel.url}
              podiumBookHeight={podiumModel.bookHeight}
              podiumTextureUrl={podiumModel.textureUrl}
              scaleFor={(entryId) =>
                storiesLayout.room.stories.find((e) => e.entryId === entryId)?.scale ?? 1
              }
              banner={bannerStyles.stories}
            />
          </Suspense>
        )}
        {arcadeLayout && (
          <Suspense fallback={null}>
            <ArcadeRoomContents
              cabinets={arcadeCabinets}
              depth={arcadeLayout.depth}
              centerZ={arcadeLayout.centerZ}
              baseY={arcadeLayout.floorYSouth}
              shouldLoad={nearbyRoomIds.has(arcadeLayout.room.id)}
              activeEntryId={activeArcadeGame?.entryId ?? null}
              onActiveChange={setActiveArcadeGame}
              scaleFor={(entryId) =>
                arcadeLayout.room.miniGames.find((e) => e.entryId === entryId)?.scale ?? 1
              }
              cabinetModel={arcadeLayout.room.arcadeCabinet}
              banner={bannerStyles.arcade}
            />
          </Suspense>
        )}
        {cosplayLayout && (
          <Suspense fallback={null}>
            <CosplayRoomContents
              standees={cosplayStandees}
              depth={cosplayLayout.depth}
              centerZ={cosplayLayout.centerZ}
              baseY={cosplayLayout.floorYSouth}
              shouldLoad={nearbyRoomIds.has(cosplayLayout.room.id)}
              activeEntryId={activeStandee?.entryId ?? null}
              onActiveChange={setActiveStandee}
              standeeModelUrl={cosplayLayout.room.cosplayStandee?.modelUrl}
              standeeCutoutHeight={cosplayLayout.room.cosplayStandee?.cutoutHeight}
              standeeTextureUrl={cosplayLayout.room.cosplayStandee?.textureUrl}
              backdropEnabled={cosplayLayout.room.cosplayStandee?.backdropEnabled}
              backdropWidth={cosplayLayout.room.cosplayStandee?.backdropWidth}
              backdropHeight={cosplayLayout.room.cosplayStandee?.backdropHeight}
              backdropFrameColor={cosplayLayout.room.cosplayStandee?.backdropFrameColor}
              backdropEdgeColor={cosplayLayout.room.cosplayStandee?.backdropEdgeColor}
              backdropEdgeThickness={cosplayLayout.room.cosplayStandee?.backdropEdgeThickness}
              banner={bannerStyles.cosplay}
              lightsStyle={cosplayLayout.room.cosplayStandee?.lightsStyle}
              lightsColor={cosplayLayout.room.cosplayStandee?.lightsColor}
              lightsIntensity={cosplayLayout.room.cosplayStandee?.lightsIntensity}
              lightsBulbSize={cosplayLayout.room.cosplayStandee?.lightsBulbSize}
              lightsSpacing={cosplayLayout.room.cosplayStandee?.lightsSpacing}
              lightsAnimation={cosplayLayout.room.cosplayStandee?.lightsAnimation}
              lightsSpeed={cosplayLayout.room.cosplayStandee?.lightsSpeed}
              // Docs/Museum_VRMode.md's Phase 5 — capped to at most 1 while
              // presenting, same reasoning as the `quality` prop above: each
              // of these is its own point/spot light, and stereo doubles
              // every one's per-fragment cost.
              floodCount={
                isPresenting
                  ? Math.min(cosplayLayout.room.cosplayStandee?.floodCount ?? 1, 1)
                  : cosplayLayout.room.cosplayStandee?.floodCount
              }
              floodBeamHeight={cosplayLayout.room.cosplayStandee?.floodBeamHeight}
              floodBeamSpread={cosplayLayout.room.cosplayStandee?.floodBeamSpread}
              scaleFor={(entryId) =>
                cosplayLayout.room.cosplays.find((e) => e.entryId === entryId)?.scale ?? 1
              }
            />
          </Suspense>
        )}
        {vinylLayout && (
          <Suspense fallback={null}>
            <VinylRoomContents
              sleeves={sleeveEntries}
              depth={vinylLayout.depth}
              centerZ={vinylLayout.centerZ}
              baseY={vinylLayout.floorYSouth}
              shouldLoad={nearbyRoomIds.has(vinylLayout.room.id)}
              config={vinylConfig}
              turntable={turntablePlacement}
              activeTarget={activeVinylTarget}
              onActiveChange={setActiveVinylTarget}
              takenEntryIds={takenEntryIds}
              deckVinyl={deckVinyl}
              deckPlaying={deckState.playing}
              deckRpm={vinylEffects.speed === 33 ? 100 / 3 : vinylEffects.speed}
              lyrics={lyricsWallState}
            />
          </Suspense>
        )}
        {freedomWallLayout && (
          <Suspense fallback={null}>
            <FreedomWallRoomContents
              notes={freedomWallNotes}
              depth={freedomWallLayout.depth}
              centerZ={freedomWallLayout.centerZ}
              baseY={freedomWallLayout.floorYSouth}
              hasNorthOpening={freedomWallLayout.hasNorthOpening}
              hasSouthOpening={freedomWallLayout.hasSouthOpening}
              shouldLoad={nearbyRoomIds.has(freedomWallLayout.room.id)}
            />
          </Suspense>
        )}
        <PlayerControls
          rigRef={rigRef}
          placements={placements}
          layouts={layouts}
          obstacles={obstacles}
          barriers={dividerBarriers}
          spawnZ={spawnZ}
          onActiveChange={handleActiveChange}
          onLockChange={setLocked}
          onRoomChange={handleRoomChange}
          isCoarsePointer={isCoarsePointer}
          moveRef={moveRef}
          lookRef={lookRef}
          jumpRef={jumpRef}
          travelRequest={travelRequest}
          // VR controller trigger -> the same activation [E]/the tap on
          // InteractionPrompt already drive outside VR — see PlayerControls'
          // onActivate doc comment for why this is needed at all (there is
          // no keyboard and no DOM overlay reaches the headset).
          onActivate={handleActivate}
          // Keeps the cursor released for as long as a panel (or the About
          // room's social drawer) is open — see PlayerControls' panelOpen.
          // The VR map counts too: a trigger press on one of its room rows
          // must not also fall through to handleActivate (see PlayerControls'
          // select handler). Outside VR mapOpen never reaches here.
          panelOpen={Boolean(panelArtwork || panelCert || panelStory || panelCosplay || panelDeck || panelGame || playingGame || panelGigs || panelContact || aboutDrawerOpen || vrHud?.mapOpen)}
        />
        {/* The VR renderer of the same panel state the DOM modals below
            render outside a session (see VrUi.tsx's header): one mirrored
            in-world panel per DOM panel, driven by the very same
            panelArtwork/panelCert/... — never a second state. Only ever
            mounted while presenting; each DOM counterpart is nulled while
            presenting in turn, further down. Closing is the panel's own ×
            (or walking away — the same proximity effects clear this state
            in VR too); the trigger/pinch that opened it is deliberately not
            a toggle while something is open, see PlayerControls' select
            handler. */}
        {isPresenting && (
          <>
            {panelArtwork && (
              <VrArtworkPanel artwork={panelArtwork} isListing={panelIsListing} onClose={() => setPanelArtwork(null)} />
            )}
            {panelCert && <VrCertificatePanel certificate={panelCert} onClose={() => setPanelCert(null)} />}
            {panelStory && <VrStoryPanel story={panelStory} onClose={() => setPanelStory(null)} />}
            {panelCosplay && <VrCosplayPanel cosplay={panelCosplay} onClose={() => setPanelCosplay(null)} />}
            {panelGame && (
              <VrGamePanel game={panelGame} howToPlay={GAME_REGISTRY[panelGame.type].howToPlay} onClose={() => setPanelGame(null)} />
            )}
            {panelGigs && aboutData && <VrGigsPanel gigs={aboutData.gigs} onClose={() => setPanelGigs(false)} />}
            {panelContact && (
              <VrContactPanel title={contactConfig.title} subtitle={contactConfig.subtitle} onClose={() => setPanelContact(false)} />
            )}
            {/* The "[E] View Artwork" pill's in-world twin — same target,
                label and name as the DOM InteractionPrompt below, minus its
                `locked` gate (there's no pointer lock in a headset). Hidden
                under the map like every other prompt is under a modal. */}
            {promptTarget && !anyPanelOpen && !vrHud?.mapOpen && !hudHidden && <VrInteractionPrompt label={promptLabel} title={promptTitle} />}
            {/* The HUD itself (VrHud.tsx) and the [M] map's in-world twin —
                both driven by MuseumClient.tsx's own state via `vrHud`, so
                the DOM HUD and this one can't disagree. */}
            {vrHud && (
              <VrHud
                rooms={rooms}
                currentRoomId={currentRoomId}
                hudHidden={hudHidden}
                onToggleHud={onToggleHud}
                darkMode={darkMode}
                lightModeLabel={lightModeLabel}
                onToggleDarkMode={onToggleDarkMode}
                musicPlaying={vrHud.musicPlaying}
                onToggleMusic={vrHud.onToggleMusic}
                mapOpen={vrHud.mapOpen}
                onToggleMap={onToggleMap}
                onExitVr={onToggleVrMode}
                minimapRef={minimapRef}
                minimapConfig={vrHud.minimapConfig}
                stats={vrHud.stats}
                achievement={vrHud.achievement}
                onDismissAchievement={vrHud.onDismissAchievement}
                splashEnabled={vrHud.splashEnabled}
                splashSpeedMs={vrHud.splashSpeedMs}
              />
            )}
            {vrHud?.mapOpen && !anyPanelOpen && (
              <VrMapPanel
                rooms={rooms}
                currentRoomId={currentRoomId}
                onSelectRoom={vrHud.onSelectRoom}
                onClose={() => onToggleMap?.()}
                freedomWallNoteCount={freedomWallNotes.length}
              />
            )}
            {/* The Freedom Wall's composer (FreedomWallCorner, a DOM card)
                needs a keyboard; this is the one corner card worth a note
                in-world, since the wall itself is right there in 3D. */}
            {inFreedomWallRoom && freedomWallAcceptingNotes && !anyPanelOpen && (
              <VrPrompt text="Want to leave a note on the wall? Remove your headset to write one." />
            )}
          </>
        )}
      </XR>
      </Canvas>

      {isCoarsePointer ? (
        // Hidden under any open panel — a joystick the visitor can't see
        // still eats the touches meant for the panel behind it.
        !panelArtwork &&
        !panelCert &&
        !panelStory &&
        !panelCosplay &&
        !panelDeck &&
        !panelGame &&
        !playingGame &&
        !panelGigs &&
        !panelContact && (
          <TouchControls
            moveRef={moveRef}
            lookRef={lookRef}
            jumpRef={jumpRef}
            landscapeMode={landscapeMode}
            gyroEnabled={gyroEnabled}
            rotatedViewport={rotatedViewport}
          />
        )
      ) : (
        !hudHidden &&
        !locked &&
        !legendDismissed &&
        // Every panel, not just an artwork's: opening one now releases the
        // pointer (see releasePointer), so without this the "Click to look
        // around" card would appear *behind* the panel the visitor just
        // opened, telling them to do the opposite of what they're doing.
        !panelArtwork &&
        !panelCert &&
        !panelStory &&
        !panelCosplay &&
        !panelDeck &&
        !panelGame &&
        !playingGame &&
        !panelGigs &&
        !panelContact && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 pointer-events-none px-4">
            <div className="px-6 py-5 rounded-2xl bg-black/70 backdrop-blur-md border border-white/10 text-center">
              <p className="font-body text-sm text-white mb-1">Click to look around</p>
              <p className="font-body text-xs text-white/50">
                WASD to walk · Esc to release the cursor
              </p>
              {/* Keyboard-only, so it belongs right here — this whole card is
                  already desktop-only (touch gets TouchControls instead) and
                  already only shows before the visitor has started moving
                  around, which is exactly the one moment a keyboard legend
                  is worth reading instead of getting in the way. */}
              <div className="mt-4 pt-4 border-t border-white/10">
                <KeyGuide />
              </div>
            </div>
          </div>
        )
      )}

      {/* Hidden once a panel is open (visible={... && !panelArtwork && !panelCert ...})
          — each panel's own [X]/backdrop-click already covers "how do I
          close this", so a second floating "[E] Close" hint behind an
          already-open modal would just be clutter. Pressing E still closes
          it either way (see handleActivate above), this only controls
          whether the little hint bubble shows. One shared prompt covers
          both artworks and certificates (mutually exclusive in practice —
          see handleActivate's comment) rather than two separate instances. */}
      <InteractionPrompt
        visible={!hudHidden && locked && promptTarget}
        label={promptLabel}
        title={promptTitle}
        isCoarsePointer={isCoarsePointer}
        onActivate={handleActivate}
      />

      {/* Every DOM panel below is nulled while an XR session is presenting:
          its in-world mirror inside the <XR> block above renders the same
          state instead. A DOM modal would only ever reach a companion 2D
          monitor at best (a standard immersive-vr session shows the headset
          nothing outside the WebXR canvas at all), so there's no reason to
          also drive its open animation for a panel nobody in the headset
          can see. Ending the session mid-panel hands that same open panel
          straight to the DOM, since the state itself never changed. */}
      <ArtworkInfoPanel
        artwork={isPresenting ? null : panelArtwork}
        onClose={() => setPanelArtwork(null)}
        isListing={panelIsListing}
        landscape={touchLandscape}
      />
      <CertificateInfoPanel
        certificate={isPresenting ? null : panelCert}
        onClose={() => setPanelCert(null)}
        landscape={touchLandscape}
      />
      {/* The same reader /stories opens — see components/public/StoryReader.tsx.
          `landscape` is the prop, not Tailwind's landscape: variant, for the
          reason ArtworkInfoPanel.tsx documents: that variant is false through
          the whole forced-landscape mode, which is the one case it's for. */}
      <StoryReader
        story={isPresenting ? null : panelStory}
        onClose={() => setPanelStory(null)}
        landscape={touchLandscape}
      />

      {/* Cosplay Room — the standee's own panel: the costume's story, its
          credits, and both photos (see CosplayInfoPanel.tsx). */}
      <CosplayInfoPanel
        cosplay={isPresenting ? null : panelCosplay}
        onClose={() => setPanelCosplay(null)}
        landscape={touchLandscape}
      />

      {/* Vinyl Room — the deck's panel (transport, speed, effects, tracklist)
          and the "you're holding a record" card. Neither exists in VR: the
          headset gets the room, the wall and the sound, not the sliders. */}
      <TurntablePanel
        vinyl={panelDeck && !isPresenting ? deckVinyl : null}
        state={deckState}
        effects={vinylEffects}
        currentTrackIndex={currentTrackIndex}
        currentLine={lyricsLineIndex >= 0 ? lyricsTimeline[lyricsLineIndex].text : null}
        onClose={() => setPanelDeck(false)}
        onPlayPause={() => {
          const player = vinylPlayerRef.current;
          if (!player) return;
          if (player.isPlaying()) player.pause();
          else {
            pauseMuseumMusicForVinyl();
            void player.play();
          }
        }}
        onTakeOff={() => takeRecordOffDeck(true)}
        onSeek={(seconds) => vinylPlayerRef.current?.seek(seconds)}
        onEffectsChange={applyVinylEffects}
        onResetEffects={() => applyVinylEffects(vinylConfig.defaultEffects ?? DEFAULT_VINYL_EFFECTS)}
        landscape={touchLandscape}
      />
      <HeldVinylHud
        vinyl={heldVinyl}
        visible={!hudHidden && !isPresenting && heldVinyl !== null && !anyPanelOpen}
        onPutBack={() => setHeldVinyl(null)}
        isCoarsePointer={isCoarsePointer}
      />

      {/* Arcade Room — the same preview + round the gallery's Mini Games
          launcher uses (GamePreviewModal at z-[75], GameSession at z-[80]),
          layered straight over the museum overlay. Starting a round never
          leaves the museum: closing the round drops the visitor back at the
          cabinet. */}
      {panelGame && !isPresenting && (
        <GamePreviewModal
          game={panelGame}
          howToPlay={GAME_REGISTRY[panelGame.type].howToPlay}
          onStart={() => {
            setPlayingGame(panelGame);
            setPanelGame(null);
          }}
          onClose={() => setPanelGame(null)}
        />
      )}
      {playingGame && (
        <GameSession game={playingGame} onClose={() => setPlayingGame(null)} />
      )}

      <ContactPanel
        open={panelContact && !isPresenting}
        title={contactConfig.title}
        subtitle={contactConfig.subtitle}
        onClose={() => setPanelContact(false)}
        landscape={touchLandscape}
      />

      {panelGigs && !isPresenting && aboutData && (
        <GigsPanel
          gigs={aboutData.gigs}
          onClose={() => setPanelGigs(false)}
          landscape={touchLandscape}
        />
      )}

      {/* Not a prompt+modal pair like artworks/certificates — the rest of the
          About room's content is always visible as wall geometry the moment
          a visitor walks in (see AboutRoomContents.tsx), so this is just the
          small ambient card for the few things that have to be actual
          clickable links. */}
      <AboutRoomCorner
        data={aboutData ?? null}
        visible={!hudHidden && inAboutRoom && !panelArtwork && !panelCert && !panelGigs && !panelContact}
        landscape={touchLandscape}
        isCoarsePointer={isCoarsePointer}
        open={aboutDrawerOpen}
        onOpenChange={(next) => {
          setAboutDrawerOpen(next);
          // Opening it hands the cursor back so the links are clickable —
          // same as opening an artwork/cert panel (see releasePointer).
          if (next) releasePointer();
        }}
      />
      <FreedomWallCorner
        visible={!hudHidden && inFreedomWallRoom && !panelArtwork && !panelCert}
        acceptingNotes={freedomWallAcceptingNotes}
        eventTitle={freedomWallEventTitle}
        onNoteAdded={onFreedomWallNoteAdded ?? (() => {})}
        isCoarsePointer={isCoarsePointer}
        landscapeMode={landscapeMode}
      />
    </div>
  );
}
