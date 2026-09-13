"use client";

// lib/museum/useMuseumAchievements.ts
//
// All the client-side bookkeeping behind Digital Museum Achievements
// (Artworks ▸ Digital Museum ▸ Achievements tab): four session-only
// counters (time spent, artworks viewed, artworks wishlisted, steps
// walked), each checked against admin-defined thresholds to fire a
// "level-up" banner the moment one is crossed.
//
// Worth being explicit about the trust model here, since it differs from
// this app's other reward features: Visitor Milestones counts real
// visits server-side, and Mini Games verifies a real puzzle solution
// server-side — there is no equivalent server ground truth for "did this
// anonymous, logged-out visitor actually spend 10 minutes / view 25
// pieces / walk 1,000 steps," because there's no login and the whole
// point of this feature is exploration behavior that happens entirely
// client-side. What IS enforced server-side (see
// app/api/digital-museum/achievements/[id]/claim/route.ts) is that the
// achievement is real/enabled and that any one email can only claim it
// once. Treat this the same way as a casual arcade high-score board, not
// a financial ledger.
//
// Deliberately session-only / never persisted (per the product decision):
// a page refresh loses all progress, same as closing the tab. A
// sessionStorage flag (not the progress itself) remembers only "this
// browser has been in the museum before this tab session," purely so a
// post-refresh visit can show a "starting fresh" notice instead of
// silently resetting with no explanation.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWishlistStore } from "@/lib/wishlist-store";
import { playSoundEffect } from "@/lib/sound/engine";
import type { MuseumAchievementPublic } from "@/types";

// No input (mouse/touch/keyboard) for this long pauses the elapsed-time
// counter — matches roomConstants.ts's general "don't count doing
// nothing" instinct, just applied to a wall-clock timer instead of a
// proximity check.
const IDLE_TIMEOUT_MS = 30_000;
const TICK_MS = 1000;
const VISITED_FLAG_KEY = "scriptovernovel_museum_visited";

export interface EarnedAchievement extends MuseumAchievementPublic {
  /** The visitor's own metric value at the moment this was earned — sent along with a claim as `reportedValue` (see the claim route's doc comment on why that's informational, not verified). */
  reportedValue: number;
}

