"use client";

// Thin pass-through — this module (and everything it imports) is the part
// next/dynamic loads with { ssr: false } from MuseumClient.tsx, keeping
// three/@react-three/* completely out of the server bundle.
import type { MutableRefObject } from "react";
import { MuseumScene } from "./components/MuseumScene";
import type { RoomTravelRequest } from "./components/roomLayout";
import type { MiniMapFrameState } from "./components/MiniMapTracker";
import type { VrHudProps } from "./components/VrHud";
import type { Share360Fn } from "./components/Room360Capture";
import type { MuseumRoomPublic, MuseumAboutData, MuseumChaseCompanion, FreedomWallNotePublic } from "@/types";

export function MuseumSceneLoader({
  rooms,
  isCoarsePointer,
  landscapeMode,
  gyroEnabled,
  rotatedViewport,
  viewportSize,
  onRoomChange,
  darkMode,
  brightnessLight,
  brightnessDark,
  onToggleDarkMode,
  onToggleMap,
  onToggleHud,
  hudHidden,
  captureRef,
  share360Ref,
  aboutRoomId,
  aboutData,
  chaseCompanions,
  onStepsChange,
  onArtworkViewed,
  travelRequest,
  freedomWallRoomId,
  freedomWallNotes,
  freedomWallEventTitle,
  freedomWallAcceptingNotes,
  onFreedomWallNoteAdded,
  minimapRef,
  activeFilterCss,
  onCycleVisionFilter,
  vrMode,
  onVrPresentingChange,
  onToggleVrMode,
  vrHud,
}: {
  rooms: MuseumRoomPublic[];
  isCoarsePointer?: boolean;
  /** MuseumClient.tsx's forced-landscape toggle — see TouchControls.tsx. */
  landscapeMode?: boolean;
  /** MuseumClient.tsx's gyroscope toggle — see TouchControls.tsx. */
  gyroEnabled?: boolean;
  /** True only while MuseumClient.tsx's forced-landscape CSS rotate is
   * actually applied — see TouchControls.tsx. */
  rotatedViewport?: boolean;
  /** The <Canvas>'s target size in CSS pixels (already swapped when
   * rotatedViewport is on) — see MuseumScene.tsx's CanvasResizeSync doc
   * comment. */
  viewportSize?: { w: number; h: number };
  onRoomChange?: (roomId: string) => void;
  darkMode?: boolean;
  brightnessLight?: number;
  brightnessDark?: number;
  onToggleDarkMode?: () => void;
  onToggleMap?: () => void;
  /** [H] key — same screenshot-mode toggle as MuseumClient.tsx's HUD button. */
  onToggleHud?: () => void;
  /** Suppresses this scene's own overlays (legend, prompts, splash, corner card) — see MuseumClient.tsx. */
  hudHidden?: boolean;
  /** [R] key / MuseumClient.tsx's "Save Photo" button — see ScreenshotCapture.tsx. */
  captureRef?: MutableRefObject<(() => void) | null>;
  /** MuseumClient.tsx's "Share 360°" button — see Room360Capture.tsx. */
  share360Ref?: MutableRefObject<Share360Fn | null>;
  aboutRoomId?: string;
  aboutData?: MuseumAboutData;
  chaseCompanions?: MuseumChaseCompanion[];
  onStepsChange?: (totalSteps: number) => void;
  onArtworkViewed?: () => void;
  /** MuseumMap.tsx room click, threaded down to PlayerControls.tsx — see roomLayout.ts. */
  travelRequest?: RoomTravelRequest | null;
  freedomWallRoomId?: string | null;
  freedomWallNotes?: FreedomWallNotePublic[];
  freedomWallEventTitle?: string | null;
  freedomWallAcceptingNotes?: boolean;
  onFreedomWallNoteAdded?: (note: FreedomWallNotePublic) => void;
  /** MuseumClient.tsx's MiniMapHud.tsx — see MiniMapTracker.tsx's doc comment. */
  minimapRef?: MutableRefObject<MiniMapFrameState | null>;
  /** The CSS `filter` currently applied to the scene, or null. Only the
   *  screenshot needs it — the filter itself is applied by MuseumClient.tsx
   *  on a wrapper outside the canvas. See ScreenshotCapture.tsx. */
  activeFilterCss?: string | null;
  /** [Q] — cycles Filter Vision. Undefined when the museum has the feature
   *  switched off, which is what removes the key handler entirely. */
  onCycleVisionFilter?: () => void;
  /** MuseumClient.tsx's VR button — whether the visitor has asked to be in
   *  VR. MuseumScene.tsx owns the actual XR store/session (see its own
   *  `vrMode` prop doc) since this file's whole job is keeping three.js
   *  out of everything upstream of it. */
  vrMode?: boolean;
  /** Reports the session's *actual* presenting state back up — a headset's
   *  own "Exit VR" UI ends the session without going through the button. */
  onVrPresentingChange?: (presenting: boolean) => void;
  /** [V] key — desktop-only, same toggle as the HUD button. Undefined when
   *  vrSupported is false, same "the key just does nothing" pattern as
   *  onCycleVisionFilter. */
  onToggleVrMode?: () => void;
  /** Everything the in-headset HUD (VrHud.tsx) mirrors from MuseumClient.tsx's
   *  own DOM HUD that this scene doesn't otherwise receive — see VrHudProps. */
  vrHud?: VrHudProps;
}) {
  return (
    <MuseumScene
      rooms={rooms}
      isCoarsePointer={isCoarsePointer}
      landscapeMode={landscapeMode}
      gyroEnabled={gyroEnabled}
      rotatedViewport={rotatedViewport}
      viewportSize={viewportSize}
      onRoomChange={onRoomChange}
      darkMode={darkMode}
      brightnessLight={brightnessLight}
      brightnessDark={brightnessDark}
      onToggleDarkMode={onToggleDarkMode}
      onToggleMap={onToggleMap}
      onToggleHud={onToggleHud}
      hudHidden={hudHidden}
      captureRef={captureRef}
      share360Ref={share360Ref}
      aboutRoomId={aboutRoomId}
      aboutData={aboutData}
      chaseCompanions={chaseCompanions}
      onStepsChange={onStepsChange}
      onArtworkViewed={onArtworkViewed}
      travelRequest={travelRequest}
      freedomWallRoomId={freedomWallRoomId}
      freedomWallNotes={freedomWallNotes}
      freedomWallEventTitle={freedomWallEventTitle}
      freedomWallAcceptingNotes={freedomWallAcceptingNotes}
      onFreedomWallNoteAdded={onFreedomWallNoteAdded}
      minimapRef={minimapRef}
      activeFilterCss={activeFilterCss}
      onCycleVisionFilter={onCycleVisionFilter}
      vrMode={vrMode}
      onVrPresentingChange={onVrPresentingChange}
      onToggleVrMode={onToggleVrMode}
      vrHud={vrHud}
    />
  );
}
