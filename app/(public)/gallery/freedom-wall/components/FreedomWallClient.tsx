"use client";

// Client wrapper for the Freedom Wall public page.
// Receives initial notes from the server component so the wall is populated
// on first paint without a loading flash, then adds new notes optimistically
// on submission.
//
// Visitors can drag notes around to arrange the wall however they like. Since
// there is no visitor login, those positions are NOT sent to the server — they
// are stored in this browser's localStorage only, keyed by the active event, so
// a return visit on the same device restores the personal layout while every
// other visitor still sees the original server layout.
//
// A personal override is deliberately *not* permanent: each one remembers the
// server position it was dragged away from, and is dropped the moment the
// server moves that note somewhere else (an admin repositioning it in the
// Museum Scene Editor). Without that, one stray drag pinned this browser to a
// stale layout for good — the admin saved new positions, the wall kept showing
// the old ones, and nothing on screen explained why.

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { RotateCcw } from "lucide-react";
import { StickyNote, type NoteData, type NoteOverride } from "./StickyNote";
import { NoteForm } from "./NoteForm";

interface Props {
  initialNotes: NoteData[];
  eventTitle: string;
  eventId: string;
}

type OverrideMap = Record<string, NoteOverride>;

const storageKey = (eventId: string) => `fw:notePositions:${eventId}`;

export function FreedomWallClient({ initialNotes, eventTitle, eventId }: Props) {
  const [notes, setNotes] = useState<NoteData[]>(initialNotes);
  const [newNoteId, setNewNoteId] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<OverrideMap>({});
  const canvasRef = useRef<HTMLDivElement>(null);

  const persist = useCallback(
    (next: OverrideMap) => {
      try {
        localStorage.setItem(storageKey(eventId), JSON.stringify(next));
      } catch {
        /* private mode / quota — the in-memory layout still works this session */
      }
    },
    [eventId]
  );

  // Load this visitor's saved layout after mount (localStorage is client-only,
  // so reading it during render would break SSR hydration), keeping only the
  // overrides whose note still sits where it did when it was dragged. An
  // override with no remembered base predates this reconciliation and is
  // dropped too, so an admin's positions win back immediately rather than
  // after the visitor happens to find "Reset layout".
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(eventId));
      if (!raw) return;
      const parsed = JSON.parse(raw) as OverrideMap;
      if (!parsed || typeof parsed !== "object") return;

      const serverPos = new Map(initialNotes.map((n) => [n.id, n]));
      const kept: OverrideMap = {};
      for (const [id, override] of Object.entries(parsed)) {
        const note = serverPos.get(id);
        if (!note || !override) continue; // note deleted server-side
        if (override.baseX !== note.positionX || override.baseY !== note.positionY) continue;
        kept[id] = override;
      }
      setOverrides(kept);
      if (Object.keys(kept).length !== Object.keys(parsed).length) persist(kept);
    } catch {
      /* corrupt or unavailable storage — fall back to the server layout */
    }
    // initialNotes is the server's own layout for this render — the whole
    // point of the comparison above — so it belongs in the dependency list.
  }, [eventId, initialNotes, persist]);

  const handleMove = useCallback(
    (id: string, x: number, y: number) => {
      // Stamp the server position this drag started from, so a later admin
      // move of the same note retires this override instead of losing to it.
      const base = notes.find((n) => n.id === id);
      setOverrides((prev) => {
        const next = {
          ...prev,
          [id]: { x, y, baseX: base?.positionX, baseY: base?.positionY },
        };
        persist(next);
        return next;
      });
    },
    [persist, notes]
  );

  const resetLayout = useCallback(() => {
    setOverrides({});
    try {
      localStorage.removeItem(storageKey(eventId));
    } catch {
      /* ignore */
    }
  }, [eventId]);

  function handleSubmitted(note: NoteData) {
    setNotes((prev) => [...prev, note]);
    setNewNoteId(note.id);
    // Clear "isNew" flag after the entrance animation ends.
    setTimeout(() => setNewNoteId(null), 800);
  }

  const hasCustomLayout = Object.keys(overrides).length > 0;

  return (
    <div className="relative w-full flex-1 min-h-[60vh] overflow-hidden">
      {/*
        Grid-line CSS lives in a scoped <style> block so we can swap the line
        colour for dark mode without fighting inline-style specificity. The bg
        colour itself uses Tailwind dark: classes on the canvas div.
      */}
      <style>{`
        .fw-canvas {
          background-image:
            repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(0,0,0,0.05) 39px, rgba(0,0,0,0.05) 40px),
            repeating-linear-gradient(90deg, transparent, transparent 39px, rgba(0,0,0,0.05) 39px, rgba(0,0,0,0.05) 40px);
        }
        .dark .fw-canvas {
          background-image:
            repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(255,255,255,0.06) 39px, rgba(255,255,255,0.06) 40px),
            repeating-linear-gradient(90deg, transparent, transparent 39px, rgba(255,255,255,0.06) 39px, rgba(255,255,255,0.06) 40px);
        }
      `}</style>

      {/* Wall canvas — bg-color via Tailwind so dark: works; grid via .fw-canvas above.
          absolute inset-0 so the canvas (and its grid) always fills the wrapper —
          h-full doesn't resolve against a flex-1 parent with no definite height,
          which left the grid cut off partway down the page. */}
      <div
        ref={canvasRef}
        className="fw-canvas absolute inset-0 w-full h-full bg-[#faf8f3] dark:bg-zinc-900"
      >
        {/* Event badge */}
        {eventTitle && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
            <span className="px-3 py-1 rounded-full bg-black/10 dark:bg-white/10 text-xs font-medium text-zinc-600 dark:text-zinc-300 backdrop-blur-sm">
              {eventTitle}
            </span>
          </div>
        )}

        {/* Empty state */}
        {notes.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-zinc-400 pointer-events-none"
          >
            <span className="text-5xl">📌</span>
            <p className="text-sm font-medium">Be the first to leave a note!</p>
          </motion.div>
        )}

        {/* Notes */}
        {notes.map((note) => (
          <StickyNote
            key={note.id}
            note={note}
            isNew={note.id === newNoteId}
            canvasRef={canvasRef}
            override={overrides[note.id]}
            onMove={handleMove}
          />
        ))}

        {/* Drag hint + personal-layout reset */}
        {notes.length > 0 && (
          <div className="absolute bottom-3 left-3 z-20 flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full bg-black/10 dark:bg-white/10 text-[0.65rem] font-medium text-zinc-500 dark:text-zinc-400 backdrop-blur-sm">
              ✋ Drag notes to rearrange — saved on this device only
            </span>
            {hasCustomLayout && (
              <button
                onClick={resetLayout}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/10 dark:bg-white/10 text-[0.65rem] font-medium text-zinc-600 dark:text-zinc-300 hover:bg-black/20 dark:hover:bg-white/20 backdrop-blur-sm transition-colors"
              >
                <RotateCcw size={11} /> Reset layout
              </button>
            )}
          </div>
        )}
      </div>

      {/* Submission form (fixed-positioned inside this wrapper) */}
      <NoteForm onSubmitted={handleSubmitted} />
    </div>
  );
}
