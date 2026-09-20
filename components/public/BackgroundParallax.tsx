"use client";

// components/public/BackgroundParallax.tsx
//
// The scroll half of the "parallax" Site Background Effect. The CSS side
// (lib/theme.ts's bgEffectCss, emitted by PublicThemeStyle) slides the
// overscaled background photo by `--bg-parallax` × 25vh; this keeps that var
// at "how far down the page are we", 0 at the top and 1 at the bottom, so
// the slide is spread over the whole page however long it is. Renders
// nothing. Mounted by app/(public)/layout.tsx only while the effect is
// selected, and stays inert when the visitor prefers reduced motion (the
// matching CSS override is in globals.css).
import { useEffect } from "react";

export function BackgroundParallax({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const root = document.documentElement;
    let raf = 0;
    const update = () => {
      raf = 0;
      const max = root.scrollHeight - window.innerHeight;
      const progress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      root.style.setProperty("--bg-parallax", progress.toFixed(4));
    };
    // One write per frame no matter how many scroll events land in it.
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      root.style.removeProperty("--bg-parallax");
    };
  }, [enabled]);
  return null;
}
