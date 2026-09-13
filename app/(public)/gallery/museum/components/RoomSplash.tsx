"use client";

import { useEffect, useRef, useState } from "react";
import { RoomSplashContent } from "./RoomSplashContent";
import { RoomSplashPopup } from "./RoomSplashPopup";
import { introExitMs, INTRO_ENTER_DELAY_MS, type IntroEffect } from "@/lib/intro-splash";
import type { SplashStyle } from "@/lib/museum-splash";
import { cn } from "@/lib/utils";

export type Phase = "hidden" | "entering" | "visible" | "exiting";

// Room-entry splash — the museum's equivalent of components/public/IntroSplash.tsx,
// same timing/phase mechanics, but retriggered per `roomId` instead of once
// per tab: every time a visitor's walk brings them into a room — including
// walking back into one they've already been in — its name/icon holds
// briefly then clears, a themed "welcome" beat on every entry.
export function RoomSplash({
  roomId,
  roomName,
  splashTitle,
  splashIcon,
  enabled,
  roomSplashEnabled = true,
  style = "full-page",
  styleMobile = "full-page",
  isCoarsePointer = false,
  landscapeMode = false,
  effect,
  speedMs,
  bgColor,
  taglineFontSize,
  taglineFontFamily,
  hidden = false,
}: {
  roomId: string | null;
  roomName: string;
  /** MuseumRoom.splashTitle — overrides `roomName` when set. */
  splashTitle?: string | null;
  /** MuseumRoom.splashIcon — see RoomSplashContent.tsx's RoomWordmark. */
  splashIcon?: string | null;
  enabled: boolean;
  /** MuseumRoomPublic.splashEnabled — this room's own toggle (RoomsTab.tsx),
   * checked alongside `enabled` (the museum-wide master switch) rather than
   * instead of it. Both must be true for the splash to fire. */
  roomSplashEnabled?: boolean;
  /** DigitalMuseum.splashStyle — which style desktop visitors get. */
  style?: SplashStyle;
  /** DigitalMuseum.splashStyleMobile — its own independent choice for touch
   * visitors (RoomSplashPopup.tsx renders smaller there via its `compact`
   * prop rather than reusing the desktop card at full size). */
  styleMobile?: SplashStyle;
  isCoarsePointer?: boolean;
  /** MuseumClient.tsx's landscape toggle — only used by the side-popup
   * style, which needs a higher anchor there to clear TouchControls.tsx's
   * jump button (see RoomSplashPopup.tsx). */
  landscapeMode?: boolean;
  effect: IntroEffect;
  speedMs: number;
  bgColor: string;
  taglineFontSize?: string;
  taglineFontFamily?: string;
  /** MuseumClient.tsx's [H] screenshot-mode switch — suppresses only the
   * visible render, never the component itself. Unmounting this instead
   * (`{!hudHidden && <RoomSplash />}`) would reset `shownForRoom` below on
   * every remount, making the room a visitor has already been standing in
   * look "just entered" again the moment they un-hide the HUD — this prop
   * is what avoids that. */
  hidden?: boolean;
}) {
  const [phase, setPhase] = useState<Phase>("hidden");
  const shownForRoom = useRef<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const exitMsRef = useRef(introExitMs(speedMs));

  function clearTimers() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }

  useEffect(() => {
    if (!enabled || !roomSplashEnabled || !roomId) return;
    if (shownForRoom.current === roomId) return; // already ran this room this render cycle
    shownForRoom.current = roomId;

    clearTimers();
    const reduced =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const holdMs = reduced ? 300 : speedMs;
    const exitMs = reduced ? 200 : introExitMs(speedMs);
    exitMsRef.current = exitMs;

    setPhase("entering");
    timers.current = [
      setTimeout(() => setPhase("visible"), INTRO_ENTER_DELAY_MS),
      setTimeout(() => setPhase("exiting"), INTRO_ENTER_DELAY_MS + holdMs),
      setTimeout(() => setPhase("hidden"), INTRO_ENTER_DELAY_MS + holdMs + exitMs),
    ];

    return clearTimers;
  }, [roomId, enabled, roomSplashEnabled, speedMs]);

  useEffect(() => clearTimers, []);

  if (!enabled || !roomSplashEnabled || phase === "hidden" || !roomId || hidden) return null;

  const displayTitle = splashTitle || roomName;
  // Desktop and touch each pick their own style independently now — see
  // the style/styleMobile prop docs above.
  const activeStyle = isCoarsePointer ? styleMobile : style;
  const usePopup = activeStyle === "side-popup";

  if (usePopup) {
    return (
      <div role="status" aria-live="polite" className="absolute inset-0 z-[55] pointer-events-none">
        <span className="sr-only">Entering {displayTitle}</span>
        <RoomSplashPopup
          phase={phase}
          roomName={displayTitle}
          splashIcon={splashIcon}
          durationMs={exitMsRef.current}
          compact={isCoarsePointer}
          landscape={isCoarsePointer && landscapeMode}
        />
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("absolute inset-0 z-[55]", phase !== "visible" && "pointer-events-none")}
    >
      <span className="sr-only">Entering {displayTitle}</span>
      <RoomSplashContent
        effect={effect}
        phase={phase === "visible" ? "visible" : "exiting"}
        roomName={displayTitle}
        splashIcon={splashIcon}
        durationMs={exitMsRef.current}
        bgColor={bgColor}
        taglineFontSize={taglineFontSize}
        taglineFontFamily={taglineFontFamily}
      />
    </div>
  );
}
