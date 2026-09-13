"use client";

// components/public/FooterVisitorCount.tsx
//
// Shimmering gold pill shown in the Footer Brand section.
// Reads from the same /api/visitor-count endpoint (POST is idempotent —
// no-op if VisitorCounterWidget already registered this visit first).
import { useEffect, useState } from "react";

export function FooterVisitorCount() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/visitor-count", { method: "POST" })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (typeof data.count === "number") setCount(data.count);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (count === null) return null;

  return (
  <span
    className="relative inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-amber-500/30 overflow-hidden
      bg-amber-500/10
      shadow-[0_0_12px_-2px_rgba(245,158,11,0.2)]
      font-body text-[11px] font-medium tracking-[0.15em] uppercase text-amber-200/90
      select-none"
    aria-label={`${count.toLocaleString()} visitors`}
  >
    {/* subtle shimmer sweep */}
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-full"
    >
      <span className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-200/10 to-transparent animate-shimmer" />
    </span>

    {/* live pulsing dot */}
    <span className="relative flex h-2 w-2 items-center justify-center">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-400" />
    </span>

    <span className="relative">{count.toLocaleString()} visitors</span>
  </span>
  );
}
