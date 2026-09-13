"use client";

import { useState } from "react";
import { Crosshair, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { optimizedImageUrl } from "@/lib/minigames/images";
import {
  MAX_DIFFERENCE_RADIUS,
  MAX_DIFFERENCE_REGIONS,
  MIN_DIFFERENCE_RADIUS,
} from "@/lib/minigames/config";
import type { DifferenceRegion } from "@/lib/minigames/types";

interface DifferenceEditorProps {
  original: { id: string; title: string; imageUrl: string } | null;
  modified: { id: string; title: string; imageUrl: string } | null;
  regions: DifferenceRegion[];
  onChange: (regions: DifferenceRegion[]) => void;
}

const DEFAULT_RADIUS = 5;

function newRegionId(): string {
  return `d_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Places the hotspots for Find the Difference by clicking the modified image.
 *
 * Deliberately manual: automatically diffing two images would need server-side
 * image processing this project has no use for elsewhere, and would still get
 * the *interesting* differences wrong — the admin knows which change is the
 * puzzle and which is compression noise.
 *
 * Coordinates are percentages of the image box, so a region placed here lands
 * in the same spot on a phone as on a desktop, and the server can check a
 * visitor's click against it without knowing either display size.
 */
export function DifferenceEditor({
  original,
  modified,
  regions,
  onChange,
}: DifferenceEditorProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  if (!original || !modified) {
    return (
      <p className="rounded-xl border border-dashed border-black/15 dark:border-white/15 px-4 py-6 text-center font-body text-sm text-ink-400 dark:text-ink-300">
        Choose both images above, then click the modified one to mark each
        difference.
      </p>
    );
  }

  const atLimit = regions.length >= MAX_DIFFERENCE_REGIONS;

  function addRegion(event: React.MouseEvent<HTMLDivElement>) {
    if (atLimit) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const region: DifferenceRegion = {
      id: newRegionId(),
      x: round2(((event.clientX - rect.left) / rect.width) * 100),
      y: round2(((event.clientY - rect.top) / rect.height) * 100),
      radius: DEFAULT_RADIUS,
    };
    onChange([...regions, region]);
    setActiveId(region.id);
  }

  function updateRadius(id: string, radius: number) {
    onChange(
      regions.map((region) =>
        region.id === id ? { ...region, radius } : region
      )
    );
  }

  function removeRegion(id: string) {
    onChange(regions.filter((region) => region.id !== id));
    if (activeId === id) setActiveId(null);
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {/* Reference — not clickable, it is only there to compare against. */}
        <figure className="space-y-1.5">
          <figcaption className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300">
            Original
          </figcaption>
          <div className="relative rounded-xl overflow-hidden border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={optimizedImageUrl(original.imageUrl)}
              alt={original.title}
              className="w-full h-auto block"
              draggable={false}
            />
          </div>
        </figure>

        <figure className="space-y-1.5">
          <figcaption className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300">
            Modified — click to mark a difference
          </figcaption>
          <div
            onClick={addRegion}
            className={cn(
              "relative rounded-xl overflow-hidden border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5",
              atLimit ? "cursor-not-allowed" : "cursor-crosshair"
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={optimizedImageUrl(modified.imageUrl)}
              alt={modified.title}
              className="w-full h-auto block"
              draggable={false}
            />

            {regions.map((region, index) => (
              <span
                key={region.id}
                className={cn(
                  "absolute rounded-full border-2 flex items-center justify-center font-mono text-[10px] pointer-events-none",
                  region.id === activeId
                    ? "border-sepia bg-sepia/30 text-white"
                    : "border-sepia/70 bg-sepia/15 text-white/90"
                )}
                style={{
                  left: `${region.x}%`,
                  top: `${region.y}%`,
                  width: `${region.radius * 2}%`,
                  // The width is a percentage of the box width; matching the
                  // height to it via aspect-ratio keeps the marker a circle
                  // whatever shape the artwork is.
                  aspectRatio: "1 / 1",
                  transform: "translate(-50%, -50%)",
                }}
              >
                {index + 1}
              </span>
            ))}
          </div>
        </figure>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="font-body text-xs text-ink-400 dark:text-ink-300 flex items-center gap-1.5">
          <Crosshair size={13} />
          {regions.length} of {MAX_DIFFERENCE_REGIONS} marked
          {atLimit && " — that's the maximum"}
        </p>
        {regions.length > 0 && (
          <button
            type="button"
            onClick={() => {
              onChange([]);
              setActiveId(null);
            }}
            className="font-body text-xs text-ink-400 dark:text-ink-300 hover:text-vermillion transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {regions.length === 0 ? (
        <p className="font-body text-xs text-amber-600 dark:text-amber-400">
          At least one difference is needed before this game can be played.
        </p>
      ) : (
        <ul className="space-y-2">
          {regions.map((region, index) => (
            <li
              key={region.id}
              onMouseEnter={() => setActiveId(region.id)}
              onMouseLeave={() => setActiveId(null)}
              className="flex items-center gap-3 px-3 py-2 rounded-xl border border-black/10 dark:border-white/10"
            >
              <span className="font-mono text-xs text-ink-400 dark:text-ink-300 w-5 shrink-0">
                {index + 1}
              </span>
              <span className="font-mono text-[11px] text-ink-400 dark:text-ink-300 shrink-0 hidden sm:inline">
                {region.x.toFixed(0)}%, {region.y.toFixed(0)}%
              </span>
              <label className="flex-1 flex items-center gap-2 min-w-0">
                <span className="font-body text-xs text-ink-400 dark:text-ink-300 shrink-0">
                  Size
                </span>
                <input
                  type="range"
                  min={MIN_DIFFERENCE_RADIUS}
                  max={MAX_DIFFERENCE_RADIUS}
                  step={0.5}
                  value={region.radius}
                  onChange={(event) =>
                    updateRadius(region.id, Number(event.target.value))
                  }
                  aria-label={`Size of difference ${index + 1}`}
                  className="flex-1 min-w-0 accent-sepia"
                />
                <span className="font-mono text-[11px] text-ink dark:text-cream w-9 text-right shrink-0">
                  {region.radius.toFixed(1)}
                </span>
              </label>
              <button
                type="button"
                onClick={() => removeRegion(region.id)}
                aria-label={`Remove difference ${index + 1}`}
                className="shrink-0 p-1.5 rounded-lg text-ink-400 hover:text-vermillion hover:bg-vermillion/10 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
