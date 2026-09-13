// components/public/AnimatedHeading.tsx
// Shared per-letter hover-color heading, matching the style used on the
// Home/Gallery, About, and Contact pages. Kept as one component so the
// letter-cycling colors stay in sync as new pages adopt the same look.
import { cn } from "@/lib/utils";
import { SquidLetter } from "@/components/public/SquidLetter";

const HOVER_COLORS = ["#FFE135", "#44D700", "#FF6B9D", "#5BC8F5"];
const NBSP = " ";

interface AnimatedHeadingProps {
  text: string;
  className?: string;
  /**
   * Swaps the letter at this index for the glowing squid — the same
   * always-on-halo, colour-cycling mark Gallery/Tales/About/Contact stand in
   * for an "a" with (SquidLetter.tsx). The squid takes no hover colour of
   * its own, but its position still counts toward the cycle below, so
   * letters after it land on the same colours those pages' hand-rolled
   * headings do. Omit for a heading with no squid (Shop, Checkout,
   * Wishlist, Order — unchanged).
   */
  squidLetterIndex?: number;
}

export function AnimatedHeading({ text, className, squidLetterIndex }: AnimatedHeadingProps) {
  return (
    <h1
      className={cn(
        "font-grotesk font-bold text-3xl sm:text-4xl md:text-6xl tracking-widest uppercase text-white drop-shadow-sm flex",
        className
      )}
    >
      {text.split("").map((char, i) =>
        i === squidLetterIndex ? (
          <SquidLetter key={i} letter={char} />
        ) : (
          <span
            key={i}
            className="transition-colors duration-200 hover:[color:var(--hover-color)]"
            style={{ "--hover-color": HOVER_COLORS[i % HOVER_COLORS.length] } as React.CSSProperties}
          >
            {char === " " ? NBSP : char}
          </span>
        )
      )}
    </h1>
  );
}
