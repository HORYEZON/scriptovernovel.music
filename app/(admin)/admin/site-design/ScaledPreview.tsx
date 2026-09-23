"use client";

// app/(admin)/admin/site-design/ScaledPreview.tsx
//
// Renders its children at a fixed "design" size (a 1440×900 desktop by
// default) and scales the whole thing down to the width available, so the
// admin's live preview is the real public component at real desktop
// proportions — 6rem type, a 50/50 split — not a cramped re-layout of it.
//
// `maxHeight` caps how tall the frame may grow: the scale then comes from
// whichever of width/height runs out first, and the children are centred in
// the leftover width. A sticky preview needs this — a 1440×900 frame in a
// full-width column is ~625px tall and would swallow the viewport it is
// supposed to stay out of.
import { useEffect, useRef, useState, type ReactNode } from "react";

export function ScaledPreview({
  children,
  width = 1440,
  height = 900,
  maxHeight,
  background,
  className = "",
}: {
  children: ReactNode;
  width?: number;
  height?: number;
  /** Cap on the rendered frame's height, in px. */
  maxHeight?: number;
  /** Frame backdrop — what shows through wherever the children don't paint
   *  (e.g. beside the menu sheet mid-slide). Defaults to the ink field. */
  background?: string;
  className?: string;
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const update = () =>
      setScale(Math.min(el.clientWidth / width, maxHeight ? maxHeight / height : Infinity));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width, height, maxHeight]);

  return (
    <div
      ref={outerRef}
      className={`relative w-full overflow-hidden rounded-xl border border-black/10 dark:border-white/10 ${background ? "" : "bg-ink"} ${className}`}
      style={{ height: height * scale, ...(background && { backgroundColor: background }) }}
    >
      <div
        className="absolute top-0 origin-top-left"
        style={{
          width,
          height,
          transform: `scale(${scale})`,
          // Centred once the height cap — not the width — sets the scale.
          left: "50%",
          marginLeft: -(width * scale) / 2,
        }}
      >
        {children}
      </div>
    </div>
  );
}
