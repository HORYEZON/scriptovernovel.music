"use client";

// Floating submission form — slides up from the bottom of the wall when the
// visitor clicks the "+ Leave a note" button. No login required.

import { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Loader2 } from "lucide-react";
import { useGoogleReCaptcha } from "react-google-recaptcha-v3";
import { cn } from "@/lib/utils";
import type { NoteData } from "./StickyNote";

interface Props {
  onSubmitted: (note: NoteData) => void;
}

export function NoteForm({ onSubmitted }: Props) {
  const { executeRecaptcha } = useGoogleReCaptcha();
  const [open, setOpen] = useState(false);
  const [nickname, setNickname] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);

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
          captchaToken,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to post note");

      onSubmitted(data as NoteData);
      setContent("");
      setNickname("");
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }, [submitting, executeRecaptcha, nickname, content, onSubmitted]);

  return (
    <>
      {/* ── Trigger button ─────────────────────────────────────────────────── */}
      {/*
        Positioned above the FaqChatbox button (bottom-5 right-5, h-14 = 56px,
        so FaqChatbox ends at ~76px from the bottom). We sit at bottom-24
        (96px) to clear it with a comfortable gap on all screen sizes.
      */}
      <button
        onClick={() => { setOpen(true); setTimeout(() => contentRef.current?.focus(), 80); }}
        className={cn(
          "fixed bottom-24 right-4 sm:right-6 z-30",
          "flex items-center gap-2 px-4 py-2.5 rounded-full shadow-xl",
          "bg-yellow-300 hover:bg-yellow-400 text-yellow-900 font-semibold text-sm",
          "transition-colors ring-2 ring-yellow-200/60",
          open && "invisible"
        )}
      >
        <span className="text-base">📌</span> Leave a note
      </button>

      {/* ── Slide-up form ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="note-form"
            initial={{ y: "110%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "110%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 24 }}
            className="fixed bottom-0 inset-x-0 z-40 flex justify-center"
          >
            <form
              onSubmit={submit}
              className={cn(
                "w-full max-w-lg mx-4 mb-6 rounded-2xl shadow-2xl",
                "bg-yellow-50 dark:bg-zinc-800 border border-yellow-200 dark:border-zinc-600 p-5"
              )}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-sm text-yellow-900 dark:text-yellow-100 flex items-center gap-1.5">
                  <span>📌</span> Pin a sticky note
                </h2>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="p-1 rounded-md hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium mb-1 text-yellow-800 dark:text-yellow-200">
                    Nickname <span className="font-normal opacity-60">(optional)</span>
                  </label>
                  <input
                    type="text"
                    maxLength={50}
                    placeholder="Anonymous"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    className={cn(
                      "w-full rounded-lg px-3 py-2 text-sm",
                      "bg-white dark:bg-zinc-700 border border-yellow-300 dark:border-zinc-500",
                      "focus:outline-none focus:ring-2 focus:ring-yellow-400",
                      "placeholder:text-zinc-400"
                    )}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1 text-yellow-800 dark:text-yellow-200">
                    Your message <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    ref={contentRef}
                    required
                    maxLength={500}
                    rows={4}
                    placeholder="Write something…"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className={cn(
                      "w-full rounded-lg px-3 py-2 text-sm resize-none",
                      "bg-white dark:bg-zinc-700 border border-yellow-300 dark:border-zinc-500",
                      "focus:outline-none focus:ring-2 focus:ring-yellow-400",
                      "placeholder:text-zinc-400"
                    )}
                  />
                  <p className="text-right text-[0.65rem] text-zinc-400 mt-0.5">{content.length}/500</p>
                </div>
              </div>

              {error && (
                <p className="text-xs text-red-500 mt-2">{error}</p>
              )}

              <button
                type="submit"
                disabled={submitting || !content.trim() || !executeRecaptcha}
                className={cn(
                  "mt-4 w-full flex items-center justify-center gap-2",
                  "px-4 py-2.5 rounded-xl font-semibold text-sm",
                  "bg-yellow-400 hover:bg-yellow-500 text-yellow-900 transition-colors",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {submitting ? "Pinning…" : "Pin note"}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
