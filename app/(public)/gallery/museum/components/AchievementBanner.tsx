"use client";

// The top-center "level-up" reveal shown once per newly-earned Digital
// Museum Achievement (Google Play Games-style XP surprise banner, per
// the confirmed design) — includes an inline name + email claim form
// (name in addition to Visitor Milestones' email-only claim, since a
// successful claim here also raises an admin Notification — see
// app/api/digital-museum/achievements/[id]/claim/route.ts). Auto-
// dismisses after a while unless the visitor is actively using the claim
// form, and always offers an explicit close.
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Trophy, X, Footprints, Eye, Heart, Clock } from "lucide-react";
import toast from "@/lib/toast";
import type { EarnedAchievement } from "@/lib/museum/useMuseumAchievements";

const AUTO_DISMISS_MS = 9000;

const CATEGORY_META: Record<
  EarnedAchievement["category"],
  { icon: typeof Footprints; label: string; describe: (threshold: number) => string }
> = {
  steps: { icon: Footprints, label: "Wanderer", describe: (t) => `Walked ${t.toLocaleString()} steps` },
  views: { icon: Eye, label: "Art Enthusiast", describe: (t) => `Viewed ${t.toLocaleString()} artworks` },
  wishlist: { icon: Heart, label: "Collector", describe: (t) => `Wishlisted ${t.toLocaleString()} artworks` },
  time: { icon: Clock, label: "Time Explorer", describe: (t) => `Spent ${t.toLocaleString()} minute${t === 1 ? "" : "s"} exploring` },
};

export function AchievementBanner({
  achievement,
  onDismiss,
}: {
  achievement: EarnedAchievement;
  onDismiss: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const meta = CATEGORY_META[achievement.category];
  const Icon = meta.icon;

  useEffect(() => {
    if (claimed) return;
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [onDismiss, claimed, name, email]);

  async function submitClaim() {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName || !trimmedEmail) return;
    setClaiming(true);
    try {
      const res = await fetch(`/api/digital-museum/achievements/${achievement.id}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName, email: trimmedEmail, reportedValue: achievement.reportedValue }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to claim reward");
      setClaimed(true);
      toast.success("Claimed! We'll be in touch by email.");
      setTimeout(onDismiss, 2000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to claim reward");
    } finally {
      setClaiming(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -40, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className="pointer-events-auto w-[min(92vw,26rem)] rounded-2xl border border-amber-400/30 bg-black/80 backdrop-blur-md shadow-2xl p-4 sm:p-5"
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-11 h-11 rounded-full bg-amber-400/15 text-amber-400 flex items-center justify-center">
          <Trophy size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-jakarta text-[10px] uppercase tracking-widest text-amber-400/90">
            Achievement Unlocked
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Icon size={14} className="text-white/70 shrink-0" />
            <p className="font-jakarta text-sm font-semibold text-white truncate">{meta.label}</p>
          </div>
          <p className="font-body text-xs text-white/60 mt-0.5">{meta.describe(achievement.threshold)}</p>
        </div>
        <button onClick={onDismiss} aria-label="Dismiss" className="text-white/40 hover:text-white/80 shrink-0">
          <X size={16} />
        </button>
      </div>

      <p className="font-body text-xs text-white/80 mt-3 pt-3 border-t border-white/10">{achievement.reward}</p>

      {claimed ? (
        <p className="font-body text-xs text-emerald-400 mt-3">🎉 Claimed — check your inbox soon.</p>
      ) : (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            // Paired with MuseumClient.tsx's exitPointerLock() on banner
            // appearance — together, a desktop visitor never has to
            // notice their cursor is gone and press Escape themselves
            // before they can start typing.
            autoFocus
            placeholder="Your name"
            className="flex-1 min-w-0 px-3 py-2 rounded-xl text-xs bg-white/10 border border-white/15 text-white placeholder:text-white/40 focus:outline-none focus:border-amber-400/50"
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            className="flex-1 min-w-0 px-3 py-2 rounded-xl text-xs bg-white/10 border border-white/15 text-white placeholder:text-white/40 focus:outline-none focus:border-amber-400/50"
          />
          <button
            onClick={submitClaim}
            disabled={claiming || !name.trim() || !email.trim()}
            className="shrink-0 px-3 py-2 rounded-xl bg-amber-400 text-black text-xs font-semibold hover:bg-amber-300 transition-colors disabled:opacity-50"
          >
            {claiming ? "…" : "Claim"}
          </button>
        </div>
      )}
    </motion.div>
  );
}
