// components/public/SquidLetter.tsx
// The squid standing in for a letter inside a display heading (Gallery,
// Tales, About, Contact). Now the same glowing, colour-cycling squid as the
// Footer wordmark (see FooterWordmark.tsx) and the sidebar/maintenance-page
// ones — motion-safe:animate-squid-drift bobs it and cycles the shared
// --squid-glow custom property (see squidCycle in tailwind.config.ts),
// which motion-safe:animate-squid-glow turns into a pulsing halo on the icon
// and the blurred dot behind it. Every one of these squids reads off the
// same global animation clock, so a heading's squid and the Footer's squid
// glow the same colour at the same moment rather than drifting out of sync.
// Pure CSS, no JS.
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { SquidIcon } from "@/components/ui/SquidIcon";

export function SquidLetter({
  letter = "a",
  className,
}: {
  letter?: string;
  className?: string;
}) {
  return (
    // mr matches the headings' tracking-widest (0.1em): letter-spacing only
    // trails text, never a flex item's box, so without it the squid would
    // hug whatever letter follows it.
    <span
      className={cn(
        "relative inline-flex items-center justify-center mr-[0.1em] motion-safe:animate-squid-drift",
        className
      )}
    >
      {/* The icon replaces a real letter, so hand that letter back to screen
          readers — otherwise the heading announces as "Gllery". */}
      <span className="sr-only">{letter}</span>
      <span
        aria-hidden="true"
        style={{
          backgroundColor: "color-mix(in srgb, var(--squid-glow) 35%, transparent)",
        }}
        className="pointer-events-none absolute inset-0 scale-150 rounded-full opacity-70 blur-lg"
      />
      <SquidIcon
        style={{ color: "var(--squid-glow)" } as CSSProperties}
        className="relative w-[0.8em] h-[0.8em] shrink-0 motion-safe:animate-squid-glow"
      />
    </span>
  );
}
