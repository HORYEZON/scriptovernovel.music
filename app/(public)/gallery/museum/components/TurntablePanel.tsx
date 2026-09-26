"use client";

// TurntablePanel.tsx
//
// The [E] panel for the Vinyl Room's deck while a record is on it — same
// shell as CosplayInfoPanel.tsx (backdrop, card, close button, the
// `landscape` prop for forced-landscape phones). Cover + title + release
// link on one side; transport, speed and the four effect sliders on the
// other; the tracklist with the current track and lyric line underneath.
// All state is MuseumScene's — this only renders it and calls back.
import Image from "@/components/ui/SafeImage";
import Link from "next/link";
import { X, Play, Pause, Disc3, ExternalLink, RotateCcw, Rewind, Undo2, Waves } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/releases";
import type { MuseumVinylSleeve } from "@/types";
import { backmaskWindowSec, type VinylEffects } from "@/lib/museum/vinylConfig";
import type { VinylPlayerState } from "@/lib/museum/vinylAudio";

const SPEEDS: { rpm: 33 | 45 | 78; label: string }[] = [
  { rpm: 33, label: "33⅓" },
  { rpm: 45, label: "45" },
  { rpm: 78, label: "78" },
];

const EFFECT_SLIDERS: { key: "reverb" | "lofi" | "crackle" | "delay"; label: string; hint: string }[] = [
  { key: "reverb", label: "Reverb", hint: "Room size" },
  { key: "lofi", label: "Lo-fi", hint: "Warmth & grit" },
  { key: "crackle", label: "Crackle", hint: "Dust on the record" },
  { key: "delay", label: "Echo", hint: "Slapback" },
];

/** The shoegaze board, in signal order (see vinylAudio.ts's chain). */
const MOD_SLIDERS: { key: "phaser" | "flanger" | "chorus" | "vibrato" | "tremolo"; label: string; hint: string }[] = [
  { key: "phaser", label: "Phaser", hint: "Swept notches" },
  { key: "flanger", label: "Flanger", hint: "Jet sweep" },
  { key: "chorus", label: "Chorus", hint: "Detuned wash" },
  { key: "vibrato", label: "Vibrato", hint: "Pitch wobble" },
  { key: "tremolo", label: "Tremolo", hint: "Volume pulse" },
];

