"use client";

// Presentational sticky-note card placed absolutely on the wall canvas.
// Base position / rotation / color all come from the note data so every viewer
// starts from the same layout — no client-side randomisation.
//
// Visitors can drag notes to rearrange the wall for themselves. That new
// position is reported up to <FreedomWallClient>, which persists it to this
// browser's localStorage only — there is no login and nothing is written back
// to the server, so every other visitor still sees the original layout.

import { useEffect, useLayoutEffect, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { motion, useMotionValue, type PanInfo } from "framer-motion";
import { cn } from "@/lib/utils";

/** How far a visitor can pinch a note in either direction. The lower bound
 *  keeps the text legible; the upper one keeps a single note from covering
 *  the wall on a phone. */
export const NOTE_VISITOR_SCALE_MIN = 0.6;
export const NOTE_VISITOR_SCALE_MAX = 2.2;

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
   *  Editor. Deliberately NOT applied on this page any more: it sizes the
   *  note on the 3-D room's wall, where a big note is a layout choice, and
   *  mirroring it here made the flat wall's cards uneven for no reason a
   *  visitor could see. Every card here starts at the same size; the visitor
   *  pinches their own (see `NoteOverride.scale`). Still carried on the type
   *  so the museum-side consumers of NoteData keep compiling. */
  scale?: number;
  createdAt: string;
}

/** Per-visitor override — position (percentage of the canvas) and/or size —
 *  or undefined when the visitor has not touched this note.
 *
 *  `baseX`/`baseY` record the note's *server* position at the moment the
 *  visitor dragged it. FreedomWallClient compares them against the note's
 *  current server position on load and throws the override away when they no
 *  longer match — otherwise a personal layout saved once would outrank every
 *  later admin repositioning (Museum Scene Editor → Save) forever, on this
 *  device, with no sign that anything had changed.
 *
 *  `x`/`y` are optional now: a note the visitor only *pinched* keeps
 *  following the server position, and only a note they *dragged* is pinned
 *  to where they dropped it. */
export interface NoteOverride {
  x?: number;
  y?: number;
  baseX?: number;
  baseY?: number;
  /** Visitor's own size multiplier from pinching, 1 = as served. */
  scale?: number;
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
  /** Report a new size multiplier after a pinch (already clamped). */
  onResize: (id: string, scale: number) => void;
}

export function StickyNote({ note, isNew = false, canvasRef, override, onMove, onResize }: Props) {
  const colorKey = COLOR_CLASSES[note.color] ? note.color : "yellow";
  const restScale = override?.scale ?? 1;

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

  // Pinch to resize. Two fingers on the card: the size follows the ratio of
  // the current finger gap to the gap when the second finger landed, from
  // the size the note had at that moment. Tracked by hand rather than through
  // framer-motion — its drag only ever follows the *primary* pointer (the
  // first finger), so the card still trails that finger while pinching,
  // which is what a visitor expects of a card they are holding anyway; it has
  // no notion of a second pointer at all. `touch-none` on the card is what
  // lets both fingers reach it as pointer events instead of the page zooming.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ startGap: number; startScale: number } | null>(null);
  const scaleRef = useRef(restScale);
  scaleRef.current = restScale;

  function gap() {
    const [a, b] = Array.from(pointers.current.values());
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      pinch.current = { startGap: gap(), startScale: scaleRef.current };
    }
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const p = pinch.current;
    if (!p || pointers.current.size < 2 || p.startGap < 1) return;
    const next = clamp(p.startScale * (gap() / p.startGap), NOTE_VISITOR_SCALE_MIN, NOTE_VISITOR_SCALE_MAX);
    if (Math.abs(next - scaleRef.current) > 0.005) onResize(note.id, next);
  }

  function handlePointerEnd(e: ReactPointerEvent<HTMLDivElement>) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  }

  // A trackpad pinch reaches the page as a wheel event with ctrlKey set (every
  // major browser maps it that way), and ⌘/Ctrl + scroll wheel is the same
  // gesture by keyboard — so this is "pinch" for a laptop, and a plain scroll
  // over a card still scrolls the page like anywhere else. A native listener
  // rather than React's onWheel: React registers wheel as *passive* at the
  // root, where preventDefault is ignored, and without it a ctrl+wheel over
  // the card zooms the whole browser page as well as the note.
  const cardRef = useRef<HTMLDivElement>(null);
  const onResizeRef = useRef(onResize);
  onResizeRef.current = onResize;
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const next = clamp(scaleRef.current * Math.exp(-e.deltaY * 0.01), NOTE_VISITOR_SCALE_MIN, NOTE_VISITOR_SCALE_MAX);
      if (Math.abs(next - scaleRef.current) > 0.005) onResizeRef.current(note.id, next);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [note.id]);

  return (
    <motion.div
      ref={cardRef}
      drag
      dragMomentum={false}
      dragElastic={0.12}
      dragConstraints={canvasRef}
      onDragEnd={handleDragEnd}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
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
