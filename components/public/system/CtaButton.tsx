// components/public/system/CtaButton.tsx
//
// The pill call-to-action (LISTEN, WATCH, ALL SHOWS…). Same shell as
// HomeHero's CTA so the admin's Site Design → Hero → Button colours tint
// every primary CTA on the site; `variant="ghost"` is the outlined
// secondary next to it.
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 font-body text-[11px] font-medium uppercase tracking-[0.18em] transition-[transform,background-color,color,border-color] duration-200 hover:scale-[1.04] active:scale-95";

export function CtaButton({
  href,
  children,
  variant = "solid",
  colors,
  external = false,
  className,
}: {
  href: string;
  children: ReactNode;
  variant?: "solid" | "ghost";
  /** Solid variant colours — Site Design's heroCtaBgColor / heroCtaTextColor. */
  colors?: { bg: string; text: string };
  external?: boolean;
  className?: string;
}) {
  const style: CSSProperties | undefined =
    variant === "solid" && colors ? { backgroundColor: colors.bg, color: colors.text } : undefined;
  const cls = cn(
    BASE,
    variant === "solid" && !colors && "bg-cream text-ink",
    variant === "ghost" && "border border-cream/30 text-cream hover:border-cream/70",
    className
  );
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls} style={style}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={cls} style={style}>
      {children}
    </Link>
  );
}
