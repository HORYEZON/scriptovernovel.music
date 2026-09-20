"use client";

// components/public/minigames/games/GuessTheCover.tsx
//
// A blurred cover, a row of titles. "Reveal more" sharpens it a step; a
// pick ends the round (the answer is redacted from the browser, so the
// server judges it). The pick is logged with the stage it was made at —
// an earlier (blurrier) right answer scores higher.
import { useState } from "react";
import { Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { imageVariantUrl } from "@/lib/images/variants";
import type { GuessTheCoverChallenge, GuessTheCoverMoves } from "@/lib/minigames/types";

export function GuessTheCover({
  challenge,
  interactive,
  onProgress,
  onComplete,
  playMoveSound,
}: {
  challenge: GuessTheCoverChallenge;
  interactive: boolean;
  onProgress: (moves: number) => void;
  onComplete: (moves: GuessTheCoverMoves) => void;
  playMoveSound: () => void;
}) {
  const [stage, setStage] = useState(0);
  const [picks, setPicks] = useState<{ stage: number; releaseId: string }[]>([]);
  const [done, setDone] = useState(false);
  // Blur from very blurry down to sharp across the stages.
  const blurPx = Math.round(28 * (1 - stage / Math.max(1, challenge.stages)));

  function reveal() {
    if (!interactive || done || stage >= challenge.stages - 1) return;
    playMoveSound();
    setStage((s) => s + 1);
  }

  function pick(id: string) {
    if (!interactive || done) return;
    playMoveSound();
    const next = [...picks, { stage, releaseId: id }];
    setPicks(next);
    onProgress(next.length);
    // The client can't know the answer (it was redacted); it submits on the
    // pick and the server says. To keep the round feeling responsive we
    // treat every pick as final: one guess, judged by the server.
    setDone(true);
    onComplete({ kind: "GUESS_THE_COVER", picks: next });
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="relative mx-auto aspect-square w-full max-w-xs overflow-hidden rounded-xl border border-white/10 bg-ink">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageVariantUrl(challenge.coverImageUrl, "medium")}
          alt=""
          draggable={false}
          className="h-full w-full scale-110 object-cover transition-[filter] duration-500"
          style={{ filter: `blur(${blurPx}px)` }}
        />
      </div>
      <div className="mt-3 flex items-center justify-between font-body text-[11px] uppercase tracking-[0.2em] text-white/50">
        <span>
          Reveal {stage + 1} / {challenge.stages}
        </span>
        <button
          type="button"
          onClick={reveal}
          disabled={!interactive || done || stage >= challenge.stages - 1}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-3 py-1 text-white/80 transition-colors hover:border-white/50 disabled:opacity-40"
        >
          <Eye size={12} /> Reveal more
        </button>
      </div>
      <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {challenge.options.map((o) => (
          <li key={o.id}>
            <button
              type="button"
              onClick={() => pick(o.id)}
              disabled={!interactive || done}
              className={cn(
                "w-full rounded-xl border px-4 py-3 text-left font-body text-sm transition-colors",
                picks.some((p) => p.releaseId === o.id) ? "border-sepia bg-sepia/10 text-white" : "border-white/15 text-white hover:border-white/50 hover:bg-white/5",
                "disabled:cursor-not-allowed"
              )}
            >
              {o.title}
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-center font-body text-[11px] text-white/40">Fewer reveals, more points. One guess — make it count.</p>
    </div>
  );
}
