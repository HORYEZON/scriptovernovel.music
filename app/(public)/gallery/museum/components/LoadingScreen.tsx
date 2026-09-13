"use client";

// app/(public)/gallery/museum/components/LoadingScreen.tsx
//
// The overlay a visitor sits behind while the museum's first wave of assets
// downloads. Two callers, and the difference matters:
//
//  - MuseumClient's dynamic-import fallback and its `view === "loading"`
//    state render it with no `progress`. Nothing is measurable yet there —
//    the scene bundle itself is still arriving — so the bar runs its own
//    indeterminate sweep rather than claiming a number it doesn't have.
//  - EntryLoadGate renders it with a real 0..1 fraction off
//    THREE.DefaultLoadingManager once the scene is mounted and fetching.
//
// The backdrop is translucent + blurred rather than opaque black so that the
// half-built room behind it reads as "developing" instead of hidden, and so
// the hand-off at the end is a blur lifting rather than a curtain cutting to
// a different image.
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Landmark } from "lucide-react";

/** How long a wait runs before the overlay stops waiting quietly and retries.
 *  Long enough that an ordinary load never reaches it, short enough that a
 *  visitor is not left staring at a bar wondering whether to touch something. */
const SLOW_NOTICE_MS = 12000;

/** Seconds counted down on screen before the automatic retry fires. The
 *  countdown is the point as much as the delay is: the previous Reload button
 *  read as dead precisely because nothing acknowledged it, so the retry says
 *  what it is about to do and then visibly does it. */
const AUTO_RELOAD_COUNTDOWN_S = 5;

/** How many automatic retries a single browser tab is allowed before it stops
 *  and asks the visitor to wait it out.
 *
 *  This cap is what separates a retry from a reload loop. A reload keeps every
 *  chunk that finished — they carry a one-year immutable Cache-Control — so
 *  each attempt does make forward progress, but it also abandons whatever was
 *  mid-flight, and the museum's largest chunk is big enough that restarting it
 *  repeatedly would cost more than it recovers. Three attempts clears a dead
 *  connection (the case a retry genuinely fixes) without turning a merely slow
 *  one into a page that can never finish loading. */
const MAX_AUTO_RELOADS = 3;

const AUTO_RELOAD_KEY = "museum_autoreload_attempts";

function autoReloadsUsed(): number {
  try {
    return Number(sessionStorage.getItem(AUTO_RELOAD_KEY) ?? 0) || 0;
  } catch {
    // Storage blocked (private mode, locked-down settings). Fail toward the
    // cap being spent rather than toward an unbounded loop: a visitor who
    // waits is inconvenienced, one stuck reloading forever never gets in.
    return MAX_AUTO_RELOADS;
  }
}

/**
 * Forget the retry budget, so a later museum visit in the same tab starts with
 * a full three again.
 *
 * Called from MuseumClient the moment the museum is actually interactive —
 * deliberately not from this component's own unmount. Each phase of the load
 * (route render, scene chunk, asset gate) mounts and unmounts its own
 * LoadingScreen, so clearing on unmount would reset the budget at every phase
 * boundary and hand back exactly the unbounded loop the cap exists to prevent.
 */
export function clearMuseumAutoReloads() {
  try {
    sessionStorage.removeItem(AUTO_RELOAD_KEY);
  } catch {
    // Nothing to clear if it could never be written.
  }
}

