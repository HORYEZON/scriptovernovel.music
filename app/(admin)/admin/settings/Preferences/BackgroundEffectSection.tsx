"use client";

// app/(admin)/admin/settings/Preferences/BackgroundEffectSection.tsx
//
// Preferences → Branding → Site Background Effects: what the public site's
// background photo does behind the page (SiteTheme.bgEffect /
// bgEffectSpeedMs, see lib/theme.ts's BG_EFFECTS). Same shape as the
// Entrance Splash card beside it — an effect picker of description cards, a
// speed slider with presets, and a live preview with Replay — and the
// preview plays the very CSS the public site does (bgEffectCss + the
// @keyframes in globals.css) on the admin's own background photo, so what
// is shown here is what visitors get.
//
// Staged into BrandingSection's form like every other control on that tab
// and written by its Save (the /api/theme PUT that already carries bgBlur).
import { useRef, useState, type CSSProperties, type UIEvent } from "react";
import { RotateCcw } from "lucide-react";
import { SettingsAccordion } from "./SettingsAccordion";
import {
  BG_EFFECTS,
  BG_EFFECT_SPEED_PRESETS,
  MIN_BG_EFFECT_SPEED,
  MAX_BG_EFFECT_SPEED,
  bgEffectCss,
  bgEffectLoops,
  type BgEffect,
} from "@/lib/theme";

// Stand-in for a site with no background photo uploaded yet — a gradient
// with enough shape in it that zoom/drift/parallax visibly move something.
// (globals.css's own --bg-image fallback points at a file that isn't
// shipped, so it can't be borrowed here.)
const PLACEHOLDER_BACKGROUND =
  "radial-gradient(circle at 30% 35%, rgba(200,169,110,0.55), transparent 40%), radial-gradient(circle at 75% 70%, rgba(217,79,56,0.45), transparent 45%), linear-gradient(135deg, #2a1420, #0d0d0d 60%, #16162a)";

export interface BackgroundEffectValue {
  bgEffect: BgEffect;
  bgEffectSpeedMs: number;
}

