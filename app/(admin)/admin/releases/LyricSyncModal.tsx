"use client";

// app/(admin)/admin/releases/LyricSyncModal.tsx
//
// Tap-sync: play the record and tap a key as each line comes round, and the
// Lyrics Wall (and the lyrics page) follow the song exactly instead of guessing.
//
// Why by hand. Nothing here listens to audio or reads a lyrics provider, so
// before this the wall spread each track's lines across its slot in proportion
// to their *length* — a long line got more time than a short one, which is true
// on average and wrong everywhere. Tapping is a few minutes of work per song and
// is exactly right.
//
// What it syncs against: the record's own audio file (VinylRecord.audioUrl),
// because that is the only audio the site has — one file per record, the thing
// the turntable plays. So a timing is seconds into *that file*, not into the
// track, and the panel says so. Replacing the vinyl's audio invalidates the
// timings, which is why the file being synced against is named at the top.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Eraser, Minus, Pause, Play, Plus, RotateCcw, X } from "lucide-react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";
import { formatTimestamp, lyricLines, sanitizeLyricTimings } from "@/lib/lyrics";

/** How far a nudge moves a line. Small enough to fix a late tap, big enough to
 *  feel in one press. */
const NUDGE_SEC = 0.25;
const SEEK_SEC = 2;
/** Seek a hair before a line's own timestamp when checking it, so you hear the
 *  line start rather than landing mid-syllable. */
const PREROLL_SEC = 0.6;

