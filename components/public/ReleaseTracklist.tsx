"use client";

// components/public/ReleaseTracklist.tsx
//
// A release's tracklist: number, title, an optional per-track link, a Lyrics
// disclosure that folds the words out underneath, and the running time.
//
// Extracted from ReleaseCard so /music's card and /music/[slug]'s own page
// render the identical list — the lyrics disclosure is the fiddliest piece of
// the release UI and the two were never going to stay in step as copies.
// `size="page"` is the detail page's roomier setting.
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/releases";

export interface ReleaseTrackData {
  id: string;
  trackNumber: number;
  title: string;
  durationSec: number | null;
  url: string | null;
  lyrics: string | null;
}

export function ReleaseTracklist({
  tracks,
  size = "card",
  className,
}: {
  tracks: ReleaseTrackData[];
  size?: "card" | "page";
  className?: string;
}) {
  const [openLyrics, setOpenLyrics] = useState<string | null>(null);
  if (tracks.length === 0) return null;
  const page = size === "page";

  return (
    <ol className={cn("divide-y divide-white/10 border-t border-white/10", className)}>
      {tracks.map((t) => {
        const open = openLyrics === t.id;
        return (
          <li key={t.id}>
            <div className={cn("flex items-center gap-4", page ? "py-4" : "py-3")}>
              <span className="w-6 shrink-0 font-mono text-xs text-cream/40">
                {String(t.trackNumber).padStart(2, "0")}
              </span>
              <span className={cn("min-w-0 flex-1 truncate font-body text-cream", page ? "text-base" : "text-sm")}>
                {t.url ? (
                  <a href={t.url} target="_blank" rel="noopener noreferrer" className="hover:text-sepia-light hover:underline">
                    {t.title}
                  </a>
                ) : (
                  t.title
                )}
              </span>
              {t.lyrics && (
                <button
                  type="button"
                  onClick={() => setOpenLyrics(open ? null : t.id)}
                  aria-expanded={open}
                  className="inline-flex shrink-0 items-center gap-1 font-body text-[10px] uppercase tracking-[0.2em] text-cream/50 transition-colors hover:text-cream"
                >
                  Lyrics <ChevronDown size={12} className={cn("transition-transform", open && "rotate-180")} />
                </button>
              )}
              {t.durationSec !== null && (
                <span className="w-10 shrink-0 text-right font-mono text-xs text-cream/40">{formatDuration(t.durationSec)}</span>
              )}
            </div>
            {t.lyrics && open && (
              <p
                className={cn(
                  "whitespace-pre-line pb-5 pl-10 font-body leading-relaxed text-cream/70 motion-safe:animate-fade-in",
                  page ? "text-base" : "text-sm"
                )}
              >
                {t.lyrics}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
