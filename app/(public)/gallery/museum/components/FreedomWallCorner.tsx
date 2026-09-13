"use client";

// FreedomWallCorner.tsx
// 2D overlay shown when the visitor is inside the Freedom Wall museum room.
// Mirrors the pattern of AboutRoomCorner.tsx — a lightweight fixed-position
// card that shows once the visitor enters the room (visible prop controls it).
//
// The submission form slides up from the bottom-right; submitting calls
// POST /api/freedom-wall/notes and returns the new note to the parent so it
// can be added to the 3D scene immediately (optimistic update via onNoteAdded).

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Send, Loader2, StickyNote } from "lucide-react";
import { useGoogleReCaptcha } from "react-google-recaptcha-v3";
import { cn } from "@/lib/utils";
import type { FreedomWallNotePublic } from "@/types";

// ── Colour palette (matches FreedomWallRoomContents + standalone page) ───────

const COLORS = [
  { key: "yellow", label: "Yellow", bg: "#fef08a", ring: "#ca8a04" },
  { key: "pink",   label: "Pink",   bg: "#fbcfe8", ring: "#db2777" },
  { key: "blue",   label: "Blue",   bg: "#bae6fd", ring: "#0284c7" },
  { key: "green",  label: "Green",  bg: "#a7f3d0", ring: "#059669" },
  { key: "purple", label: "Purple", bg: "#ddd6fe", ring: "#7c3aed" },
  { key: "orange", label: "Orange", bg: "#fed7aa", ring: "#ea580c" },
] as const;

type ColorKey = (typeof COLORS)[number]["key"];

interface Props {
  visible: boolean;
  acceptingNotes: boolean; // false when no active event or wall is inactive
  /** Active event's name, so the form says what visitors are writing about.
   *  Null when nothing is active — the header then falls back to generic copy. */
  eventTitle?: string | null;
  onNoteAdded: (note: FreedomWallNotePublic) => void;
  /** True on touch devices — hides the [E] key hint and shows the 📌 button instead. */
  isCoarsePointer?: boolean;
  /** MuseumClient.tsx's landscape toggle — moves the pin button to the
   * opposite corner there; see `pinCorner` below. */
  landscapeMode?: boolean;
}