export function LyricSyncModal({
  open,
  onClose,
  trackLabel,
  lyrics,
  timings,
  audioUrl,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  trackLabel: string;
  lyrics: string;
  timings: number[] | null;
  /** The record's audio, or null when it has no published vinyl. */
  audioUrl: string | null;
  onSave: (timings: number[] | null) => void;
}) {
  const lines = useMemo(() => lyricLines(lyrics), [lyrics]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Sparse while working: index → seconds, with holes for lines not yet tapped.
  const [stamps, setStamps] = useState<(number | null)[]>([]);
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState(1);
  useLockBodyScroll(open);

  // Reload from the saved timings each time the panel opens, so closing without
  // saving really does discard.
  useEffect(() => {
    if (!open) return;
    const saved = sanitizeLyricTimings(timings, lines.length) ?? [];
    setStamps(lines.map((_, i) => (saved[i] !== undefined ? saved[i] : null)));
    setCursor(saved.length >= lines.length ? 0 : saved.length);
    setTime(0);
    setPlaying(false);
  }, [open, timings, lines]);

  // One rAF loop while playing rather than timeupdate, which fires ~4×/second —
  // too coarse to show the playhead against a line you're about to tap.
  useEffect(() => {
    if (!open || !playing) return;
    let raf = 0;
    const tick = () => {
      const el = audioRef.current;
      if (el) setTime(el.currentTime);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [open, playing]);

  const togglePlay = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) void el.play().catch(() => setPlaying(false));
    else el.pause();
  }, []);

  const seekBy = useCallback((delta: number) => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = Math.max(0, Math.min(el.duration || 0, el.currentTime + delta));
    setTime(el.currentTime);
  }, []);

  const seekTo = useCallback((seconds: number) => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = Math.max(0, seconds);
    setTime(el.currentTime);
  }, []);

  /** Stamp the line at the cursor with the playhead and move on. */
  const tap = useCallback(() => {
    const el = audioRef.current;
    if (!el || cursor >= lines.length) return;
    const at = Math.round(el.currentTime * 100) / 100;
    setStamps((prev) => prev.map((v, i) => (i === cursor ? at : v)));
    setCursor((c) => Math.min(lines.length, c + 1));
  }, [cursor, lines.length]);

  const undo = useCallback(() => {
    setCursor((c) => {
      const target = Math.max(0, c - 1);
      setStamps((prev) => prev.map((v, i) => (i === target ? null : v)));
      return target;
    });
  }, []);

  // Keyboard is the whole point — you can't tap in time with a mouse.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      // Never steal keys from a field the admin is typing in.
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if (e.key === " ") {
        e.preventDefault();
        tap();
      } else if (e.key === "k" || e.key === "K") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "j" || e.key === "J") {
        seekBy(-SEEK_SEC);
      } else if (e.key === "l" || e.key === "L") {
        seekBy(SEEK_SEC);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        undo();
      } else if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, tap, togglePlay, seekBy, undo, onClose]);

  if (!open) return null;

  const stamped = stamps.filter((s) => s !== null).length;
  const complete = lines.length > 0 && stamped === lines.length;

  function adjust(index: number, delta: number) {
    setStamps((prev) =>
      prev.map((v, i) => (i === index && v !== null ? Math.max(0, Math.round((v + delta) * 100) / 100) : v))
    );
  }

  function clearOne(index: number) {
    setStamps((prev) => prev.map((v, i) => (i === index ? null : v)));
    setCursor(index);
  }

  function save() {
    // Partial work is kept, but the wall treats a track as synced only when
    // every line has a timing (see lib/museum/lyricsTimeline.ts) — so saving
    // half a song leaves the estimate in place rather than half-following.
    const filled = stamps.filter((s): s is number => s !== null);
    onSave(filled.length > 0 ? filled.sort((a, b) => a - b) : null);
    onClose();
  }

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-6">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl dark:bg-ink-900 sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-black/10 p-5 dark:border-white/10">
          <div className="min-w-0">
            <h2 className="font-fraunces text-xl font-light text-ink dark:text-cream">Sync lyrics</h2>
            <p className="mt-0.5 truncate font-body text-xs text-ink-400 dark:text-ink-300">{trackLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-black/5 dark:hover:bg-white/10"
          >
            <X size={18} />
          </button>
        </div>

        {!audioUrl ? (
          <div className="p-6">
            <p className="font-body text-sm leading-relaxed text-ink dark:text-cream">
              This release has no published vinyl, so there&apos;s no audio to sync against.
            </p>
            <p className="mt-2 font-body text-xs leading-relaxed text-ink-400 dark:text-ink-300">
              Add one under <span className="font-medium">Vinyls</span> — a release plus the audio the turntable
              plays — and the timings you tap here will follow that file.
            </p>
          </div>
        ) : lines.length === 0 ? (
          <div className="p-6">
            <p className="font-body text-sm text-ink dark:text-cream">This track has no lyrics yet.</p>
            <p className="mt-2 font-body text-xs text-ink-400 dark:text-ink-300">
              Paste them into the track&apos;s Lyrics box first. Section headers in [brackets] are skipped — they
              aren&apos;t sung, so they aren&apos;t timed.
            </p>
          </div>
        ) : (
          <>
            {/* Transport */}
            <div className="border-b border-black/10 p-5 dark:border-white/10">
              <audio
                ref={audioRef}
                src={audioUrl}
                preload="metadata"
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onEnded={() => setPlaying(false)}
                onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
                className="hidden"
              />
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={togglePlay}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-sepia text-white transition-opacity hover:opacity-90"
                  aria-label={playing ? "Pause" : "Play"}
                >
                  {playing ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
                </button>
                <span className="font-mono text-sm tabular-nums text-ink dark:text-cream">
                  {formatTimestamp(time, true)}
                  <span className="text-ink-400 dark:text-ink-300"> / {formatTimestamp(duration)}</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={duration || 0}
                  step={0.05}
                  value={Math.min(time, duration || 0)}
                  onChange={(e) => seekTo(Number(e.target.value))}
                  aria-label="Seek"
                  className="min-w-[8rem] flex-1 accent-sepia"
                />
                <select
                  value={rate}
                  onChange={(e) => {
                    const r = Number(e.target.value);
                    setRate(r);
                    if (audioRef.current) audioRef.current.playbackRate = r;
                  }}
                  aria-label="Playback speed"
                  className="rounded-lg border border-black/10 bg-transparent px-2 py-1 font-body text-xs text-ink dark:border-white/10 dark:text-cream"
                >
                  {[0.5, 0.75, 1].map((r) => (
                    <option key={r} value={r} className="bg-white dark:bg-ink-900">
                      {r}×
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={tap}
                  disabled={cursor >= lines.length}
                  className="inline-flex items-center gap-2 rounded-xl bg-ink px-5 py-2.5 font-body text-sm font-medium text-cream transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-cream dark:text-ink"
                >
                  Tap line {Math.min(cursor + 1, lines.length)}
                  <kbd className="rounded bg-black/20 px-1.5 py-0.5 font-mono text-[10px] dark:bg-black/20">space</kbd>
                </button>
                <button
                  type="button"
                  onClick={undo}
                  disabled={cursor === 0}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 px-3 py-2 font-body text-xs text-ink transition-colors hover:border-sepia disabled:opacity-40 dark:border-white/10 dark:text-cream"
                >
                  <RotateCcw size={13} /> Undo
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStamps(lines.map(() => null));
                    setCursor(0);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 px-3 py-2 font-body text-xs text-ink transition-colors hover:border-red-500 hover:text-red-500 dark:border-white/10 dark:text-cream"
                >
                  <Eraser size={13} /> Clear all
                </button>
                <span className="ml-auto font-body text-xs text-ink-400 dark:text-ink-300">
                  {stamped}/{lines.length} timed
                </span>
              </div>
              <p className="mt-3 font-body text-[11px] leading-relaxed text-ink-400 dark:text-ink-300">
                <kbd className="font-mono">space</kbd> tap · <kbd className="font-mono">K</kbd> play/pause ·{" "}
                <kbd className="font-mono">J</kbd>/<kbd className="font-mono">L</kbd> back/forward 2s ·{" "}
                <kbd className="font-mono">⌫</kbd> undo. Timings are seconds into the record&apos;s audio file —
                replace that file and they&apos;ll need doing again.
              </p>
            </div>

            {/* Lines */}
            <ol className="min-h-0 flex-1 overflow-y-auto p-5">
              {lines.map((line, i) => {
                const at = stamps[i];
                const isNext = i === cursor;
                // The line currently sounding, by what's been stamped so far.
                const isSounding =
                  at !== null &&
                  at <= time &&
                  (stamps.slice(i + 1).find((s) => s !== null) ?? Infinity) > time;
                return (
                  <li
                    key={i}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-2 py-2 transition-colors",
                      isNext && "bg-sepia/15",
                      isSounding && !isNext && "bg-black/5 dark:bg-white/10"
                    )}
                  >
                    <span className="w-6 shrink-0 text-right font-mono text-[10px] text-ink-400">{i + 1}</span>
                    {at !== null ? (
                      <button
                        type="button"
                        onClick={() => seekTo(Math.max(0, at - PREROLL_SEC))}
                        title="Play from here"
                        className="w-16 shrink-0 rounded font-mono text-xs tabular-nums text-sepia-dark underline decoration-dotted dark:text-sepia-light"
                      >
                        {formatTimestamp(at, true)}
                      </button>
                    ) : (
                      <span className="w-16 shrink-0 font-mono text-xs text-ink-400">—</span>
                    )}
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate font-body text-sm",
                        at !== null ? "text-ink dark:text-cream" : "text-ink-400 dark:text-ink-300"
                      )}
                    >
                      {line}
                    </span>
                    <span className="flex shrink-0 items-center gap-0.5">
                      {at !== null && (
                        <>
                          <button
                            type="button"
                            onClick={() => adjust(i, -NUDGE_SEC)}
                            aria-label={`Move line ${i + 1} earlier`}
                            className="rounded p-1 text-ink-400 transition-colors hover:bg-black/5 dark:hover:bg-white/10"
                          >
                            <Minus size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => adjust(i, NUDGE_SEC)}
                            aria-label={`Move line ${i + 1} later`}
                            className="rounded p-1 text-ink-400 transition-colors hover:bg-black/5 dark:hover:bg-white/10"
                          >
                            <Plus size={12} />
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => (at !== null ? clearOne(i) : setCursor(i))}
                        aria-label={at !== null ? `Clear line ${i + 1}` : `Start from line ${i + 1}`}
                        className="rounded p-1 text-ink-400 transition-colors hover:bg-black/5 dark:hover:bg-white/10"
                      >
                        {at !== null ? <Eraser size={12} /> : <Check size={12} />}
                      </button>
                    </span>
                  </li>
                );
              })}
            </ol>

            {/* Footer */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/10 p-5 dark:border-white/10">
              <p className="font-body text-xs text-ink-400 dark:text-ink-300">
                {complete
                  ? "Every line timed — the wall will follow this exactly."
                  : `${lines.length - stamped} line${lines.length - stamped === 1 ? "" : "s"} still untimed. The wall keeps estimating until they all are.`}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-black/10 px-4 py-2 font-body text-sm text-ink transition-colors hover:border-sepia dark:border-white/10 dark:text-cream"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={save}
                  className="rounded-xl bg-sepia px-5 py-2 font-body text-sm font-medium text-white transition-opacity hover:opacity-90"
                >
                  Use these timings
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
