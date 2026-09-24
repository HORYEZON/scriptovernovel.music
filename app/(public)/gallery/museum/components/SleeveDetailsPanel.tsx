"use client";

// SleeveDetailsPanel.tsx
//
// The [E] panel for a wall sleeve whose record is out on the deck. Before
// this, the prompt at an empty sleeve said "On the deck" and pressing [E] did
// nothing — a prompt that offers nothing reads as broken. Now it opens the
// record's details: the cover large, what's playing, the tracklist with the
// current track lit, and the two things that make sense from the wall —
// pause/resume the deck (the sound is room-wide, so it's reachable from
// anywhere in the room) and put the record back in this sleeve.
//
// Same shell as TurntablePanel.tsx / CosplayInfoPanel.tsx: backdrop, card,
// close button, `landscape` for forced-landscape phones. DOM only, like the
// deck's own panel — in a headset the prompt stays a label.
import Image from "@/components/ui/SafeImage";
import Link from "next/link";
import { X, Play, Pause, Disc3, ExternalLink, Undo2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/releases";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";
import type { MuseumVinylSleeve } from "@/types";
import type { VinylPlayerState } from "@/lib/museum/vinylAudio";

export function SleeveDetailsPanel({
  vinyl,
  state,
  currentTrackIndex,
  currentLine,
  onClose,
  onPlayPause,
  onPutBack,
  landscape = false,
}: {
  vinyl: MuseumVinylSleeve | null;
  state: VinylPlayerState;
  currentTrackIndex: number;
  currentLine: string | null;
  onClose: () => void;
  onPlayPause: () => void;
  /** Stop the deck and return the record to this sleeve. */
  onPutBack: () => void;
  landscape?: boolean;
}) {
  useLockBodyScroll(vinyl !== null);
  const statusLabel =
    state.source === "reverse" ? "Playing backwards" : state.source === "backmask" ? "Backmasked" : "On the deck";

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
            role="dialog"
            aria-modal="true"
            aria-label={`${vinyl.title} — details`}
            className={cn(
              "relative w-full bg-[#121212] border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col",
              landscape ? "max-w-4xl max-h-[min(90vh,100%)]" : "max-w-lg max-h-[min(88vh,100%)]"
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
              {/* ── Cover ─────────────────────────────────────────────── */}
              <div className={cn("relative bg-black", landscape ? "w-2/5 shrink-0" : "aspect-square w-full")}>
                <Image src={vinyl.coverImageUrl} alt={vinyl.title} fill className="object-cover" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-5 pt-16">
                  <p className="flex items-center gap-1.5 font-body text-[10px] uppercase tracking-[0.3em] text-sepia-light">
                    <Disc3 size={12} className={cn(state.playing && "animate-[spin_3s_linear_infinite]")} />
                    {statusLabel}
                    {!state.playing && " · paused"}
                  </p>
                  <h2 className="mt-1 font-display text-2xl italic text-white">{vinyl.title}</h2>
                  {vinyl.sideLabel && <p className="font-body text-xs text-white/50">{vinyl.sideLabel}</p>}
                </div>
              </div>

              {/* ── Details ───────────────────────────────────────────── */}
              <div className={cn("p-5", landscape && "w-3/5 overflow-y-auto")}>
                <div className="flex flex-wrap items-center gap-2">
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
                    onClick={onPutBack}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-white/15 px-4 py-2 font-body text-sm text-white/80 hover:bg-white/10 hover:text-white"
                  >
                    <Undo2 size={15} />
                    Put it back in its sleeve
                  </button>
                </div>

                <div className="mt-3 flex items-center justify-between font-body text-[11px] tabular-nums text-white/40">
                  <span>
                    {formatDuration(Math.floor(state.currentTime))}
                    {state.duration ? ` / ${formatDuration(Math.floor(state.duration))}` : ""}
                  </span>
                  {vinyl.releaseSlug && (
                    <Link
                      href={`/music#${vinyl.releaseSlug}`}
                      target="_blank"
                      className="inline-flex items-center gap-1 text-white/50 hover:text-white"
                    >
                      Release page <ExternalLink size={11} />
                    </Link>
                  )}
                </div>

                {currentLine && (
                  <p className="mt-4 border-l-2 border-sepia/50 pl-3 font-display text-base italic text-white/80">{currentLine}</p>
                )}

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
                          {t.durationSec != null && (
                            <span className="shrink-0 text-[11px] tabular-nums text-white/30">{formatDuration(t.durationSec)}</span>
                          )}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                <p className="mt-5 font-body text-[11px] text-white/35">
                  The effects live on the turntable — walk over to it to change how this sounds.
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
