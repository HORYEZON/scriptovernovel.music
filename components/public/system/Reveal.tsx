"use client";

// components/public/system/Reveal.tsx
//
// Fades a section up, slowly, the first time it scrolls into view — the
// "everything arrives like a tide" pacing of the hazy direction. Renders
// visible from the start when the visitor prefers reduced motion or when
// IntersectionObserver is missing, so nothing is ever hidden by a failed
// animation.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Reveal({
  children,
  className,
  delayMs = 0,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  delayMs?: number;
  as?: "div" | "section" | "li";
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);
  // Once the fade-up has played, the transform and will-change come off:
  // either would make this element the containing block for any
  // `position: fixed` descendant (a modal, an overlay), which would then be
  // clipped to the section instead of covering the viewport.
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (!shown) return;
    const t = setTimeout(() => setSettled(true), 1300 + delayMs);
    return () => clearTimeout(t);
  }, [shown, delayMs]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (
      typeof IntersectionObserver === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.05 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={ref as any}
      className={cn(
        settled
          ? "opacity-100"
          : cn(
              "transition-[opacity,transform] duration-[1200ms] ease-out will-change-[opacity,transform]",
              shown ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
            ),
        className
      )}
      style={settled ? undefined : { transitionDelay: `${delayMs}ms` }}
    >
      {children}
    </Tag>
  );
}
