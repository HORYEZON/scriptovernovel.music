"use client";

// components/ui/ThemeToggle.tsx
//
// Light/dark switch. The moving part is a record: it slides between the two
// ends of the pill and spins a half-turn as it goes, so the control is the
// band's rather than a generic sun/moon pill.
//
// The sun and moon stay on the *track*. They are what tells a first-time
// visitor this is a theme switch at all, and a record alone says nothing
// about brightness — the record is the personality, the two icons are the
// meaning, and the meaning isn't the part to be clever with. Colours are the
// logo's gold against a muted grey rather than the inherited amber/indigo.

import { useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";

/** The thumb: a record seen head-on — grooves, a gold label, a spindle hole.
 *  Inline SVG rather than an icon-font glyph because at 24px the groove rings
 *  have to be hand-spaced to stay distinguishable. */
export function VinylThumb({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <circle cx="16" cy="16" r="15.5" className="fill-zinc-900 dark:fill-black" />
      {/* Grooves. Progressively fainter towards the middle so the disc reads
          as catching light from one side rather than as a flat target. */}
      {[13, 11, 9].map((r, i) => (
        <circle
          key={r}
          cx="16"
          cy="16"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.38 - i * 0.09}
          strokeWidth="1"
        />
      ))}
      {/* Label + spindle. */}
      <circle cx="16" cy="16" r="6" fill="currentColor" />
      <circle cx="16" cy="16" r="1.6" className="fill-zinc-900 dark:fill-black" />
      {/* The sheen that makes it read as vinyl and not as a coin. */}
      <path
        d="M6 7a14 14 0 0 1 13 -4"
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.3"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ThemeToggle({
  compactOnMobile = false,
}: {
  /** Shrinks the pill below `sm` — the public header row can't spare the
   *  full 72px next to MENU on a 375px phone. Every other caller keeps the
   *  original size at every width. */
  compactOnMobile?: boolean;
} = {}) {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem("theme");
    const isDark =
      savedTheme === "dark" ||
      (!savedTheme && document.documentElement.classList.contains("dark"));
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  // Compact: 56px pill, 2px padding, 24px thumb → 28px of travel.
  // Full:    72px pill, 4px padding, 28px thumb → 36px of travel.
  const pillSize = compactOnMobile ? "w-14 h-8 p-0.5 sm:w-[72px] sm:h-9 sm:p-1" : "w-[72px] h-9 p-1";
  const thumbSize = compactOnMobile ? "w-6 h-6 sm:w-7 sm:h-7" : "w-7 h-7";
  const thumbOn = compactOnMobile ? "translate-x-[28px] sm:translate-x-[36px]" : "translate-x-[36px]";

  if (!mounted) {
    return <div className={compactOnMobile ? "w-14 h-8 sm:w-[72px] sm:h-9" : "w-[72px] h-9"} />;
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={`
        relative ${pillSize}
        rounded-full
        bg-zinc-200/80 dark:bg-zinc-900/80
        border border-black/10 dark:border-white/10
        backdrop-blur-md
        shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)]
        dark:shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]
        transition-all duration-300 ease-out
        hover:border-[#E5AD06]/50
        focus:outline-none focus:ring-2 focus:ring-[#E5AD06]/40
        group cursor-pointer
      `}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {/* Track icons — what makes this readable as a theme switch. */}
      <div className="absolute inset-0 flex items-center justify-between px-2.5 pointer-events-none">
        <Sun
          size={14}
          strokeWidth={2}
          className={`transition-all duration-300 ${
            dark ? "text-zinc-600 opacity-40 scale-75" : "text-[#E5AD06] opacity-100 scale-100"
          }`}
        />
        <Moon
          size={14}
          strokeWidth={2}
          className={`transition-all duration-300 ${
            dark ? "text-[#E5AD06] opacity-100 scale-100" : "text-zinc-400 opacity-40 scale-75 -rotate-12"
          }`}
        />
      </div>

      {/* The record. Slide and spin share one transition so it reads as one
          movement — a disc rolling to the other end, not a disc that arrives
          and then turns. The overshoot easing is what gives it the snap. */}
      <div
        className={`
          relative ${thumbSize} rounded-full
          shadow-[0_2px_8px_rgba(0,0,0,0.35)]
          text-[#E5AD06]
          transition-transform duration-500 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)]
          motion-reduce:duration-150
          ${dark ? `${thumbOn} rotate-180` : "translate-x-0 rotate-0"}
          group-hover:brightness-110
        `}
      >
        <VinylThumb className="h-full w-full" />
      </div>
    </button>
  );
}
