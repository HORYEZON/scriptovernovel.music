"use client";

// ContactPanel.tsx
//
// The "Send an Email" overlay the About room's Contact Desk opens on [E].
//
// Same form, same endpoint and same reCAPTCHA action as the public contact
// page (app/(public)/contact/ContactClient.tsx) — the museum is another way
// into the same enquiry, not a second inbox. The subject list is imported
// from lib/contact rather than re-typed, so adding a subject there adds it
// here; the field markup is its own, because that page's is woven into a
// full-page two-column layout that means nothing inside a modal.
//
// The shell mirrors ArtworkInfoPanel: fixed overlay, [X] / backdrop / Esc to
// close, and the same `landscape` prop for the museum's forced-landscape
// mode — read that file's doc for why this is a prop and not Tailwind's
// `landscape:` variant.
import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Mail, Send, X } from "lucide-react";
import { useGoogleReCaptcha } from "react-google-recaptcha-v3";
import toast from "@/lib/toast";
import { cn } from "@/lib/utils";
import { CONTACT_SUBJECTS } from "@/lib/contact";

const EMPTY_FORM = { name: "", email: "", subject: "", message: "" };

export function ContactPanel({
  open,
  title,
  subtitle,
  onClose,
  landscape = false,
}: {
  open: boolean;
  title: string;
  subtitle: string;
  onClose: () => void;
  /** True only on a touch device in the forced-landscape view — switches to a
   *  two-column form so the fields still fit a short screen. */
  landscape?: boolean;
}) {
  const { executeRecaptcha } = useGoogleReCaptcha();
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (loading) return;
      if (!executeRecaptcha) {
        // The provider lives in the public layout, so this only happens while
        // the script is still loading — say so rather than failing silently.
        toast.error("Still loading — try again in a moment.");
        return;
      }
      setLoading(true);
      try {
        const captchaToken = await executeRecaptcha("contact_form");
        const res = await fetch("/api/contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form, captchaToken }),
        });
        if (!res.ok) {
          const { error } = await res.json().catch(() => ({ error: null }));
          throw new Error(error || "Failed to send message.");
        }
        toast.success("Message sent! We'll be in touch soon.");
        setForm(EMPTY_FORM);
        onClose();
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        setLoading(false);
      }
    },
    [executeRecaptcha, form, loading, onClose]
  );

  const inputCls =
    "w-full bg-black/30 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 rounded-lg px-3 py-2 font-body text-sm transition-colors";
  const labelCls =
    "block font-body text-[11px] tracking-widest uppercase text-white/50 mb-1.5";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
        >
          <motion.div
            // min(…vh, 100%) rather than a bare vh, for the reason
            // ArtworkInfoPanel and MuseumMap both document: under the museum's
            // forced-landscape rotate this overlay fills the pre-rotation box
            // — as tall as the phone is *wide* — while `vh` goes on measuring
            // the phone's full height and would size this to roughly twice the
            // room it has.
            className={cn(
              "relative w-full bg-[#121212] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden",
              landscape ? "max-w-3xl max-h-[min(92vh,100%)]" : "max-w-lg max-h-[min(88vh,100%)]"
            )}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 px-4 sm:px-5 py-3 sm:py-4 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <Mail size={17} className="shrink-0 text-sepia" />
                <div className="min-w-0">
                  <h2 className="font-grotesk font-bold text-sm sm:text-base uppercase tracking-wide text-white truncate">
                    {title}
                  </h2>
                  {subtitle.trim() && (
                    <p className="font-body text-[11px] text-white/45 mt-0.5">{subtitle}</p>
                  )}
                </div>
              </div>
              <button
                onClick={onClose}
                className="shrink-0 p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Close"
              >
                <X size={17} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="overflow-y-auto p-4 sm:p-5">
              <div className={cn("grid gap-3 sm:gap-4", landscape ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2")}>
                <div>
                  <label className={labelCls} htmlFor="museum-contact-name">
                    Your Name
                  </label>
                  <input
                    id="museum-contact-name"
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className={inputCls}
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label className={labelCls} htmlFor="museum-contact-email">
                    Email
                  </label>
                  <input
                    id="museum-contact-email"
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className={inputCls}
                    placeholder="email@domain.com"
                  />
                </div>
              </div>

              <div className="mt-3 sm:mt-4">
                <label className={labelCls} htmlFor="museum-contact-subject">
                  Subject
                </label>
                {/* appearance-none removes the native arrow — without a drawn
                    replacement this looked like a plain text field. */}
                <div className="relative">
                  <select
                    id="museum-contact-subject"
                    required
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    className={cn(inputCls, "appearance-none cursor-pointer pr-10")}
                  >
                    <option value="" className="bg-[#121212]">
                      Select a subject…
                    </option>
                    {CONTACT_SUBJECTS.map((s) => (
                      <option key={s.key} value={s.key} className="bg-[#121212]">
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-white/40">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </div>
              </div>

              <div className="mt-3 sm:mt-4">
                <label className={labelCls} htmlFor="museum-contact-message">
                  Message
                </label>
                <textarea
                  id="museum-contact-message"
                  // Shorter in landscape: the panel has the phone's *width*
                  // for height there, and a 6-row box would push the Send
                  // button off the bottom of it.
                  rows={landscape ? 3 : 5}
                  required
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  className={cn(inputCls, "resize-none")}
                  placeholder="Tell me about what you have in mind…"
                />
              </div>

              <div className="flex flex-col items-center mt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-sepia-light text-zinc-900 font-body text-sm font-medium hover:bg-sepia-light/90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:active:scale-100"
                >
                  {loading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-zinc-900/30 border-t-zinc-900 rounded-full animate-spin" />
                      Sending…
                    </>
                  ) : (
                    <>
                      <Send size={15} strokeWidth={1.5} />
                      Send Message
                    </>
                  )}
                </button>
                <p className="font-body text-[10px] text-white/35 mt-2.5 text-center">
                  Protected by reCAPTCHA — Google&apos;s{" "}
                  <a
                    href="https://policies.google.com/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-white/60"
                  >
                    Privacy Policy
                  </a>{" "}
                  and{" "}
                  <a
                    href="https://policies.google.com/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-white/60"
                  >
                    Terms
                  </a>{" "}
                  apply.
                </p>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
