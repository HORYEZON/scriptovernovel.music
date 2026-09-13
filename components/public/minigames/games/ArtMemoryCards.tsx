"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { tileBackgroundStyle } from "@/lib/minigames/images";
import type {
  MemoryCardsChallenge,
  MemoryCardsMoves,
  PublicGameArtwork,
} from "@/lib/minigames/types";
import { useImageAsset, usePrefersReducedMotion } from "../hooks";

interface ArtMemoryCardsProps {
  challenge: MemoryCardsChallenge;
  artwork: PublicGameArtwork;
  interactive: boolean;
  onProgress: (moves: number) => void;
  onComplete: (moves: MemoryCardsMoves) => void;
  playMoveSound: () => void;
}

/** How long a mismatched pair stays visible before turning back over. */
const MISMATCH_HOLD_MS = 850;

/**
 * Columns by deck size, chosen so no layout strands a lone card on its own
 * row. Written as whole class strings rather than an interpolated
 * `grid-cols-${n}` because Tailwind's purge only sees literals.
 */
function columnsFor(cards: number): string {
  if (cards <= 12) return "grid-cols-3 sm:grid-cols-4";
  if (cards <= 16) return "grid-cols-4";
  return "grid-cols-4 sm:grid-cols-5";
}

/**
 * Matching pairs, where the faces are crops of the configured artwork rather
 * than separate images — that is what lets every game in the system run off
 * the same single-artwork setting.
 *
 * The move log is the sequence of turns (which two cards were revealed each
 * time), so the server can replay it: check no already-matched card is flipped
 * again, and confirm every pair really was found.
 */
export function ArtMemoryCards({
  challenge,
  artwork,
  interactive,
  onProgress,
  onComplete,
  playMoveSound,
}: ArtMemoryCardsProps) {
  const asset = useImageAsset(artwork.imageUrl);
  const reducedMotion = usePrefersReducedMotion();
  const columns = columnsFor(challenge.deck.length);

  const [revealed, setRevealed] = useState<number[]>([]);
  const [matched, setMatched] = useState<boolean[]>(() =>
    new Array(challenge.deck.length).fill(false)
  );
  const [busy, setBusy] = useState(false);

  const flipsRef = useRef<[number, number][]>([]);
  const finishedRef = useRef(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    setRevealed([]);
    setMatched(new Array(challenge.deck.length).fill(false));
    setBusy(false);
    flipsRef.current = [];
    finishedRef.current = false;
  }, [challenge]);

  // A pending flip-back must not fire after the game is torn down, or React
  // warns and the next round starts with two cards mysteriously face-up.
  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleFlip = useCallback(
    (slot: number) => {
      if (!interactive || busy || finishedRef.current) return;
      if (matched[slot] || revealed.includes(slot)) return;

      if (revealed.length === 0) {
        setRevealed([slot]);
        playMoveSound();
        return;
      }

      const first = revealed[0];
      flipsRef.current.push([first, slot]);
      onProgress(flipsRef.current.length);
      playMoveSound();

      if (challenge.deck[first] === challenge.deck[slot]) {
        const nextMatched = [...matched];
        nextMatched[first] = true;
        nextMatched[slot] = true;
        setMatched(nextMatched);
        setRevealed([]);

        if (nextMatched.every(Boolean)) {
          finishedRef.current = true;
          onComplete({ kind: "MEMORY_CARDS", flips: flipsRef.current });
        }
        return;
      }

      // Miss: show both, then turn them back. `busy` blocks input meanwhile so
      // a fast tapper can't queue a third card into a two-card turn.
      setRevealed([first, slot]);
      setBusy(true);
      timeoutRef.current = window.setTimeout(() => {
        setRevealed([]);
        setBusy(false);
        timeoutRef.current = null;
      }, reducedMotion ? MISMATCH_HOLD_MS / 2 : MISMATCH_HOLD_MS);
    },
    [busy, challenge.deck, interactive, matched, onComplete, onProgress, playMoveSound, revealed, reducedMotion]
  );

  const matchCount = matched.filter(Boolean).length / 2;

  return (
    <div className="mx-auto w-full max-w-lg" style={{ touchAction: "manipulation" }}>
      <div
        className={cn("grid gap-2 sm:gap-2.5", columns)}
        role="group"
        aria-label="Memory cards"
      >
        {challenge.deck.map((pairId, slot) => {
          const isMatched = matched[slot];
          const isFaceUp = isMatched || revealed.includes(slot);

          return (
            <button
              key={slot}
              type="button"
              onClick={() => handleFlip(slot)}
              disabled={!interactive || isMatched}
              aria-label={
                isMatched
                  ? `Card ${slot + 1}, matched`
                  : isFaceUp
                    ? `Card ${slot + 1}, face up`
                    : `Card ${slot + 1}, face down`
              }
              className={cn(
                "relative aspect-square rounded-lg",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-sepia focus-visible:ring-offset-2 focus-visible:ring-offset-black",
                isMatched && "opacity-70",
                !isMatched && interactive && "hover:brightness-110"
              )}
              style={{ perspective: reducedMotion ? undefined : 800 }}
            >
              <span
                className={cn(
                  "absolute inset-0",
                  reducedMotion ? "transition-opacity duration-150" : "transition-transform duration-500"
                )}
                style={
                  reducedMotion
                    ? undefined
                    : {
                        transformStyle: "preserve-3d",
                        transform: isFaceUp ? "rotateY(180deg)" : "rotateY(0deg)",
                      }
                }
              >
                {/* Back — a quiet sepia panel, not a playing-card motif; the
                    artwork is meant to be the only picture on the table. */}
                <span
                  className={cn(
                    "absolute inset-0 rounded-lg border border-sepia/25 bg-gradient-to-br from-ink-800 to-black flex items-center justify-center",
                    reducedMotion && isFaceUp && "opacity-0"
                  )}
                  style={reducedMotion ? undefined : { backfaceVisibility: "hidden" }}
                  aria-hidden="true"
                >
                  <span className="w-2.5 h-2.5 rotate-45 border border-sepia/50" />
                </span>

                {/* Face — one cell of the artwork. */}
                <span
                  className={cn(
                    "absolute inset-0 rounded-lg overflow-hidden ring-1 ring-inset",
                    isMatched ? "ring-sepia/70" : "ring-white/10",
                    reducedMotion && !isFaceUp && "opacity-0"
                  )}
                  style={{
                    ...tileBackgroundStyle(artwork.imageUrl, challenge.faces[pairId], challenge.grid, {
                      imageRatio: asset.ratio,
                      boardRatio: 1,
                    }),
                    ...(reducedMotion
                      ? {}
                      : { backfaceVisibility: "hidden", transform: "rotateY(180deg)" }),
                  }}
                  aria-hidden="true"
                />
              </span>

              {/* Matched cards get a mark as well as a colour shift. */}
              {isMatched && (
                <span
                  aria-hidden="true"
                  className="absolute top-1 right-1 z-10 w-1.5 h-1.5 rounded-full bg-sepia"
                />
              )}
            </button>
          );
        })}
      </div>

      <p className="sr-only" aria-live="polite">
        {matchCount} of {challenge.pairs} pairs matched
      </p>
    </div>
  );
}
