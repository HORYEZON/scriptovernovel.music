"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { tileBackgroundStyle } from "@/lib/minigames/images";
import type {
  PublicGameArtwork,
  SlidingPuzzleChallenge,
  SlidingPuzzleMoves,
} from "@/lib/minigames/types";
import { useImageAsset, usePrefersReducedMotion } from "../hooks";
import { GameBoard } from "./GameBoard";

interface ArtSlidingPuzzleProps {
  challenge: SlidingPuzzleChallenge;
  artwork: PublicGameArtwork;
  interactive: boolean;
  onProgress: (moves: number) => void;
  onComplete: (moves: SlidingPuzzleMoves) => void;
  playMoveSound: () => void;
}

/** How far a touch must travel before it counts as a swipe rather than a tap. */
const SWIPE_THRESHOLD_PX = 24;

/**
 * The classic sliding puzzle. The board arrives already scrambled by the
 * server, which built it by walking legal moves back from solved — so it is
 * always solvable, which a blind shuffle would not be half the time.
 *
 * Tiles are absolutely positioned and keyed by tile id rather than laid out in
 * grid order: that way React moves the same DOM node when a tile changes slot,
 * and a CSS transition on left/top reads as the tile sliding.
 */
export function ArtSlidingPuzzle({
  challenge,
  artwork,
  interactive,
  onProgress,
  onComplete,
  playMoveSound,
}: ArtSlidingPuzzleProps) {
  const size = challenge.grid;
  const count = size * size;
  const blankTile = count - 1;
  const asset = useImageAsset(artwork.imageUrl);
  const reducedMotion = usePrefersReducedMotion();

  const [board, setBoard] = useState<number[]>(() => [...challenge.board]);
  const movesRef = useRef<number[]>([]);
  const finishedRef = useRef(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    setBoard([...challenge.board]);
    movesRef.current = [];
    finishedRef.current = false;
  }, [challenge]);

  const blankSlot = board.indexOf(blankTile);

  const isAdjacent = useCallback(
    (slot: number) => {
      const rowA = Math.floor(slot / size);
      const colA = slot % size;
      const rowB = Math.floor(blankSlot / size);
      const colB = blankSlot % size;
      return Math.abs(rowA - rowB) + Math.abs(colA - colB) === 1;
    },
    [blankSlot, size]
  );

  const move = useCallback(
    (slot: number) => {
      if (!interactive || finishedRef.current) return;
      if (slot < 0 || slot >= count || !isAdjacent(slot)) return;

      const next = [...board];
      [next[blankSlot], next[slot]] = [next[slot], next[blankSlot]];
      movesRef.current.push(slot);

      setBoard(next);
      onProgress(movesRef.current.length);
      playMoveSound();

      if (next.every((tile, index) => tile === index)) {
        finishedRef.current = true;
        onComplete({ kind: "SLIDING_PUZZLE", moves: movesRef.current });
      }
    },
    [blankSlot, board, count, interactive, isAdjacent, onComplete, onProgress, playMoveSound]
  );

  /**
   * Swipes and arrow keys name a *direction*, and the tile that satisfies it
   * is the one on the opposite side of the gap: swiping left slides the tile
   * to the gap's right into it.
   */
  const moveByDirection = useCallback(
    (direction: "left" | "right" | "up" | "down") => {
      const col = blankSlot % size;
      const row = Math.floor(blankSlot / size);
      switch (direction) {
        case "left":
          if (col < size - 1) move(blankSlot + 1);
          break;
        case "right":
          if (col > 0) move(blankSlot - 1);
          break;
        case "up":
          if (row < size - 1) move(blankSlot + size);
          break;
        case "down":
          if (row > 0) move(blankSlot - size);
          break;
      }
    },
    [blankSlot, move, size]
  );

  function onTouchStart(event: React.TouchEvent) {
    const touch = event.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY };
  }

  function onTouchEnd(event: React.TouchEvent) {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;

    const touch = event.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    // Below the threshold this was a tap, and the tile's own onClick has it.
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_THRESHOLD_PX) return;

    if (Math.abs(dx) > Math.abs(dy)) {
      moveByDirection(dx < 0 ? "left" : "right");
    } else {
      moveByDirection(dy < 0 ? "up" : "down");
    }
  }

  function onKeyDown(event: React.KeyboardEvent) {
    const directions: Record<string, "left" | "right" | "up" | "down"> = {
      ArrowLeft: "left",
      ArrowRight: "right",
      ArrowUp: "up",
      ArrowDown: "down",
    };
    const direction = directions[event.key];
    if (!direction) return;
    // Otherwise the arrow keys scroll the modal behind the board.
    event.preventDefault();
    moveByDirection(direction);
  }

  // Tile → slot, so tiles can be rendered in stable id order.
  const slotOfTile = useMemo(() => {
    const slots = new Array<number>(count).fill(0);
    board.forEach((tile, slot) => {
      slots[tile] = slot;
    });
    return slots;
  }, [board, count]);

  const placed = board.filter((tile, slot) => tile === slot && tile !== blankTile).length;

  return (
    <GameBoard ratio={asset.ratio} status={asset.status} label="Sliding puzzle board">
      <div
        className="absolute inset-0 rounded-xl overflow-hidden bg-black/40"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onKeyDown={onKeyDown}
      >
        {slotOfTile.map((slot, tile) => {
          if (tile === blankTile) return null;
          const row = Math.floor(slot / size);
          const col = slot % size;
          const movable = interactive && isAdjacent(slot);

          return (
            <button
              key={tile}
              type="button"
              onClick={() => move(slot)}
              aria-label={`Tile at row ${row + 1}, column ${col + 1}${
                movable ? ", can be moved" : ""
              }`}
              className={cn(
                "absolute rounded-[2px] overflow-hidden",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-sepia focus-visible:z-10",
                movable ? "cursor-pointer hover:brightness-110" : "cursor-default",
                reducedMotion
                  ? "transition-none"
                  : "transition-[left,top] duration-200 ease-out"
              )}
              style={{
                left: `${(col / size) * 100}%`,
                top: `${(row / size) * 100}%`,
                width: `${100 / size}%`,
                height: `${100 / size}%`,
                // Hairline inset keeps neighbouring tiles visually separate
                // without a gap the sliding animation would have to cross.
                padding: 1,
                ...tileBackgroundStyle(artwork.imageUrl, tile, size, {
                  imageRatio: asset.ratio,
                  boardRatio: asset.ratio,
                }),
                backgroundClip: "content-box",
              }}
            />
          );
        })}
      </div>
      <p className="sr-only" aria-live="polite">
        {placed} of {count - 1} tiles in place
      </p>
    </GameBoard>
  );
}
