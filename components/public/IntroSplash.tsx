// components/public/IntroSplash.tsx
"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { IntroSplashContent } from "@/components/public/IntroSplashContent";
import {
  introExitMs,
  INTRO_ENTER_DELAY_MS,
  type IntroEffect,
  type IntroLetterColors,
} from "@/lib/intro-splash";
import { cn } from "@/lib/utils";

// Next SSRs this tree, and useLayoutEffect warns about doing nothing on the
// server. Swapping to useEffect there is silent and behaves identically —
// no effect ever runs during SSR either way — while still letting the
// client resolve sessionStorage before first paint so repeat-in-tab visits
// never flash the overlay.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

const STORAGE_KEY = "scriptovernovel-intro-shown";

type Phase = "hidden" | "entering" | "visible" | "exiting";

// One-time entrance splash: the SCRIPT/N(squid)VEL lockup glows in, holds, then
// clears with the admin-chosen effect to reveal the page already rendered
// underneath — this is a server component tree, so there's nothing to
// "wait for", the splash is a deliberate reveal beat, not a loading state.
//
// Mounted once in the public layout, driven by Profile.intro* (fetched
// there and passed down as props — see lib/intro-splash.ts for the shared
// defaults/sanitizers the admin form and this component both read from).
// Client-side navigation between pages never remounts a layout, and a fresh
// tab/session replays it once via the sessionStorage flag below — so it's a
// first-visit-per-tab flourish, not an every-page-load annoyance.
export function IntroSplash({
  enabled,
  effect,
  speedMs,
  text,
  textAbove,
  bgColor,
  icon,
  taglineFontSize,
  taglineFontFamily,
  taglineColor,
  taglineAboveFontSize,
  taglineAboveFontFamily,
  taglineAboveColor,
  taglineFontSizeMobile,
  taglineAboveFontSizeMobile,
  glowIntensity,
  glowColor,
  glowShimmer,
  glowOffsetX,
  glowOffsetY,
  letterColors,
  squidColor,
  logoText,
  logoFontFamily,
  logoImage,
}: {
  enabled: boolean;
  effect: IntroEffect;
  speedMs: number;
  text: string;
  textAbove?: string;
  bgColor: string;
  icon?: string | null;
  taglineFontSize?: string;
  taglineFontFamily?: string;
  taglineColor?: string;
  taglineAboveFontSize?: string;
  taglineAboveFontFamily?: string;
  taglineAboveColor?: string;
  /** Profile.introTagline*FontSizeMobile — phone-only size overrides. Null
   *  follows the desktop size; the switch itself happens in CSS at the real
   *  viewport width, not here. See IntroSplashContent's IntroViewport. */
  taglineFontSizeMobile?: string | null;
  taglineAboveFontSizeMobile?: string | null;
  glowIntensity?: number;
  glowColor?: string;
  glowShimmer?: boolean;
  glowOffsetX?: number;
  glowOffsetY?: number;
  /** Profile.introLetterColors — see IntroSplashContent. */
  letterColors?: IntroLetterColors;
  /** Profile.introSquidColor — see IntroSplashContent. */
  squidColor?: string;
  /** Site Design → Header → Wordmark — see IntroSplashContent. */
  logoText?: string;
  logoFontFamily?: string;
  logoImage?: string | null;
}) {
  const [phase, setPhase] = useState<Phase>("hidden");
  const started = useRef(false);
  // Set once when the splash actually starts (see effect below) — read back
  // in the JSX below instead of re-querying matchMedia on every render.
  const exitMsRef = useRef(introExitMs(speedMs));

  useIsomorphicLayoutEffect(() => {
    if (!enabled) return;

    let alreadyShown = true;
    try {
      alreadyShown = sessionStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      // Storage blocked (private browsing, locked-down settings, etc.) —
      // fail toward "already shown" so a storage error can never trap the
      // page behind a splash that never dismisses.
    }
    if (alreadyShown || started.current) return;
    started.current = true;

    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // If it can't be persisted the splash just replays next load —
      // harmless, so no further handling needed.
    }

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const holdMs = reduced ? 300 : speedMs;
    const exitMs = reduced ? 200 : introExitMs(speedMs);
    exitMsRef.current = exitMs;

    // Locked only while the splash owns the screen — prevents a scroll
    // that starts underneath from jumping the page once it's revealed.
    document.documentElement.style.overflow = "hidden";
    // Mounts in the "off" state first (see Phase/IntroSplashContent) — the
    // browser paints that frame, then the timer below flips to "visible" so
    // the transition to it is actually observed instead of appearing
    // pre-settled with nothing to animate from.
    setPhase("entering");

    const toVisible = setTimeout(() => setPhase("visible"), INTRO_ENTER_DELAY_MS);
    const toExit = setTimeout(
      () => setPhase("exiting"),
      INTRO_ENTER_DELAY_MS + holdMs
    );
    const toDone = setTimeout(() => {
      setPhase("hidden");
      document.documentElement.style.overflow = "";
    }, INTRO_ENTER_DELAY_MS + holdMs + exitMs);

    return () => {
      clearTimeout(toVisible);
      clearTimeout(toExit);
      clearTimeout(toDone);
      document.documentElement.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately runs once: settings changing mid-splash shouldn't restart it.
  }, [enabled]);

  if (!enabled || phase === "hidden") return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("fixed inset-0 z-[100]", phase !== "visible" && "pointer-events-none")}
    >
      <span className="sr-only">Loading ScriptOverNovel — {text}</span>
      <IntroSplashContent
        effect={effect}
        // "entering" maps to the same off-state classes as "exiting" — see
        // IntroSplashContent/introTransitionClasses; both ends of the
        // timeline share one visual state, only the direction differs.
        phase={phase === "visible" ? "visible" : "exiting"}
        text={text}
        durationMs={exitMsRef.current}
        bgColor={bgColor}
        icon={icon}
        textAbove={textAbove}
        taglineFontSize={taglineFontSize}
        taglineFontFamily={taglineFontFamily}
        taglineColor={taglineColor}
        taglineAboveFontSize={taglineAboveFontSize}
        taglineAboveFontFamily={taglineAboveFontFamily}
        taglineAboveColor={taglineAboveColor}
        taglineFontSizeMobile={taglineFontSizeMobile}
        taglineAboveFontSizeMobile={taglineAboveFontSizeMobile}
        glowIntensity={glowIntensity}
        glowColor={glowColor}
        glowShimmer={glowShimmer}
        glowOffsetX={glowOffsetX}
        glowOffsetY={glowOffsetY}
        letterColors={letterColors}
        squidColor={squidColor}
        logoText={logoText}
        logoFontFamily={logoFontFamily}
        logoImage={logoImage}
      />
    </div>
  );
}
