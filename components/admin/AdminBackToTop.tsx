"use client";

import { useState, useEffect } from "react";
import { ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Floating "back to top" button for the admin shell.
 *
 * Mirrors components/public/BackToTop.tsx. The admin layout's <main> carries
 * overflow-auto, but .admin-shell is only min-h-screen (not h-screen) so
 * main's height is never actually constrained — it just grows with content,
 * and the window ends up scrolling (confirmed by AdminSidebar being
 * fixed/sticky rather than scrolling away). So, like the public site, this
 * tracks window.scrollY rather than any inner container's scrollTop.
 */
export function AdminBackToTop() {
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
