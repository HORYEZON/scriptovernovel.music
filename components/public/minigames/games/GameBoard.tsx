"use client";

import type { ReactNode } from "react";
import { ImageOff } from "lucide-react";
import type { AssetStatus } from "../hooks";

/**
 * How much of the viewport height a board may take. The modal also carries a
 * title bar and a stats strip, so leaving room for those is what stops a tall
 * portrait artwork from pushing the move counter off a phone screen.
 */
const MAX_BOARD_VH = 56;

interface GameBoardProps {
  /** Width ÷ height the board should hold. */
  ratio: number;
  status: AssetStatus;
  children: ReactNode;
  /** Announced to screen readers as the name of the play area. */
  label: string;
}

/**
 * Shared frame for the four grid games: it owns the loading and error states
 * and the one piece of sizing arithmetic they all need.
 *
 * The width expression is the whole trick — `aspect-ratio` alone would let a
 * portrait artwork grow as tall as it likes, and `max-height` alone would
 * letterbox it. Capping width at `MAX_BOARD_VH × ratio` makes the height cap
 * bite first on tall artwork and the width cap bite first on wide artwork.
 */
export function GameBoard({ ratio, status, children, label }: GameBoardProps) {
  if (status === "loading") {
    return (
      <div
        className="mx-auto w-full max-w-md rounded-xl bg-white/5 animate-pulse"
        style={{ aspectRatio: "1 / 1" }}
        role="status"
        aria-label="Loading artwork"
      />
    );
  }

  if (status === "error") {
    return (
      <div
        className="mx-auto w-full max-w-md rounded-xl border border-white/10 bg-black/40 flex flex-col items-center justify-center gap-3 p-8 text-center"
        style={{ aspectRatio: "1 / 1" }}
        role="alert"
      >
        <ImageOff size={32} strokeWidth={1} className="text-white/30" />
        <p className="font-body text-sm text-white/60">
          This artwork could not be loaded, so the game can&apos;t start.
        </p>
        <p className="font-body text-xs text-white/35">
          Check your connection and try again.
        </p>
      </div>
    );
  }

  return (
    <div
      className="relative mx-auto select-none"
      style={{
        aspectRatio: `${ratio}`,
        width: `min(100%, ${MAX_BOARD_VH * ratio}vh)`,
        // Stops a drag on a tile from turning into a page scroll or an
        // image-drag on touch devices.
        touchAction: "manipulation",
      }}
      role="group"
      aria-label={label}
    >
      {children}
    </div>
  );
}
