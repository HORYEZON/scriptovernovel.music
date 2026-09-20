"use client";

import { Puzzle, RotateCw, LayoutGrid, Layers, ScanSearch, Gamepad2, Disc3, Music2, MicVocal, ListOrdered, CalendarRange } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// The registry stores an icon *key* rather than a component so lib/minigames
// stays free of JSX and importable from server code. This is the one place
// those keys become pixels — and it uses the project's existing icon library
// rather than the emoji the mockups sketched, so the games sit next to the
// rest of the gallery chrome instead of shouting over it.
const GAME_ICONS: Record<string, LucideIcon> = {
  puzzle: Puzzle,
  rotate: RotateCw,
  sliding: LayoutGrid,
  memory: Layers,
  difference: ScanSearch,
  cover: Disc3,
  track: Music2,
  lyric: MicVocal,
  tracklist: ListOrdered,
  timeline: CalendarRange,
};

export function GameIcon({
  icon,
  size = 18,
  className,
}: {
  icon: string;
  size?: number;
  className?: string;
}) {
  const Icon = GAME_ICONS[icon] ?? Gamepad2;
  return <Icon size={size} strokeWidth={1.5} className={className} aria-hidden="true" />;
}
