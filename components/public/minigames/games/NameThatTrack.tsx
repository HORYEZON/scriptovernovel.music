"use client";

// components/public/minigames/games/NameThatTrack.tsx
//
// A track title, a grid of covers: which record is it on? One pick,
// judged by the server (the answer is redacted from the browser's copy).
import { useState } from "react";
import { cn } from "@/lib/utils";
import { imageVariantUrl } from "@/lib/images/variants";
import type { NameThatTrackChallenge, NameThatTrackMoves } from "@/lib/minigames/types";

export function NameThatTrack({
  challenge,
  interactive,
  onProgress,
  onComplete,
  playMoveSound,
}: {
  challenge: NameThatTrackChallenge;
  interactive: boolean;
  onProgress: (moves: number) => void;
  onComplete: (moves: NameThatTrackMoves) => void;
  playMoveSound: () => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  function pick(id: string) {
    if (!interactive || picked) return;
    playMoveSound();
    setPicked(id);
    onProgress(1);
    onComplete({ kind: "NAME_THAT_TRACK", picks: [id] });
  }
  return (
    <div className="mx-auto w-full max-w-lg">
      <p className="text-center font-body text-[11px] uppercase tracking-[0.3em] text-white/50">Which record is this on?</p>
      <p className="mt-2 text-center font-fraunces text-2xl font-light text-white md:text-3xl">“{challenge.trackTitle}”</p>
      <ul className={cn("mt-6 grid gap-3", challenge.options.length > 4 ? "grid-cols-3" : "grid-cols-2")}>
        {challenge.options.map((o) => (
          <li key={o.id}>
            <button
              type="button"
              onClick={() => pick(o.id)}
              disabled={!interactive || picked !== null}
              className={cn(
                "group block w-full overflow-hidden rounded-xl border text-left transition-colors",
                picked === o.id ? "border-sepia" : "border-white/15 hover:border-white/50",
                "disabled:cursor-not-allowed"
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageVariantUrl(o.coverImageUrl, "thumb")} alt="" draggable={false} className="aspect-square w-full object-cover" />
              <span className="block truncate px-2 py-1.5 font-body text-[11px] text-white/80">{o.title}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
