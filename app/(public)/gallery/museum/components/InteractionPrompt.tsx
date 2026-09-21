"use client";

import { AnimatePresence, motion } from "framer-motion";

// A plain DOM overlay (not part of the R3F scene graph) driven by the
// lifted "active artwork"/"near exit marker" state from PlayerControls —
// cheap to show/hide, no per-frame React work of its own. On touch there's
// no E key to press, so the badge becomes the trigger itself
// (isCoarsePointer + onActivate). `label` makes this reusable for both the
// artwork prompt ("View Artwork") and the room-exit prompt
// ("View Museum Map") rather than duplicating this component.
export function InteractionPrompt({
  visible,
  label = "View",
  title,
  isCoarsePointer,
  onActivate,
}: {
  visible: boolean;
  label?: string;
  title?: string;
  isCoarsePointer?: boolean;
  onActivate?: () => void;
}) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.15 }}
          className="absolute bottom-24 inset-x-0 z-40 flex flex-col items-center gap-1 pointer-events-none"
        >
          {isCoarsePointer ? (
            <button
              type="button"
              onClick={onActivate}
              className="pointer-events-auto flex items-center gap-2 px-5 py-2.5 rounded-full bg-emerald-600 active:bg-emerald-700 text-white text-sm font-medium shadow-lg transition-colors"
            >
              {label}
            </button>
          ) : (
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/70 backdrop-blur-md border border-white/15 text-white text-sm font-medium">
              <kbd className="px-1.5 py-0.5 rounded bg-white/15 font-mono text-xs">E</kbd>
              {label}
            </div>
          )}
          {title && <p className="font-body text-xs text-white/50">{title}</p>}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