export function FreedomWallCorner({
  visible,
  acceptingNotes,
  eventTitle = null,
  onNoteAdded,
  isCoarsePointer = false,
  landscapeMode = false,
}: Props) {
  const { executeRecaptcha } = useGoogleReCaptcha();
  const [open, setOpen]           = useState(false);
  const [nickname, setNickname]   = useState("");
  const [content, setContent]     = useState("");
  const [color, setColor]         = useState<ColorKey>("yellow");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  // Desktop only: press [E] to open the form (same key museum uses for
  // interaction prompts). Skipped on touch devices — they use the 📌 button.
  // Guard: only fires when the overlay is visible + accepting notes + not
  // already open + no other input is focused (so typing in a form field
  // doesn't re-trigger it).
  useEffect(() => {
    if (isCoarsePointer || !visible || !acceptingNotes) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "e" && e.key !== "E") return;
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (open) return;
      setOpen(true);
      setTimeout(() => contentRef.current?.focus(), 80);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isCoarsePointer, visible, acceptingNotes, open]);

  const submit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !executeRecaptcha) return;
    setError(null);
    setSubmitting(true);
    try {
      const captchaToken = await executeRecaptcha("freedom_wall_note");
      const res = await fetch("/api/freedom-wall/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: nickname.trim() || "Anonymous",
          content,
          color,
          captchaToken,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to post note");
      onNoteAdded(data as FreedomWallNotePublic);
      setContent("");
      setNickname("");
      setColor("yellow");
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }, [submitting, executeRecaptcha, nickname, content, color, onNoteAdded]);

  if (!visible) return null;

  // Where the pin button (and the view-only notice that takes its place)
  // sits. Portrait's bottom-right is empty apart from the jump button well
  // below it, but landscape stacks TouchControls.tsx's whole right-hand
  // column into that corner — look joystick 32–128px up from the bottom,
  // jump button 144–208px — and the drawn area there is only as tall as the
  // phone is wide. bottom-28/right-4 put this 48px button at 112–160px on
  // the same edge, straight across both of them.
  //
  // Landscape moves it to the *left* edge instead of just further up the
  // right one: the space above the jump button is where the room-entry
  // splash now lives (RoomSplashPopup.tsx), and stacking a third control
  // there would only trade one overlap for another. Left has just the one
  // move joystick (also 32–128px), so sitting at 160–208px clears it with
  // room to spare and stays well below the ~96px top HUD stack.
  const pinCorner =
    isCoarsePointer && landscapeMode ? "bottom-40 left-4" : "bottom-28 right-4";

  return (
    <div className="absolute inset-0 pointer-events-none z-20">

      {/* ── Pin button (mobile) / [E] key hint (desktop) ── */}
      {!open && acceptingNotes && (
        isCoarsePointer ? (
          /* Touch devices — visible 📌 button */
          <button
            onClick={() => {
              setOpen(true);
              setTimeout(() => contentRef.current?.focus(), 80);
            }}
            title="Pin a note"
            className={cn(
              "absolute pointer-events-auto",
              pinCorner,
              "w-12 h-12 rounded-full shadow-xl flex items-center justify-center",
              "bg-yellow-300 hover:bg-yellow-400 text-xl",
              "transition-colors ring-2 ring-yellow-200/60 active:scale-95"
            )}
          >
            📌
          </button>
        ) : (
          /* Desktop — keyboard hint only; [E] key listener handles opening */
          <div className="absolute bottom-28 right-4 pointer-events-none">
            <p className="text-xs text-white/50 bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-full font-jakarta">
              Press <kbd className="font-bold text-yellow-300">E</kbd> to pin a note
            </p>
          </div>
        )
      )}

      {/* ── Inactive notice ───────────────────────────────────────────── */}
      {!open && !acceptingNotes && (
        <div className={cn("absolute pointer-events-none", pinCorner)}>
          <p className="text-xs text-white/40 bg-black/40 backdrop-blur-sm px-3 py-1.5 rounded-full">
            Wall is view-only — no active event
          </p>
        </div>
      )}

      {/* ── Slide-up form ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="fw-form"
            initial={{ y: "110%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "110%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 24 }}
            className="absolute bottom-0 inset-x-0 flex justify-center pointer-events-auto"
          >
            <form
              onSubmit={submit}
              // max-h + overflow-y-auto: this card is pinned to the bottom
              // edge with nothing capping it above, so on a short landscape
              // phone viewport (further squeezed by an on-screen keyboard,
              // which on landscape mobile can eat well over half the
              // screen) it was growing taller than the visible area and
              // pushing the submit button off-screen entirely, above the
              // top edge, with no way to scroll back down to it.
              className={cn(
                "w-full max-w-md mx-4 mb-4 rounded-2xl shadow-2xl max-h-[85vh] overflow-y-auto",
                "bg-black/70 backdrop-blur-lg border border-white/10 p-5 landscape:p-4"
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="min-w-0">
                  <h2 className="font-semibold text-sm text-yellow-200 flex items-center gap-1.5">
                    <StickyNote size={15} /> Pin a sticky note
                  </h2>
                  {eventTitle && (
                    <p className="text-[11px] text-white/50 mt-0.5 truncate">
                      Posting to <span className="text-white/80">{eventTitle}</span>
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="p-1 rounded-md hover:bg-white/10 transition-colors text-white/60"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Colour picker */}
              <div className="flex items-center gap-1.5 mb-3">
                {COLORS.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    title={c.label}
                    onClick={() => setColor(c.key)}
                    style={{ background: c.bg, outlineColor: c.ring }}
                    className={cn(
                      "w-6 h-6 rounded-full transition-all",
                      color === c.key
                        ? "ring-2 ring-offset-1 ring-offset-black/70 scale-125"
                        : "opacity-70 hover:opacity-100 hover:scale-110"
                    )}
                  />
                ))}
                <span className="text-[10px] text-white/40 ml-1">note colour</span>
              </div>

              <div className="space-y-2">
                <input
                  type="text"
                  maxLength={50}
                  placeholder="Nickname (optional)"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className={cn(
                    "w-full rounded-lg px-3 py-2 text-sm",
                    "bg-white/10 border border-white/10 text-white placeholder:text-white/30",
                    "focus:outline-none focus:ring-1 focus:ring-yellow-400/60"
                  )}
                />
                <textarea
                  ref={contentRef}
                  required
                  maxLength={500}
                  rows={3}
                  placeholder="Write something…"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className={cn(
                    "w-full rounded-lg px-3 py-2 text-sm resize-none",
                    "bg-white/10 border border-white/10 text-white placeholder:text-white/30",
                    "focus:outline-none focus:ring-1 focus:ring-yellow-400/60"
                  )}
                />
                <p className="text-right text-[0.65rem] text-white/30">{content.length}/500</p>
              </div>

              {error && <p className="text-xs text-red-400 mt-1.5">{error}</p>}

              <button
                type="submit"
                disabled={submitting || !content.trim() || !executeRecaptcha}
                className={cn(
                  "mt-3 w-full flex items-center justify-center gap-2",
                  "px-4 py-2 rounded-xl font-semibold text-sm",
                  "bg-yellow-400 hover:bg-yellow-500 text-yellow-900 transition-colors",
                  "disabled:opacity-40 disabled:cursor-not-allowed"
                )}
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {submitting ? "Pinning…" : "Pin note"}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
