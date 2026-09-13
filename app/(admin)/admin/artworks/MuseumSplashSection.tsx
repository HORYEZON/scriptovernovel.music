// app/(admin)/admin/artworks/MuseumSplashSection.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Play, ToggleLeft, ToggleRight, LayoutPanelLeft, PictureInPicture2 } from "lucide-react";
import { RoomSplashContent } from "@/app/(public)/gallery/museum/components/RoomSplashContent";
import { RoomSplashPopup } from "@/app/(public)/gallery/museum/components/RoomSplashPopup";
import { toggleStaged } from "@/lib/admin/toggleToast";
import { INTRO_EFFECTS, INTRO_ENTER_DELAY_MS, introExitMs, isHexColor, type IntroEffect } from "@/lib/intro-splash";
import {
  SPLASH_SPEED_PRESETS,
  SPLASH_TAGLINE_SIZE_PRESETS,
  SPLASH_TAGLINE_FONT_OPTIONS,
  MIN_SPLASH_SPEED,
  MAX_SPLASH_SPEED,
  MUSEUM_SPLASH_DEFAULTS,
  type SplashStyle,
} from "@/lib/museum-splash";

export interface MuseumSplashValue {
  splashEnabled: boolean;
  splashEffect: IntroEffect;
  splashSpeedMs: number;
  splashBgColor: string;
  splashTaglineFontSize: string;
  splashTaglineFontFamily: string;
  /** "full-page" (fullscreen reveal) or "side-popup" (slide-in card from
   * the right edge — see RoomSplashPopup.tsx). The *desktop* choice.
   * Museum-wide, same as every other field here. */
  splashStyle: SplashStyle;
  /** Same two options, mobile's own independent choice — see
   * splashStyleMobile below the Desktop picker. */
  splashStyleMobile: SplashStyle;
}

const DESKTOP_STYLE_OPTIONS: { value: SplashStyle; label: string; description: string; icon: typeof LayoutPanelLeft }[] = [
  {
    value: "full-page",
    label: "Full Page",
    description: "Takes over the whole screen — the original reveal.",
    icon: LayoutPanelLeft,
  },
  {
    value: "side-popup",
    label: "Side Popup",
    description: "A card slides in from the bottom-right instead.",
    icon: PictureInPicture2,
  },
];

const MOBILE_STYLE_OPTIONS: { value: SplashStyle; label: string; description: string; icon: typeof LayoutPanelLeft }[] = [
  {
    value: "full-page",
    label: "Full Page",
    description: "Takes over the whole screen — the original reveal.",
    icon: LayoutPanelLeft,
  },
  {
    value: "side-popup",
    label: "Side Popup",
    description: "A smaller card, positioned clear of the on-screen joystick/jump button.",
    icon: PictureInPicture2,
  },
];

type PreviewPhase = "idle" | "entering" | "visible" | "exiting";

