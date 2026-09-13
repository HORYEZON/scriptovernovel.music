"use client";

// The "side-popup" alternative to RoomSplashContent.tsx's fullscreen reveal
// (DigitalMuseum.splashStyle / splashStyleMobile — see
// MuseumSplashSection.tsx's Style selectors, one per device) — a card
// sliding in from the right edge instead of taking over the whole screen.
// Desktop sits bottom-right, opposite corner from MiniMapHud.tsx/
// AchievementHud.tsx's bottom-left stack. Mobile (`compact` below) instead
// anchors near the *top*, right-aligned, below the top HUD row (Music/
// View/Save Photo/Dark Mode/Map) and the room-name pill beneath it.
//
// How far below depends on the orientation, because the space between
// those two obstacles does. In portrait there's a whole screen of it and
// the jump button is a long way down at the opposite edge. In landscape
// the drawn area is only as tall as the phone is wide (~390px on the
// device this was reported from), and the jump button moves *up* to sit
// above the right look joystick — its top edge lands around 180px down.
// The single 9rem offset that portrait uses put this card at 144–190px,
// straight through it. `landscape` shifts it up to sit in the gap that
// does exist there: below the ~96px top stack, above the jump button.
//
// Same phase model as RoomSplashContent.tsx (hidden/entering/visible/
// exiting, driven entirely by RoomSplash.tsx's timers) — this only reacts
// to phase, no timing logic of its own. "entering" and "visible" both read
// as "slid in"; only "exiting" (and "hidden", which never actually renders
// this — see RoomSplash.tsx) reads as "slid back out."
import type { CSSProperties } from "react";
import nextDynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import { SquidIcon } from "@/components/ui/SquidIcon";
import { parseIconValue } from "@/components/ui/icon-values";
import type { Phase } from "./RoomSplash";

const DynamicIcon = nextDynamic(
  () => import("@/components/ui/DynamicIcon").then((m) => m.DynamicIcon),
  { ssr: false }
);

export function RoomSplashPopup({
  phase,
  roomName,
  splashIcon,
  durationMs,
  compact = false,
  landscape = false,
}: {
  phase: Phase;
  roomName: string;
  /** MuseumRoom.splashIcon ("platform:name") — falls back to the glowing
   * squid mark, same convention as RoomSplashContent.tsx's RoomWordmark. */
  splashIcon?: string | null;
  /** RoomSplash.tsx's own exit-transition duration — reused here for the
   * slide itself so this popup's timing feels tied to the same speed
   * slider (MuseumSplashSection.tsx), not a separate hardcoded value. */
  durationMs: number;
  /** RoomSplash.tsx passes this on touch (DigitalMuseum.splashStyleMobile
   * = "side-popup") — a smaller card anchored near the top instead of the
   * desktop version's bottom-right, clear of TouchControls.tsx's jump
   * button/joysticks (bottom-anchored in both orientations) and below the
   * top HUD row so it doesn't sit on top of the Screenshot/Dark Mode/Map
   * buttons. */
  compact?: boolean;
  /** MuseumClient.tsx's landscape toggle — only meaningful alongside
   * `compact`. Raises this card into the shorter gap landscape leaves
   * between the top HUD stack and TouchControls.tsx's jump button; see this
   * file's doc comment. */
  landscape?: boolean;
}) {
  const parsedIcon = parseIconValue(splashIcon);
  const slidIn = phase === "entering" || phase === "visible";
  const iconSize = compact ? "w-6 h-6" : "w-9 h-9";

  return (
    <div
      className={cn(
        "absolute left-0 right-0 flex justify-end",
        compact ? "pr-3" : "bottom-6 pr-4 sm:pr-6"
      )}
      style={
        compact
          ? // Clears the top HUD button row + the room-name/progress-dots
            // pill beneath it (see MuseumClient.tsx) — both sit centered/
            // right-aligned up there, so this needs real vertical distance
            // from them, not just a few pixels. That stack ends around 96px,
            // so landscape's 6.25rem is about as high as this can go while
            // still clearing it — which is what buys the ~35px of daylight
            // above the jump button that portrait's 9rem didn't leave.
            { top: `calc(${landscape ? "6.25rem" : "9rem"} + env(safe-area-inset-top, 0px))` }
          : undefined
      }
    >
      <div
        className={cn(
          "flex items-center rounded-2xl bg-black/70 backdrop-blur-md border border-white/10 shadow-2xl transition-transform ease-out max-w-[85vw]",
          compact ? "gap-2.5 pl-3 pr-4 py-2.5" : "gap-4 pl-4 pr-7 py-4",
          slidIn ? "translate-x-0" : "translate-x-[calc(100%+1.5rem)]"
        )}
        style={{ transitionDuration: `${durationMs}ms` }}
      >
        <span className="relative inline-flex items-center justify-center shrink-0">
          <span
            aria-hidden="true"
            style={{
              backgroundColor: "color-mix(in srgb, var(--squid-glow) 40%, transparent)",
            }}
            className="pointer-events-none absolute inset-0 scale-150 rounded-full blur-xl"
          />
          {parsedIcon ? (
            <DynamicIcon
              platform={parsedIcon.platform}
              name={parsedIcon.name}
              style={{ color: "var(--squid-glow)" } as CSSProperties}
              className={cn("relative shrink-0", iconSize)}
              fallback={
                <SquidIcon
                  style={{ color: "var(--squid-glow)" } as CSSProperties}
                  className={cn("relative shrink-0", iconSize)}
                />
              }
            />
          ) : (
            <SquidIcon
              style={{ color: "var(--squid-glow)" } as CSSProperties}
              className={cn("relative shrink-0", iconSize)}
            />
          )}
        </span>
        <p
          className={cn(
            "font-grotesk font-bold uppercase text-cream tracking-wide truncate",
            compact ? "text-sm" : "text-base sm:text-xl"
          )}
        >
          {roomName}
        </p>
      </div>
    </div>
  );
}