export function TurntablePanel({
  vinyl,
  state,
  effects,
  currentTrackIndex,
  currentLine,
  onClose,
  onPlayPause,
  onTakeOff,
  onSeek,
  onEffectsChange,
  onResetEffects,
  landscape = false,
}: {
  vinyl: MuseumVinylSleeve | null;
  state: VinylPlayerState;
  effects: VinylEffects;
  currentTrackIndex: number;
  currentLine: string | null;
  onClose: () => void;
  onPlayPause: () => void;
  onTakeOff: () => void;
  onSeek: (seconds: number) => void;
  onEffectsChange: (next: Partial<VinylEffects>) => void;
  onResetEffects: () => void;
  landscape?: boolean;
}) {
  const progress = state.duration > 0 ? state.currentTime / state.duration : 0;

  return (
    <AnimatePresence>
      {vinyl && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
        >
          <motion.div
            className={cn(
              "relative w-full bg-[#121212] border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col",
              landscape ? "max-w-4xl max-h-[min(90vh,100%)]" : "max-w-xl max-h-[min(88vh,100%)]"
            )}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              className="absolute top-3 right-3 z-10 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
              aria-label="Close"
            >
              <X size={16} />
            </button>

            <div className={cn("overflow-y-auto", landscape && "flex flex-1 overflow-hidden")}>
              {/* ── Record + transport ────────────────────────────────── */}
              <div className={cn("p-5", landscape ? "w-2/5 shrink-0 overflow-y-auto border-r border-white/10" : "border-b border-white/10")}>
                <div className="flex items-center gap-4">
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-black">
                    <Image src={vinyl.coverImageUrl} alt={vinyl.title} fill className="object-cover" />
                    <span className={cn("absolute -bottom-2 -right-2 rounded-full bg-black/80 p-1.5 text-sepia-light", state.playing && "animate-[spin_3s_linear_infinite]")}>
                      <Disc3 size={16} />
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-body text-[10px] uppercase tracking-[0.3em] text-sepia-light">On the deck</p>
                    <h2 className="truncate font-display text-xl italic text-white">{vinyl.title}</h2>
                    {vinyl.sideLabel && <p className="font-body text-xs text-white/40">{vinyl.sideLabel}</p>}
                    {vinyl.releaseSlug && (
                      <Link
                        href={`/music/${vinyl.releaseSlug}`}
                        target="_blank"
                        className="mt-1 inline-flex items-center gap-1 font-body text-[11px] text-white/50 hover:text-white"
                      >
                        Release page <ExternalLink size={11} />
                      </Link>
                    )}
                  </div>
                </div>

                {/* Progress */}
                <div className="mt-5">
                  <input
                    type="range"
                    min={0}
                    max={1000}
                    value={Math.round(progress * 1000)}
                    onChange={(e) => onSeek((Number(e.target.value) / 1000) * state.duration)}
                    aria-label="Position"
                    className="w-full accent-[#c8a96e]"
                  />
                  <div className="mt-1 flex justify-between font-body text-[11px] tabular-nums text-white/40">
                    <span>{formatDuration(Math.floor(state.currentTime))}</span>
                    <span>{state.duration ? formatDuration(Math.floor(state.duration)) : "—"}</span>
                  </div>
                </div>

                {state.error && <p className="mt-2 font-body text-xs text-red-300">{state.error}</p>}

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={onPlayPause}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-emerald-600 px-5 py-2 font-body text-sm font-medium text-white hover:bg-emerald-500"
                  >
                    {state.playing ? <Pause size={16} /> : <Play size={16} />}
                    {state.playing ? "Pause" : "Play"}
                  </button>
                  <button
                    type="button"
                    onClick={onTakeOff}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-white/15 px-4 py-2 font-body text-sm text-white/80 hover:bg-white/10 hover:text-white"
                  >
                    Take the record off
                  </button>
                </div>

                {/* Two ways to hear a record reversed — both swap the deck's
                    source for a decoded copy (see vinylAudio.ts), so the
                    first flip on a long record takes a moment, and only one
                    can be on: each button turns the other off.
                      Backward play — the needle runs back towards the start;
                      the timer counts down.
                      Backmasking — every moment sounds reversed but the song
                      still moves forward; the timer counts up. */}
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => onEffectsChange({ reverse: !effects.reverse, backmask: false })}
                    disabled={state.decoding}
                    aria-pressed={effects.reverse}
                    className={cn(
                      "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border px-3 py-2 font-body text-sm transition-colors disabled:opacity-60",
                      effects.reverse
                        ? "border-sepia bg-sepia/20 text-sepia-light"
                        : "border-white/15 text-white/80 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    <Rewind size={16} />
                    Backward play
                  </button>
                  <button
                    type="button"
                    onClick={() => onEffectsChange({ backmask: !effects.backmask, reverse: false })}
                    disabled={state.decoding}
                    aria-pressed={effects.backmask}
                    className={cn(
                      "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border px-3 py-2 font-body text-sm transition-colors disabled:opacity-60",
                      effects.backmask
                        ? "border-sepia bg-sepia/20 text-sepia-light"
                        : "border-white/15 text-white/80 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    <Undo2 size={16} />
                    Backmasking
                  </button>
                </div>
                {state.decoding ? (
                  <p className="mt-1.5 text-center font-body text-[11px] text-sepia-light/70">Turning the record round…</p>
                ) : effects.reverse ? (
                  <p className="mt-1.5 text-center font-body text-[11px] text-sepia-light/70">
                    The needle is running back to the start — the timer counts down.
                  </p>
                ) : effects.backmask ? (
                  <div className="mt-2">
                    <label className="block">
                      <span className="flex justify-between font-body text-[11px] text-white/40">
                        <span>Window — how much plays backwards at a time</span>
                        <span className="tabular-nums">{backmaskWindowSec(effects.backmaskWindow).toFixed(1)}s</span>
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={Math.round(effects.backmaskWindow * 100)}
                        onChange={(e) => onEffectsChange({ backmaskWindow: Number(e.target.value) / 100 })}
                        className="w-full accent-[#c8a96e]"
                      />
                    </label>
                    <p className="text-center font-body text-[11px] text-sepia-light/70">
                      Every moment sounds reversed; the song still moves forward.
                    </p>
                  </div>
                ) : null}

                {/* Speed */}
                <div className="mt-5">
                  <p className="mb-2 font-body text-[10px] uppercase tracking-[0.3em] text-white/40">Speed</p>
                  <div className="flex gap-1.5">
                    {SPEEDS.map((s) => (
                      <button
                        key={s.rpm}
                        type="button"
                        onClick={() => onEffectsChange({ speed: s.rpm })}
                        className={cn(
                          "min-h-[40px] flex-1 rounded-lg border px-2 font-body text-sm tabular-nums transition-colors",
                          effects.speed === s.rpm
                            ? "border-sepia bg-sepia/15 text-sepia-light"
                            : "border-white/10 text-white/60 hover:border-white/30 hover:text-white"
                        )}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                  <label className="mt-3 block">
                    <span className="flex justify-between font-body text-[11px] text-white/40">
                      <span>Fine</span>
                      <span className="tabular-nums">{effects.fine >= 0 ? "+" : ""}{Math.round(effects.fine * 100)}%</span>
                    </span>
                    <input
                      type="range"
                      min={-8}
                      max={8}
                      step={1}
                      value={Math.round(effects.fine * 100)}
                      onChange={(e) => onEffectsChange({ fine: Number(e.target.value) / 100 })}
                      className="w-full accent-[#c8a96e]"
                    />
                  </label>
                </div>
              </div>

              {/* ── Effects + tracklist ───────────────────────────────── */}
              <div className={cn("p-5", landscape ? "w-3/5 overflow-y-auto" : "")}>
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-body text-[10px] uppercase tracking-[0.3em] text-white/40">Effects</p>
                  <button
                    type="button"
                    onClick={onResetEffects}
                    className="inline-flex items-center gap-1 font-body text-[11px] text-white/50 hover:text-white"
                  >
                    <RotateCcw size={11} /> Room defaults
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {EFFECT_SLIDERS.map((s) => (
                    <label key={s.key} className="block rounded-xl border border-white/10 bg-white/[0.03] p-3">
                      <span className="flex items-baseline justify-between">
                        <span className="font-body text-sm text-white">{s.label}</span>
                        <span className="font-body text-[11px] tabular-nums text-white/40">{Math.round(effects[s.key] * 100)}</span>
                      </span>
                      <span className="block font-body text-[11px] text-white/35">{s.hint}</span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={Math.round(effects[s.key] * 100)}
                        onChange={(e) => onEffectsChange({ [s.key]: Number(e.target.value) / 100 })}
                        className="mt-2 w-full accent-[#c8a96e]"
                      />
                    </label>
                  ))}
                </div>

                {/* ── The shoegaze board ──────────────────────────────── */}
                <div className="mt-5">
                  <div className="mb-2 flex items-center gap-1.5">
                    <Waves size={12} className="text-sepia-light" />
                    <p className="font-body text-[10px] uppercase tracking-[0.3em] text-white/40">Shoegaze</p>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {MOD_SLIDERS.map((s) => (
                      <label key={s.key} className="block rounded-xl border border-white/10 bg-white/[0.03] p-3">
                        <span className="flex items-baseline justify-between">
                          <span className="font-body text-sm text-white">{s.label}</span>
                          <span className="font-body text-[11px] tabular-nums text-white/40">{Math.round(effects[s.key] * 100)}</span>
                        </span>
                        <span className="block font-body text-[11px] text-white/35">{s.hint}</span>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={Math.round(effects[s.key] * 100)}
                          onChange={(e) => onEffectsChange({ [s.key]: Number(e.target.value) / 100 })}
                          className="mt-2 w-full accent-[#c8a96e]"
                        />
                      </label>
                    ))}
                    {/* One tempo for all five — each pedal runs its own LFO at
                        its own multiple of it, so they drift together. */}
                    <label className="block rounded-xl border border-sepia/20 bg-sepia/[0.06] p-3">
                      <span className="flex items-baseline justify-between">
                        <span className="font-body text-sm text-white">Drift</span>
                        <span className="font-body text-[11px] tabular-nums text-white/40">{Math.round(effects.modRate * 100)}</span>
                      </span>
                      <span className="block font-body text-[11px] text-white/35">Speed of every sweep</span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={Math.round(effects.modRate * 100)}
                        onChange={(e) => onEffectsChange({ modRate: Number(e.target.value) / 100 })}
                        className="mt-2 w-full accent-[#c8a96e]"
                      />
                    </label>
                  </div>
                </div>

                {vinyl.tracks.length > 0 && (
                  <div className="mt-5">
                    <p className="mb-2 font-body text-[10px] uppercase tracking-[0.3em] text-white/40">Tracklist</p>
                    <ol className="divide-y divide-white/5">
                      {vinyl.tracks.map((t, i) => (
                        <li
                          key={`${t.title}-${i}`}
                          className={cn(
                            "flex items-center justify-between gap-3 py-1.5 font-body text-sm",
                            i === currentTrackIndex ? "text-sepia-light" : "text-white/55"
                          )}
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="w-5 shrink-0 text-right text-[11px] tabular-nums text-white/30">{i + 1}</span>
                            <span className="truncate">{t.title}</span>
                          </span>
                          {t.durationSec != null && <span className="shrink-0 text-[11px] tabular-nums text-white/30">{formatDuration(t.durationSec)}</span>}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {currentLine && (
                  <p className="mt-4 border-l-2 border-sepia/50 pl-3 font-display text-base italic text-white/80">{currentLine}</p>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
