"use client";

// A one-time "starting fresh" notice shown when useMuseumAchievements
// detects this browser tab has already been in the museum once this
// session (see that hook's sessionStorage flag) — Digital Museum
// Achievements progress is intentionally session-only and never
// persisted, so a reload always starts every counter back at zero; this
// just says so instead of silently doing it with no explanation.
import { motion } from "framer-motion";
import { RotateCcw } from "lucide-react";

export function AchievementResetNotice({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm rounded-2xl bg-[#161412] border border-white/10 shadow-2xl p-6 text-center"
      >
        <div className="inline-flex p-3 rounded-full bg-amber-400/15 text-amber-400 mb-3">
          <RotateCcw size={22} />
        </div>
        <h3 className="font-jakarta text-base font-semibold text-white mb-1.5">Starting fresh!</h3>
        <p className="font-body text-sm text-white/60 mb-5">
          Achievement progress (steps, views, wishlist, time) doesn&apos;t carry across a reload —
          your counters are back at zero for this visit.
        </p>
        <button
          onClick={onDismiss}
          className="w-full py-2.5 rounded-xl bg-amber-400 text-black text-sm font-semibold hover:bg-amber-300 transition-colors"
        >
          Got it
        </button>
      </motion.div>
    </div>
  );
}