export function useMuseumAchievements(achievements: MuseumAchievementPublic[], enabled: boolean) {
  const [steps, setSteps] = useState(0);
  const [views, setViews] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [wishlistAdds, setWishlistAdds] = useState(0);
  const [banner, setBanner] = useState<EarnedAchievement | null>(null);
  const [showWelcomeBack, setShowWelcomeBack] = useState(false);

  const earnedIds = useRef<Set<string>>(new Set());
  const bannerQueue = useRef<EarnedAchievement[]>([]);
  const lastActivity = useRef(Date.now());
  const wishlistBaseline = useRef<number | null>(null);
  const wishlistCount = useWishlistStore((s) => s.items.length);

  const byCategory = useMemo(() => {
    const map: Record<MuseumAchievementPublic["category"], MuseumAchievementPublic[]> = {
      time: [],
      views: [],
      wishlist: [],
      steps: [],
    };
    for (const a of achievements) map[a.category].push(a);
    return map;
  }, [achievements]);

  // Also doubles as dismissBanner (returned below) — called with an empty
  // queue just clears the current banner, no sound for that case, only
  // for an actual new one appearing.
  const advanceBanner = useCallback(() => {
    const next = bannerQueue.current.shift() ?? null;
    setBanner(next);
    if (next) playSoundEffect("museum.achievement");
  }, []);

  const checkThresholds = useCallback(
    (category: MuseumAchievementPublic["category"], value: number) => {
      for (const achievement of byCategory[category]) {
        if (earnedIds.current.has(achievement.id)) continue;
        if (value >= achievement.threshold) {
          earnedIds.current.add(achievement.id);
          const earned: EarnedAchievement = { ...achievement, reportedValue: value };
          bannerQueue.current.push(earned);
        }
      }
    },
    [byCategory]
  );

  // Show the next queued banner whenever nothing is currently showing —
  // covers both "just earned one" and "just dismissed one while more were
  // waiting" without two separate code paths.
  useEffect(() => {
    if (!banner && bannerQueue.current.length > 0) advanceBanner();
  }, [banner, advanceBanner, steps, views, elapsedSeconds, wishlistAdds]);

  // One-time "you've been here before this tab" check + baseline capture —
  // runs once per mount (i.e. once per museum entry, including after a
  // refresh, since component state is gone but sessionStorage survives a
  // refresh within the same tab).
  useEffect(() => {
    if (!enabled) return;
    try {
      if (sessionStorage.getItem(VISITED_FLAG_KEY)) {
        setShowWelcomeBack(true);
      } else {
        sessionStorage.setItem(VISITED_FLAG_KEY, "1");
      }
    } catch {
      // Private browsing / storage disabled — just never shows the notice.
    }
    wishlistBaseline.current = useWishlistStore.getState().items.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // Activity tracking — any real input resets the idle clock. Pointer-lock
  // FPS look still fires mousemove (with movementX/Y) even though the
  // cursor is hidden, so this works the same whether or not the pointer
  // is locked. Deliberately NOT gated on `enabled` — MiniMapHud.tsx's
  // always-on "time inside" stat reuses this same steps/elapsedSeconds
  // tracking regardless of whether the Achievements feature itself is on
  // (only the threshold/banner/claim machinery below stays achievement-
  // gated; counting itself doesn't need to be).
  useEffect(() => {
    function markActive() {
      lastActivity.current = Date.now();
    }
    window.addEventListener("mousemove", markActive);
    window.addEventListener("keydown", markActive);
    window.addEventListener("touchstart", markActive);
    window.addEventListener("touchmove", markActive);
    window.addEventListener("pointerdown", markActive);
    return () => {
      window.removeEventListener("mousemove", markActive);
      window.removeEventListener("keydown", markActive);
      window.removeEventListener("touchstart", markActive);
      window.removeEventListener("touchmove", markActive);
      window.removeEventListener("pointerdown", markActive);
    };
  }, []);

  // The elapsed-time ticker itself — only advances while active. Also
  // deliberately not gated on `enabled` — see the activity-tracking effect
  // above.
  useEffect(() => {
    const interval = setInterval(() => {
      if (Date.now() - lastActivity.current < IDLE_TIMEOUT_MS) {
        setElapsedSeconds((s) => {
          const next = s + 1;
          checkThresholds("time", Math.floor(next / 60));
          return next;
        });
      }
    }, TICK_MS);
    return () => clearInterval(interval);
  }, [checkThresholds]);

  // Wishlist adds this session — a net increase from the count at museum
  // entry, ignoring removals (a trophy shouldn't be taken back for
  // changing your mind), and never counting whatever was already
  // wishlisted from a previous, unrelated site visit.
  useEffect(() => {
    if (!enabled || wishlistBaseline.current === null) return;
    const delta = Math.max(0, wishlistCount - wishlistBaseline.current);
    setWishlistAdds(delta);
    checkThresholds("wishlist", delta);
  }, [enabled, wishlistCount, checkThresholds]);

  const reportSteps = useCallback(
    (totalSteps: number) => {
      setSteps(totalSteps);
      checkThresholds("steps", totalSteps);
    },
    [checkThresholds]
  );

  const reportArtworkViewed = useCallback(() => {
    setViews((v) => {
      const next = v + 1;
      checkThresholds("views", next);
      return next;
    });
  }, [checkThresholds]);

  // Is there anything in this session worth warning about losing? Progress
  // here is session-only and never persisted (see this file's top comment),
  // so leaving really does discard it.
  //
  // Returned as well as used below because two different guards have to
  // agree on the answer: this file's beforeunload (refresh/close) and
  // MuseumClient's Back-to-Gallery confirmation. Two copies of the
  // condition would eventually drift into a museum that warns on refresh
  // but not on exit, or the reverse.
  //
  // `enabled` is part of it: the warning exists to protect *achievement*
  // progress, so a museum with Achievements switched off has nothing to
  // interrupt anyone over.
  const hasProgress =
    enabled && (steps > 0 || views > 0 || elapsedSeconds > 0 || wishlistAdds > 0);

  // Warn before a refresh/close discards it — browsers only allow their own
  // generic "leave site?" wording here, no custom copy (see the confirmed
  // design note on this limitation), and mobile browsers routinely suppress
  // the dialog outright. Neither is fixable from here, which is why the
  // in-app exit path gets a real modal of its own rather than leaning on
  // this. This still covers what a modal cannot: refresh and tab close.
  useEffect(() => {
    if (!hasProgress) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasProgress]);

  return {
    steps,
    views,
    elapsedSeconds,
    wishlistAdds,
    hasProgress,
    banner,
    dismissBanner: advanceBanner,
    showWelcomeBack,
    dismissWelcomeBack: () => setShowWelcomeBack(false),
    reportSteps,
    reportArtworkViewed,
  };
}
