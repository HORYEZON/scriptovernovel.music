"use client";

// Mobile's home for the minimap. Desktop keeps MiniMapHud.tsx pinned
// bottom-left with the stats card tucked underneath it, always on — there's
// screen to spare there. Touch has none, so instead of a second permanent
// overlay competing with the joysticks and the jump button, the stats card
// itself (AchievementHud.tsx — steps / artworks viewed / time inside /
// wishlisted) doubles as the toggle: tap it and the minimap expands out of
// it, tap again and it collapses back to just the numbers.
//
// The card does not move when that happens, in either orientation, which is
// the whole reason the map is placed on a *side* rather than simply
// rendered next to it: it grows away from whichever edge the card is
// anchored to, so the numbers stay exactly where the visitor's eye (and
// thumb) last found them.
//  - portrait  → card hangs off the top HUD stack, so the map opens *below*
//  - landscape → card sits at bottom-center, so the map opens *above*
// Either way the growth happens on the free side and the card holds still.
import { type MutableRefObject } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronUp } from "lucide-react";
import { AchievementHud } from "./AchievementHud";
import { MiniMapHud } from "./MiniMapHud";
import type { MiniMapFrameState } from "./MiniMapTracker";
import { MINIMAP_HUD_DEFAULTS, type MinimapHudConfig } from "@/lib/museum/minimapHud";

// Smaller than desktop's 240×200 — this is drawn over the room the visitor
// is walking through, on a screen that's ~390 CSS px across in portrait, so
// it has to read as a glanceable radar rather than a panel that takes the
// view away. The room rectangle scales to fit whatever it's given (see
// MiniMapHud's own `scale`), so this is purely a display-size choice.
const MOBILE_MAP_W = 176;
const MOBILE_MAP_H = 148;

export function StatsMinimapPanel({
  steps,
  views,
  elapsedSeconds,
  wishlistAdds,
  frameStateRef,
  config = MINIMAP_HUD_DEFAULTS,
  open,
  onToggle,
  placement,
}: {
  steps: number;
  views: number;
  elapsedSeconds: number;
  wishlistAdds: number;
  /** MiniMapTracker.tsx's per-frame ref — mounted inside the Canvas
   * regardless of pointer type, so the data this draws was already being
   * produced on mobile before anything here existed to show it. */
  frameStateRef: MutableRefObject<MiniMapFrameState | null>;
  /** The admin's museum-wide look for this card. Its colours and counter
   *  settings apply here exactly as they do on desktop; its *size* does not
   *  — mobile keeps the smaller pair below, since a map sized for a desktop
   *  corner would take a phone's whole view. */
  config?: MinimapHudConfig;
  open: boolean;
  onToggle: () => void;
  /** Which side the map grows toward — see this file's doc comment for why
   * it differs by orientation. */
  placement: "above" | "below";
}) {
  const above = placement === "above";
  // Down when the map is (or would be) below the card, up when it's above —
  // so the chevron always points at wherever the map actually is, and flips
  // to point back at the card once it's open.
  const Chevron = above === open ? ChevronDown : ChevronUp;

  // Rendered directly inside <AnimatePresence> (no wrapper div) — exit
  // animations only run for its own immediate, keyed children.
  const map = (
    <motion.div
      key="minimap"
      // Scales out of the card's own edge rather than just fading, so the
      // relationship between the tapped card and the thing that appeared is
      // legible at a glance.
      initial={{ opacity: 0, scale: 0.9, y: above ? 8 : -8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: above ? 8 : -8 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      style={{ transformOrigin: above ? "bottom center" : "top center" }}
      // Stays transparent to touch so the look-drag zone underneath still
      // works where the map overlaps it — this is a readout, not a control.
      className="pointer-events-none rounded-2xl bg-black/60 backdrop-blur-md border border-white/10 p-1.5"
    >
      <MiniMapHud
        frameStateRef={frameStateRef}
        config={config}
        width={MOBILE_MAP_W}
        height={MOBILE_MAP_H}
      />
    </motion.div>
  );

  return (
    <div className="flex flex-col items-center gap-2">
      <AnimatePresence initial={false}>{open && above && map}</AnimatePresence>

      {/* The pill background lives here rather than on AchievementHud (hence
          `bare`), so the whole card — numbers and chevron alike — is one tap
          target instead of a card sitting inside a slightly larger button
          with a dead ring around it. AchievementHud's own pointer-events-none
          doesn't block this: the child declining events just lets them
          resolve on this button, which is what should receive them anyway. */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-label={open ? "Hide minimap" : "Show minimap"}
        className="pointer-events-auto inline-flex items-center gap-2.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full bg-black/50 backdrop-blur-md border border-white/10 active:bg-black/70 transition-colors"
      >
        <AchievementHud
          bare
          config={config}
          steps={steps}
          views={views}
          elapsedSeconds={elapsedSeconds}
          wishlistAdds={wishlistAdds}
        />
        <Chevron size={13} className="text-white/50" />
      </button>

      <AnimatePresence initial={false}>{open && !above && map}</AnimatePresence>
    </div>
  );
}
