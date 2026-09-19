"use client";

// app/(admin)/admin/site-design/ScaledPreview.tsx
//
// Renders its children at a fixed "design" size (a 1440×900 desktop by
// default) and scales the whole thing down to the width available, so the
// admin's live preview is the real public component at real desktop
// proportions — 6rem type, a 50/50 split — not a cramped re-layout of it.
import { useEffect, useRef, useState, type ReactNode } from "react";

export function ScaledPreview({
  children,
  width = 1440,
  height = 900,
  className = "",
}: {
  children: ReactNode;
  width?: number;
  height?: number;
  className?: string;
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / width);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);

  return (
    <div
      ref={outerRef}
      className={`relative w-full overflow-hidden rounded-xl border border-black/10 bg-ink dark:border-white/10 ${className}`}
      style={{ height: height * scale }}
    >
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{ width, height, transform: `scale(${scale})` }}
      >
        {children}
      </div>
    </div>
  );
}
