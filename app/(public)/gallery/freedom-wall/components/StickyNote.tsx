"use client";

// Presentational sticky-note card placed absolutely on the wall canvas.
// Base position / rotation / color all come from the note data so every viewer
// starts from the same layout — no client-side randomisation.
//
// Visitors can drag notes to rearrange the wall for themselves. That new
// position is reported up to <FreedomWallClient>, which persists it to this
// browser's localStorage only — there is no login and nothing is written back
// to the server, so every other visitor still sees the original layout.

import { useLayoutEffect, type RefObject } from "react";
import { motion, useMotionValue, type PanInfo } from "framer-motion";
import { cn } from "@/lib/utils";

export interface NoteData {
  id: string;
  nickname: string;
  content: string;
  positionX: number; // 0–100 %
  positionY: number; // 0–100 %
  color: string;
  rotation: number;  // degrees
  /** Uniform size multiplier — same field as the 3D museum room's notes
   *  (FreedomWallNotePublic.scale), admin-adjustable in the Museum Scene
   *  Editor. 1 = normal card size. */
  scale?: number;
  createdAt: string;
}

/** Per-visitor position override (percentage of the canvas), or undefined when
 *  the visitor has not moved this note.
 *
 *  `baseX`/`baseY` record the note's *server* position at the moment the
 *  visitor dragged it. FreedomWallClient compares them against the note's
 *  current server position on load and throws the override away when they no
 *  longer match — otherwise a personal layout saved once would outrank every
 *  later admin repositioning (Museum Scene Editor → Save) forever, on this
 *  device, with no sign that anything had changed. */
export interface NoteOverride {
  x: number;
  y: number;
  baseX?: number;
  baseY?: number;
}

// Tailwind classes for each palette key.
const COLOR_CLASSES: Record<string, string> = {
  yellow:  "bg-yellow-200  border-yellow-400  text-yellow-900",
  pink:    "bg-pink-200    border-pink-400    text-pink-900",
  blue:    "bg-sky-200     border-sky-400     text-sky-900",
  green:   "bg-emerald-200 border-emerald-400 text-emerald-900",
  purple:  "bg-violet-200  border-violet-400  text-violet-900",
  orange:  "bg-orange-200  border-orange-400  text-orange-900",
};

// Pin colour that complements each note body.
const PIN_CLASSES: Record<string, string> = {
  yellow:  "bg-yellow-500",
  pink:    "bg-pink-500",
  blue:    "bg-sky-500",
  green:   "bg-emerald-500",
  purple:  "bg-violet-500",
  orange:  "bg-orange-500",
};

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

interface Props {
  note: NoteData;
  isNew?: boolean;
  /** The wall canvas element — used as the drag boundary and to convert the
   *  pixel drag delta into a percentage position. */
  canvasRef: RefObject<HTMLDivElement | null>;
  /** This visitor's saved position for the note, if any. */
  override?: NoteOverride;
  /** Report a new position (percentage of the canvas) after a drag. */
  onMove: (id: string, xPct: number, yPct: number) => void;
}

export function StickyNote({ note, isNew = false, canvasRef, override, onMove }: Props) {
  const colorKey = COLOR_CLASSES[note.color] ? note.color : "yellow";
  const restScale = note.scale ?? 1;

  // Resting position: the visitor's saved override wins over the note's own
  // server-assigned coordinates.
  const posX = override?.x ?? note.positionX;
  const posY = override?.y ?? note.positionY;

  // Drag delta. framer-motion writes to these while dragging; once the new
  // percentage position lands in `posX/posY` we snap the delta back to 0 in a
  // layout effect (before paint) so the note never visibly jumps.
  const dragX = useMotionValue(0);
  const dragY = useMotionValue(0);

  useLayoutEffect(() => {
    dragX.set(0);
    dragY.set(0);
  }, [posX, posY, dragX, dragY]);

  function handleDragEnd(_e: unknown, info: PanInfo) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const nextX = clamp(posX + (info.offset.x / rect.width) * 100, 2, 98);
    // positionY counts *up* the wall (see the `top` style below), so a
    // downward drag lowers it.
    const nextY = clamp(posY - (info.offset.y / rect.height) * 100, 2, 98);
    onMove(note.id, nextX, nextY);
  }

  return (
    <motion.div
      drag
      dragMomentum={false}
      dragElastic={0.12}
      dragConstraints={canvasRef}
      onDragEnd={handleDragEnd}
      whileDrag={{ scale: restScale * 1.06, zIndex: 50 }}
      initial={
        isNew
          ? { opacity: 0, scale: restScale * 0.5, rotate: note.rotation }
          : { opacity: 1, scale: restScale, rotate: note.rotation }
      }
      animate={{ opacity: 1, scale: restScale, rotate: note.rotation }}
      transition={{ type: "spring", stiffness: 200, damping: 18 }}
      // left/top place the note's CENTER on the canvas coordinate; the
      // translate(-50%, -50%) that actually centres it must live in
      // transformTemplate — framer-motion rebuilds `transform` from its own
      // animated values (scale/rotate/drag) and would otherwise drop a raw
      // `transform` string passed via `style`, leaving every note offset
      // down-and-right (bottom notes then clip out of the canvas).
      transformTemplate={(_, generated) => `translate(-50%, -50%) ${generated}`}
      // positionY is a height *up the wall* — 0 is the floor, 100 the top —
      // because that's what the 3-D room and the Museum Scene Editor both
      // mean by it (freedomWallNotePlacement.ts maps it onto world Y). CSS
      // `top` grows downward, so it has to be flipped here; without the flip
      // a note the admin dragged to the top of the wall in the editor landed
      // at the bottom of this page.
      style={{
        position: "absolute",
        left: `${posX}%`,
        top: `${100 - posY}%`,
        x: dragX,
        y: dragY,
      }}
      className={cn(
        "w-36 min-h-[9rem] p-3 rounded-sm shadow-lg border-t-4 select-none touch-none",
        "cursor-grab active:cursor-grabbing",
        "flex flex-col gap-1",
        COLOR_CLASSES[colorKey]
      )}
    >
      {/* Decorative pin */}
      <div
        className={cn(
          "absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full shadow-md border-2 border-white/60",
          PIN_CLASSES[colorKey]
        )}
      />

      {/* Content */}
      <p className="text-[0.7rem] leading-snug font-medium break-words whitespace-pre-wrap line-clamp-6 mt-1">
        {note.content}
      </p>

      {/* Nickname */}
      <p className="text-[0.6rem] font-bold opacity-60 mt-auto truncate">— {note.nickname}</p>
    </motion.div>
  );
}
