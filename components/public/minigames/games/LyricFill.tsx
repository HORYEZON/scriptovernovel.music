"use client";

// components/public/minigames/games/LyricFill.tsx
//
// A few lyric lines with blanks, a bank of words. Tap a blank (or the next
// empty one is selected), tap a word to fill it; tap a filled blank to
// clear it. "Check" submits — the server grades against its own key.
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { LyricFillChallenge, LyricFillMoves } from "@/lib/minigames/types";

export function LyricFill({
  challenge,
  interactive,
  onProgress,
  onComplete,
  playMoveSound,
}: {
  challenge: LyricFillChallenge;
  interactive: boolean;
  onProgress: (moves: number) => void;
  onComplete: (moves: LyricFillMoves) => void;
  playMoveSound: () => void;
}) {
  const [filled, setFilled] = useState<(string | null)[]>(Array(challenge.blanks).fill(null));
  const [active, setActive] = useState(0);
  const [done, setDone] = useState(false);
  const used = new Set(filled.filter(Boolean) as string[]);
  const allFilled = filled.every(Boolean);

  function chooseWord(word: string) {
    if (!interactive || done || used.has(word)) return;
    const slot = filled[active] === null ? active : filled.findIndex((f) => f === null);
    if (slot < 0) return;
    playMoveSound();
    const next = [...filled];
    next[slot] = word;
    setFilled(next);
    onProgress(next.filter(Boolean).length);
    const nextEmpty = next.findIndex((f) => f === null);
    setActive(nextEmpty < 0 ? slot : nextEmpty);
  }
  function clearBlank(i: number) {
    if (!interactive || done) return;
    const next = [...filled];
    next[i] = null;
    setFilled(next);
    setActive(i);
  }
  function check() {
    if (!allFilled || done) return;
    setDone(true);
    onComplete({ kind: "LYRIC_FILL", answers: filled as string[] });
  }

  // Render lines, replacing each "____" with a blank slot in order.
  let blankIndex = 0;
  return (
    <div className="mx-auto w-full max-w-lg">
      <p className="text-center font-body text-[11px] uppercase tracking-[0.3em] text-white/50">
        {challenge.release.title} · “{challenge.trackTitle}”
      </p>
      <div className="mt-5 space-y-3 rounded-xl border border-white/10 bg-white/5 p-5 text-center font-fraunces text-xl font-light leading-relaxed text-white md:text-2xl">
        {challenge.lines.map((line, li) => (
          <p key={li}>
            {line.split(/(____)/).map((part, pi) => {
              if (part !== "____") return <span key={pi}>{part}</span>;
              const i = blankIndex++;
              const value = filled[i];
              return (
                <button
                  key={pi}
                  type="button"
                  onClick={() => (value ? clearBlank(i) : setActive(i))}
                  disabled={!interactive || done}
                  className={cn(
                    "mx-1 inline-block min-w-[4.5em] rounded-md border-b-2 px-2 align-baseline font-body text-base transition-colors",
                    value ? "border-sepia text-sepia-light" : active === i ? "border-white text-white/40" : "border-white/30 text-white/30"
                  )}
                >
                  {value ?? "…"}
                </button>
              );
            })}
          </p>
        ))}
      </div>
      <ul className="mt-5 flex flex-wrap justify-center gap-2">
        {challenge.choices.map((word) => (
          <li key={word}>
            <button
              type="button"
              onClick={() => chooseWord(word)}
              disabled={!interactive || done || used.has(word)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 font-body text-sm transition-colors",
                used.has(word) ? "border-white/10 text-white/25" : "border-white/20 text-white hover:border-white/60 hover:bg-white/5",
                "disabled:cursor-not-allowed"
              )}
            >
              {word}
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={check}
          disabled={!interactive || done || !allFilled}
          className="rounded-full bg-cream px-6 py-2.5 font-body text-[11px] font-medium uppercase tracking-[0.18em] text-ink transition-transform hover:scale-[1.04] disabled:opacity-40 disabled:hover:scale-100"
        >
          Check
        </button>
      </div>
    </div>
  );
}
