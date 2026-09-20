"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Clock, MousePointerClick, Volume2, VolumeX, X } from "lucide-react";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/minigames/scoring";
import { DIFFICULTY_LABELS } from "@/lib/minigames/types";
import type {
  GameMoves,
  PublicGame,
  StartGameResponse,
  SubmitResultResponse,
} from "@/lib/minigames/types";
import { ExitConfirmModal } from "./ExitConfirmModal";
import { GameIcon } from "./GameIcon";
import { GameResult } from "./GameResult";
import { useFocusTrap, useGameClock, useGameSound } from "./hooks";
import { ArtMemoryCards } from "./games/ArtMemoryCards";
import { ArtPuzzle } from "./games/ArtPuzzle";
import { ArtSlidingPuzzle } from "./games/ArtSlidingPuzzle";
import { FindTheDifference } from "./games/FindTheDifference";
import { GuessTheCover } from "./games/GuessTheCover";
import { NameThatTrack } from "./games/NameThatTrack";
import { LyricFill } from "./games/LyricFill";
import { OrderList } from "./games/OrderList";
import { RotateAndSolve } from "./games/RotateAndSolve";

interface GameSessionProps {
  game: PublicGame;
  onClose: () => void;
}

type Phase = "starting" | "playing" | "submitting" | "finished" | "timeup" | "error";

/**
 * One round, start to finish.
 *
 * Gameplay is entirely local — no request leaves the browser between the
 * session being created and the result being submitted. That is deliberate:
 * a tile-by-tile round trip would be both slower to play and, on a free-tier
 * database, wasteful for no gain, since the server re-derives everything it
 * needs from the move log at the end.
 */