// Same admin pattern as Preferences → Branding → Entrance Splash
// (IntroSplashSection.tsx) — effect picker, speed slider+presets, tagline
// font/size, background color, live preview with a Replay button — copied
// deliberately so the two feel like the same feature rather than two
// different UIs for a near-identical concept. No "Splash Icon"/"Splash
// Title" fields here though — those are per-room overrides now
// (RoomsTab.tsx, next to each room's own wall/floor/ceiling settings), not
// a museum-wide value, so the preview below uses a fixed "Sample Room"
// placeholder + the default glowing squid icon instead.
export function MuseumSplashSection({
  value,
  onChange,
}: {
  value: MuseumSplashValue;
  onChange: (patch: Partial<MuseumSplashValue>) => void;
}) {
  const [previewPhase, setPreviewPhase] = useState<PreviewPhase>("idle");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const [bgColorDraft, setBgColorDraft] = useState(value.splashBgColor);
  useEffect(() => {
    setBgColorDraft(value.splashBgColor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.splashBgColor]);

  function commitBgColorDraft() {
    if (isHexColor(bgColorDraft)) {
      onChange({ splashBgColor: bgColorDraft });
    } else {
      setBgColorDraft(value.splashBgColor);
    }
  }

  // Preview-only, not persisted.
  const [previewBrightness, setPreviewBrightness] = useState(20);

  function clearTimers() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }

  function play() {
    clearTimers();
    setPreviewPhase("idle");
    const exitMs = introExitMs(value.splashSpeedMs);
    const toEnter = setTimeout(() => setPreviewPhase("entering"), 20);
    const toVisible = setTimeout(() => setPreviewPhase("visible"), 20 + INTRO_ENTER_DELAY_MS);
    const toExit = setTimeout(
      () => setPreviewPhase("exiting"),
      20 + INTRO_ENTER_DELAY_MS + value.splashSpeedMs
    );
    const toIdle = setTimeout(
      () => setPreviewPhase("idle"),
      20 + INTRO_ENTER_DELAY_MS + value.splashSpeedMs + exitMs
    );
    timers.current = [toEnter, toVisible, toExit, toIdle];
  }

  useEffect(() => {
    play();
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only autoplay
  }, []);

  useEffect(() => {
    play();
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.splashEffect]);

  const disabledCls = value.splashEnabled ? "" : "opacity-50 pointer-events-none";

  return (
    <div className="admin-card border rounded-2xl backdrop-blur-md shadow-sm p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 border-b border-black/10 dark:border-white/10 pb-4">
        <div>
          <p className="font-body text-xs tracking-widest uppercase text-ink-400 dark:text-ink-300">
            Room Splash
          </p>
          <p className="font-body text-xs text-ink-400 dark:text-ink-300 mt-1">
            A brief reveal shown the first time a visitor walks into each
            room — plays once per room, per visit.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            onChange({ splashEnabled: !value.splashEnabled });
            toggleStaged("Room Splash", !value.splashEnabled);
          }}
          title={value.splashEnabled ? "Disable room splash" : "Enable room splash"}
          className={`shrink-0 p-1.5 rounded-lg transition-colors ${
            value.splashEnabled
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
              : "bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:bg-black/10 dark:hover:bg-white/10"
          }`}
        >
          {value.splashEnabled ? <ToggleRight size={26} /> : <ToggleLeft size={26} />}
        </button>
      </div>

      <div className={`space-y-6 transition-opacity ${disabledCls}`}>
        {/* Style pickers — Full Page (original) vs Side Popup (new), one
            independent choice for desktop and one for mobile (a phone
            visitor doesn't have to fall back to Full Page just because
            that's what desktop is set to, and vice versa — see
            RoomSplash.tsx). Museum-wide otherwise, same as every other
            setting here (no per-room style choice — see docs on the
            per-room enable toggle instead, which lives on RoomsTab.tsx
            rather than here). */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">
            Desktop Style
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {DESKTOP_STYLE_OPTIONS.map((s) => {
              const Icon = s.icon;
              return (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => onChange({ splashStyle: s.value })}
                  className={`text-left p-3 rounded-xl border transition-all flex items-start gap-3 ${
                    value.splashStyle === s.value
                      ? "border-sepia bg-sepia/10"
                      : "border-black/10 dark:border-white/10 hover:border-black/30 dark:hover:border-white/30"
                  }`}
                >
                  <Icon
                    size={18}
                    className={`shrink-0 mt-0.5 ${value.splashStyle === s.value ? "text-sepia" : "text-ink-400 dark:text-ink-300"}`}
                  />
                  <span>
                    <p
                      className={`font-body text-sm font-medium ${
                        value.splashStyle === s.value ? "text-sepia" : "text-ink dark:text-cream"
                      }`}
                    >
                      {s.label}
                    </p>
                    <p className="font-body text-[11px] text-ink-400 dark:text-ink-300 mt-1">
                      {s.description}
                    </p>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">
            Mobile Style
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {MOBILE_STYLE_OPTIONS.map((s) => {
              const Icon = s.icon;
              return (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => onChange({ splashStyleMobile: s.value })}
                  className={`text-left p-3 rounded-xl border transition-all flex items-start gap-3 ${
                    value.splashStyleMobile === s.value
                      ? "border-sepia bg-sepia/10"
                      : "border-black/10 dark:border-white/10 hover:border-black/30 dark:hover:border-white/30"
                  }`}
                >
                  <Icon
                    size={18}
                    className={`shrink-0 mt-0.5 ${value.splashStyleMobile === s.value ? "text-sepia" : "text-ink-400 dark:text-ink-300"}`}
                  />
                  <span>
                    <p
                      className={`font-body text-sm font-medium ${
                        value.splashStyleMobile === s.value ? "text-sepia" : "text-ink dark:text-cream"
                      }`}
                    >
                      {s.label}
                    </p>
                    <p className="font-body text-[11px] text-ink-400 dark:text-ink-300 mt-1">
                      {s.description}
                    </p>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Effect picker — only irrelevant when *both* desktop and mobile
            are set to Side Popup (which never uses it, always its own
            fixed slide-in animation) — Full Page on either device still
            reads this. */}
        <div className={value.splashStyle === "side-popup" && value.splashStyleMobile === "side-popup" ? "opacity-40 pointer-events-none" : ""}>
          <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">
            Transition Effect
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {INTRO_EFFECTS.map((e) => (
              <button
                key={e.value}
                type="button"
                onClick={() => onChange({ splashEffect: e.value })}
                className={`text-left p-3 rounded-xl border transition-all ${
                  value.splashEffect === e.value
                    ? "border-sepia bg-sepia/10"
                    : "border-black/10 dark:border-white/10 hover:border-black/30 dark:hover:border-white/30"
                }`}
              >
                <p
                  className={`font-body text-sm font-medium ${
                    value.splashEffect === e.value ? "text-sepia" : "text-ink dark:text-cream"
                  }`}
                >
                  {e.label}
                </p>
                <p className="font-body text-[11px] text-ink-400 dark:text-ink-300 mt-1">
                  {e.description}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Speed */}
        <div>
          <label
            htmlFor="splash-speed"
            className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2"
          >
            Transition Speed —{" "}
            <span className="font-mono normal-case tracking-normal text-ink dark:text-cream">
              {(value.splashSpeedMs / 1000).toFixed(1)}s hold
            </span>
          </label>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <input
              id="splash-speed"
              type="range"
              min={MIN_SPLASH_SPEED}
              max={MAX_SPLASH_SPEED}
              step={100}
              value={value.splashSpeedMs}
              onChange={(e) => onChange({ splashSpeedMs: Number(e.target.value) })}
              onMouseUp={play}
              onTouchEnd={play}
              className="flex-1 accent-sepia cursor-pointer"
            />
            <div className="flex gap-1 shrink-0">
              {SPLASH_SPEED_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    onChange({ splashSpeedMs: preset.value });
                    setTimeout(play, 0);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-wider border transition-all ${
                    value.splashSpeedMs === preset.value
                      ? "bg-sepia text-white border-sepia font-medium"
                      : "border-black/10 dark:border-white/10 text-ink-400 dark:text-ink-300 hover:border-black/30 dark:hover:border-white/30"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
          <p className="font-body text-[11px] text-ink-400 dark:text-ink-300 mt-1.5">
            How long the room name holds on screen before it clears.
          </p>
        </div>

        {/* Tagline style */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">
              &quot;Digital Museum&quot; Label Size
            </label>
            <div className="flex flex-wrap gap-1.5">
              {SPLASH_TAGLINE_SIZE_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => onChange({ splashTaglineFontSize: preset.value })}
                  className={`px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-wider border transition-all ${
                    value.splashTaglineFontSize === preset.value
                      ? "bg-sepia text-white border-sepia font-medium"
                      : "border-black/10 dark:border-white/10 text-ink-400 dark:text-ink-300 hover:border-black/30 dark:hover:border-white/30"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label
              htmlFor="splash-tagline-font"
              className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2"
            >
              Label Font Type
            </label>
            <div className="relative">
              <select
                id="splash-tagline-font"
                value={value.splashTaglineFontFamily}
                onChange={(e) => onChange({ splashTaglineFontFamily: e.target.value })}
                className="w-full px-4 py-2.5 pr-10 rounded-xl admin-input border text-ink dark:text-cream focus:outline-none focus:border-sepia transition-colors text-sm cursor-pointer appearance-none"
              >
                {SPLASH_TAGLINE_FONT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} className="bg-white dark:bg-ink-900">
                    {opt.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-ink-400"
              />
            </div>
          </div>
        </div>

        {/* Background color */}
        <div>
          <label
            htmlFor="splash-bg-color"
            className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2"
          >
            Splash Background Color
          </label>
          <div className="flex items-center gap-3">
            <input
              id="splash-bg-color"
              type="color"
              value={isHexColor(value.splashBgColor) ? value.splashBgColor : MUSEUM_SPLASH_DEFAULTS.splashBgColor}
              onChange={(e) => onChange({ splashBgColor: e.target.value })}
              className="h-10 w-14 shrink-0 rounded-lg border border-black/10 dark:border-white/10 bg-transparent p-1 cursor-pointer"
            />
            <input
              type="text"
              value={bgColorDraft}
              onChange={(e) => setBgColorDraft(e.target.value)}
              onBlur={commitBgColorDraft}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              maxLength={7}
              spellCheck={false}
              placeholder="#0D0D0D"
              className="w-28 px-3 py-2 rounded-xl admin-input border text-ink dark:text-cream placeholder-ink-400 font-mono text-xs focus:outline-none focus:border-sepia transition-colors"
            />
            {value.splashBgColor !== MUSEUM_SPLASH_DEFAULTS.splashBgColor && (
              <button
                type="button"
                onClick={() => onChange({ splashBgColor: MUSEUM_SPLASH_DEFAULTS.splashBgColor })}
                className="font-body text-xs text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream transition-colors"
              >
                Reset
              </button>
            )}
          </div>
          <p className="font-body text-[11px] text-ink-400 dark:text-ink-300 mt-1.5">
            Fills the splash screen behind the room name. Defaults to near-black.
          </p>
        </div>

        {/* Live preview */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300">
              Preview
            </label>
            <button
              type="button"
              onClick={play}
              className="flex items-center gap-1.5 font-body text-xs text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream transition-colors"
            >
              <Play size={12} />
              Replay
            </button>
          </div>
          <div
            className="relative rounded-xl border border-white/10 h-64 overflow-hidden transition-colors"
            style={{ backgroundColor: `hsl(0 0% ${previewBrightness}%)` }}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="font-body text-xs tracking-widest uppercase text-white mix-blend-difference">
                Your museum room
              </p>
            </div>
            {previewPhase !== "idle" && (
              value.splashStyle === "side-popup" ? (
                <RoomSplashPopup
                  phase={previewPhase}
                  roomName="Sample Room"
                  durationMs={introExitMs(value.splashSpeedMs)}
                />
              ) : (
                <RoomSplashContent
                  effect={value.splashEffect}
                  phase={previewPhase === "visible" ? "visible" : "exiting"}
                  roomName="Sample Room"
                  durationMs={introExitMs(value.splashSpeedMs)}
                  bgColor={value.splashBgColor}
                  taglineFontSize={value.splashTaglineFontSize}
                  taglineFontFamily={value.splashTaglineFontFamily}
                  forceMotion
                />
              )
            )}
          </div>

          <div className="mt-3">
            <label
              htmlFor="splash-preview-brightness"
              className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2"
            >
              Backdrop Brightness (preview only) —{" "}
              <span className="font-mono normal-case tracking-normal text-ink dark:text-cream">
                {previewBrightness}%
              </span>
            </label>
            <input
              id="splash-preview-brightness"
              type="range"
              min={0}
              max={100}
              value={previewBrightness}
              onChange={(e) => setPreviewBrightness(Number(e.target.value))}
              className="w-full accent-sepia cursor-pointer"
            />
            <p className="font-body text-[11px] text-ink-400 dark:text-ink-300 mt-1.5">
              Adjusts only this preview&apos;s stand-in backdrop. Nothing here is saved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
