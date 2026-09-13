"use client";

import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { useFocusTrap } from "@/components/public/minigames/hooks";

interface ExitConfirmModalProps {
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Confirms leaving the Digital Museum while a visit has achievement progress
 * behind it. That progress is session-only and never persisted (see
 * lib/museum/useMuseumAchievements.ts's top comment), so Back to Gallery
 * genuinely throws it away — the same thing the mini games guard a round
 * against, one level up.
 *
 * This exists because the browser's own `beforeunload` dialog cannot do the
 * job. It covers refresh and tab close (and still does — the hook keeps it),
 * but it does not fire on an in-app `<Link>` navigation at all, and mobile
 * browsers suppress it even when it would: iOS Safari never shows it, and
 * Chrome on Android gates it behind a stricter gesture. That asymmetry is
 * exactly what was reported — a warning on desktop, only the exit sound on a
 * phone. A real component is the only way both platforms behave the same.
 *
 * `absolute`, not `fixed`, and mounted as a child of MuseumClient's root, for
 * the same two reasons as the mini games' ExitConfirmModal: that root carries
 * a `rotate(90deg)` transform under forced landscape, and a transformed
 * ancestor becomes the containing block for fixed descendants anyway — so
 * `absolute` against the root is both the honest description and the one that
 * survives the rotation.
 *
 * Sized for the shortest box it is ever drawn into, too. Under that same
 * forced landscape the height available is the phone's *width* (~390px),
 * where `sm:` still measures the real unrotated viewport and so would never
 * apply in the one case that needs it. Hence always-horizontal buttons rather
 * than a height breakpoint, which cannot see the difference.
 */
export function ExitConfirmModal({ onCancel, onConfirm }: ExitConfirmModalProps) {
  const containerRef = useFocusTrap(true);

  return (
    <motion.div
      className="absolute inset-0 z-[95] bg-ink/90 backdrop-blur-sm flex items-center justify-center overflow-hidden p-3 sm:p-4 pointer-events-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={onCancel}
      // Escape backs out, and every other key stops here. PlayerControls
      // listens for WASD/Space on `window` with no pointer-lock gate (see its
      // own keydown effect), and React's root listener sits below window in
      // the tree — so swallowing keys at this overlay is what keeps the
      // visitor from walking away underneath the dialog they're reading.
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Escape") onCancel();
      }}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="museum-exit-title"
      aria-describedby="museum-exit-body"
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
          id="museum-exit-title"
          className="font-grotesk text-base font-semibold tracking-widest uppercase text-cream"
        >
          Leave the museum?
        </h2>
        <p id="museum-exit-body" className="font-body text-sm text-white/50 mt-1.5 leading-snug">
          Your progress this visit — time spent, pieces viewed, steps walked — isn&apos;t
          saved. Leaving now starts you over on your next visit.
        </p>
        <div className="flex flex-row gap-2 mt-4">
          <button
            type="button"
            onClick={onCancel}
            autoFocus
            className="flex-1 px-3 sm:px-4 py-2.5 rounded-lg bg-sepia text-ink font-body text-sm font-medium whitespace-nowrap hover:bg-sepia-light transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sepia focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            Keep exploring
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 px-3 sm:px-4 py-2.5 rounded-lg border border-white/15 text-white/70 font-body text-sm whitespace-nowrap hover:text-cream hover:border-white/30 transition-colors"
          >
            Leave
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
