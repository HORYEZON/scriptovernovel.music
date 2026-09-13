"use client";

// components/public/ReleaseNotes.tsx
//
// The navbar's "what's new on the site" panel, sitting beside ThemeToggle.
// Click the icon to see the newest few notes, click one to read it in full.
//
// Only the newest N are ever listed (N = Profile.releaseNotesLimit, 3 by
// default) — publishing an N+1th pushes the oldest out rather than growing
// the list. The cap is applied server-side in /api/release-notes/active, so
// this component just renders whatever it's handed.

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";
import {
  releaseNoteAccent,
  formatReleaseNoteDate,
  type ReleaseNote,
} from "@/lib/release-notes";

/** Only the fields the panel actually renders — see the route's `select`. */
export type PublicReleaseNote = Pick<
  ReleaseNote,
  "id" | "title" | "body" | "category" | "version" | "publishedAt"
>;

const SEEN_KEY = "scriptovernovel:release-notes:seen";

export function ReleaseNotes({ initialNotes }: { initialNotes: PublicReleaseNote[] }) {
  const [notes, setNotes] = useState<PublicReleaseNote[]>(initialNotes);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<PublicReleaseNote | null>(null);
  const [mounted, setMounted] = useState(false);
  const [seenId, setSeenId] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const newestId = notes[0]?.id ?? null;
  // A dot rather than a count: the panel is a "what's new", and a visitor who
  // has read the top note has read the news. Held back until after mount —
  // the server can't know what this browser has seen, so rendering it during
  // hydration would mismatch (same reasoning as Navbar's cart badge).
  const hasUnseen = mounted && Boolean(newestId) && seenId !== newestId;

  useEffect(() => {
    setMounted(true);
    try {
      setSeenId(localStorage.getItem(SEEN_KEY));
    } catch {
      // Private mode or blocked site data — the dot just stays on.
    }
  }, []);

  // Most public routes prerender, so a note published after the last build
  // would never appear in the server-rendered list. Refresh once on mount,
  // the same reason MarqueeBanner re-fetches its own /active endpoint.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/release-notes/active")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        if (Array.isArray(data.notes)) setNotes(data.enabled === false ? [] : data.notes);
      })
      .catch(() => {
        // Keep whatever the server rendered; this is a refresh, not the
        // only source.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const markSeen = useCallback(() => {
    if (!newestId) return;
    setSeenId(newestId);
    try {
      localStorage.setItem(SEEN_KEY, newestId);
    } catch {
      // Nothing to do — the dot reappears next visit, which is harmless.
    }
  }, [newestId]);

  function togglePanel() {
    const next = !open;
    setOpen(next);
    if (next) markSeen();
  }

  // Click-outside and Escape close the dropdown. The detail modal has its own
  // Escape handler below and sits in a portal, so it isn't affected by this.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent | TouchEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!selected) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSelected(null);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selected]);

  // The detail modal is a fixed overlay, so a wheel/touch scroll that starts on
  // it (or once its own body hits an end) falls through to the page behind and
  // scrolls that instead — the note stays put while the site slides around
  // underneath it. Every other modal in the app already locks this; this one
  // was missed.
  useLockBodyScroll(selected !== null);

  // Phone-only: centre the panel in the viewport instead of hanging it off the
  // sparkle icon.
  //
  // The panel is anchored `right-0` to its button, which is the right call on
  // desktop — but on a phone that button sits well left of centre in the navbar
  // (logo, theme switch, sparkle, wishlist, cart, menu) while the panel is
  // nearly the full width of the screen. Anchoring the panel's right edge to a
  // button that far left pushes its left edge clean off the display, which is
  // the half-cut panel that was reported.
  //
  // Measured rather than done in CSS: `absolute` positions against the button's
  // own box, so no combination of left/right/translate can centre the panel on
  // the *viewport* from there. Above `sm` nothing changes — `anchored` stays
  // null and the original classes apply verbatim.
  const btnRef = useRef<HTMLButtonElement>(null);
  const [anchored, setAnchored] = useState<{ top: number } | null>(null);
  useEffect(() => {
    if (!open) {
      setAnchored(null);
      return;
    }
    const place = () => {
      const el = btnRef.current;
      if (!el || window.innerWidth >= 640) {
        setAnchored(null);
        return;
      }
      setAnchored({ top: el.getBoundingClientRect().bottom + 8 });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  // No notes published (or the panel switched off in Settings) means no icon
  // at all, rather than an icon that opens onto an empty box.
  if (notes.length === 0) return null;

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={togglePanel}
        className="relative p-2 text-ink dark:text-cream hover:text-sepia transition-colors"
        aria-label="Release notes — what's new"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Sparkles size={18} strokeWidth={1.5} />
        {hasUnseen && (
          <span
            aria-hidden
            className="absolute top-1 right-1 w-2 h-2 rounded-full bg-vermillion ring-2 ring-white dark:ring-ink"
          />
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Release notes"
          className={cn(
            "w-[min(20rem,calc(100vw-1.5rem))] rounded-2xl border border-black/10 dark:border-white/10 bg-white/95 dark:bg-ink-900/95 backdrop-blur-xl shadow-xl overflow-hidden z-50",
            anchored
              ? "fixed left-1/2 -translate-x-1/2"
              : "absolute right-0 top-full mt-2"
          )}
          style={anchored ? { top: anchored.top } : undefined}
        >
          <div className="px-4 py-3 border-b border-black/5 dark:border-white/10">
            <p className="font-jakarta text-sm font-semibold text-ink dark:text-cream">
              What&apos;s New
            </p>
            <p className="font-body text-[11px] text-ink-400 dark:text-ink-300 mt-0.5">
              The {notes.length === 1 ? "latest update" : `last ${notes.length} updates`} to the site
            </p>
          </div>

          <ul className="max-h-[60vh] overflow-y-auto divide-y divide-black/5 dark:divide-white/10">
            {notes.map((note) => (
              <li key={note.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(note);
                    setOpen(false);
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors"
                >
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span
                      className={cn(
                        "inline-flex items-center px-1.5 py-0.5 rounded-md border text-[9px] uppercase tracking-wider",
                        releaseNoteAccent(note.category)
                      )}
                    >
                      {note.category}
                    </span>
                    {note.version && (
                      <span className="font-jakarta text-[10px] text-ink-400 dark:text-ink-300">
                        {note.version}
                      </span>
                    )}
                  </div>
                  <p className="font-jakarta text-sm font-medium text-ink dark:text-cream leading-snug">
                    {note.title}
                  </p>
                  <p className="font-body text-[11px] text-ink-400 dark:text-ink-300 mt-1">
                    {formatReleaseNoteDate(note.publishedAt)}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Portaled so the navbar's own stacking context can't clip or
          under-layer it — the header is fixed and translucent. */}
      {mounted &&
        selected &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setSelected(null)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="release-note-title"
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-lg max-h-[85vh] flex flex-col rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-ink-900 shadow-2xl overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="absolute top-3 right-3 p-2 rounded-lg text-ink-400 hover:text-ink dark:hover:text-cream hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                aria-label="Close"
              >
                <X size={16} />
              </button>

              <div className="px-6 pt-6 pb-4 border-b border-black/5 dark:border-white/10">
                <div className="flex items-center gap-2 flex-wrap mb-2 pr-8">
                  <span
                    className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] uppercase tracking-wider",
                      releaseNoteAccent(selected.category)
                    )}
                  >
                    {selected.category}
                  </span>
                  {selected.version && (
                    <span className="font-jakarta text-xs text-ink-400 dark:text-ink-300">
                      {selected.version}
                    </span>
                  )}
                  <span className="font-body text-xs text-ink-400 dark:text-ink-300">
                    {formatReleaseNoteDate(selected.publishedAt)}
                  </span>
                </div>
                <h2
                  id="release-note-title"
                  className="font-jakarta text-lg font-semibold text-ink dark:text-cream leading-snug pr-8"
                >
                  {selected.title}
                </h2>
              </div>

              {/* whitespace-pre-line, not a markdown renderer: the admin types
                  plain text into a textarea, and line breaks are the only
                  formatting that needs to survive. */}
              <div className="px-6 py-5 overflow-y-auto">
                <p className="font-body text-sm text-ink-500 dark:text-cream/75 leading-relaxed whitespace-pre-line">
                  {selected.body}
                </p>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
