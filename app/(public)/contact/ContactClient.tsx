// app/(public)/contact/ContactClient.tsx
"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Send, MapPin, Mail, Phone, CreditCard, Download, X, RotateCcw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "@/lib/toast";
import { useGoogleReCaptcha } from "react-google-recaptcha-v3";
import { SquidLetter } from "@/components/public/SquidLetter";
import { SafeImg } from "@/components/ui/SafeImage";
import { CONTACT_SUBJECTS } from "@/lib/contact";

interface ContactInfo {
  phone: string | null;
  email: string | null;
  address: string | null;
  contactHeading: string;
  contactIntro: string;
  commissionHeading: string;
  commissionIntro: string;
  callingCardFront: string | null;
  callingCardBack: string | null;
}

// ─── Calling Card Modal ───────────────────────────────────────────────────────

function CallingCardModal({
  front,
  back,
  onClose,
}: {
  front: string;
  back: string | null;
  onClose: () => void;
}) {
  const hasBack = Boolean(back);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isAutoSpinning, setIsAutoSpinning] = useState(hasBack);
  const spinRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [downloadingFront, setDownloadingFront] = useState(false);
  const [downloadingBack, setDownloadingBack] = useState(false);

  // Auto-spin on mount when there's a back image
  useEffect(() => {
    if (!hasBack) return;
    spinRef.current = setInterval(() => {
      setIsFlipped((f) => !f);
    }, 2200);
    return () => {
      if (spinRef.current) clearInterval(spinRef.current);
    };
  }, [hasBack]);

  function stopAutoSpin() {
    setIsAutoSpinning(false);
    if (spinRef.current) {
      clearInterval(spinRef.current);
      spinRef.current = null;
    }
  }

  function toggleSpin() {
    if (isAutoSpinning) {
      stopAutoSpin();
    } else {
      setIsAutoSpinning(true);
      spinRef.current = setInterval(() => {
        setIsFlipped((f) => !f);
      }, 2200);
    }
  }

  async function downloadImage(url: string, filename: string, setLoading: (v: boolean) => void) {
    setLoading(true);
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch {
      toast.error("Download failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // Lock body scroll while modal is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 16 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className="relative z-10 w-full max-w-sm sm:max-w-md flex flex-col items-center gap-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -top-2 -right-2 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 border border-white/20 text-white hover:bg-white/20 transition-colors z-20"
          aria-label="Close"
        >
          <X size={14} />
        </button>

        <p className="font-body text-xs tracking-[0.4em] uppercase text-white/50">
          Calling Card
        </p>

        {/* 3D Flip Card */}
        {hasBack ? (
          <div
            className="w-full cursor-pointer"
            style={{ perspective: "1000px" }}
            onClick={() => { stopAutoSpin(); setIsFlipped((f) => !f); }}
            role="button"
            aria-label="Flip card"
          >
            <motion.div
              animate={{ rotateY: isFlipped ? 180 : 0 }}
              transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
              style={{ transformStyle: "preserve-3d", position: "relative" }}
              className="w-full"
            >
              {/* Front face */}
              <div
                style={{ backfaceVisibility: "hidden" }}
                className="w-full rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10"
              >
                <SafeImg
                  src={front}
                  alt="Calling Card Front"
                  className="w-full h-auto block"
                  placeholderClassName="w-full aspect-[7/4]"
                  draggable={false}
                />
              </div>

              {/* Back face */}
              <div
                style={{
                  backfaceVisibility: "hidden",
                  transform: "rotateY(180deg)",
                  position: "absolute",
                  inset: 0,
                }}
                className="rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10"
              >
                <SafeImg
                  src={back!}
                  alt="Calling Card Back"
                  className="w-full h-auto block"
                  placeholderClassName="w-full aspect-[7/4]"
                  draggable={false}
                />
              </div>
            </motion.div>
          </div>
        ) : (
          /* Single image — no flip */
          <div className="w-full rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10">
            <SafeImg
              src={front}
              alt="Calling Card"
              className="w-full h-auto block"
              placeholderClassName="w-full aspect-[7/4]"
              draggable={false}
            />
          </div>
        )}

        {/* Hint + auto-spin toggle */}
        {hasBack && (
          <div className="flex items-center gap-3">
            <p className="font-body text-[11px] text-white/40">
              {isAutoSpinning ? "Auto-rotating · tap to flip" : "Tap card to flip"}
            </p>
            <button
              onClick={toggleSpin}
              className="flex items-center gap-1.5 font-body text-[11px] text-white/50 hover:text-white/80 transition-colors"
              aria-label={isAutoSpinning ? "Stop auto-rotate" : "Start auto-rotate"}
            >
              <RotateCcw size={12} />
              {isAutoSpinning ? "Stop" : "Auto-rotate"}
            </button>
          </div>
        )}

        {/* Download buttons */}
        <div className="flex flex-wrap gap-3 justify-center">
          <button
            onClick={() => downloadImage(front, "scriptovernovel-calling-card-front.jpg", setDownloadingFront)}
            disabled={downloadingFront}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/10 border border-white/20 text-white font-body text-xs tracking-widest uppercase hover:bg-white/20 active:scale-95 transition-all disabled:opacity-50"
          >
            <Download size={13} />
            {downloadingFront ? "Downloading…" : hasBack ? "Front" : "Download"}
          </button>
          {hasBack && (
            <button
              onClick={() => downloadImage(back!, "scriptovernovel-calling-card-back.jpg", setDownloadingBack)}
              disabled={downloadingBack}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/10 border border-white/20 text-white font-body text-xs tracking-widest uppercase hover:bg-white/20 active:scale-95 transition-all disabled:opacity-50"
            >
              <Download size={13} />
              {downloadingBack ? "Downloading…" : "Back"}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ContactClient({
  phone,
  email,
  address,
  contactHeading,
  contactIntro,
  commissionHeading,
  commissionIntro,
  callingCardFront,
  callingCardBack,
}: ContactInfo) {
  const { executeRecaptcha } = useGoogleReCaptcha();
  const [loading, setLoading] = useState(false);
  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!executeRecaptcha) return;
    setLoading(true);
    try {
      const captchaToken = await executeRecaptcha("contact_form");
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, captchaToken }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error || "Failed to send message.");
      }
      toast.success("Message sent! We'll be in touch soon.");
      setForm({ name: "", email: "", subject: "", message: "" });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [executeRecaptcha, form]);

  const inputCls =
    "w-full bg-black/30 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 rounded-md px-4 py-3 font-body text-sm transition-colors duration-200";

  return (
    <>
    <AnimatePresence>
      {cardModalOpen && callingCardFront && (
        <CallingCardModal
          front={callingCardFront}
          back={callingCardBack}
          onClose={() => setCardModalOpen(false)}
        />
      )}
    </AnimatePresence>
    <div className="pt-24 pb-24">
      <div className="section-padding">
        <div className="bg-black/30 dark:bg-black/45 rounded-2xl border border-white/5 shadow-2xl p-8 md:p-14">
          {/* Header */}
          <div className="mb-16">
            <p className="font-body text-md tracking-[0.5em] uppercase text-sepia-light mb-3">
              Reach Out
            </p>
            <h1 className="font-grotesk font-bold text-4xl md:text-6xl tracking-widest uppercase text-white drop-shadow-sm flex">
              <span className="transition-colors duration-200 hover:text-[#FFE135]">C</span>
              <span className="transition-colors duration-200 hover:text-[#44D700]">o</span>
              <span className="transition-colors duration-200 hover:text-[#FF6B9D]">n</span>
              <span className="transition-colors duration-200 hover:text-[#5BC8F5]">t</span>
              <SquidLetter />
              <span className="transition-colors duration-200 hover:text-[#44D700]">c</span>
              <span className="transition-colors duration-200 hover:text-[#FF6B9D]">t</span>
            </h1>
            <div className="deco-line mt-6" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-16 lg:gap-24">
            {/* Contact Info */}
            <div className="lg:col-span-2 space-y-12">
              <div>
                <p className="font-body text-xs tracking-widest uppercase text-white/50 mb-6">
                  {contactHeading}
                </p>
                <p className="font-body text-sm text-white/70 leading-relaxed">
                  {contactIntro}
                </p>
              </div>

              <div className="space-y-6">
                {phone && (
                  <a
                    href={`tel:${phone.replace(/[^\d+]/g, "")}`}
                    className="flex items-center gap-4 group"
                  >
                    <div className="w-10 h-10 border border-white/15 text-white/60 flex items-center justify-center group-hover:bg-white/10 group-hover:border-white/30 group-hover:text-white transition-all duration-300">
                      <Phone size={16} strokeWidth={1.5} />
                    </div>
                    <div>
                      <p className="font-body text-xs uppercase tracking-widest text-white/50 mb-0.5">
                        Phone
                      </p>
                      <p className="font-body text-sm text-white/80 group-hover:text-sepia transition-colors">
                        {phone}
                      </p>
                    </div>
                  </a>
                )}

                {email && (
                  <a
                    href={`mailto:${email}`}
                    className="flex items-center gap-4 group"
                  >
                    <div className="w-10 h-10 border border-white/15 text-white/60 flex items-center justify-center group-hover:bg-white/10 group-hover:border-white/30 group-hover:text-white transition-all duration-300">
                      <Mail size={16} strokeWidth={1.5} />
                    </div>
                    <div>
                      <p className="font-body text-xs uppercase tracking-widest text-white/50 mb-0.5">
                        Email
                      </p>
                      <p className="font-body text-sm text-white/80 group-hover:text-sepia transition-colors">
                        {email}
                      </p>
                    </div>
                  </a>
                )}

                {address && (
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 border border-white/15 text-white/60 flex items-center justify-center">
                      <MapPin size={16} strokeWidth={1.5} />
                    </div>
                    <div>
                      <p className="font-body text-xs uppercase tracking-widest text-white/50 mb-0.5">
                        Address
                      </p>
                      <p className="font-body text-sm text-white/80">
                        {address}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-white/10 pt-8">
                <p className="font-body text-xs uppercase tracking-widest text-white/50 mb-4">
                  {commissionHeading}
                </p>
                <p className="font-body text-xs text-white/60 leading-relaxed">
                  {commissionIntro}
                </p>
              </div>

              {/* Calling Card button — only shown when at least one card image is uploaded */}
              {callingCardFront && (
                <div className="border-t border-white/10 pt-8">
                  <p className="font-body text-xs uppercase tracking-widest text-white/50 mb-4">
                    Calling Card
                  </p>
                  <motion.button
                    type="button"
                    onClick={() => setCardModalOpen(true)}
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    // Brand blue (#5BC8F5, the "u"/squid cyan) in the same gradient-pill
                    // shell as Mini Games (red) and Go To Museum (green).
                    className="relative inline-flex items-center gap-2 px-4 py-2 rounded-full border backdrop-blur-sm bg-gradient-to-br from-sky-900 via-[#3AA8DA] to-[#5BC8F5]/90 border-[#5BC8F5]/50 shadow-[0_2px_16px_-2px_rgba(91,200,245,0.55)] font-body text-xs font-medium tracking-[0.2em] uppercase text-white transition-shadow duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5BC8F5] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                  >
                    {/* Shimmer */}
                    <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
                      <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                    </span>
                    <span className="relative inline-flex items-center gap-2">
                      <CreditCard size={15} strokeWidth={1.5} aria-hidden="true" />
                      Calling Card
                    </span>
                  </motion.button>
                </div>
              )}
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="lg:col-span-3 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block font-body text-xs tracking-widest uppercase text-white/50 mb-2">
                    Your Name
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className={inputCls}
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label className="block font-body text-xs tracking-widest uppercase text-white/50 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className={inputCls}
                    placeholder="email@domain.com"
                  />
                </div>
              </div>

              <div>
                <label className="block font-body text-xs tracking-widest uppercase text-white/50 mb-2">
                  Subject
                </label>
                <div className="relative">
                  <select
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    className={inputCls + " bg-ink-900 appearance-none pr-10"}
                    required
                  >
                    <option value="" className="bg-ink-900">Select a subject...</option>
                    {CONTACT_SUBJECTS.map((s) => (
                      <option key={s.key} value={s.key} className="bg-ink-900">
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-white/40">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-body text-xs tracking-widest uppercase text-white/50 mb-2">
                  Message
                </label>
                <textarea
                  rows={6}
                  required
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  className={inputCls + " resize-none"}
                  placeholder="Tell me about what you have in mind..."
                />
              </div>

              <div className="flex flex-col items-center">
                <button
                  type="submit"
                  disabled={loading}
                  className="relative inline-flex items-center justify-center gap-2 px-6 py-3 rounded-md bg-sepia-light text-zinc-900 font-medium tracking-wide hover:bg-sepia-light/90 hover:shadow-[0_0_20px_rgba(232,213,168,0.3)] active:scale-[0.98] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:active:scale-100"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-zinc-900/30 border-t-zinc-900 rounded-full animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <Send size={16} strokeWidth={1.5} />
                      <span>Send Message</span>
                    </>
                  )}
                </button>

                {/* reCAPTCHA Notice (Centered din) */}
                <p className="font-body text-[11px] text-white/40 mt-3 text-center">
                  This site is protected by reCAPTCHA and the Google{" "}
                  <a
                    href="https://policies.google.com/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-white/70"
                  >
                    Privacy Policy
                  </a>{" "}
                  and{" "}
                  <a
                    href="https://policies.google.com/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-white/70"
                  >
                    Terms of Service
                  </a>{" "}
                  apply.
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
