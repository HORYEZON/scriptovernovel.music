"use client";

// components/public/site-design/MenuOpenTransition.tsx
//
// The enter/leave animation for the menu overlay — one wrapper that maps
// Site Design's `menuOpenEffect` / `menuCloseEffect` to CSS transitions of
// their own durations. Opening is the trip from the open effect's start
// position to rest; closing is the trip from rest to the close effect's
// end position — so "Drop" can mean "in from above" on open and "out below"
// on close, each picked independently.
//
// Shared by MenuOverlay (the real thing, fixed to the viewport) and the
// admin's Site Design preview (inside a scaled frame, with Play buttons),
// so what the admin previews is exactly the animation visitors get.
//
// "split" is the one exception: it isn't a whole-sheet trip at all — the
// colour panel and the photo panel travel in from opposite edges and meet
// at the centre, independently of each other. This wrapper stays a no-op
// for it (identity pose, nothing to transition), and MenuPanel animates its
// own two halves instead, reading the same openEffect/closeEffect/speeds.
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import type { MenuOpenEffect } from "@/lib/site-design";

/**
 * True once the sheet has *landed* — `openSpeedMs` after `shown` flips on —
 * and false the instant it flips off. Drive MenuPanel's `revealed` from
 * this rather than from `shown` itself: the link entrance
 * (menuItemsEffect) is meant to play on a sheet that has already arrived,
 * and started together with the sheet it just rides along inside the
 * panel's own motion and is never seen as its own effect.
 */
export function useSheetLanded(shown: boolean, openSpeedMs: number): boolean {
  const [landed, setLanded] = useState(false);
  useEffect(() => {
    if (!shown) {
      setLanded(false);
      return;
    }
    const t = setTimeout(() => setLanded(true), openSpeedMs);
    return () => clearTimeout(t);
  }, [shown, openSpeedMs]);
  return landed;
}

const EASE = "cubic-bezier(0.65, 0, 0.35, 1)";

type Pose = { style: CSSProperties; props: string[] };

const IDENTITY: Pose = { style: {}, props: [] };

// Where the sheet sits *before* it opens, per open effect.
const OPEN_FROM: Record<MenuOpenEffect, Pose> = {
  drop: { style: { transform: "translateY(-100%)" }, props: ["transform"] },
  rise: { style: { transform: "translateY(100%)" }, props: ["transform"] },
  "slide-left": { style: { transform: "translateX(-100%)" }, props: ["transform"] },
  "slide-right": { style: { transform: "translateX(100%)" }, props: ["transform"] },
  fade: { style: { opacity: 0 }, props: ["opacity"] },
  zoom: { style: { opacity: 0, transform: "scale(1.08)" }, props: ["opacity", "transform"] },
  curtain: { style: { clipPath: "inset(0 50% 0 50%)" }, props: ["clip-path"] },
  split: IDENTITY,
};

// Where the sheet ends up *after* it closes, per close effect. Read as
// exits: "drop" falls away downward, "rise" lifts away upward.
const CLOSE_TO: Record<MenuOpenEffect, Pose> = {
  drop: { style: { transform: "translateY(100%)" }, props: ["transform"] },
  rise: { style: { transform: "translateY(-100%)" }, props: ["transform"] },
  "slide-left": { style: { transform: "translateX(-100%)" }, props: ["transform"] },
  "slide-right": { style: { transform: "translateX(100%)" }, props: ["transform"] },
  fade: { style: { opacity: 0 }, props: ["opacity"] },
  zoom: { style: { opacity: 0, transform: "scale(1.08)" }, props: ["opacity", "transform"] },
  curtain: { style: { clipPath: "inset(0 50% 0 50%)" }, props: ["clip-path"] },
  split: IDENTITY,
};

// Rest — every animatable property at its identity, so any pose → rest or
// rest → any pose is a clean trip.
const REST: CSSProperties = {
  transform: "none",
  opacity: 1,
  clipPath: "inset(0 0 0 0)",
};

export function MenuOpenTransition({
  openEffect,
  openSpeedMs,
  closeEffect,
  closeSpeedMs,
  shown,
  closing,
  className,
  children,
}: {
  openEffect: MenuOpenEffect;
  openSpeedMs: number;
  closeEffect: MenuOpenEffect;
  closeSpeedMs: number;
  /** Rest position when true; otherwise the open effect's start pose, or
   *  the close effect's end pose when `closing`. */
  shown: boolean;
  /** Whether a not-shown state is a departure (true) or a pre-open start
   *  position (false). Only read while `shown` is false. */
  closing: boolean;
  className?: string;
  children: ReactNode;
}) {
  // CSS transitions read the `transition` value from the *destination*
  // style, so each state carries the timing of the trip that leads to it:
  // rest ← open effect's props/duration; closed pose ← close effect's.
  let style: CSSProperties;
  if (shown) {
    const pose = OPEN_FROM[openEffect];
    style = {
      ...REST,
      transition: pose.props.map((p) => `${p} ${openSpeedMs}ms ${EASE}`).join(", "),
    };
  } else if (closing) {
    const pose = CLOSE_TO[closeEffect];
    style = {
      ...REST,
      ...pose.style,
      transition: pose.props.map((p) => `${p} ${closeSpeedMs}ms ${EASE}`).join(", "),
    };
  } else {
    // Pre-open start position — snap there, no transition, so the sheet
    // doesn't animate *into* its hiding place on mount.
    style = { ...REST, ...OPEN_FROM[openEffect].style, transition: "none" };
  }

  return (
    <div className={className} style={{ ...style, willChange: "transform, opacity, clip-path" }}>
      {children}
    </div>
  );
}
