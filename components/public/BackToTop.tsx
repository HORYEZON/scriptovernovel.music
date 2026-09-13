"use client";

import { useState, useEffect } from "react";
import { ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

/** Floating "back to top" button shown site-wide once the user scrolls down. */
export function BackToTop() {
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 300);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Back to top"
      className={cn(
        "fixed bottom-6 left-1/2 -translate-x-1/2 z-50",
        "bg-ink/80 hover:bg-ink-800 text-white",
        "border border-white/10 p-3 rounded-full",
        "shadow-xl backdrop-blur-md",
        "flex items-center justify-center cursor-pointer",
        "transition-all duration-300 hover:scale-110 active:scale-95",
        showScrollTop
          ? "opacity-100 translate-y-0 pointer-events-auto"
          : "opacity-0 translate-y-4 pointer-events-none"
      )}
    >
      <ChevronUp className="w-5 h-5" />
    </button>
  );
}
