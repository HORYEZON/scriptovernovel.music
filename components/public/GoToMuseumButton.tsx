"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Landmark } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The gallery's entry point into the Digital Museum — same shell as
 * MiniGamesLauncher's button (padding/radius/typography/hover-tap spring/
 * shimmer) but rendered as real navigation (a Link, no popover/chevron) and
 * recolored green so the two sit apart at a glance while staying visually
 * paired. Parent decides whether to render this at all (museum enabled +
 * has artworks) — this component is always "on" once mounted.
 */
export function GoToMuseumButton() {
  return (
    <Link href="/gallery/museum" className="inline-block">
      <motion.span
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.95 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className={cn(
          "relative inline-flex items-center gap-2 px-4 py-2 rounded-full border backdrop-blur-sm whitespace-nowrap",
          "bg-gradient-to-br from-emerald-900 via-emerald-600 to-emerald-400/90",
          "font-body text-xs font-medium tracking-[0.2em] uppercase text-white transition-shadow duration-300",
          "border-emerald-300/50 shadow-[0_2px_16px_-2px_rgba(16,185,129,0.55)]",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        )}
      >
        {/* Clipping lives on this static inner layer, matching MiniGamesLauncher's
            Safari workaround for a filtered child leaking outside a rounded
            overflow-hidden ancestor mid hover/tap transform. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-full"
        >
          <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
        </span>

        <span className="relative inline-flex items-center gap-2">
          <Landmark size={15} strokeWidth={1.5} aria-hidden="true" />
          Go To Museum
        </span>
      </motion.span>
    </Link>
  );
}
