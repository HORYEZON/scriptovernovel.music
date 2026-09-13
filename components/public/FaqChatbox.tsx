// components/public/FaqChatbox.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import nextDynamic from "next/dynamic";
import { X, RotateCcw, ArrowLeft, Bot } from "lucide-react";
import { SquidIcon } from "@/components/ui/SquidIcon";
import { parseIconValue } from "@/components/ui/icon-values";

// DynamicIcon.tsx pulls in the full Lucide + Tabler icon-import maps
// (~3,000 entries) — dynamic-imported so that weight only ever loads if
// chatIcon is actually set (and only once, then cached), instead of being
// part of every public page's compile via this always-mounted chatbox.
const DynamicIcon = nextDynamic(() => import("@/components/ui/DynamicIcon").then((m) => m.DynamicIcon), {
  ssr: false,
});

interface Faq {
  id: string;
  question: string;
  answer: string;
}

interface ConversationEntry {
  id: string;
  question: string;
  answer: string;
}

// chatIcon is a "platform:name" icon-gallery value picked in Settings →
// Preferences → Branding → Icons, not an uploaded image. See IconPicker.tsx.
export function FaqChatbox({ chatIcon }: { chatIcon?: string | null }) {
  const pathname = usePathname();
  const icon = parseIconValue(chatIcon);
  const [open, setOpen] = useState(false);
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [conversation, setConversation] = useState<ConversationEntry[]>([]);

  // Lazily fetch active FAQs the first time the chatbox is opened
  useEffect(() => {
    if (!open || status !== "idle") return;

    let isMounted = true;
    setStatus("loading");

    fetch("/api/faqs/active", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: Faq[]) => {
        if (isMounted) {
          setFaqs(Array.isArray(data) ? data : []);
          setStatus("loaded");
        }
      })
      .catch(() => {
        if (isMounted) setStatus("error");
      });

    return () => {
      isMounted = false;
    };
    // Intentionally omitting `status` — this effect sets `status` itself, and
    // including it would re-trigger the effect (and its cleanup) before the
    // in-flight fetch resolves, permanently stranding the state at "loading".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const answeredIds = useMemo(() => new Set(conversation.map((c) => c.id)), [conversation]);
  const remainingFaqs = useMemo(() => faqs.filter((f) => !answeredIds.has(f.id)), [faqs, answeredIds]);

  function handleSelectFaq(faq: Faq) {
    setConversation((prev) => [...prev, { id: faq.id, question: faq.question, answer: faq.answer }]);
  }

  function handleReset() {
    setConversation([]);
  }

  // Same reasoning as Navbar.tsx: the Digital Museum is a full-viewport 3D
  // room with its own HUD/chrome — a floating chat bubble over it would
  // just sit in the way of walking/looking around, and it duplicates the
  // room's own [E]/[M]/[L] interaction model instead of complementing it.
  if (pathname?.startsWith("/gallery/museum")) return null;

  return (
    <>
      {/* Floating Toggle Button */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? "Close FAQ chat" : "Open FAQ chat"}
        className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-40 flex items-center justify-center w-14 h-14 rounded-full bg-sepia text-white shadow-xl hover:bg-sepia-dark hover:scale-105 active:scale-95 transition-all duration-200 overflow-hidden"
      >
        {open ? (
          <X size={22} />
        ) : icon ? (
          <DynamicIcon platform={icon.platform} name={icon.name} size={22} />
        ) : (
          <SquidIcon className="w-[22px] h-[22px]" />
        )}
      </button>

      {/* Chat Panel */}
      {open && (
        <div
          role="dialog"
          aria-label="Frequently asked questions"
          className="fixed bottom-24 right-4 left-4 sm:right-6 sm:left-auto z-40 w-auto sm:w-96 max-w-full h-[70vh] sm:h-[32rem] max-h-[calc(100vh-8rem)] flex flex-col rounded-2xl overflow-hidden border border-black/10 dark:border-white/15 bg-white dark:bg-[#121212] shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 duration-200"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-black/10 dark:border-white/10 bg-sepia/10 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-full bg-sepia text-white flex items-center justify-center shrink-0">
                <Bot size={18} />
              </div>
              <div className="min-w-0">
                <h2 className="font-jakarta text-sm font-semibold text-ink dark:text-cream truncate">
                  Got a question?
                </h2>
                <p className="font-body text-[11px] text-ink-400 dark:text-ink-300 truncate">
                  We&apos;re happy to help
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {conversation.length > 0 && (
                <button
                  type="button"
                  onClick={handleReset}
                  title="Reset conversation"
                  aria-label="Reset conversation"
                  className="p-2 rounded-lg text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                >
                  <RotateCcw size={16} />
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                title="Close"
                aria-label="Close chat"
                className="p-2 rounded-lg text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Message Thread */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 font-jakarta text-sm">
            {/* Bot greeting */}
            <div className="flex items-start gap-2">
              <div className="w-7 h-7 rounded-full bg-sepia/15 text-sepia flex items-center justify-center shrink-0">
                <Bot size={14} />
              </div>
              <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-black/5 dark:bg-white/10 px-3.5 py-2.5 text-ink dark:text-cream">
                {conversation.length === 0
                  ? "Hi! 👋 Pick a question below and I'll answer it right away."
                  : "Glad that helped! Ask me something else below, or reset to start over."}
              </div>
            </div>

            {/* Q&A history */}
            {conversation.map((entry, i) => (
              <div key={`${entry.id}-${i}`} className="space-y-3">
                {/* Visitor question bubble */}
                <div className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-sepia text-white px-3.5 py-2.5">
                    {entry.question}
                  </div>
                </div>
                {/* Bot answer bubble */}
                <div className="flex items-start gap-2">
                  <div className="w-7 h-7 rounded-full bg-sepia/15 text-sepia flex items-center justify-center shrink-0">
                    <Bot size={14} />
                  </div>
                  <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-black/5 dark:bg-white/10 px-3.5 py-2.5 text-ink dark:text-cream whitespace-pre-wrap">
                    {entry.answer}
                  </div>
                </div>
              </div>
            ))}

            {/* Loading state */}
            {status === "loading" && (
              <p className="text-xs text-ink-400 dark:text-ink-300 text-center py-4">Loading questions...</p>
            )}

            {/* Error state */}
            {status === "error" && (
              <p className="text-xs text-ink-400 dark:text-ink-300 text-center py-4">
                Couldn&apos;t load FAQs right now. Please try again shortly.
              </p>
            )}

            {/* No FAQs configured */}
            {status === "loaded" && faqs.length === 0 && (
              <p className="text-xs text-ink-400 dark:text-ink-300 text-center py-4">
                No FAQs available yet. Feel free to{" "}
                <Link href="/contact" onClick={() => setOpen(false)} className="text-sepia hover:underline">
                  contact us
                </Link>{" "}
                directly.
              </p>
            )}

            {/* All questions answered */}
            {status === "loaded" && faqs.length > 0 && remainingFaqs.length === 0 && conversation.length > 0 && (
              <p className="text-xs text-ink-400 dark:text-ink-300 text-center py-2">
                You&apos;ve seen all our FAQs. Still need help?{" "}
                <Link href="/contact" onClick={() => setOpen(false)} className="text-sepia hover:underline">
                  Contact us
                </Link>
              </p>
            )}
          </div>

          {/* Question Options */}
          {remainingFaqs.length > 0 && (
            <div className="shrink-0 border-t border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03] px-4 py-3 space-y-2 max-h-40 overflow-y-auto">
              {conversation.length > 0 && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="inline-flex items-center gap-1.5 font-body text-[11px] text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream transition-colors mb-1"
                >
                  <ArrowLeft size={11} />
                  Back to main questions
                </button>
              )}
              {remainingFaqs.map((faq) => (
                <button
                  key={faq.id}
                  type="button"
                  onClick={() => handleSelectFaq(faq)}
                  className="w-full text-left px-3.5 py-2 rounded-xl border border-sepia/30 text-sepia dark:text-sepia font-body text-xs hover:bg-sepia/10 transition-colors"
                >
                  {faq.question}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
