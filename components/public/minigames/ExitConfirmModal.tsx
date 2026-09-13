"use client";

import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { useFocusTrap } from "./hooks";

interface ExitConfirmModalProps {
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Guards the one moment a player can throw away a round without meaning to:
 * closing mid-play. Gameplay never round-trips to the server (see
 * GameSession's top comment), so once this round is abandoned there is
 * nothing left server-side to resume — the confirmation is the only recovery
 * this state gets.
 *
 * Positioned `absolute`, not `fixed`, and mounted as a child of GameSession's
 * non-scrolling root — which is what actually keeps it on screen. `fixed` was
 * the bug: that root carries `backdrop-blur-md`, and a filter makes an element
 * the containing block for fixed-position descendants, so this overlay
 * resolved against the root rather than the viewport and, while that root was
 * also the scroller, drifted off with the board the moment a player scrolled.
 *
 * Sized to fit the *shortest* box it is ever drawn into, too. Inside the
 * museum it renders under MuseumClient.tsx's forced-landscape CSS rotate,
 * where the height available is the phone's *width* (~390px) — and where `sm:`
 * (like every media query) still measures the real, unrotated viewport, 390px
 * wide, so a `sm:flex-row` button row would never apply in exactly the case
 * that needs it. Hence the always-horizontal buttons and tight vertical
 * rhythm rather than a height breakpoint, which cannot see the difference.
 */
export function ExitConfirmModal({ onCancel, onConfirm }: ExitConfirmModalProps) {
  const containerRef = useFocusTrap(true);

  return (
    <motion.div
      className="absolute inset-0 z-[85] bg-ink/90 backdrop-blur-sm flex items-center justify-center overflow-hidden p-3 sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={onCancel}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="mg-exit-title"
      aria-describedby="mg-exit-body"
    >
      <motion.div
        ref={containerRef}
        className="w-full max-w-sm max-h-full rounded-2xl border border-white/10 bg-black/80 backdrop-blur-md shadow-2xl p-4 sm:p-6 text-center"
        initial={{ opacity: 0, y: 8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        onClick={(event) => event.stopPropagation()}
      >
        <AlertTriangle size={24} strokeWidth={1.5} className="mx-auto text-vermillion mb-2" />
        <h2
          id="mg-exit-title"
          className="font-grotesk text-base font-semibold tracking-widest uppercase text-cream"
        >
          Leave this round?
        </h2>
        <p id="mg-exit-body" className="font-body text-sm text-white/50 mt-1.5 leading-snug">
          Your progress isn&apos;t saved until the round is finished — leaving now resets it
          and nothing is scored.
        </p>
        <div className="flex flex-row gap-2 mt-4">
          <button
            type="button"
            onClick={onCancel}
            autoFocus
            className="flex-1 px-3 sm:px-4 py-2.5 rounded-lg bg-sepia text-ink font-body text-sm font-medium whitespace-nowrap hover:bg-sepia-light transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sepia focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            Keep playing
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 px-3 sm:px-4 py-2.5 rounded-lg border border-white/15 text-white/70 font-body text-sm whitespace-nowrap hover:text-cream hover:border-white/30 transition-colors"
          >
            Discard round
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
