"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { optimizedImageUrl } from "@/lib/minigames/images";
import type {
  FindDifferenceChallenge,
  FindDifferenceMoves,
  PublicGameArtwork,
} from "@/lib/minigames/types";
import { useImageAsset, usePrefersReducedMotion } from "../hooks";

interface FindTheDifferenceProps {
  challenge: FindDifferenceChallenge;
  artwork: PublicGameArtwork;
  secondaryArtwork: PublicGameArtwork;
  interactive: boolean;
  onProgress: (moves: number) => void;
  onComplete: (moves: FindDifferenceMoves) => void;
  playMoveSound: () => void;
}

/** How long a miss marker lingers before fading out. */
const MISS_HOLD_MS = 700;

/** Percentage points the keyboard crosshair travels per arrow press. */
const CROSSHAIR_STEP = 2.5;

interface Miss {
  id: number;
  x: number;
  y: number;
}

/**
 * Two versions of one artwork; click what changed.
 *
 * Unlike the other four games the hotspots are shipped to the browser, because
 * a click needs an instant verdict and round-tripping every click to the
 * server is exactly the chatty pattern this feature avoids. That leaks
 * nothing: the answer is already sitting in the two images. The server keeps
 * its own copy of the regions and re-checks every submitted click, so a
 * tampered client still cannot claim a hit it never made — see the note on
 * FindDifferenceChallenge in lib/minigames/types.ts.
 */
