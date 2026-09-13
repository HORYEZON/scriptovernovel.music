// Pure presentational visual for the museum's room-entry splash — a
// centered icon + the room's name, plus the phase-driven transition
// treatment. No timing/session logic here; that's RoomSplash.tsx's job.
// Mirrors components/public/IntroSplashContent.tsx's structure exactly
// (including reusing its transition helpers directly, and its exact
// icon-fallback/glow treatment below) but swaps the SCRIPT/N(squid)VEL wordmark
// for room-appropriate content, since that wordmark is specific to the
// site-wide splash. Kept separate from RoomSplash.tsx so the admin's live
// preview (MuseumSplashSection.tsx) can render this exact visual bounded in
// a box instead of a fullscreen overlay.
"use client";

import type { CSSProperties } from "react";
import nextDynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import { SquidIcon } from "@/components/ui/SquidIcon";
import { parseIconValue } from "@/components/ui/icon-values";
import {
  introTransitionClasses,
  introSplitOrientation,
  type IntroEffect,
} from "@/lib/intro-splash";
import { MUSEUM_SPLASH_DEFAULTS } from "@/lib/museum-splash";

// Dynamic-imported like IntroSplashContent.tsx — this mounts on every room
// entry, so the ~3,000-entry icon maps should only load once a room's
// splashIcon is actually set, not ship as part of the always-mounted splash.
const DynamicIcon = nextDynamic(
  () => import("@/components/ui/DynamicIcon").then((m) => m.DynamicIcon),
  { ssr: false }
);

function RoomWordmark({
  roomName,
  splashIcon,
  taglineFontSize,
  taglineFontFamily,
}: {
  roomName: string;
  /** MuseumRoom.splashIcon ("platform:name") — falls back to the site's
   * glowing squid mark when unset/invalid, same as the site-wide entrance
   * splash's Profile.splashIcon (IntroSplashContent.tsx). */
  splashIcon?: string | null;
  taglineFontSize: string;
  taglineFontFamily: string;
}) {
  const parsedIcon = parseIconValue(splashIcon);
  return (
    <div className="flex flex-col items-center gap-5 motion-safe:animate-fade-up">
      {/* Same glow-halo + drop-shadow treatment as the entrance splash's
          SCRIPT/N(squid)VEL mark (IntroSplashContent.tsx) — a custom icon gets
          it too, not just the squid fallback, so a room with its own icon
          still reads as "alive" the same way. */}
      <span className="relative inline-flex items-center justify-center motion-safe:animate-squid-drift">
        <span
          aria-hidden="true"
          style={{
            backgroundColor: "color-mix(in srgb, var(--squid-glow) 40%, transparent)",
          }}
          className="pointer-events-none absolute inset-0 scale-150 rounded-full blur-2xl"
        />
        {parsedIcon ? (
          <DynamicIcon
            platform={parsedIcon.platform}
            name={parsedIcon.name}
            style={{ color: "var(--squid-glow)" } as CSSProperties}
            className="relative w-12 h-12 sm:w-14 sm:h-14 shrink-0 motion-safe:animate-squid-glow"
            fallback={
              <SquidIcon
                style={{ color: "var(--squid-glow)" } as CSSProperties}
                className="relative w-12 h-12 sm:w-14 sm:h-14 shrink-0 motion-safe:animate-squid-glow"
              />
            }
          />
        ) : (
          <SquidIcon
            style={{ color: "var(--squid-glow)" } as CSSProperties}
            className="relative w-12 h-12 sm:w-14 sm:h-14 shrink-0 motion-safe:animate-squid-glow"
          />
        )}
      </span>
      {/* Block element so text-center and max-width actually apply.
          padding-left = letter-spacing value — compensates for the
          trailing gap CSS letter-spacing adds after the last character,
          which would otherwise shift the text visually off-center. */}
      <p
        className="uppercase text-cream text-center font-grotesk font-bold leading-tight w-[min(85vw,32rem)]"
        style={{
          fontSize: "clamp(1.2rem, 5.5vw, 1.875rem)",
          letterSpacing: "0.4em",
          paddingLeft: "0.4em",
        }}
      >
        {roomName}
      </p>
      <p
        className="uppercase text-sepia-light/70 whitespace-nowrap text-center"
        style={{
          fontSize: taglineFontSize,
          fontFamily: taglineFontFamily,
          letterSpacing: "0.3em",
          paddingLeft: "0.3em",
        }}
      >
        Digital Museum
      </p>
    </div>
  );
}

