"use client";

// app/(admin)/admin/artworks/VisionFiltersSection.tsx
//
// Digital Museum ▸ General Settings ▸ Filter Vision. Chooses which of the 5
// built-in looks visitors can cycle with [Q], and lets the admin mix up to
// CUSTOM_FILTER_MAX of their own from a colour.
//
// Same local-edits-plus-one-Save shape as MinimapHudSection beside it, for
// the same reason: a colour picker and two sliders fire on every drag step,
// and the swatch preview already shows the result without a round trip.
//
// The previews are the point of this section. A custom filter is a colour run
// through grayscale → sepia → hue-rotate (see lib/museum/visionFilters.ts),
// which is an approximation — "#48ff9c at intensity 1.2" is not something
// anyone can picture. So every card renders a real sample image with the real
// CSS filter on it, which is exactly what a visitor will see.

import { Aperture, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  BUILT_IN_VISION_FILTERS,
  CUSTOM_FILTER_MAX,
  CUSTOM_INTENSITY_MIN,
  CUSTOM_INTENSITY_MAX,
  CUSTOM_BRIGHTNESS_MIN,
  CUSTOM_BRIGHTNESS_MAX,
  DEFAULT_CUSTOM_FILTER,
  customFilterCss,
  type CustomVisionFilter,
  type VisionFilterConfig,
} from "@/lib/museum/visionFilters";

/**
 * What every preview swatch is filtered.
 *
 * A CSS gradient rather than a photograph of the museum, deliberately: these
 * filters are hue rotations, and a spectrum sweep shows what one does to
 * *every* hue at once. A single photo would only show what happens to the
 * colours that photo happens to contain, which is how you end up shipping a
 * filter that looks fine on the sample and ruins the one red painting.
 */
const PREVIEW_BACKGROUND =
  "linear-gradient(120deg, #e8532f 0%, #e0b02e 20%, #4bb85f 40%, #2f8fe0 60%, #7a4be0 80%, #f2f0e8 100%)";

function FilterSwatch({ css, className = "" }: { css: string; className?: string }) {
  return (
    <div
      aria-hidden
      className={`rounded-lg border border-black/10 dark:border-white/10 ${className}`}
      style={{ background: PREVIEW_BACKGROUND, filter: css || undefined }}
    />
  );
}