export function FindTheDifference({
  challenge,
  artwork,
  secondaryArtwork,
  interactive,
  onProgress,
  onComplete,
  playMoveSound,
}: FindTheDifferenceProps) {
  const original = useImageAsset(artwork.imageUrl);
  const modified = useImageAsset(secondaryArtwork.imageUrl);
  const reducedMotion = usePrefersReducedMotion();

  const [found, setFound] = useState<string[]>([]);
  const [misses, setMisses] = useState<Miss[]>([]);
  const [crosshair, setCrosshair] = useState<{ x: number; y: number } | null>(null);

  const clicksRef = useRef<{ x: number; y: number }[]>([]);
  const finishedRef = useRef(false);
  const missIdRef = useRef(0);
  /**
   * Mirror of `found`, kept because the hit test has to read the same value
   * the server will when it replays the click list. Resolving against React
   * state instead would let two clicks landing in one render both "find" the
   * same hotspot, after which the visitor's tally and the server's would
   * disagree about their score.
   */
  const foundRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setFound([]);
    setMisses([]);
    setCrosshair(null);
    clicksRef.current = [];
    foundRef.current = new Set();
    finishedRef.current = false;
  }, [challenge]);

  const registerClick = useCallback(
    (x: number, y: number) => {
      if (!interactive || finishedRef.current) return;

      clicksRef.current.push({ x, y });
      onProgress(clicksRef.current.length);
      playMoveSound();

      // Same resolution rule the server replays with: first hotspot not yet
      // found whose radius contains the point.
      const hit = challenge.regions.find(
        (region) =>
          !foundRef.current.has(region.id) &&
          Math.hypot(region.x - x, region.y - y) <= region.radius
      );

      if (!hit) {
        const id = ++missIdRef.current;
        setMisses((current) => [...current, { id, x, y }]);
        window.setTimeout(
          () => setMisses((current) => current.filter((miss) => miss.id !== id)),
          MISS_HOLD_MS
        );
        return;
      }

      foundRef.current.add(hit.id);
      setFound(Array.from(foundRef.current));

      if (foundRef.current.size === challenge.regions.length) {
        finishedRef.current = true;
        onComplete({ kind: "FIND_DIFFERENCE", clicks: clicksRef.current });
      }
    },
    [challenge.regions, interactive, onComplete, onProgress, playMoveSound]
  );

  function onImageClick(event: React.MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    registerClick(
      ((event.clientX - rect.left) / rect.width) * 100,
      ((event.clientY - rect.top) / rect.height) * 100
    );
  }

  /**
   * Keyboard play. Arrow keys walk a crosshair across the image and Enter
   * commits it — without this the game would be mouse-only, which is the one
   * accessibility gap none of the other four games have.
   */
  function onImageKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const current = crosshair ?? { x: 50, y: 50 };

    switch (event.key) {
      case "ArrowLeft":
        event.preventDefault();
        setCrosshair({ ...current, x: Math.max(0, current.x - CROSSHAIR_STEP) });
        break;
      case "ArrowRight":
        event.preventDefault();
        setCrosshair({ ...current, x: Math.min(100, current.x + CROSSHAIR_STEP) });
        break;
      case "ArrowUp":
        event.preventDefault();
        setCrosshair({ ...current, y: Math.max(0, current.y - CROSSHAIR_STEP) });
        break;
      case "ArrowDown":
        event.preventDefault();
        setCrosshair({ ...current, y: Math.min(100, current.y + CROSSHAIR_STEP) });
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        registerClick(current.x, current.y);
        break;
      default:
        break;
    }
  }

  const status = original.status === "ready" && modified.status === "ready"
    ? "ready"
    : original.status === "error" || modified.status === "error"
      ? "error"
      : "loading";

  if (status === "loading") {
    return (
      <div className="grid gap-3 sm:grid-cols-2" role="status" aria-label="Loading artwork">
        <div className="aspect-[4/3] rounded-xl bg-white/5 animate-pulse" />
        <div className="aspect-[4/3] rounded-xl bg-white/5 animate-pulse" />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div
        className="rounded-xl border border-white/10 bg-black/40 p-8 text-center"
        role="alert"
      >
        <p className="font-body text-sm text-white/60">
          One of the two images could not be loaded, so this round can&apos;t start.
        </p>
      </div>
    );
  }

  const panels: { label: string; art: PublicGameArtwork }[] = [
    { label: "Original", art: artwork },
    { label: "Altered", art: secondaryArtwork },
  ];

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {panels.map((panel, index) => (
          <div key={panel.label} className="space-y-1.5">
            <p className="font-body text-[10px] tracking-[0.25em] uppercase text-white/40">
              {panel.label}
            </p>
            <div
              role="button"
              tabIndex={interactive ? 0 : -1}
              onClick={onImageClick}
              onKeyDown={onImageKeyDown}
              onFocus={() => setCrosshair((c) => c ?? { x: 50, y: 50 })}
              aria-label={`${panel.label} artwork. Click a difference, or use the arrow keys to move the crosshair and Enter to check.`}
              className={cn(
                "relative w-full overflow-hidden rounded-xl border border-white/10 bg-black/40",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-sepia",
                interactive ? "cursor-crosshair" : "cursor-default"
              )}
              style={{
                aspectRatio: `${original.ratio}`,
                touchAction: "manipulation",
              }}
            >
              {/* Plain <img>: the box is already sized from the artwork's real
                  ratio, and the src is the same optimized URL next/image would
                  have produced. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={optimizedImageUrl(panel.art.imageUrl)}
                alt={`${panel.label} version of ${artwork.title}`}
                className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                draggable={false}
              />

              {/* Found markers, drawn on both panels so the pair reads as one
                  puzzle rather than two independent images. */}
              {challenge.regions
                .filter((region) => found.includes(region.id))
                .map((region) => (
                  <span
                    key={region.id}
                    aria-hidden="true"
                    className="absolute rounded-full border-2 border-sepia bg-sepia/15 flex items-center justify-center"
                    style={{
                      left: `${region.x}%`,
                      top: `${region.y}%`,
                      width: `${region.radius * 2}%`,
                      // Percentage heights resolve against the container's
                      // height, so the same number would draw an oval on a
                      // non-square box — aspectRatio keeps the ring round.
                      aspectRatio: "1 / 1",
                      transform: "translate(-50%, -50%)",
                    }}
                  >
                    <Check size={14} className="text-sepia" strokeWidth={3} />
                  </span>
                ))}

              {/* Misses, only on the panel that was clicked. */}
              {misses.map((miss) => (
                <span
                  key={`${miss.id}-${index}`}
                  aria-hidden="true"
                  className={cn(
                    "absolute w-7 h-7 rounded-full border-2 border-vermillion bg-vermillion/20 flex items-center justify-center",
                    !reducedMotion && "animate-fade-in"
                  )}
                  style={{
                    left: `${miss.x}%`,
                    top: `${miss.y}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  <X size={14} className="text-vermillion" strokeWidth={3} />
                </span>
              ))}

              {/* Keyboard crosshair. */}
              {crosshair && interactive && (
                <span
                  aria-hidden="true"
                  className="absolute w-6 h-6 rounded-full border border-cream/80 ring-1 ring-black/40"
                  style={{
                    left: `${crosshair.x}%`,
                    top: `${crosshair.y}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                />
              )}
            </div>
          </div>
        ))}
      </div>

      <p
        className="font-body text-xs text-white/50 text-center"
        aria-live="polite"
      >
        {found.length} of {challenge.regions.length} differences found
      </p>
    </div>
  );
}
