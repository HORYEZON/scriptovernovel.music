// components/public/MarqueeBanner.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Pause, Play } from "lucide-react";
import { isMarqueeLive, type Marquee } from "@/lib/marquee";

/**
 * Scrolling ticker rendered inside the fixed public header.
 *
 * Motion is pure CSS (see `.marquee-*` in globals.css) — the only JS here is
 * schedule expiry, the pause control, and publishing the bar's height as
 * `--marquee-h` so the page content below can offset itself.
 */

/**
 * How many times to repeat the text within one half of the track. Short
 * strings need several copies to span the viewport without a visible gap;
 * long ones need only the two halves the -50% loop requires. Derived from
 * length alone so server and client always agree.
 */
function repeatCount(text: string): number {
  return Math.min(12, Math.max(2, Math.ceil(80 / Math.max(text.length, 1))));
}

function MarqueeRow({ item, paused }: { item: Marquee; paused: boolean }) {
  const copies = useMemo(() => repeatCount(item.text), [item.text]);

  const content = (
    <span
      className="marquee-text"
      style={{ "--marquee-fs": item.fontSize } as React.CSSProperties}
    >
      {item.text}
    </span>
  );

  // One half of the track. Rendered twice; translating -50% swaps the two
  // halves at exactly the point they overlap, so the loop has no seam.
  const half = (
    <div className="marquee-half">
      {Array.from({ length: copies }, (_, i) => (
        <span key={i} className="marquee-item">
          {content}
          <span className="marquee-sep" aria-hidden="true">
            {item.separator}
          </span>
        </span>
      ))}
    </div>
  );

  const track = (
    <div
      className="marquee-track"
      aria-hidden="true"
      style={{
        animationDuration: `${item.speed}s`,
        animationPlayState: paused ? "paused" : "running",
      }}
    >
      {half}
      {half}
    </div>
  );

  const body = (
    <>
      {/* The visible track is duplicated and aria-hidden; this carries the
          real text once for assistive tech. */}
      <span className="sr-only">{item.text}</span>
      <div className="marquee-viewport">{track}</div>
    </>
  );

  return (
    <div
      className="marquee-bar"
      data-pause-on-hover={item.pauseOnHover ? "true" : "false"}
      style={{
        backgroundColor: item.backgroundColor,
        color: item.textColor,
        fontFamily: item.fontFamily,
      }}
    >
      {item.linkUrl ? (
        <Link
          href={item.linkUrl}
          className="marquee-link"
          {...(item.linkUrl.startsWith("http")
            ? { target: "_blank", rel: "noopener noreferrer" }
            : {})}
        >
          {body}
        </Link>
      ) : (
        body
      )}
    </div>
  );
}

export function MarqueeBanner({
  items,
  category,
}: {
  /** Live rows from the server — the first paint. Refreshed on mount. */
  items: Marquee[];
  /** Optional section filter, e.g. only render "System Alert" bars. */
  category?: string;
}) {
  const [rows, setRows] = useState<Marquee[]>(items);
  const [now, setNow] = useState<Date | null>(null);
  const [paused, setPaused] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const scoped = useMemo(
    () => (category ? rows.filter((i) => i.category === category) : rows),
    [rows, category]
  );

  // Several public routes prerender statically, so the server-rendered rows can
  // be older than the schedule they encode. One fetch against the no-store
  // /active endpoint corrects that; the 30s tick then retires bars whose end
  // date passes mid-visit, without a reload.
  useEffect(() => {
    let alive = true;

    fetch("/api/marquees/active", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (alive && Array.isArray(data)) setRows(data);
      })
      .catch(() => {
        // Keep the server-rendered rows on failure rather than blanking the bar.
      });

    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const visible = useMemo(
    () => (now ? scoped.filter((i) => isMarqueeLive(i, now)) : scoped),
    [scoped, now]
  );

  // Publish the bar's height so `<main>` can pad itself by exactly this much —
  // page top offsets are otherwise sized for the navbar alone.
  useEffect(() => {
    const el = wrapRef.current;
    const root = document.documentElement;

    if (!el || visible.length === 0) {
      root.style.setProperty("--marquee-h", "0px");
      return;
    }

    const publish = () => root.style.setProperty("--marquee-h", `${el.offsetHeight}px`);
    publish();

    const observer = new ResizeObserver(publish);
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.setProperty("--marquee-h", "0px");
    };
  }, [visible.length]);

  if (visible.length === 0) return null;

  return (
    <div ref={wrapRef} className="relative">
      {visible.map((item) => (
        <MarqueeRow key={item.id} item={item} paused={paused} />
      ))}

      {/* WCAG 2.2.2: moving content needs a mechanism to stop it. */}
      <button
        type="button"
        onClick={() => setPaused((p) => !p)}
        aria-pressed={paused}
        aria-label={paused ? "Resume scrolling announcements" : "Pause scrolling announcements"}
        title={paused ? "Resume announcements" : "Pause announcements"}
        className="absolute right-1 top-1/2 -translate-y-1/2 z-10 min-w-6 min-h-6 flex items-center justify-center rounded-full bg-black/40 text-white opacity-40 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white transition-opacity"
      >
        {paused ? <Play size={11} strokeWidth={2} /> : <Pause size={11} strokeWidth={2} />}
      </button>
    </div>
  );
}
