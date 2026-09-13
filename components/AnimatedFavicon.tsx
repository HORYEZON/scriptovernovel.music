// components/AnimatedFavicon.tsx
"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { MUSEUM_FAVICON_ICON } from "@/lib/favicon";

/**
 * Browsers render an SVG favicon as a single static snapshot — @keyframes
 * inside app/icon.tsx would never actually play in the tab. This gets the
 * same "glow" effect by swapping the <link rel="icon"> href on an interval
 * between app/api/favicon-frame's colored variants of the exact same icon
 * (see lib/favicon.ts — shared by both routes, so the static favicon and
 * these animated frames can never visually drift apart, and this
 * automatically follows whichever icon the admin has picked).
 *
 * Discrete steps rather than a smooth per-frame color interpolation (the
 * pre-icon-picker version of this component did that with locally-built
 * data: URIs, at zero network cost) — each color is now a real request to
 * app/api/favicon-frame, so interpolating through dozens of intermediate
 * colors would mean dozens of uncached URLs instead of one per configured
 * color. A favicon is a handful of pixels; a hard cut between colors reads
 * the same as a soft one at that size.
 *
 * One exception to "whichever icon the admin has picked": on /gallery/museum
 * this swaps in a fixed museum icon instead (see MUSEUM_FAVICON_ICON below),
 * still cycling through the exact same colors — a shape override scoped to
 * that route, not a second color scheme.
 */
const DEFAULT_COLORS = ["#FFE135", "#44D700", "#FF6B9D", "#5BC8F5"];
const STEP_MS = 2500;

export default function AnimatedFavicon({ colors }: { colors?: string[] }) {
  const cycleColors = colors && colors.length > 0 ? colors : DEFAULT_COLORS;
  // Joined so the effect only restarts when the actual color list changes,
  // not merely when the caller passes a new array instance.
  const colorsKey = cycleColors.join(",");

  // While on /gallery/museum the tab shows the museum's own icon (a fixed
  // "landmark" glyph, see lib/favicon.ts's MUSEUM_FAVICON_ICON doc comment)
  // instead of the site-wide admin-picked one, still cycling through the
  // exact same colors — this is purely a shape override, not a separate
  // color scheme. app/(public)/gallery/museum/icon.tsx handles the static/
  // no-JS equivalent so the two never disagree.
  const pathname = usePathname();
  const iconOverride = pathname?.startsWith("/gallery/museum") ? MUSEUM_FAVICON_ICON : null;

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Take over favicon rendering: drop whatever <link rel="icon"> Next
    // auto-injected for app/icon.tsx, and manage our own.
    const existing = document.querySelectorAll<HTMLLinkElement>('link[rel="icon"]');
    existing.forEach((link) => link.remove());

    const link = document.createElement("link");
    link.rel = "icon";
    link.type = "image/svg+xml";
    document.head.appendChild(link);

    const list = colorsKey.split(",");
    let i = 0;
    const tick = () => {
      const params = new URLSearchParams({ color: list[i % list.length] });
      if (iconOverride) params.set("icon", iconOverride);
      link.href = `/api/favicon-frame?${params.toString()}`;
      i++;
    };

    tick();
    const id = window.setInterval(tick, STEP_MS);

    return () => {
      window.clearInterval(id);
      link.remove();
    };
  }, [colorsKey, iconOverride]);

  return null;
}
