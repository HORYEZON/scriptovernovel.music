"use client";

// components/ui/ThemeSwitch.tsx
//
// The light/dark pill, drawn purely from its `dark` prop. ThemeToggle wraps it
// with the real site theme (the <html> class + localStorage); Preferences →
// Header's live preview wraps it with a preview-only flag, so clicking it
// there flips the preview without flipping the admin's own theme.
//
// Styled off the prop rather than `dark:` variants for that reason — the same
// call kalamari.arts' ThemeSwitch makes. Inside the admin a `dark:` class
// follows the *admin's* theme, not the preview's, so the preview's pill and
// record used to disagree with the preview's own light/dark. The preview also
// carried its own copy of this markup and left the thumb's gold off, which is
// why the record's grooves and label came out zinc: VinylThumb draws them in
// `currentColor`, and with nothing setting it they inherited the surrounding
// admin chrome. One component, one set of colours, no way for the two to
// drift.
//
// Icons are the band's rather than generic: a record for the thumb, with the
// sun and moon left on the track. A record alone says nothing about
// brightness — the record is the personality, the two icons are the meaning,
// and the meaning isn't the part to be clever with. Colours are the logo's
// gold against a muted grey.
import { Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

/** The logo's gold — the one accent on the pill, in both modes. */
const GOLD = "#E5AD06";

/** The thumb: a record seen head-on — grooves, a gold label, a spindle hole.
 *  Inline SVG rather than an icon-font glyph because at 24px the groove rings
 *  have to be hand-spaced to stay distinguishable.
 *
 *  `dark` picks the disc body, and the grooves/label take `currentColor` so
 *  the caller sets the gold once on the wrapper. */
export function VinylThumb({ className, dark = false }: { className?: string; dark?: boolean }) {
  const body = dark ? "#000000" : "#18181b";
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <circle cx="16" cy="16" r="15.5" fill={body} />
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
      <circle cx="16" cy="16" r="1.6" fill={body} />
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

export function ThemeSwitch({
  dark,
  onToggle,
  compactOnMobile = false,
  className,
  label,
}: {
  dark: boolean;
  onToggle: () => void;
  /** Shrinks the pill below `sm` — the public header row can't spare the
   *  full 72px next to MENU on a 375px phone. Every other caller keeps the
   *  original size at every width. */
  compactOnMobile?: boolean;
  className?: string;
  /** Overrides the aria-label — the admin preview switches a preview, not
   *  the reader's own theme, and should say so. */
  label?: string;
}) {
  // Compact: 56px pill, 2px padding, 24px thumb → 28px of travel.
  // Full:    72px pill, 4px padding, 28px thumb → 36px of travel.
  const pillSize = compactOnMobile ? "w-14 h-8 p-0.5 sm:w-[72px] sm:h-9 sm:p-1" : "w-[72px] h-9 p-1";
  const thumbSize = compactOnMobile ? "w-6 h-6 sm:w-7 sm:h-7" : "w-7 h-7";
  const thumbOn = compactOnMobile ? "translate-x-[28px] sm:translate-x-[36px]" : "translate-x-[36px]";

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={dark}
      aria-label={label ?? (dark ? "Switch to light mode" : "Switch to dark mode")}
      className={cn(
        "group relative cursor-pointer rounded-full border backdrop-blur-md transition-all duration-300 ease-out",
        "focus:outline-none focus:ring-2 focus:ring-[#E5AD06]/40 hover:border-[#E5AD06]/50",
        pillSize,
        dark
          ? "border-white/10 bg-zinc-900/80 shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]"
          : "border-black/10 bg-zinc-200/80 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)]",
        className
      )}
    >
      {/* Track icons — what makes this readable as a theme switch. */}
      <span className="pointer-events-none absolute inset-0 flex items-center justify-between px-2.5">
        <Sun
          size={14}
          strokeWidth={2}
          className={cn("transition-all duration-300", dark ? "scale-75 text-zinc-600 opacity-40" : "scale-100 opacity-100")}
          style={dark ? undefined : { color: GOLD }}
        />
        <Moon
          size={14}
          strokeWidth={2}
          className={cn("transition-all duration-300", dark ? "scale-100 opacity-100" : "-rotate-12 scale-75 text-zinc-400 opacity-40")}
          style={dark ? { color: GOLD } : undefined}
        />
      </span>

      {/* The record. Slide and spin share one transition so it reads as one
          movement — a disc rolling to the other end, not a disc that arrives
          and then turns. The overshoot easing is what gives it the snap. */}
      <span
        style={{ color: GOLD }}
        className={cn(
          "relative block rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.35)]",
          "transition-transform duration-500 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)]",
          "motion-reduce:duration-150 group-hover:brightness-110",
          thumbSize,
          dark ? `${thumbOn} rotate-180` : "translate-x-0 rotate-0"
        )}
      >
        <VinylThumb className="h-full w-full" dark={dark} />
      </span>
    </button>
  );
}
