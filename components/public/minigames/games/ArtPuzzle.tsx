"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { tileBackgroundStyle } from "@/lib/minigames/images";
import type { ArtPuzzleChallenge, ArtPuzzleMoves, PublicGameArtwork } from "@/lib/minigames/types";
import { useImageAsset } from "../hooks";
import { GameBoard } from "./GameBoard";

interface ArtPuzzleProps {
  challenge: ArtPuzzleChallenge;
  artwork: PublicGameArtwork;
  interactive: boolean;
  onProgress: (moves: number) => void;
  onComplete: (moves: ArtPuzzleMoves) => void;
  playMoveSound: () => void;
}

/**
 * Swap-two-pieces jigsaw. Every arrangement is reachable by swaps, so unlike
 * the sliding puzzle there is no solvability constraint — the server just has
 * to hand out something that isn't already solved.
 *
 * The move log is a list of swaps rather than a final arrangement: the server
 * replays it, so "here is the solved board" isn't something a client can
 * simply assert.
 */
export function ArtPuzzle({
  challenge,
  artwork,
  interactive,
  onProgress,
  onComplete,
  playMoveSound,
}: ArtPuzzleProps) {
  const size = challenge.grid;
  const asset = useImageAsset(artwork.imageUrl);
  const [order, setOrder] = useState<number[]>(() => [...challenge.order]);
  const [selected, setSelected] = useState<number | null>(null);
  const swapsRef = useRef<[number, number][]>([]);
  const finishedRef = useRef(false);

  useEffect(() => {
    setOrder([...challenge.order]);
    setSelected(null);
    swapsRef.current = [];
    finishedRef.current = false;
  }, [challenge]);

  const handleSelect = useCallback(
    (slot: number) => {
      if (!interactive || finishedRef.current) return;

      if (selected === null) {
        setSelected(slot);
        return;
      }
      if (selected === slot) {
        setSelected(null);
        return;
      }

      const next = [...order];
      [next[selected], next[slot]] = [next[slot], next[selected]];
      swapsRef.current.push([selected, slot]);

      setOrder(next);
      setSelected(null);
      onProgress(swapsRef.current.length);
      playMoveSound();

      if (next.every((piece, index) => piece === index)) {
        finishedRef.current = true;
        onComplete({ kind: "ART_PUZZLE", swaps: swapsRef.current });
      }
    },
    [interactive, onComplete, onProgress, order, playMoveSound, selected]
  );

  return (
    <GameBoard ratio={asset.ratio} status={asset.status} label="Art puzzle board">
      <div
        className="absolute inset-0 grid gap-[2px]"
        style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
      >
        {order.map((piece, slot) => {
          const isSelected = selected === slot;
          const isHome = piece === slot;
          return (
            <button
              key={slot}
              type="button"
              onClick={() => handleSelect(slot)}
              disabled={!interactive}
              // Position is what identifies a piece here, and a screen-reader
              // user has no image to go on — so say where it belongs.
              aria-label={`Piece ${piece + 1} in position ${slot + 1}${
                isHome ? ", correctly placed" : ""
              }`}
              aria-pressed={isSelected}
              className={cn(
                "relative rounded-[2px] overflow-hidden transition-all duration-200",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-sepia focus-visible:ring-offset-1 focus-visible:ring-offset-black",
                isSelected
                  ? "ring-2 ring-sepia scale-[0.94] z-10 shadow-lg shadow-black/50"
                  : "hover:brightness-110",
                !interactive && "cursor-default"
              )}
              style={tileBackgroundStyle(artwork.imageUrl, piece, size, {
                imageRatio: asset.ratio,
                boardRatio: asset.ratio,
              })}
            >
              {/* Correct-placement cue that isn't only colour — a corner notch
                  reads at a glance and survives a colour-blind viewer. */}
              {isHome && (
                <span
                  aria-hidden="true"
                  className="absolute top-0 right-0 w-0 h-0 border-t-[10px] border-l-[10px] border-t-sepia/90 border-l-transparent"
                />
              )}
            </button>
          );
        })}
      </div>
    </GameBoard>
  );
}
