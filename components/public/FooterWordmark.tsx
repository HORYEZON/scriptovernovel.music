// components/public/FooterWordmark.tsx
// The SCRIPT/N(squid)VEL lockup — "over" is the slash, the icon is the O in NOVEL. No "use client" — the colour cycle is pure CSS,
// so this ships zero JS.
import type { CSSProperties } from "react";
import { SquidIcon } from "@/components/ui/SquidIcon";
import { DynamicIcon } from "@/components/ui/DynamicIcon";
import { parseIconValue } from "@/components/ui/icon-values";
import { cn } from "@/lib/utils";

/**
 * `className` overrides the size (default text-5xl) — the same lockup also
 * stands in for the uploaded logo wherever that image is missing or dead
 * (navbar, admin sidebar, login), where it has to fit a navbar row rather
 * than the footer. Everything scales in em off the font-size.
 */
export function FooterWordmark({
  icon,
  className,
}: {
  icon?: string | null;
  className?: string;
}) {
  const parsedIcon = parseIconValue(icon);
  return (
    <span
      className={cn(
        "group/logo font-badaboom tracking-[0.25em] uppercase inline-flex items-center",
        className ?? "text-5xl"
      )}
    >
      <span className="transition-colors duration-200 hover:text-[#FFD700]">Script</span>
      <span className="transition-colors duration-200 hover:text-[#9A9A9A]">/</span>
      <span className="transition-colors duration-200 hover:text-[#F5F1E8]">N</span>
      {/* Squid stands in for the O in NOVEL. Sized in em so it tracks the
          wordmark's font-size, and mr matches tracking-[0.25em] — letter-spacing
          only trails text, never a flex item's box, so without it the squid
          would hug "vel". animate-squid-drift bobs the wrapper and cycles
          --squid-glow, which inherits to both children below. */}
      <span className="relative inline-flex items-center justify-center mr-[0.25em] motion-safe:animate-squid-drift">
        <span
          aria-hidden="true"
          style={{
            backgroundColor: "color-mix(in srgb, var(--squid-glow) 35%, transparent)",
          }}
          className="pointer-events-none absolute inset-0 scale-75 rounded-full opacity-0 blur-xl transition-all duration-300 group-hover/logo:scale-150 group-hover/logo:opacity-100"
        />
        {parsedIcon ? (
          <DynamicIcon
            platform={parsedIcon.platform}
            name={parsedIcon.name}
            style={{ color: "var(--squid-glow)" } as CSSProperties}
            className="relative w-[1em] h-[1em] shrink-0 transition-transform duration-300 motion-safe:animate-squid-glow group-hover/logo:scale-110"
            fallback={
              <SquidIcon
                style={{ color: "var(--squid-glow)" } as CSSProperties}
                className="relative w-[1em] h-[1em] shrink-0 transition-transform duration-300 motion-safe:animate-squid-glow group-hover/logo:scale-110"
              />
            }
          />
        ) : (
          <SquidIcon
            style={{ color: "var(--squid-glow)" } as CSSProperties}
            className="relative w-[1em] h-[1em] shrink-0 transition-transform duration-300 motion-safe:animate-squid-glow group-hover/logo:scale-110"
          />
        )}
      </span>
      <span className="transition-colors duration-200 hover:text-[#F5F1E8]">vel</span>
    </span>
  );
}
