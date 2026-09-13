"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { tileBackgroundStyle } from "@/lib/minigames/images";
import type {
  PublicGameArtwork,
  RotateSolveChallenge,
  RotateSolveMoves,
} from "@/lib/minigames/types";
import { useImageAsset, usePrefersReducedMotion } from "../hooks";
import { GameBoard } from "./GameBoard";

interface RotateAndSolveProps {
  challenge: RotateSolveChallenge;
  artwork: PublicGameArtwork;
  interactive: boolean;
  onProgress: (moves: number) => void;
  onComplete: (moves: RotateSolveMoves) => void;
  playMoveSound: () => void;
}

/**
 * Every tile starts turned; tapping one turns it another quarter. Solved is
 * "all tiles at zero turns", which is deterministic and reachable from any
 * starting state — there is no orientation you can get stuck in.
 *
 * This is the one game with a square board. A tile has to be square for a 90°
 * rotation to land back inside its own box, so the artwork is letterboxed to
 * fit that square whole rather than cropped or stretched (see
 * tileBackgroundStyle's `fit: "contain"`).
 */
export function RotateAndSolve({
  challenge,
  artwork,
  interactive,
  onProgress,
  onComplete,
  playMoveSound,
}: RotateAndSolveProps) {
  const size = challenge.grid;
  const asset = useImageAsset(artwork.imageUrl);
  const reducedMotion = usePrefersReducedMotion();
  const [rotations, setRotations] = useState<number[]>(() => [...challenge.rotations]);
  const tapsRef = useRef<number[]>([]);
  const finishedRef = useRef(false);

  useEffect(() => {
    setRotations([...challenge.rotations]);
    tapsRef.current = [];
    finishedRef.current = false;
  }, [challenge]);

  const handleTap = useCallback(
    (tile: number) => {
      if (!interactive || finishedRef.current) return;

      const next = [...rotations];
      next[tile] = (next[tile] + 1) % 4;
      tapsRef.current.push(tile);

      setRotations(next);
      onProgress(tapsRef.current.length);
      playMoveSound();

      if (next.every((turns) => turns === 0)) {
        finishedRef.current = true;
        onComplete({ kind: "ROTATE_SOLVE", taps: tapsRef.current });
      }
    },
    [interactive, onComplete, onProgress, playMoveSound, rotations]
  );

  const solvedCount = rotations.filter((turns) => turns === 0).length;

  return (
    <GameBoard ratio={1} status={asset.status} label="Rotate and solve board">
      <div
        className="absolute inset-0 grid gap-[2px]"
        style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
      >
        {rotations.map((turns, tile) => (
          <button
            key={tile}
            type="button"
            onClick={() => handleTap(tile)}
            disabled={!interactive}
            aria-label={`Tile ${tile + 1}, turned ${turns * 90} degrees${
              turns === 0 ? ", upright" : ""
            }`}
            className={cn(
              "relative rounded-[2px] overflow-hidden",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-sepia focus-visible:ring-offset-1 focus-visible:ring-offset-black",
              interactive && "hover:brightness-110",
              !interactive && "cursor-default",
              reducedMotion ? "transition-none" : "transition-transform duration-300 ease-out"
            )}
            style={{
              ...tileBackgroundStyle(artwork.imageUrl, tile, size, {
                imageRatio: asset.ratio,
                boardRatio: 1,
                // The board is forced square for the 90° rotation to work;
                // "contain" shows the whole artwork letterboxed inside that
                // square instead of centre-cropping it down to a sliver.
                fit: "contain",
              }),
              transform: `rotate(${turns * 90}deg)`,
            }}
          >
            {/* Upright tiles get a hairline frame — a second, non-colour cue
                that this one is already done. */}
            {turns === 0 && (
              <span
                aria-hidden="true"
                className="absolute inset-0 ring-1 ring-inset ring-sepia/50 rounded-[2px]"
              />
            )}
          </button>
        ))}
      </div>
      <p className="sr-only" aria-live="polite">
        {solvedCount} of {rotations.length} tiles upright
      </p>
    </GameBoard>
  );
}
