"use client";

import { useEffect, useRef } from "react";

const SIZE = 28; // px — kept small on purpose, this is a flourish, not a spotlight.

// A soft glow that trails the cursor on desktop. Purely decorative:
//   - pointer-events: none, so it never intercepts a click
//   - mix-blend-screen, so it only ever adds light — it can't visually cover
//     content, even where it happens to overlap a card or button
//   - cycles through the same brand palette + --squid-glow custom property
//     the Footer/Sidebar squid already animates (see .cursor-glow in
//     globals.css), just on its own faster 8s loop
//   - skipped entirely on touch (no real cursor) and for
//     prefers-reduced-motion, matching the motion-safe: convention already
//     used for every other squid animation in this codebase
//
// Split into two elements on purpose: this outer wrapper is the only one
// with a JS-driven `transform` (cursor tracking, every frame). The colour
// cycle + breathing pulse live on the *inner* div via the plain-CSS
// `.cursor-glow` class instead — a CSS animation on `transform` would fight
// the JS position updates on the same element and win, freezing the glow in
// place instead of following the cursor.
export function CursorGlow({ enabled = true }: { enabled?: boolean }) {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled) return;
    const hasFinePointer = window.matchMedia(
      "(hover: hover) and (pointer: fine)"
    ).matches;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (!hasFinePointer || reducedMotion) return;

    const el = wrapRef.current;
    if (!el) return;

    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let x = targetX;
    let y = targetY;
    let raf = 0;

    function onMove(e: MouseEvent) {
      targetX = e.clientX;
      targetY = e.clientY;
      el!.style.opacity = "1";
    }
    function onLeave() {
      el!.style.opacity = "0";
    }

    function tick() {
      // Lerp toward the pointer instead of snapping 1:1 — a soft trailing
      // feel reads as "premium", a rigid 1:1 follow reads as a bug.
      x += (targetX - x) * 0.15;
      y += (targetY - y) * 0.15;
      el!.style.transform = `translate3d(${x - SIZE / 2}px, ${y - SIZE / 2}px, 0)`;
      raf = requestAnimationFrame(tick);
    }

    window.addEventListener("mousemove", onMove);
    document.documentElement.addEventListener("mouseleave", onLeave);
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("mousemove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div
      ref={wrapRef}
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-[2] hidden md:block opacity-0 transition-opacity duration-300"
      style={{ width: SIZE, height: SIZE }}
    >
      <div className="cursor-glow w-full h-full rounded-full mix-blend-screen blur" />
    </div>
  );
}
