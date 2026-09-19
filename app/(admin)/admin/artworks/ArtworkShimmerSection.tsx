"use client";

// Artworks ▸ Digital Museum ▸ General Settings ▸ Artwork Shimmer — the light
// sweep that plays across an artwork when a visitor walks up to it
// (lib/museum/artworkShimmer.ts), with a live preview on an artwork of the
// admin's choosing. The choice of preview artwork is a viewing aid only: it
// is held here and never sent with the config.

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Image as ImageIcon } from "lucide-react";
import { AdminSelect } from "@/components/admin/AdminSelect";
import { ColorField, Toggle } from "./museum-ui";
import type { PickableArtwork } from "./ArtworkPicker";
import {
  ARTWORK_SHIMMER_DEFAULTS,
  ARTWORK_SHIMMER_MIN_SPEED,
  ARTWORK_SHIMMER_MAX_SPEED,
  ARTWORK_SHIMMER_MIN_STRENGTH,
  ARTWORK_SHIMMER_MAX_STRENGTH,
  ARTWORK_SHIMMER_MIN_BAND,
  ARTWORK_SHIMMER_MAX_BAND,
  type ArtworkShimmerConfig,
} from "@/lib/museum/artworkShimmer";

// three.js — client only, loaded when the section is actually open, the way
// MuseumPreviewSidebar loads its canvas.
const ArtworkShimmerPreview = dynamic(
  () => import("./ArtworkShimmerPreview").then((m) => m.ArtworkShimmerPreview),
  { ssr: false, loading: () => <div className="w-full h-full bg-[#141210]" /> }
);

function RangeRow({
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  hint?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="font-body text-xs text-ink-400 dark:text-ink-300">{label}</label>
        <span className="font-body text-[11px] tabular-nums text-ink-400 dark:text-ink-300">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full touch-none accent-sepia"
      />
      {hint && <p className="font-body text-[10px] text-ink-400 dark:text-ink-300 mt-1">{hint}</p>}
    </div>
  );
}

export function ArtworkShimmerSection({
  value,
  onChange,
  artworks,
}: {
  value: ArtworkShimmerConfig;
  onChange: (patch: Partial<ArtworkShimmerConfig>) => void;
  /** The Artworks module's list — the preview picks from it. */
  artworks: PickableArtwork[];
}) {
  // Published first, then the rest, so the default preview is something a
  // visitor could actually walk up to.
  const options = useMemo(
    () => [...artworks].sort((a, b) => Number(b.published) - Number(a.published) || a.title.localeCompare(b.title)),
    [artworks]
  );
  const [previewId, setPreviewId] = useState<string | null>(null);
  const previewArtwork = options.find((a) => a.id === previewId) ?? options[0] ?? null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* ── Controls ── */}
      <div className="admin-card border rounded-2xl p-4 space-y-4">
        <Toggle
          checked={value.enabled}
          onChange={(enabled) => onChange({ enabled })}
          label="Shimmer the artwork a visitor walks up to"
        />
        <p className="font-body text-[11px] text-ink-400 dark:text-ink-300">
          A soft band of light sweeps across the piece while it&apos;s the one the visitor can open
          with [E] — the same sheen the room labels&apos; glass carries. Off leaves the frame&apos;s
          glow as the only sign it can be opened.
        </p>

        {value.enabled && (
          <>
            <RangeRow
              label="Speed"
              value={value.speed}
              display={`${value.speed.toFixed(2)}/s`}
              min={ARTWORK_SHIMMER_MIN_SPEED}
              max={ARTWORK_SHIMMER_MAX_SPEED}
              step={0.05}
              onChange={(speed) => onChange({ speed })}
              hint="Sweeps per second."
            />
            <RangeRow
              label="Strength"
              value={value.strength}
              display={`${Math.round(value.strength * 100)}%`}
              min={ARTWORK_SHIMMER_MIN_STRENGTH}
              max={ARTWORK_SHIMMER_MAX_STRENGTH}
              step={0.05}
              onChange={(strength) => onChange({ strength })}
              hint="How bright the band burns. It adds light, so it reads stronger on a pale piece than a dark one."
            />
            <RangeRow
              label="Band Width"
              value={value.bandWidth}
              display={`${Math.round(value.bandWidth * 100)}%`}
              min={ARTWORK_SHIMMER_MIN_BAND}
              max={ARTWORK_SHIMMER_MAX_BAND}
              step={0.01}
              onChange={(bandWidth) => onChange({ bandWidth })}
              hint="How much of the artwork the band covers at once — narrow is a glint, wide is a wash."
            />
            <ColorField
              label="Colour"
              value={value.color}
              defaultValue={ARTWORK_SHIMMER_DEFAULTS.color}
              onChange={(color) => onChange({ color })}
            />
          </>
        )}
      </div>

      {/* ── Preview ── */}
      <div className="admin-card border rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300">
            Preview
          </p>
          <span className="font-body text-[10px] text-ink-400 dark:text-ink-300">
            Shown as walked up to
          </span>
        </div>
        {/* Which piece to preview on — pulled from the Artworks module, kept
            here only. Nothing about the choice is saved. */}
        <AdminSelect
          icon={<ImageIcon size={14} />}
          value={previewArtwork?.id ?? ""}
          onChange={(e) => setPreviewId(e.target.value || null)}
          className="py-2 text-sm"
          disabled={options.length === 0}
        >
          {options.length === 0 ? (
            <option value="">No artworks yet</option>
          ) : (
            options.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title}
                {a.published ? "" : " (draft)"}
              </option>
            ))
          )}
        </AdminSelect>
        <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden border border-black/10 dark:border-white/10 bg-[#141210]">
          {previewArtwork ? (
            <ArtworkShimmerPreview artwork={previewArtwork} config={value} />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center font-body text-xs text-ink-400">
              Add an artwork to preview the sweep on it.
            </div>
          )}
        </div>
        <p className="font-body text-[10px] text-ink-400 dark:text-ink-300">
          For previewing only — the artwork you pick here isn&apos;t saved with the setting.
        </p>
      </div>
    </div>
  );
}