export function VisionFiltersSection({
  enabled,
  value,
  onToggleEnabled,
  onChange,
}: {
  enabled: boolean;
  value: Required<VisionFilterConfig>;
  onToggleEnabled: (enabled: boolean) => void;
  onChange: (patch: Partial<VisionFilterConfig>) => void;
}) {
  // Which custom filter's colour picker is open. Only one at a time — five
  // stacked pickers is a wall of controls, and an admin is tuning one look at
  // a moment anyway.
  const [openPicker, setOpenPicker] = useState<string | null>(null);

  function toggleBuiltIn(id: string) {
    onChange({
      enabledBuiltIns: value.enabledBuiltIns.includes(id)
        ? value.enabledBuiltIns.filter((x) => x !== id)
        : [...value.enabledBuiltIns, id],
    });
  }

  function addCustom() {
    if (value.custom.length >= CUSTOM_FILTER_MAX) return;
    const filter: CustomVisionFilter = {
      // Prefixed so it can never collide with a built-in's id — the visitor's
      // remembered choice is stored as a bare id, so a collision would mean
      // one filter silently selecting another.
      id: `custom-${Date.now().toString(36)}`,
      ...DEFAULT_CUSTOM_FILTER,
      label: `My Filter ${value.custom.length + 1}`,
    };
    onChange({ custom: [...value.custom, filter] });
    setOpenPicker(filter.id);
  }

  function updateCustom(id: string, patch: Partial<CustomVisionFilter>) {
    onChange({
      custom: value.custom.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    });
  }

  function removeCustom(id: string) {
    onChange({ custom: value.custom.filter((c) => c.id !== id) });
    if (openPicker === id) setOpenPicker(null);
  }

  const activeCount =
    value.enabledBuiltIns.length + value.custom.length;

  return (
    <div className="admin-card border rounded-2xl p-4 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-jakarta text-sm font-semibold text-ink dark:text-cream flex items-center gap-2">
            <Aperture size={15} strokeWidth={1.5} className="text-sepia" />
            Filter Vision
          </p>
          <p className="font-body text-[11px] text-ink-400 dark:text-ink-300 mt-1 max-w-lg">
            Visitors press <kbd className="px-1 rounded bg-black/5 dark:bg-white/10 font-mono">Q</kbd>{" "}
            (or tap the Filter button on a phone) to cycle through these looks and back to normal.
            Nothing changes until they do.
          </p>
        </div>
        <label className="inline-flex items-center gap-2 shrink-0 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onToggleEnabled(e.target.checked)}
            className="w-4 h-4 accent-sepia cursor-pointer"
          />
          <span className="font-body text-xs text-ink dark:text-cream">On</span>
        </label>
      </div>

      {enabled && activeCount === 0 && (
        // Every filter switched off is indistinguishable from the feature
        // being off, so say so rather than leaving the admin to discover that
        // [Q] does nothing.
        <p className="font-body text-[11px] text-amber-600 dark:text-amber-400">
          Nothing is switched on, so visitors won&rsquo;t see the Filter button or have [Q] do
          anything. Pick at least one look below.
        </p>
      )}

      <div className={enabled ? "space-y-5" : "space-y-5 opacity-40 pointer-events-none"}>
        {/* ── Built-ins ─────────────────────────────────────────────── */}
        <div>
          <p className="font-body text-[10px] uppercase tracking-widest text-ink-400 dark:text-ink-300 mb-2">
            Built-in looks
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {BUILT_IN_VISION_FILTERS.map((filter) => {
              const on = value.enabledBuiltIns.includes(filter.id);
              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => toggleBuiltIn(filter.id)}
                  aria-pressed={on}
                  className={`flex items-center gap-3 p-2 rounded-xl border text-left transition-colors ${
                    on
                      ? "border-sepia bg-sepia/10"
                      : "border-black/10 dark:border-white/10 hover:border-black/20 dark:hover:border-white/20"
                  }`}
                >
                  <FilterSwatch css={filter.css} className="w-12 h-9 shrink-0" />
                  <span className="min-w-0">
                    <span className="block font-jakarta text-xs font-medium text-ink dark:text-cream truncate">
                      {filter.label}
                    </span>
                    <span className="block font-body text-[10px] text-ink-400 dark:text-ink-300">
                      {on ? "Visitors can pick this" : "Hidden"}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Custom ────────────────────────────────────────────────── */}
        <div className="pt-1 border-t border-black/5 dark:border-white/5">
          <div className="flex items-center justify-between gap-3 mb-2">
            <p className="font-body text-[10px] uppercase tracking-widest text-ink-400 dark:text-ink-300">
              Your own colours ({value.custom.length}/{CUSTOM_FILTER_MAX})
            </p>
            <button
              type="button"
              onClick={addCustom}
              disabled={value.custom.length >= CUSTOM_FILTER_MAX}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-jakarta text-[11px] font-medium text-sepia hover:bg-sepia/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus size={13} /> Add colour
            </button>
          </div>

          {value.custom.length === 0 ? (
            <p className="font-body text-[11px] text-ink-400 dark:text-ink-300 italic">
              None yet — add one to tint the whole museum a colour of your choosing.
            </p>
          ) : (
            <div className="space-y-2">
              {value.custom.map((filter) => {
                const css = customFilterCss(filter);
                const open = openPicker === filter.id;
                return (
                  <div
                    key={filter.id}
                    className="rounded-xl border border-black/10 dark:border-white/10 p-3 space-y-3"
                  >
                    <div className="flex items-center gap-3">
                      <FilterSwatch css={css} className="w-14 h-10 shrink-0" />
                      <input
                        type="text"
                        value={filter.label}
                        maxLength={40}
                        onChange={(e) => updateCustom(filter.id, { label: e.target.value })}
                        placeholder="Filter name"
                        className="admin-input flex-1 min-w-0 px-3 py-1.5 rounded-lg text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setOpenPicker(open ? null : filter.id)}
                        title={open ? "Hide the colour controls" : "Pick the colour"}
                        aria-expanded={open}
                        className="w-8 h-8 rounded-lg border border-black/15 dark:border-white/15 shrink-0"
                        style={{ background: filter.color }}
                      />
                      <button
                        type="button"
                        onClick={() => removeCustom(filter.id)}
                        title="Remove this filter"
                        className="p-1.5 rounded-lg text-ink-400 dark:text-ink-300 hover:text-vermillion hover:bg-vermillion/10 transition-colors shrink-0"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {open && (
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          {/* The OS colour picker plus a hex box — the same
                              pair every other colour control in the admin uses
                              (see IntroSplashSection's HexColorField). No
                              third-party picker: this project has never added
                              one, and a native input needs no bundle. */}
                          <input
                            type="color"
                            value={filter.color}
                            onChange={(e) => updateCustom(filter.id, { color: e.target.value })}
                            aria-label={`${filter.label} colour`}
                            className="h-9 w-11 shrink-0 rounded-lg border border-black/10 dark:border-white/10 bg-transparent p-1 cursor-pointer"
                          />
                          <input
                            type="text"
                            value={filter.color}
                            maxLength={7}
                            spellCheck={false}
                            onChange={(e) => {
                              const next = e.target.value;
                              // Committed only once it is a full valid hex —
                              // a half-typed "#4f" would otherwise render as
                              // an invalid filter and blank the preview while
                              // the admin is still typing.
                              if (/^#[0-9a-fA-F]{6}$/.test(next)) {
                                updateCustom(filter.id, { color: next });
                              }
                            }}
                            placeholder="#7CC4FF"
                            className="admin-input w-[6rem] px-2.5 py-1.5 rounded-lg text-xs font-mono uppercase"
                          />
                        </div>
                        <div className="space-y-3">
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="font-body text-[10px] uppercase tracking-widest text-ink-400 dark:text-ink-300">
                                Strength
                              </label>
                              <span className="font-body text-[10px] tabular-nums text-ink-400 dark:text-ink-300">
                                {filter.intensity.toFixed(2)}
                              </span>
                            </div>
                            <input
                              type="range"
                              min={CUSTOM_INTENSITY_MIN}
                              max={CUSTOM_INTENSITY_MAX}
                              step={0.05}
                              value={filter.intensity}
                              onChange={(e) =>
                                updateCustom(filter.id, { intensity: Number(e.target.value) })
                              }
                              className="w-full accent-sepia"
                            />
                            <p className="font-body text-[10px] text-ink-400 dark:text-ink-300 mt-0.5">
                              0 is plain monochrome — the colour fades out entirely.
                            </p>
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="font-body text-[10px] uppercase tracking-widest text-ink-400 dark:text-ink-300">
                                Brightness
                              </label>
                              <span className="font-body text-[10px] tabular-nums text-ink-400 dark:text-ink-300">
                                {filter.brightness.toFixed(2)}
                              </span>
                            </div>
                            <input
                              type="range"
                              min={CUSTOM_BRIGHTNESS_MIN}
                              max={CUSTOM_BRIGHTNESS_MAX}
                              step={0.05}
                              value={filter.brightness}
                              onChange={(e) =>
                                updateCustom(filter.id, { brightness: Number(e.target.value) })
                              }
                              className="w-full accent-sepia"
                            />
                            <p className="font-body text-[10px] text-ink-400 dark:text-ink-300 mt-0.5">
                              Turn this up for a dark colour — tinting costs some light.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