export function BackgroundEffectSection({
  value,
  onChange,
  imageUrl,
  open,
  onToggle,
}: {
  value: BackgroundEffectValue;
  onChange: (patch: Partial<BackgroundEffectValue>) => void;
  /** The uploaded public background photo, if any. */
  imageUrl?: string;
  open: boolean;
  onToggle: () => void;
}) {
  // Remounting the photo layer restarts its CSS animation from frame one —
  // what "Replay" means for a loop that otherwise never stops.
  const [replayKey, setReplayKey] = useState(0);
  // Parallax is driven by scrolling, so its preview is a scroll box: this is
  // the same 0→1 progress BackgroundParallax.tsx feeds the public site, read
  // from the box instead of the window.
  const [parallax, setParallax] = useState(0);
  const scrollBox = useRef<HTMLDivElement>(null);

  const isParallax = value.bgEffect === "parallax";
  const loops = bgEffectLoops(value.bgEffect);

  function onPreviewScroll(e: UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    const max = el.scrollHeight - el.clientHeight;
    setParallax(max > 0 ? Math.min(1, Math.max(0, el.scrollTop / max)) : 0);
  }

  function replay() {
    setReplayKey((k) => k + 1);
    if (scrollBox.current) scrollBox.current.scrollTo({ top: 0, behavior: "smooth" });
  }

  const photoStyle: CSSProperties = {
    backgroundImage: imageUrl ? `url('${imageUrl}')` : PLACEHOLDER_BACKGROUND,
    ...bgEffectCss(value.bgEffect, value.bgEffectSpeedMs),
  };

  return (
    <SettingsAccordion
      title="Site Background Effects"
      description="Motion on the background photo behind every public page. Still by default."
      open={open}
      onToggle={onToggle}
    >
      {/* Preview beside the controls, the Entrance Splash's arrangement, so
          the thing being tuned stays on screen while it is tuned. */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] gap-5 lg:gap-6">
        <div className="min-w-0 lg:sticky lg:top-4 lg:self-start">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300">
              Preview
            </label>
            <button
              type="button"
              onClick={replay}
              className="inline-flex items-center gap-1.5 rounded-lg border border-black/10 px-2.5 py-1 font-body text-xs text-ink-500 transition-colors hover:border-sepia hover:text-ink dark:border-white/10 dark:text-ink-300 dark:hover:text-cream"
            >
              <RotateCcw size={12} />
              Replay
            </button>
          </div>

          {/* The frame stands in for the viewport: the photo layer is
              `sticky` so it holds still while the stand-in page content
              scrolls past it, exactly as the fixed html::before does on the
              real site. Only parallax gets a scrollbar; the loops have
              nothing to scroll for. */}
          <div
            ref={scrollBox}
            onScroll={isParallax ? onPreviewScroll : undefined}
            className={`relative aspect-[16/10] w-full rounded-xl border border-black/10 dark:border-white/10 bg-ink ${
              isParallax ? "overflow-y-auto overscroll-contain" : "overflow-hidden"
            }`}
            style={{ "--bg-parallax": parallax } as CSSProperties}
          >
            <div className="sticky top-0 h-full w-full overflow-hidden">
              <div
                key={replayKey}
                aria-hidden="true"
                className="absolute inset-0 bg-cover bg-center"
                style={photoStyle}
              />
              {/* The public site's page wash, so brightness reads as it will. */}
              <div className="absolute inset-0 bg-[rgba(6,6,10,0.55)]" aria-hidden="true" />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
                <span className="font-jakarta text-2xl font-light tracking-tight text-cream">ScriptOverNovel</span>
                <span className="font-body text-[10px] tracking-widest uppercase text-cream/60">
                  {isParallax ? "Scroll this box" : BG_EFFECTS.find((e) => e.value === value.bgEffect)?.label}
                </span>
              </div>
            </div>
            {isParallax && (
              // Enough stand-in page below the fold to scroll through.
              <div className="relative flex h-[220%] flex-col justify-around px-6 py-6" aria-hidden="true">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-16 rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm" />
                ))}
              </div>
            )}
          </div>
          <p className="mt-1.5 font-body text-[11px] text-ink-400 dark:text-ink-300">
            {imageUrl
              ? "Plays on your uploaded background photo."
              : "No background photo uploaded yet — shown on a stand-in."}{" "}
            Visitors who have asked their device for reduced motion see the photo still.
          </p>
        </div>

        <div className="space-y-6">
          {/* Effect picker */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">
              Effect
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
              {BG_EFFECTS.map((e) => {
                const selected = value.bgEffect === e.value;
                return (
                  <button
                    key={e.value}
                    type="button"
                    onClick={() => onChange({ bgEffect: e.value })}
                    className={`text-left p-3 rounded-xl border transition-all ${
                      selected
                        ? "border-sepia bg-sepia/10"
                        : "border-black/10 dark:border-white/10 hover:border-black/30 dark:hover:border-white/30"
                    }`}
                  >
                    <p className={`font-body text-sm font-medium ${selected ? "text-sepia" : "text-ink dark:text-cream"}`}>
                      {e.label}
                    </p>
                    <p className="font-body text-[11px] text-ink-400 dark:text-ink-300 mt-1">{e.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Speed — one loop, for the effects that loop */}
          <div className={loops ? "" : "opacity-50"}>
            <label
              htmlFor="bg-effect-speed"
              className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2"
            >
              Speed —{" "}
              <span className="font-mono normal-case tracking-normal text-ink dark:text-cream">
                {(value.bgEffectSpeedMs / 1000).toFixed(0)}s per loop
              </span>
            </label>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <input
                id="bg-effect-speed"
                type="range"
                min={MIN_BG_EFFECT_SPEED}
                max={MAX_BG_EFFECT_SPEED}
                step={1000}
                value={value.bgEffectSpeedMs}
                onChange={(e) => onChange({ bgEffectSpeedMs: Number(e.target.value) })}
                disabled={!loops}
                className="flex-1 accent-sepia cursor-pointer disabled:cursor-not-allowed"
              />
              <div className="flex gap-1 shrink-0">
                {BG_EFFECT_SPEED_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => onChange({ bgEffectSpeedMs: preset.value })}
                    disabled={!loops}
                    className={`px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-wider border transition-all disabled:cursor-not-allowed ${
                      value.bgEffectSpeedMs === preset.value
                        ? "bg-sepia text-white border-sepia font-medium"
                        : "border-black/10 dark:border-white/10 text-ink-400 dark:text-ink-300 hover:border-black/30 dark:hover:border-white/30"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
            <p className="mt-1.5 font-body text-[11px] text-ink-400 dark:text-ink-300">
              {isParallax
                ? "Parallax follows the visitor's own scrolling, so it has no speed of its own."
                : loops
                  ? "Slower reads as calmer; the site's photo is on screen for a long time."
                  : "Pick an effect to set its speed."}
            </p>
          </div>
        </div>
      </div>
    </SettingsAccordion>
  );
}
