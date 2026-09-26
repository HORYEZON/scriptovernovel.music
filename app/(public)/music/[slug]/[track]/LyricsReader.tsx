"use client";

// app/(public)/music/[slug]/[track]/LyricsReader.tsx
//
// The lyrics, following the record.
//
// When a track has been tap-synced (Releases → Sync lyrics) this plays the
// record's audio and lights the line that's sounding, scrolling it into view.
// With no timings — or no vinyl to play — it renders the same lyrics as plain
// text, which is the whole page's job anyway; the sync is the extra.
//
// The audio is the *record's* file, not the track's, because that is the only
// audio the site has (see lib/lyrics.ts). So pressing play seeks to this track's
// first line rather than starting the record from the top, and stopping at the
// last line is deliberate: what follows is the next song.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTimestamp, lineIndexAtSeconds, lyricBlocks, type LyricBlock } from "@/lib/lyrics";

export function LyricsReader({
  lyrics,
  timings,
  audioUrl,
  synced,
}: {
  lyrics: string;
  /** Per-line seconds into the record's audio. Empty when not synced. */
  timings: number[];
  audioUrl: string | null;
  /** Every line timed *and* there's audio — the only case that can follow along. */
  synced: boolean;
}) {
  const blocks = useMemo<LyricBlock[]>(() => lyricBlocks(lyrics), [lyrics]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lineRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const [playing, setPlaying] = useState(false);
  const [active, setActive] = useState(-1);
  const [started, setStarted] = useState(false);

  // rAF rather than timeupdate: the latter fires about four times a second,
  // which is visibly late on a line that lasts two.
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      const el = audioRef.current;
      if (el) setActive(lineIndexAtSeconds(timings, el.currentTime));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, timings]);

  // Keep the sounding line in view, but never fight a visitor who has scrolled
  // away to read ahead: only nudge when the line is actually off-screen.
  useEffect(() => {
    if (active < 0 || !playing) return;
    const el = lineRefs.current[active];
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.top < 80 || rect.bottom > window.innerHeight - 80) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [active, playing]);

  const toggle = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      // First press starts at this track's first line, not at the top of the
      // record — the page is about this song.
      if (!started && timings.length > 0) {
        el.currentTime = Math.max(0, timings[0] - 0.4);
        setStarted(true);
      }
      void el.play().catch(() => setPlaying(false));
    } else {
      el.pause();
    }
  }, [started, timings]);

  if (blocks.length === 0) return null;

  return (
    <div>
      {synced && audioUrl && (
        <div className="mb-8 flex flex-wrap items-center gap-4">
          <audio
            ref={audioRef}
            src={audioUrl}
            preload="none"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => {
              setPlaying(false);
              setActive(-1);
            }}
            className="hidden"
          />
          <button
            type="button"
            onClick={toggle}
            className="inline-flex items-center gap-2.5 rounded-full border border-cream/30 px-5 py-2.5 font-body text-[11px] uppercase tracking-[0.18em] text-cream transition-colors hover:border-cream/70"
          >
            {playing ? <Pause size={13} /> : <Play size={13} className="ml-0.5" />}
            {playing ? "Pause" : "Follow along"}
          </button>
          <p className="font-body text-xs text-cream/45">
            Plays the record and lights each line as it comes.
          </p>
        </div>
      )}

      <div className="space-y-1">
        {blocks.map((block, i) =>
          block.heading ? (
            <p
              key={i}
              className="pt-6 font-body text-[10px] uppercase tracking-[0.3em] text-sepia-light first:pt-0"
            >
              {block.text.replace(/^\[|\]$/g, "")}
            </p>
          ) : (
            <p
              key={i}
              ref={(el) => {
                if (block.timedIndex >= 0) lineRefs.current[block.timedIndex] = el;
              }}
              className={cn(
                "font-body text-base leading-[1.9] transition-colors duration-300 md:text-lg",
                synced && block.timedIndex === active ? "text-cream" : synced && playing ? "text-cream/35" : "text-cream/80"
              )}
            >
              {block.text}
            </p>
          )
        )}
      </div>

      {synced && timings.length > 0 && (
        <p className="mt-8 font-body text-[11px] text-cream/35">
          Synced by hand · first line at {formatTimestamp(timings[0])} of the record
        </p>
      )}
    </div>
  );
}