export function RoomSplashContent({
  effect,
  phase,
  roomName,
  splashIcon,
  durationMs,
  bgColor,
  className,
  forceMotion,
  taglineFontSize,
  taglineFontFamily,
}: {
  effect: IntroEffect;
  phase: "visible" | "exiting";
  /** The already-resolved display text — RoomSplash.tsx resolves
   * `splashTitle || room.name` before this ever gets called, so this
   * component only has one text value to render, not a title/name pair. */
  roomName: string;
  /** MuseumRoom.splashIcon — see RoomWordmark's doc comment above. */
  splashIcon?: string | null;
  /** CSS transition-duration, in ms — the exit half of the timeline. */
  durationMs: number;
  bgColor?: string;
  className?: string;
  /** Bypasses the motion-reduce fallback — only the admin's own live preview should pass this. */
  forceMotion?: boolean;
  taglineFontSize?: string;
  taglineFontFamily?: string;
}) {
  const exiting = phase === "exiting";
  const bg = bgColor || MUSEUM_SPLASH_DEFAULTS.splashBgColor;
  const splitOrientation = introSplitOrientation(effect);
  const resolvedTaglineFontSize = taglineFontSize || MUSEUM_SPLASH_DEFAULTS.splashTaglineFontSize;
  const resolvedTaglineFontFamily = taglineFontFamily || MUSEUM_SPLASH_DEFAULTS.splashTaglineFontFamily;

  if (splitOrientation) {
    const vertical = splitOrientation === "vertical";
    return (
      <div className={cn("absolute inset-0 overflow-hidden", className)}>
        <div
          aria-hidden="true"
          className={cn(
            "absolute transition-transform ease-out",
            vertical ? "inset-y-0 left-0 w-1/2" : "inset-x-0 top-0 h-1/2",
            exiting && (vertical ? "-translate-x-full" : "-translate-y-full")
          )}
          style={{ backgroundColor: bg, transitionDuration: `${durationMs}ms` }}
        />
        <div
          aria-hidden="true"
          className={cn(
            "absolute transition-transform ease-out",
            vertical ? "inset-y-0 right-0 w-1/2" : "inset-x-0 bottom-0 h-1/2",
            exiting && (vertical ? "translate-x-full" : "translate-y-full")
          )}
          style={{ backgroundColor: bg, transitionDuration: `${durationMs}ms` }}
        />
        <div
          className={cn(
            "relative h-full flex items-center justify-center px-6",
            "pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
            "transition-opacity ease-out",
            exiting ? "opacity-0 pointer-events-none" : "opacity-100"
          )}
          style={{ transitionDuration: `${durationMs}ms` }}
        >
          <RoomWordmark
            roomName={roomName}
            splashIcon={splashIcon}
            taglineFontSize={resolvedTaglineFontSize}
            taglineFontFamily={resolvedTaglineFontFamily}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "absolute inset-0 flex items-center justify-center px-6",
        "pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
        "transition-[opacity,transform] ease-out",
        exiting && "pointer-events-none",
        introTransitionClasses(effect, phase, forceMotion),
        className
      )}
      style={{ backgroundColor: bg, transitionDuration: `${durationMs}ms` }}
    >
      <RoomWordmark
        roomName={roomName}
        splashIcon={splashIcon}
        taglineFontSize={resolvedTaglineFontSize}
        taglineFontFamily={resolvedTaglineFontFamily}
      />
    </div>
  );
}
