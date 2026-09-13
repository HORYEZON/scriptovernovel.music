"use client";

import { useState } from "react";
import Image from "@/components/ui/SafeImage";
import { motion } from "framer-motion";
import { Clock, Gift, Play, X, ZoomIn } from "lucide-react";
import { ImagePreviewModal, type PreviewImage } from "@/components/public/ImagePreviewModal";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";
import { formatScore } from "@/lib/minigames/scoring";
import { DIFFICULTY_LABELS, type PublicGame } from "@/lib/minigames/types";
import { GameIcon } from "./GameIcon";
import { Leaderboard } from "./Leaderboard";
import { useFocusTrap } from "./hooks";
import { imageVariantUrl } from "@/lib/images/variants";

interface GamePreviewModalProps {
  game: PublicGame;
  howToPlay: string;
  onStart: () => void;
  onClose: () => void;
}

/**
 * What the visitor sees before committing to a round: the artwork in play, the
 * rules, the difficulty, their best, and who is currently on top.
 *
 * Nothing here starts a session — the server only issues a puzzle when Start
 * is pressed, so browsing the menu never creates rows.
 */
export function GamePreviewModal({
  game,
  howToPlay,
  onStart,
  onClose,
}: GamePreviewModalProps) {
  useLockBodyScroll(true);
  const containerRef = useFocusTrap(true);
  const [zoomedImage, setZoomedImage] = useState<PreviewImage | null>(null);

  return (
    <motion.div
      className="fixed inset-0 z-[75] bg-ink/90 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="mg-preview-title"
    >
      <motion.div
        ref={containerRef}
        className="relative w-full max-w-md my-auto rounded-2xl border border-white/10 bg-black/60 backdrop-blur-md shadow-2xl overflow-hidden"
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        onClick={(event) => event.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-3 p-5 pb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="shrink-0 w-9 h-9 rounded-lg bg-sepia/15 text-sepia flex items-center justify-center">
              <GameIcon icon={game.icon} size={18} />
            </span>
            <h2
              id="mg-preview-title"
              className="font-grotesk text-base font-semibold tracking-widest uppercase text-cream truncate"
            >
              {game.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="shrink-0 p-1.5 -m-1 text-white/50 hover:text-cream transition-colors rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-sepia"
          >
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>

        {/* ── Artwork preview ── */}
        {game.artwork && (
          <div className="px-5">
            <div className="relative aspect-[16/10] rounded-xl overflow-hidden border border-white/10">
              <Image
                src={imageVariantUrl(game.artwork.imageUrl, "medium")}
                alt={game.artwork.title}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 90vw, 420px"
              />
              {/* The thumbnail is cropped to fit the frame — this hands back
                  the whole, uncropped plate on request. */}
              <button
                type="button"
                onClick={() =>
                  setZoomedImage({ src: game.artwork!.imageUrl, alt: game.artwork!.title })
                }
                title="View full image"
                aria-label="View full image"
                className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
              >
                <ZoomIn size={14} aria-hidden="true" />
              </button>
              {/* For Find the Difference, showing both plates up front is the
                  preview — the game is the comparison. */}
              {game.secondaryArtwork && (
                <div className="absolute inset-y-0 right-0 w-1/2 border-l border-white/20">
                  <Image
                    src={game.secondaryArtwork.imageUrl}
                    alt={`Altered version of ${game.artwork.title}`}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 45vw, 210px"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setZoomedImage({
                        src: game.secondaryArtwork!.imageUrl,
                        alt: `Altered version of ${game.artwork!.title}`,
                      })
                    }
                    title="View full image"
                    aria-label="View full image"
                    className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
                  >
                    <ZoomIn size={14} aria-hidden="true" />
                  </button>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />
              <p className="absolute bottom-2 left-3 right-3 font-display text-sm italic text-cream/90 truncate">
                {game.artwork.title}
              </p>
            </div>
          </div>
        )}

        {/* ── Detail ── */}
        <div className="p-5 space-y-4">
          <p className="font-body text-sm text-white/60 leading-relaxed">{howToPlay}</p>

          <dl className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-body">
            <div className="flex items-center gap-1.5">
              <dt className="text-white/35 uppercase tracking-widest text-[10px]">Difficulty</dt>
              <dd className="text-cream">{DIFFICULTY_LABELS[game.difficulty]}</dd>
            </div>
            {game.timeLimitSec > 0 && (
              <div className="flex items-center gap-1.5">
                <Clock size={12} className="text-white/35" aria-hidden="true" />
                <dd className="text-cream">
                  {Math.round(game.timeLimitSec / 60)} min limit
                </dd>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <dt className="text-white/35 uppercase tracking-widest text-[10px]">Your best</dt>
              <dd className="font-mono text-sepia tabular-nums">
                {game.bestScore !== null ? formatScore(game.bestScore) : "—"}
              </dd>
            </div>
          </dl>

          {game.rewardEnabled && game.rewardDescription && (
            <p className="flex items-start gap-2 rounded-lg border border-sepia/30 bg-sepia/5 px-3 py-2.5 font-body text-xs text-cream/80">
              <Gift size={14} className="text-sepia shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                Reach {formatScore(game.rewardThreshold)} points to unlock{" "}
                <strong className="text-cream">{game.rewardDescription}</strong>.
              </span>
            </p>
          )}

          {game.leaderboardEnabled && (
            <Leaderboard
              entries={game.topScores}
              title="Top scores"
              emptyMessage="No scores yet — the board is open."
            />
          )}

          <button
            type="button"
            onClick={onStart}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-sepia text-ink font-body text-sm font-medium tracking-wide hover:bg-sepia-light transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sepia focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            <Play size={15} aria-hidden="true" />
            Start game
          </button>
        </div>
      </motion.div>

      {/* Stops a click that closes the lightbox from also bubbling up to
          the backdrop above and closing the whole preview. */}
      <div onClick={(event) => event.stopPropagation()}>
        <ImagePreviewModal image={zoomedImage} onClose={() => setZoomedImage(null)} />
      </div>
    </motion.div>
  );
}