export function LoadingScreen({
  progress,
  slowNotice = false,
}: {
  progress?: number;
  /**
   * After SLOW_NOTICE_MS, tell the visitor the load is still running and retry
   * it for them — up to MAX_AUTO_RELOADS times per tab.
   *
   * The history is worth keeping, because this spot has now been wrong twice.
   * It began as a **Reload** button, which read as dead: a reload starts a new
   * document load while the browser keeps painting the old one, so the tap
   * produced no visible change and visitors used the browser's own refresh
   * anyway. It was then removed in favour of "keep this page open", on the
   * reasoning that reloading throws the download away.
   *
   * That reasoning was half right. A reload does abandon whatever is in flight
   * — but every chunk that already *finished* is cached for a year, so a retry
   * resumes from there rather than from zero. Which makes retrying genuinely
   * worth doing for the case that actually strands people: a connection that
   * drops mid-download leaves requests that will never settle and never fail,
   * and no amount of waiting fixes those. Only a new request does.
   *
   * So: retry automatically, count down on screen so it is visibly not a dead
   * control, and stop after three attempts so a merely slow connection is
   * never trapped in a loop. See v6.28.1 in Docs/Progress_Timeline.md.
   */
  slowNotice?: boolean;
}) {
  const determinate = typeof progress === "number";
  const pct = determinate ? Math.round(Math.min(1, Math.max(0, progress)) * 100) : 0;

  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!slowNotice) return;
    const t = setTimeout(() => setSlow(true), SLOW_NOTICE_MS);
    return () => clearTimeout(t);
  }, [slowNotice]);

  // Read once, on the client only, when the notice appears — never during
  // render, where touching sessionStorage would diverge the server's HTML from
  // the client's first paint and trip hydration. `null` means "not measured
  // yet", which renders neither branch of the message below.
  const [retriesLeft, setRetriesLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!slow) return;
    setRetriesLeft(Math.max(0, MAX_AUTO_RELOADS - autoReloadsUsed()));
  }, [slow]);

  // The countdown, then the retry. Ticks once a second so the number on screen
  // is the number of seconds left, and spends one attempt from the budget
  // immediately before reloading — the increment has to survive the navigation,
  // which is the whole reason the budget lives in sessionStorage rather than in
  // state.
  const [countdown, setCountdown] = useState(AUTO_RELOAD_COUNTDOWN_S);
  const willRetry = retriesLeft !== null && retriesLeft > 0;
  useEffect(() => {
    if (!willRetry) return;
    if (countdown <= 0) {
      try {
        sessionStorage.setItem(AUTO_RELOAD_KEY, String(autoReloadsUsed() + 1));
      } catch {
        // autoReloadsUsed() already reports the cap as spent when storage is
        // unavailable, so this branch is unreachable in practice — and if it
        // somehow isn't, reloading without recording the attempt is the one
        // thing that could loop. Bail instead.
        return;
      }
      window.location.reload();
      return;
    }
    const t = setTimeout(() => setCountdown((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [willRetry, countdown]);

  return (
    <motion.div
      // Above the museum HUD, which runs up to z-[60]. This used to sit at
      // z-40, which was fine while it only ever showed *instead of* the scene
      // — but EntryLoadGate now holds it over a mounted, HUD-bearing canvas,
      // and the joystick, map and filter buttons would otherwise float on top
      // of the overlay that is meant to be covering them.
      className="absolute inset-0 z-[70] flex flex-col items-center justify-center bg-black/80 backdrop-blur-xl text-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      // The scene underneath is already interactive by the time this unmounts,
      // so the exit is a reveal of something live, not a transition to a still.
      exit={{ opacity: 0, transition: { duration: 0.45, ease: "easeOut" } }}
      transition={{ duration: 0.2 }}
    >
      <div className="inline-flex p-4 rounded-full bg-emerald-500/10 text-emerald-400 mb-5 animate-pulse">
        <Landmark size={32} />
      </div>
      <p className="font-grotesk uppercase tracking-[0.3em] text-sm mb-2">
        Entering Digital Museum…
      </p>
      <p className="font-body text-xs text-white/40 mb-4 tabular-nums">
        {determinate ? `Loading artworks and objects… ${pct}%` : "Loading artworks…"}
      </p>

      <div className="w-48 h-1 rounded-full bg-white/10 overflow-hidden">
        {determinate ? (
          <motion.div
            className="h-full bg-emerald-500"
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          />
        ) : (
          // No total to divide by yet — a sweep reads as "working" without
          // implying a position the caller can't actually measure.
          <motion.div
            className="h-full w-1/3 bg-emerald-500"
            animate={{ x: ["-100%", "300%"] }}
            transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
      </div>

      {slow && (
        <motion.div
          className="mt-6 flex flex-col items-center gap-3 px-6 text-center"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          {willRetry ? (
            <>
              <p className="font-body text-xs text-white/55 max-w-[17rem] leading-relaxed">
                This is taking longer than usual. Your connection may have
                dropped part of the museum.
              </p>
              {/* Says the number out loud, and `aria-live` so a screen reader
                  announces the retry rather than the page changing under it.
                  tabular-nums keeps 5 → 4 → 3 from nudging the line's width. */}
              <p
                aria-live="polite"
                className="font-body text-[11px] text-emerald-400/90 max-w-[17rem] leading-relaxed tabular-nums"
              >
                Trying again automatically in {countdown}…
              </p>
            </>
          ) : (
            retriesLeft !== null && (
              <>
                <p className="font-body text-xs text-white/55 max-w-[17rem] leading-relaxed">
                  Still loading — the museum is a large download the first time.
                </p>
                {/* The budget is spent, so this is the end of the line: three
                    retries have not got past it, and a fourth would only keep
                    abandoning whatever is in flight. What is left really is to
                    wait, and the wait is finite — everything that lands is
                    cached for a year. */}
                <p className="font-body text-[11px] text-white/35 max-w-[17rem] leading-relaxed">
                  Keep this page open — it&apos;s much faster once it finishes.
                </p>
              </>
            )
          )}
        </motion.div>
      )}
    </motion.div>
  );
}
