"use client";

// components/admin/AdminConfirmModal.tsx
//
// The admin's "are you sure?" dialog — the same box the Sections, Stories,
// Products and Trash modules each drew inline (warning roundel, question,
// optional detail, a danger button and Cancel), extracted so the modules that
// were still on the browser's own `window.confirm()` (Leaderboards, Blocked
// Emails, Visitor Milestones, Achievements, Notifications) can use literally
// the same dialog rather than a lookalike.
//
// Plays admin.deleteConfirm the moment it opens, like those inline copies
// do — the sound is the dialog's, not the caller's, so nobody can forget it.
// Locks page scroll while open (every fixed overlay in the admin does), and
// Escape backs out.
//
// The open/closed state is the caller's: pass `open` and keep whatever you
// need to confirm in your own state, exactly as the inline versions did with
// their `deleteConfirm` object.

import { useEffect, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { playSoundEffect } from "@/lib/sound/engine";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";

export function AdminConfirmModal({
  open,
  title,
  description,
  detail,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  /** Red confirm button (the default — most of these are deletes). False
   *  gives a neutral sepia one for non-destructive confirmations. */
  danger = true,
  loading = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: ReactNode;
  description?: ReactNode;
  /** A boxed, emphasised block under the description — the "the following
   *  will also go" list the Sections dialog carries. */
  detail?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  /** Disables both buttons and swaps the confirm label for a spinner while
   *  the caller's request is in flight. */
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useLockBodyScroll(open);

  useEffect(() => {
    if (!open) return;
    playSoundEffect("admin.deleteConfirm");
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !loading) onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // Sound and the Escape listener belong to the *opening*, not to every
    // re-render while open — loading/onCancel are read fresh from the
    // closure each keypress anyway.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return (
    // z-[60]: one step above the z-50 the admin's own edit/detail modals
    // sit at, since a confirm is often asked from *inside* one of those
    // (Notifications' detail view offers both Delete and Block) and has to
    // land on top of it whatever order the two were mounted in.
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={() => !loading && onCancel()}
      role="alertdialog"
      aria-modal="true"
    >
      <div
        className="bg-white dark:bg-[#121212] border border-black/10 dark:border-white/15 rounded-2xl w-full max-w-md p-6 shadow-2xl text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center mb-4">
          <div
            className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center",
              danger ? "bg-vermillion/10" : "bg-sepia/10"
            )}
          >
            <AlertTriangle size={24} className={danger ? "text-vermillion" : "text-sepia"} />
          </div>
        </div>
        <p className="font-jakarta text-xl font-semibold mb-2 text-ink dark:text-cream">
          {title}
        </p>
        {description && (
          <p className="font-body text-sm text-ink-400 dark:text-ink-300 mb-2">
            {description}
          </p>
        )}
        {detail && (
          <div className="bg-vermillion/10 border border-vermillion/20 p-3 mb-4 text-left font-body text-xs text-ink-500 dark:text-ink-300">
            {detail}
          </div>
        )}
        <div className="flex gap-3 justify-center flex-wrap mt-4">
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              "inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-medium transition-colors disabled:opacity-50",
              danger ? "bg-red-500 hover:bg-red-600" : "bg-sepia hover:bg-sepia-dark"
            )}
          >
            {loading && (
              <span className="w-3.5 h-3.5 border border-white/40 border-t-white rounded-full animate-spin" />
            )}
            {confirmLabel}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream text-sm font-medium transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