export function GameSession({ game, onClose }: GameSessionProps) {
  const [phase, setPhase] = useState<Phase>("starting");
  const [session, setSession] = useState<StartGameResponse | null>(null);
  const [result, setResult] = useState<SubmitResultResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [moveCount, setMoveCount] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // Held so a failed submit can be retried without replaying the round.
  const pendingMoves = useRef<GameMoves | null>(null);

  useLockBodyScroll(true);
  const containerRef = useFocusTrap(true);
  const sound = useGameSound();

  // Local wall-clock start, used only for the on-screen timer. The score is
  // timed from the session row's startedAt on the server.
  const [roundStart, setRoundStart] = useState<number | null>(null);
  const elapsed = useGameClock(phase === "playing", roundStart);

  const timeLimitMs = (session?.timeLimitSec ?? 0) * 1000;
  const remainingMs = timeLimitMs > 0 ? Math.max(0, timeLimitMs - elapsed) : null;

  // ── Start a round ──────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function start() {
      setPhase("starting");
      setError(null);
      setResult(null);
      setMoveCount(0);
      pendingMoves.current = null;

      try {
        const response = await fetch("/api/minigames/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: game.type }),
        });
        const data = await response.json().catch(() => ({}));

        if (cancelled) return;
        if (!response.ok) {
          setError(data?.error ?? "This game could not be started.");
          setPhase("error");
          return;
        }

        setSession(data as StartGameResponse);
        setRoundStart(Date.now());
        setPhase("playing");
      } catch {
        if (cancelled) return;
        setError("Could not reach the server. Check your connection and try again.");
        setPhase("error");
      }
    }

    start();
    return () => {
      cancelled = true;
    };
  }, [game.type, attempt]);

  // ── Time limit ─────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "playing" || remainingMs === null) return;
    if (remainingMs > 0) return;
    setPhase("timeup");
  }, [phase, remainingMs]);

  // ── Finish a round ─────────────────────────────────────────────────
  const submit = useCallback(
    async (moves: GameMoves) => {
      if (!session) return;
      pendingMoves.current = moves;
      setPhase("submitting");
      setError(null);

      try {
        const response = await fetch("/api/minigames/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: session.sessionId, moves }),
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          setError(data?.error ?? "That result could not be recorded.");
          setPhase("error");
          return;
        }

        setResult(data as SubmitResultResponse);
        setPhase("finished");
      } catch {
        setError("Could not reach the server. Your round is still open — try again.");
        setPhase("error");
      }
    },
    [session]
  );

  const playAgain = useCallback(() => {
    setSession(null);
    setRoundStart(null);
    setAttempt((n) => n + 1);
  }, []);

  // Whether closing right now would throw away something real: a round in
  // progress, or a finished round whose result hasn't made it to the server
  // yet (a failed submit that's still retryable via pendingMoves).
  const hasUnsavedRound =
    phase === "playing" || phase === "submitting" || (phase === "error" && pendingMoves.current !== null);

  const requestClose = useCallback(() => {
    if (hasUnsavedRound) {
      // Play the moment the modal actually appears, not after the visitor
      // resolves it — a confirmation sound is meant to announce the prompt,
      // not react to whichever button they end up pressing.
      sound.play("minigame.exit");
      setShowExitConfirm(true);
    } else {
      onClose();
    }
  }, [hasUnsavedRound, onClose, sound]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") requestClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [requestClose]);

  // Refreshing or closing the tab loses the round the same way an in-app
  // close does — the browser only offers its own generic prompt for that,
  // not our copy, but it's the same guard for the same reason.
  useEffect(() => {
    if (!hasUnsavedRound) return;
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsavedRound]);

  const interactive = phase === "playing";

  return (
    // The scrolling lives on the inner layer, not here, so this root stays a
    // still frame the exit dialog below can be positioned against.
    //
    // It cannot simply be `fixed` there: this element's `backdrop-blur-md` (any
    // filter does it) makes it the containing block for fixed-position
    // descendants, so a `fixed inset-0` child resolves against *this* box and,
    // while this box was also the scroller, behaved like an absolutely
    // positioned child of the scrolled content — the dialog slid away with the
    // board as soon as a player scrolled. Splitting the two means the dialog's
    // `absolute inset-0` is always exactly the visible frame, whatever the
    // scroll position, and it holds under the museum's forced-landscape
    // rotate as well, where that overflow was reachable on every round.
    <motion.div
      className="fixed inset-0 z-[80] bg-ink/95 backdrop-blur-md"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      role="dialog"
      aria-modal="true"
      aria-label={`${game.name} mini game`}
    >
      <div className="absolute inset-0 overflow-y-auto">
        <div ref={containerRef} className="min-h-full flex flex-col max-w-3xl mx-auto p-4 sm:p-6">
          {/* ── Header ── */}
          <header className="shrink-0 flex items-start justify-between gap-4 mb-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sepia">
                <GameIcon icon={game.icon} size={16} />
                <h2 className="font-grotesk text-base sm:text-lg font-semibold tracking-widest uppercase text-cream truncate">
                  {game.name}
                </h2>
              </div>
              <p className="font-body text-xs text-white/40 mt-1">
                {DIFFICULTY_LABELS[game.difficulty]}
                {session?.artwork ? ` · ${session.artwork.title}` : ""}
              </p>
            </div>
            <div className="shrink-0 flex items-center gap-1">
              <button
                type="button"
                onClick={sound.toggleMuted}
                aria-label={sound.muted ? "Unmute game sounds" : "Mute game sounds"}
                title={sound.muted ? "Unmute game sounds" : "Mute game sounds"}
                className="p-2 -m-1 text-white/60 hover:text-cream transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sepia rounded"
              >
                {sound.muted ? (
                  <VolumeX size={19} strokeWidth={1.5} />
                ) : (
                  <Volume2 size={19} strokeWidth={1.5} />
                )}
              </button>
              <button
                type="button"
                onClick={requestClose}
                aria-label="Close game"
                className="p-2 -m-1 text-white/60 hover:text-cream transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sepia rounded"
              >
                <X size={22} strokeWidth={1.5} />
              </button>
            </div>
          </header>

          {/* ── HUD ── */}
          {(phase === "playing" || phase === "submitting") && (
            <div className="shrink-0 flex items-center justify-center gap-6 mb-4 font-mono text-sm">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 tabular-nums",
                  remainingMs !== null && remainingMs < 15_000 ? "text-vermillion" : "text-white/60"
                )}
              >
                <Clock size={14} aria-hidden="true" />
                <span className="sr-only">
                  {remainingMs !== null ? "Time remaining" : "Time elapsed"}:{" "}
                </span>
                {formatDuration(remainingMs ?? elapsed)}
              </span>
              <span className="inline-flex items-center gap-1.5 text-white/60 tabular-nums">
                <MousePointerClick size={14} aria-hidden="true" />
                <span className="sr-only">Moves: </span>
                {moveCount}
              </span>
            </div>
          )}

          {/* ── Body ── */}
          <div className="flex-1 flex flex-col justify-center">
            {phase === "starting" && (
              <div className="text-center py-16" role="status">
                <div className="w-6 h-6 mx-auto border border-white/20 border-t-sepia rounded-full animate-spin" />
                <p className="font-body text-sm text-white/40 mt-4">Setting up the board…</p>
              </div>
            )}

            {phase === "error" && (
              <div className="text-center py-12 px-4" role="alert">
                <AlertCircle size={28} strokeWidth={1} className="mx-auto text-vermillion mb-3" />
                <p className="font-body text-sm text-cream/80 max-w-sm mx-auto">{error}</p>
                <div className="flex flex-col sm:flex-row gap-2 justify-center mt-6">
                  {/* Only offered when a completed round failed to send — a
                      round that was rejected has nothing left to retry. */}
                  {pendingMoves.current && (
                    <button
                      type="button"
                      onClick={() => pendingMoves.current && submit(pendingMoves.current)}
                      className="px-4 py-2.5 rounded-lg bg-cream text-ink font-body text-sm hover:bg-white transition-colors"
                    >
                      Try sending again
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={playAgain}
                    className="px-4 py-2.5 rounded-lg border border-sepia/50 text-sepia font-body text-sm hover:bg-sepia/10 transition-colors"
                  >
                    Start a new round
                  </button>
                  <button
                    type="button"
                    onClick={requestClose}
                    className="px-4 py-2.5 rounded-lg border border-white/15 text-white/70 font-body text-sm hover:text-cream transition-colors"
                  >
                    Back to gallery
                  </button>
                </div>
              </div>
            )}

            {phase === "timeup" && (
              <div className="text-center py-12" role="alert">
                <Clock size={28} strokeWidth={1} className="mx-auto text-vermillion mb-3" />
                <p className="font-grotesk text-lg tracking-widest uppercase text-cream">
                  Time&apos;s up
                </p>
                <p className="font-body text-sm text-white/40 mt-2">
                  This round ran out of time, so it can&apos;t be scored.
                </p>
                <div className="flex flex-col sm:flex-row gap-2 justify-center mt-6">
                  <button
                    type="button"
                    onClick={playAgain}
                    className="px-4 py-2.5 rounded-lg bg-sepia text-ink font-body text-sm hover:bg-sepia-light transition-colors"
                  >
                    Try again
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2.5 rounded-lg border border-white/15 text-white/70 font-body text-sm hover:text-cream transition-colors"
                  >
                    Back to gallery
                  </button>
                </div>
              </div>
            )}

            {phase === "finished" && result && session && (
              <GameResult
                sessionId={session.sessionId}
                gameName={game.name}
                result={result}
                onPlayAgain={playAgain}
                onClose={onClose}
              />
            )}

            {(phase === "playing" || phase === "submitting") && session && (
              <>
                <GameCanvas
                  session={session}
                  interactive={interactive}
                  onProgress={setMoveCount}
                  onComplete={submit}
                  playMoveSound={() => sound.play("minigame.move")}
                />
                {phase === "submitting" && (
                  <p className="font-body text-sm text-sepia text-center mt-4" role="status">
                    Checking your round…
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showExitConfirm && (
          <ExitConfirmModal
            onCancel={() => setShowExitConfirm(false)}
            onConfirm={() => {
              setShowExitConfirm(false);
              onClose();
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/**
 * Dispatch to the right game.
 *
 * Switching on `challenge.kind` rather than the game type is what makes this
 * type-safe: the challenge union is discriminated, so each branch hands its
 * component an already-narrowed challenge and TypeScript flags a new game
 * type that has no branch here.
 */
function GameCanvas({
  session,
  interactive,
  onProgress,
  onComplete,
  playMoveSound,
}: {
  session: StartGameResponse;
  interactive: boolean;
  onProgress: (moves: number) => void;
  onComplete: (moves: GameMoves) => void;
  /** Every game plays this on its own notion of a "move" — a swap, a tap, a
   * slide, a card flip, a click — not just the sliding puzzle. */
  playMoveSound: () => void;
}) {
  const { challenge, artwork, secondaryArtwork } = session;

  // The music games carry everything they need inside the challenge; only
  // the image puzzles need the subject picture.
  switch (challenge.kind) {
    case "GUESS_THE_COVER":
      return <GuessTheCover challenge={challenge} interactive={interactive} onProgress={onProgress} onComplete={onComplete} playMoveSound={playMoveSound} />;
    case "NAME_THAT_TRACK":
      return <NameThatTrack challenge={challenge} interactive={interactive} onProgress={onProgress} onComplete={onComplete} playMoveSound={playMoveSound} />;
    case "LYRIC_FILL":
      return <LyricFill challenge={challenge} interactive={interactive} onProgress={onProgress} onComplete={onComplete} playMoveSound={playMoveSound} />;
    case "TRACKLIST_ORDER":
      return (
        <OrderList
          items={challenge.titles.map((t, i) => ({ key: `${i}-${t}`, label: t }))}
          order={challenge.order}
          interactive={interactive}
          onProgress={onProgress}
          onComplete={(swaps) => onComplete({ kind: "TRACKLIST_ORDER", swaps })}
          playMoveSound={playMoveSound}
          hint={`${challenge.release.title} — tap two songs to swap them.`}
        />
      );
    case "RELEASE_TIMELINE":
      return (
        <OrderList
          items={challenge.options.map((o) => ({ key: o.id, label: o.title, imageUrl: o.coverImageUrl }))}
          order={challenge.order}
          interactive={interactive}
          onProgress={onProgress}
          onComplete={(swaps) => onComplete({ kind: "RELEASE_TIMELINE", swaps })}
          playMoveSound={playMoveSound}
          hint="Oldest at the top, newest at the bottom."
        />
      );
  }

  if (!artwork) {
    return (
      <p className="font-body text-sm text-white/50 text-center py-12" role="alert">
        The cover for this game is unavailable.
      </p>
    );
  }

  switch (challenge.kind) {
    case "ART_PUZZLE":
      return (
        <ArtPuzzle
          challenge={challenge}
          artwork={artwork}
          interactive={interactive}
          onProgress={onProgress}
          onComplete={onComplete}
          playMoveSound={playMoveSound}
        />
      );
    case "ROTATE_SOLVE":
      return (
        <RotateAndSolve
          challenge={challenge}
          artwork={artwork}
          interactive={interactive}
          onProgress={onProgress}
          onComplete={onComplete}
          playMoveSound={playMoveSound}
        />
      );
    case "SLIDING_PUZZLE":
      return (
        <ArtSlidingPuzzle
          challenge={challenge}
          artwork={artwork}
          interactive={interactive}
          onProgress={onProgress}
          onComplete={onComplete}
          playMoveSound={playMoveSound}
        />
      );
    case "MEMORY_CARDS":
      return (
        <ArtMemoryCards
          challenge={challenge}
          artwork={artwork}
          interactive={interactive}
          onProgress={onProgress}
          onComplete={onComplete}
          playMoveSound={playMoveSound}
        />
      );
    case "FIND_DIFFERENCE":
      if (!secondaryArtwork) {
        return (
          <p className="font-body text-sm text-white/50 text-center py-12" role="alert">
            The altered cover for this game is unavailable.
          </p>
        );
      }
      return (
        <FindTheDifference
          challenge={challenge}
          artwork={artwork}
          secondaryArtwork={secondaryArtwork}
          interactive={interactive}
          onProgress={onProgress}
          onComplete={onComplete}
          playMoveSound={playMoveSound}
        />
      );
  }
}
