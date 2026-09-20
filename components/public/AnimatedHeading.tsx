// components/public/AnimatedHeading.tsx
// Shared per-letter hover-color heading, matching the style used on the
// Home/Gallery, About, and Contact pages. Kept as one component so the
// letter-cycling colors stay in sync as new pages adopt the same look.
import { cn } from "@/lib/utils";

const HOVER_COLORS = ["#FFE135", "#44D700", "#FF6B9D", "#5BC8F5"];
const NBSP = " ";

interface AnimatedHeadingProps {
  text: string;
  className?: string;
}

// Still on the cart / checkout / wishlist / order pages until the Store
// phase moves them to components/public/system/SectionHeading.
export function AnimatedHeading({ text, className }: AnimatedHeadingProps) {
  return (
    <h1
      className={cn(
        "font-grotesk font-bold text-3xl sm:text-4xl md:text-6xl tracking-widest uppercase text-white drop-shadow-sm flex",
        className
      )}
    >
      {text.split("").map((char, i) => (
        <span
          key={i}
          className="transition-colors duration-200 hover:[color:var(--hover-color)]"
          style={{ "--hover-color": HOVER_COLORS[i % HOVER_COLORS.length] } as React.CSSProperties}
        >
          {char === " " ? NBSP : char}
        </span>
      ))}
    </h1>
  );
}
