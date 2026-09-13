// components/public/ProfileSlideshow.tsx
"use client";

import { useEffect, useState } from "react";
import Image from "@/components/ui/SafeImage";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  images: string[];
  alt?: string;
}

export function ProfileSlideshow({ images, alt = "Artist portrait" }: Props) {
  const [current, setCurrent] = useState(0);
  const [resetKey, setResetKey] = useState(0);
  const count = images.length;

  useEffect(() => {
    if (count <= 1) return;
    const id = setInterval(() => setCurrent((c) => (c + 1) % count), 8000);
    return () => clearInterval(id);
  }, [count, resetKey]);

  function goTo(i: number) {
    setCurrent(i);
    setResetKey((k) => k + 1);
  }

  // Manual step — same reset-the-autoplay-timer behavior as goTo (a click
  // shouldn't have the autoplay yank the photo forward again a moment
  // later), just wrapping around the ends instead of an absolute index.
  function step(delta: 1 | -1) {
    goTo((current + delta + count) % count);
  }

  if (count === 0) {
    return (
      <div className="absolute inset-0 bg-ink-800/40 flex items-center justify-center transition-colors duration-500 group-hover:bg-ink-800/60">
        <div className="text-center text-white/30 transition-transform duration-500 group-hover:scale-95">
          <div className="w-24 h-24 border border-white/15 rounded-full mx-auto mb-6 transition-colors duration-500 group-hover:border-white/30" />
          <p className="font-body text-xs tracking-widest uppercase transition-colors duration-500 group-hover:text-white/60">
            Artist Portrait
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.75, ease: "easeInOut" }}
          className="absolute inset-0"
        >
          <Image
            src={images[current]}
            alt={alt}
            fill
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-105 group-hover:brightness-105"
            priority={current === 0}
          />
        </motion.div>
      </AnimatePresence>

      {/* Dark vignette on hover */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

      {/* Prev/Next — manual override, autoplay keeps running underneath (each
          click just resets its 8s timer via goTo/step, same as a dot click).
          Hidden until hover so they don't compete with the portrait itself. */}
      {count > 1 && (
        <>
          <button
            type="button"
            onClick={() => step(-1)}
            aria-label="Previous image"
            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-1.5 rounded-full bg-black/30 text-white/70 opacity-0 group-hover:opacity-100 hover:bg-black/50 hover:text-white transition-all duration-300 focus-visible:opacity-100"
          >
            <ChevronLeft size={18} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            aria-label="Next image"
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-1.5 rounded-full bg-black/30 text-white/70 opacity-0 group-hover:opacity-100 hover:bg-black/50 hover:text-white transition-all duration-300 focus-visible:opacity-100"
          >
            <ChevronRight size={18} strokeWidth={1.75} />
          </button>
        </>
      )}

      {/* Indicator dots — only shown for multiple images */}
      {count > 1 && (
        <div className="absolute bottom-4 left-0 right-0 flex justify-center items-center gap-2 z-10">
          {images.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Show image ${i + 1} of ${count}`}
              aria-current={i === current ? "true" : undefined}
              className={`h-1.5 rounded-full transition-all duration-400 ease-out ${
                i === current
                  ? "w-6 bg-white"
                  : "w-1.5 bg-white/40 hover:bg-white/70"
              }`}
            />
          ))}
        </div>
      )}
    </>
  );
}
