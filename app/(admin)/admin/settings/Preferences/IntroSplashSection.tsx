// app/(admin)/admin/settings/Preferences/IntroSplashSection.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Monitor, Play, Repeat, Smartphone, ToggleLeft, ToggleRight } from "lucide-react";
import { IntroSplashContent } from "@/components/public/IntroSplashContent";
import { SettingsAccordion } from "./SettingsAccordion";
import {
  INTRO_EFFECTS,
  INTRO_SPEED_PRESETS,
  INTRO_TAGLINE_SIZE_PRESETS,
  INTRO_TAGLINE_FONT_OPTIONS,
  MIN_INTRO_SPEED,
  MAX_INTRO_SPEED,
  MAX_INTRO_TEXT_LENGTH,
  INTRO_ENTER_DELAY_MS,
  INTRO_DEFAULTS,
  MIN_INTRO_TAGLINE_REM,
  MAX_INTRO_TAGLINE_REM,
  INTRO_TAGLINE_REM_STEP,
  MIN_INTRO_GLOW,
  MAX_INTRO_GLOW,
  MIN_INTRO_GLOW_OFFSET,
  MAX_INTRO_GLOW_OFFSET,
  taglineLengthFromRem,
  taglineRemFromLength,
  introExitMs,
  isHexColor,
  type IntroEffect,
  type IntroLetterColors,
} from "@/lib/intro-splash";

export interface IntroSplashValue {
  introEnabled: boolean;
  introEffect: IntroEffect;
  introSpeedMs: number;
  introText: string;
  introTextAbove: string;
  introBgColor: string;
  introTaglineFontSize: string;
  introTaglineColor: string;
  introTaglineAboveFontSize: string;
  introTaglineAboveColor: string;
  introTaglineFontFamily: string;
  introTaglineAboveFontFamily: string;
  /** Phone-only size overrides. Null = follow the size above, which is what
   *  every splash did before these existed. */
  introTaglineFontSizeMobile: string | null;
  introTaglineAboveFontSizeMobile: string | null;
  introGlowIntensity: number;
  introGlowColor: string;
  introGlowShimmer: boolean;
  introGlowOffsetX: number;
  introGlowOffsetY: number;
  /** Unused since the splash took the header's wordmark — carried so the
   *  Branding form's shape is unchanged; no control edits it. */
  introLetterColors: IntroLetterColors;
  introSquidColor: string;
  // Edited from Branding/Icons' "Entrance Splash Icon" picker, not here —
  // just read so the preview below reflects it too. See BrandingSection.tsx.
  splashIcon: string;
}

type PreviewPhase = "idle" | "entering" | "visible" | "exiting";

/** How long the preview rests on the bare stand-in "page" between looped
 *  runs. Long enough that a repeat reads as the splash playing again rather
 *  than as one animation stuttering. */
const LOOP_GAP_MS = 500;

/**
 * Color swatch + hex field, with the same "only a fully-valid hex commits"
 * rule the splash background color has always had — a mid-typed "#0D0" must
 * not be pushed up to the form and saved. Factored out because this card now
 * has four of them (background, both taglines, the glow) and four hand-rolled
 * drafts is four places for that rule to drift.
 */
function HexColorField({
  id,
  value,
  onChange,
  resetTo,
}: {
  id: string;
  value: string;
  onChange: (hex: string) => void;
  /** Shows a Reset link whenever `value` differs from this. */
  resetTo?: string;
}) {
  const [draft, setDraft] = useState(value);
  // Resyncs whenever the committed value changes elsewhere (the swatch, Reset).
  useEffect(() => setDraft(value), [value]);

  function commit() {
    if (isHexColor(draft)) onChange(draft.trim());
    else setDraft(value);
  }

  return (
    // flex-wrap + a narrow hex box on purpose: this field sits inside the
    // ~22rem config column, and at its old fixed widths (14 + 28 + a Reset
    // link) it was wider than half of that column — which is exactly what
    // put a horizontal scrollbar under the whole config pane, since
    // `overflow-y: auto` there makes the x axis scrollable too.
    <div className="flex flex-wrap items-center gap-2">
      <input
        id={id}
        type="color"
        value={isHexColor(value) ? value : "#000000"}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-12 shrink-0 rounded-lg border border-black/10 dark:border-white/10 bg-transparent p-1 cursor-pointer"
      />
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        maxLength={7}
        spellCheck={false}
        placeholder="#E8D5A8"
        className="w-[5.5rem] min-w-0 flex-1 px-2.5 py-2 rounded-xl admin-input border text-ink dark:text-cream placeholder-ink-400 font-mono text-xs focus:outline-none focus:border-sepia transition-colors"
      />
      {resetTo !== undefined && value !== resetTo && (
        <button
          type="button"
          onClick={() => onChange(resetTo)}
          className="font-body text-xs text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream transition-colors"
        >
          Reset
        </button>
      )}
    </div>
  );
}

/**
 * A tagline's font size, as a slider over rem plus the curated preset chips.
 *
 * The slider is the primary control — "how big should this line be" is a
 * continuous question and picking between four fixed steps never quite
 * answered it. The presets stay as one-click seeds, and land the slider on
 * their own value rather than replacing it. Storage is still the CSS length
 * string every other size field in the app uses (see taglineLengthFromRem).
 */
/**
 * The phone-only size for one tagline — a checkbox that reveals the same
 * slider, rather than a second always-on field.
 *
 * Opt-in because null is meaningfully different from "the same number as
 * desktop": an unset override *follows* the desktop size, so an admin who
 * later changes the desktop size gets the phone one moving with it. A field
 * pre-filled with a copy of the desktop value would silently freeze that
 * relationship the first time it was rendered.
 */
function TaglineMobileSizeField({
  id,
  value,
  desktopValue,
  onChange,
}: {
  id: string;
  value: string | null;
  /** What the phone inherits while the override is off — shown so the admin
   *  can see what they'd be departing from. */
  desktopValue: string;
  onChange: (length: string | null) => void;
}) {
  const on = value !== null;
  return (
    <div className="rounded-xl border border-black/10 dark:border-white/10 p-3">
      <label className="flex items-start gap-2.5 cursor-pointer">
        <input
          type="checkbox"
          checked={on}
          // Switching on seeds from the desktop size, so the first thing the
          // admin sees is where they already were rather than a jump to some
          // arbitrary default they have to undo.
          onChange={(e) => onChange(e.target.checked ? desktopValue : null)}
          className="mt-0.5 w-4 h-4 accent-sepia cursor-pointer shrink-0"
        />
        <span className="min-w-0">
          <span className="block text-xs font-semibold uppercase tracking-wider text-ink dark:text-cream">
            Different size on phones
          </span>
          <span className="block font-body text-[11px] text-ink-400 dark:text-ink-300 mt-0.5">
            {on
              ? "Phones use the size below instead."
              : `Phones use the same ${taglineRemFromLength(desktopValue, 0.75).toFixed(2)}rem.`}
          </span>
        </span>
      </label>
      {on && (
        <div className="mt-3">
          <TaglineSizeSlider
            id={id}
            label="Phone Size"
            value={value}
            onChange={onChange}
          />
        </div>
      )}
    </div>
  );
}

function TaglineSizeSlider({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (length: string) => void;
}) {
  const rem = taglineRemFromLength(value, 0.75);
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2"
      >
        {label} —{" "}
        <span className="font-mono normal-case tracking-normal text-ink dark:text-cream">
          {rem.toFixed(2)}rem
        </span>
      </label>
      <input
        id={id}
        type="range"
        min={MIN_INTRO_TAGLINE_REM}
        max={MAX_INTRO_TAGLINE_REM}
        step={INTRO_TAGLINE_REM_STEP}
        value={rem}
        onChange={(e) => onChange(taglineLengthFromRem(Number(e.target.value)))}
        className="w-full accent-sepia cursor-pointer"
      />
      <div className="flex flex-wrap gap-1.5 mt-2">
        {INTRO_TAGLINE_SIZE_PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => onChange(preset.value)}
            className={`px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-wider border transition-all ${
              value === preset.value
                ? "bg-sepia text-white border-sepia font-medium"
                : "border-black/10 dark:border-white/10 text-ink-400 dark:text-ink-300 hover:border-black/30 dark:hover:border-white/30"
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * A tagline's font family. One of these now sits inside each tagline's own
 * card rather than a single shared picker below both — the line above the
 * logo is usually a small label and the one below it the house line, and
 * setting them from one knob meant a choice made for one silently changed
 * the other.
 */
function TaglineFontSelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (family: string) => void;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2"
      >
        Font Type
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-4 py-2.5 pr-10 rounded-xl admin-input border text-ink dark:text-cream focus:outline-none focus:border-sepia transition-colors text-sm cursor-pointer appearance-none"
        >
          {INTRO_TAGLINE_FONT_OPTIONS.map((opt) => (
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
  );
}

/**
 * One axis of the glow's position, as a percentage of the lockup's own box
 * away from centre. Signed and labelled rather than raw, so 0 reads as
 * "centred" instead of as an arbitrary number.
 */
function GlowOffsetSlider({
  id,
  label,
  hint,
  value,
  onChange,
}: {
  id: string;
  label: string;
  /** What the two ends of this axis mean, e.g. "left / right". */
  hint: string;
  value: number;
  onChange: (offset: number) => void;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2"
      >
        {label} —{" "}
        <span className="font-mono normal-case tracking-normal text-ink dark:text-cream">
          {value === 0 ? "centred" : `${value > 0 ? "+" : ""}${value}%`}
        </span>
      </label>
      <input
        id={id}
        type="range"
        min={MIN_INTRO_GLOW_OFFSET}
        max={MAX_INTRO_GLOW_OFFSET}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full min-w-0 accent-sepia cursor-pointer"
      />
      <p className="font-body text-[10px] uppercase tracking-wider text-ink-400 dark:text-ink-300 mt-1">
        {hint}
      </p>
    </div>
  );
}

// Card lives inside BrandingSection.tsx (Preferences → Branding tab). Same
// "value + onChange patch" shape as the rest of that form so it slots into
// BrandingSection's single `form` object without its own save button.
export function IntroSplashSection({
  value,
  onChange,
  onToggleSave,
  open,
  onToggle,
}: {
  value: IntroSplashValue;
  onChange: (patch: Partial<IntroSplashValue>) => void;
  /** Writes one field straight to the database instead of staging it for the
   *  tab's Save Branding button. Only this card's two switches use it: every
   *  other control here is a value being composed (a colour, a tagline, a
   *  duration), where staging is right, while a switch is a decision already
   *  finished the moment it's flipped — see BrandingSection's saveField. */
  onToggleSave: (patch: Partial<IntroSplashValue>, label: string, on: boolean) => void;
  /** Folded state, owned by BrandingSection alongside its other sections —
   *  see SettingsAccordion.tsx. */
  open: boolean;
  onToggle: () => void;
}) {
  const [previewPhase, setPreviewPhase] = useState<PreviewPhase>("idle");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  // Continuous replay. Worth having because the splash is a ~2-second event
  // and most of what is tuned here (tagline colours, the glow, a font size)
  // is only judged *while* it plays — without this an admin re-clicks Replay
  // after every single nudge of a slider.
  const [loopPreview, setLoopPreview] = useState(false);

  // Preview-only, not persisted — lets an admin sanity-check an effect
  // against a lighter "page" than the near-black default without touching
  // anything live. See the placeholder backdrop in the Preview box below.
  const [previewBrightness, setPreviewBrightness] = useState(20);
  // Which shape the preview is drawn at. Preview-only and not persisted — it
  // is a way of looking at the splash, not a property of it. The public splash
  // decides this from the real viewport width (see IntroSplashContent's
  // IntroViewport); here it has to be a switch, because the preview is a box a
  // few hundred pixels wide sitting on a desktop page, and a media query would
  // answer for the admin's monitor rather than for the phone being previewed.
  const [previewViewport, setPreviewViewport] = useState<"desktop" | "mobile">("desktop");

  // The phone preview draws at a real handset's CSS width and is then scaled
  // down to whatever the frame is, rather than drawing at the frame's own
  // ~200px directly.
  //
  // That difference is the whole "the phone preview is huge" report. CSS px
  // are absolute: a 1rem tagline is 16px whether the box around it is 390px
  // wide or 200px, so rendering into the small frame at 1:1 showed every
  // element at roughly twice its true proportion — and a font-size nudge moved
  // the text by half as much of the frame as it will move on a phone, which is
  // why the slider read as doing nothing. Drawing at PHONE_STAGE_W and scaling
  // the finished layer means what the admin sees is the phone, shrunk.
  const phoneFrameRef = useRef<HTMLDivElement>(null);
  // 390 x 845 — an iPhone 14/15-class viewport, and 390/845 is the same 9/19.5
  // the frame itself uses, so the stage maps onto it without letterboxing.
  const PHONE_STAGE_W = 390;
  const [phoneScale, setPhoneScale] = useState(0);
  useEffect(() => {
    const el = phoneFrameRef.current;
    if (!el || previewViewport !== "mobile") return;
    const measure = () => setPhoneScale(el.clientWidth / PHONE_STAGE_W);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [previewViewport]);

  function clearTimers() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }

  function play() {
    clearTimers();
    // Restart from a blank frame even if a previous run is mid-flight, so
    // rapid re-clicks always replay the full sequence instead of skipping
    // straight to "exiting". Mounts in the "entering" (off) state first,
    // same as the real public splash — a tick later "visible" is what
    // actually triggers the transition, giving the browser something to
    // animate from instead of just painting the settled frame directly.
    setPreviewPhase("idle");
    const exitMs = introExitMs(value.introSpeedMs);
    const toEnter = setTimeout(() => setPreviewPhase("entering"), 20);
    const toVisible = setTimeout(
      () => setPreviewPhase("visible"),
      20 + INTRO_ENTER_DELAY_MS
    );
    const toExit = setTimeout(
      () => setPreviewPhase("exiting"),
      20 + INTRO_ENTER_DELAY_MS + value.introSpeedMs
    );
    const toIdle = setTimeout(
      () => setPreviewPhase("idle"),
      20 + INTRO_ENTER_DELAY_MS + value.introSpeedMs + exitMs
    );
    timers.current = [toEnter, toVisible, toExit, toIdle];
  }

  // Auto-play once on mount so the card isn't a blank box before the admin
  // has touched anything.
  useEffect(() => {
    play();
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only autoplay; the Play button (or the effect/text watchers below) handles replays after that.
  }, []);

  // Replay whenever the effect or text changes, so switching options shows
  // its result immediately rather than requiring a manual click every time.
  // Speed is excluded — dragging the slider would otherwise restart the
  // preview on every pixel of movement.
  useEffect(() => {
    play();
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.introEffect, value.introText, value.introTextAbove]);

  // Loop re-arms from the *settled* state rather than from inside play()'s own
  // timer chain, which is what keeps every repeat honest: each run is started
  // by a fresh render, so a speed or colour changed mid-loop takes effect on
  // the very next pass instead of the loop replaying whatever `play` had
  // closed over when it first fired.
  useEffect(() => {
    if (!loopPreview || previewPhase !== "idle") return;
    // A beat of the bare "page" between runs, so two passes read as two
    // reveals rather than one stuttering animation.
    const t = setTimeout(play, LOOP_GAP_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loopPreview, previewPhase]);

  const disabledCls = value.introEnabled ? "" : "opacity-50 pointer-events-none";

  return (
    <SettingsAccordion
      title="Entrance Splash"
      description="A one-time reveal animation shown before the homepage appears — plays once per visitor tab."
      open={open}
      onToggle={onToggle}
      // The master switch rides in the header so it stays reachable while the
      // section is folded — turning the splash off shouldn't require opening
      // every control that configures it.
      right={
        <button
          type="button"
          onClick={() =>
            onToggleSave(
              { introEnabled: !value.introEnabled },
              "Entrance Splash",
              !value.introEnabled
            )
          }
          title={value.introEnabled ? "Disable entrance splash" : "Enable entrance splash"}
          className={`shrink-0 p-1.5 rounded-lg transition-colors ${
            value.introEnabled
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
              : "bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:bg-black/10 dark:hover:bg-white/10"
          }`}
        >
          {value.introEnabled ? <ToggleRight size={26} /> : <ToggleLeft size={26} />}
        </button>
      }
    >

      {/* Two panes, the Museum Scene Editor's arrangement: the thing being
          configured stays on screen at full size while every control lives in
          a column beside it. Before this the preview was the last block in a
          single tall column, so tuning a tagline colour meant scrolling the
          thing you were tuning off screen and scrolling back to check it.
          Stacks back to one column below `lg`, where there is no room for two. */}
      <div
        className={`grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] gap-5 lg:gap-6 transition-opacity ${disabledCls}`}
      >
        {/* Preview pane. Sticky so it holds its place against a config column
            that is taller than it — the whole point of the split. */}
        <div className="min-w-0 lg:sticky lg:top-4 lg:self-start space-y-3">
          {/* Live preview */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300">
                Preview
              </label>
              <div className="flex items-center gap-1">
                {/* Desktop / phone. Sits with Replay and Loop because it is
                    the same kind of control: how to look at the splash, not
                    what the splash is. */}
                <div className="flex items-center rounded-lg border border-black/10 dark:border-white/10 p-0.5 mr-1">
                  {([
                    { id: "desktop" as const, Icon: Monitor, label: "Desktop" },
                    { id: "mobile" as const, Icon: Smartphone, label: "Phone" },
                  ]).map(({ id, Icon, label }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setPreviewViewport(id)}
                      aria-pressed={previewViewport === id}
                      title={`Preview at ${label.toLowerCase()} size`}
                      className={`flex items-center gap-1 px-2 py-1 rounded-md font-body text-[11px] transition-colors ${
                        previewViewport === id
                          ? "bg-sepia text-white"
                          : "text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream"
                      }`}
                    >
                      <Icon size={12} />
                      <span className="hidden sm:inline">{label}</span>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={play}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg font-body text-xs text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                >
                  <Play size={12} />
                  Replay
                </button>
                <button
                  type="button"
                  onClick={() => setLoopPreview((prev) => !prev)}
                  aria-pressed={loopPreview}
                  title={loopPreview ? "Stop looping the preview" : "Loop the preview continuously"}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-lg font-body text-xs transition-colors ${
                    loopPreview
                      ? "bg-sepia text-white"
                      : "text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/5 dark:hover:bg-white/5"
                  }`}
                >
                  <Repeat size={12} />
                  Loop
                </button>
              </div>
            </div>
            {/* Sized by aspect ratio rather than the old fixed h-64: this pane
                is as wide as the card allows, and a splash judged in a
                letterbox that doesn't match a browser window's proportions
                isn't telling the admin much.

                The floor is `sm:` and nothing below it, which is the phone fix:
                a min-height on a box that also has an aspect-ratio does not
                simply make the box taller — the constrained height is fed back
                through the ratio, so 16rem of height asked for 25.6rem of
                width, and on a ~20rem-wide card the preview (and the brightness
                row under it, which the overflow widened too) ran off the right
                edge of the section. Phones get the pure ratio, which can never
                be wider than the column it's in; the floor still applies from
                `sm` up, where there is the width to honour it. `w-full` and
                `min-w-0` pin that intent rather than leaving it to inference. */}
            {/* In phone mode the box narrows to a handset's proportions and
                centres, rather than staying a 16/10 letterbox with smaller
                type in it. The shape is the point: what wraps a tagline is the
                *width* it has, so a preview that keeps desktop width and only
                shrinks the font would show a line fitting comfortably that
                then breaks on a real phone — the exact bug this is here to
                catch. 9/19.5 is roughly a modern handset; the max-width keeps
                it from towering over the config column beside it. */}
            <div
              ref={phoneFrameRef}
              className={
                previewViewport === "mobile"
                  ? "relative mx-auto w-full max-w-[13rem] min-w-0 rounded-[1.75rem] border-[6px] border-black/60 dark:border-white/15 aspect-[9/19.5] overflow-hidden transition-colors"
                  : "relative w-full min-w-0 rounded-xl border border-white/10 aspect-[16/10] sm:min-h-[16rem] overflow-hidden transition-colors"
              }
              style={{ backgroundColor: `hsl(0 0% ${previewBrightness}%)` }}
            >
              {/* In phone mode this is the handset-sized stage described up by
                  PHONE_STAGE_W: laid out at 390 CSS px and scaled down to the
                  frame from its top-left corner. In desktop mode it is an inert
                  `absolute inset-0` wrapper — no stage, no transform — so that
                  preview keeps behaving exactly as it did.

                  Held back until `phoneScale` has been measured (it starts at
                  0) so the first paint isn't a full-size 390px layer flashing
                  outside the frame before the observer catches up. */}
              <div
                className="absolute inset-0"
                style={
                  previewViewport === "mobile"
                    ? {
                        width: PHONE_STAGE_W,
                        // The frame's own ratio, expressed in stage pixels, so
                        // the scaled result lands exactly on the frame's height
                        // rather than a few px short or long.
                        height: PHONE_STAGE_W * (19.5 / 9),
                        right: "auto",
                        bottom: "auto",
                        transform: `scale(${phoneScale})`,
                        transformOrigin: "top left",
                        visibility: phoneScale > 0 ? undefined : "hidden",
                      }
                    : undefined
                }
              >
              {/* Stands in for "the page underneath" — what the splash reveals
                  once it clears, so an exited preview doesn't just look empty.
                  mix-blend-difference keeps the label legible against the
                  adjustable backdrop above instead of just against black. */}
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="font-body text-xs tracking-widest uppercase text-white mix-blend-difference">
                  Your site content
                </p>
              </div>
              {previewPhase !== "idle" && (
                <IntroSplashContent
                  effect={value.introEffect}
                  // "entering" shares "exiting"'s off-state classes — see
                  // introTransitionClasses; only "visible" differs.
                  phase={previewPhase === "visible" ? "visible" : "exiting"}
                  text={value.introText || INTRO_DEFAULTS.introText}
                  durationMs={introExitMs(value.introSpeedMs)}
                  bgColor={value.introBgColor}
                  icon={value.splashIcon}
                  textAbove={value.introTextAbove}
                  taglineFontSize={value.introTaglineFontSize}
                  taglineFontFamily={value.introTaglineFontFamily}
                  taglineColor={value.introTaglineColor}
                  taglineAboveFontSize={value.introTaglineAboveFontSize}
                  taglineAboveFontFamily={value.introTaglineAboveFontFamily}
                  taglineAboveColor={value.introTaglineAboveColor}
                  taglineFontSizeMobile={value.introTaglineFontSizeMobile}
                  taglineAboveFontSizeMobile={value.introTaglineAboveFontSizeMobile}
                  // Explicit, not "auto": this box's width has nothing to do
                  // with the viewport the media query would read.
                  viewport={previewViewport}
                  glowIntensity={value.introGlowIntensity}
                  glowColor={value.introGlowColor}
                  glowShimmer={value.introGlowShimmer}
                  glowOffsetX={value.introGlowOffsetX}
                  glowOffsetY={value.introGlowOffsetY}
                  letterColors={value.introLetterColors}
                  squidColor={value.introSquidColor}
                  // This preview is a deliberate, self-triggered demo the
                  // admin explicitly asked to see — always show full motion
                  // regardless of the OS's Reduce Motion setting, unlike the
                  // real public splash. See introTransitionClasses' doc comment.
                  forceMotion
                />
              )}
              </div>
            </div>

            {/* Preview-only aid — not saved, doesn't affect the live site.
                Raising it off 0 makes the fade/slide effects' motion and the
                split-panel effects' seam actually visible against a
                near-black splash color, instead of blending into an
                equally-dark backdrop. */}
            <div className="mt-3">
              <label
                htmlFor="preview-brightness"
                className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2"
              >
                Backdrop Brightness (preview only) —{" "}
                <span className="font-mono normal-case tracking-normal text-ink dark:text-cream">
                  {previewBrightness}%
                </span>
              </label>
              <input
                id="preview-brightness"
                type="range"
                min={0}
                max={100}
                value={previewBrightness}
                onChange={(e) => setPreviewBrightness(Number(e.target.value))}
                className="w-full accent-sepia cursor-pointer"
              />
              <p className="font-body text-[11px] text-ink-400 dark:text-ink-300 mt-1.5">
                Adjusts only this preview&apos;s stand-in backdrop, to check the
                splash against a lighter page. Nothing here is saved.
              </p>
            </div>
          </div>
        </div>

        {/* Config pane. Scrolls within itself on `lg` and up rather than
            growing the page, so the preview beside it can't be scrolled away. */}
        <div className="space-y-6 lg:max-h-[calc(100vh-9rem)] lg:overflow-y-auto lg:pr-1.5">
        {/* Effect picker */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">
            Transition Effect
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-3">
            {INTRO_EFFECTS.map((e) => (
              <button
                key={e.value}
                type="button"
                onClick={() => onChange({ introEffect: e.value })}
                className={`text-left p-3 rounded-xl border transition-all ${
                  value.introEffect === e.value
                    ? "border-sepia bg-sepia/10"
                    : "border-black/10 dark:border-white/10 hover:border-black/30 dark:hover:border-white/30"
                }`}
              >
                <p
                  className={`font-body text-sm font-medium ${
                    value.introEffect === e.value ? "text-sepia" : "text-ink dark:text-cream"
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
            htmlFor="intro-speed"
            className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2"
          >
            Transition Speed —{" "}
            <span className="font-mono normal-case tracking-normal text-ink dark:text-cream">
              {(value.introSpeedMs / 1000).toFixed(1)}s hold
            </span>
          </label>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <input
              id="intro-speed"
              type="range"
              min={MIN_INTRO_SPEED}
              max={MAX_INTRO_SPEED}
              step={100}
              value={value.introSpeedMs}
              onChange={(e) => onChange({ introSpeedMs: Number(e.target.value) })}
              onMouseUp={play}
              onTouchEnd={play}
              // min-w-0: a range input's intrinsic width (~130px) is a floor
              // for flex-1 without it, which together with the three presets
              // beside it is wider than the config column.
              className="flex-1 min-w-0 accent-sepia cursor-pointer"
            />
            <div className="flex flex-wrap gap-1 shrink-0">
              {INTRO_SPEED_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    onChange({ introSpeedMs: preset.value });
                    // Preset is a discrete click (unlike the slider drag
                    // above), so it can safely trigger the replay directly.
                    setTimeout(play, 0);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-wider border transition-all ${
                    value.introSpeedMs === preset.value
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
            How long the logo holds on screen before it clears.
          </p>
        </div>

        {/* --- The icon seal --------------------------------------------
            The splash draws the band's wordmark (Site Design → Header →
            Wordmark: the same text/font/image the header shows) with the
            splash icon as a seal above it. This is that seal's colour; the
            words themselves are cream. */}
        <div>
          <label
            htmlFor="intro-squid-color"
            className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2"
          >
            Icon Color
          </label>
          <HexColorField
            id="intro-squid-color"
            value={value.introSquidColor}
            onChange={(introSquidColor) => onChange({ introSquidColor })}
            resetTo={INTRO_DEFAULTS.introSquidColor}
          />
          <p className="font-body text-[11px] text-ink-400 dark:text-ink-300 mt-1.5">
            The icon above the band name (picked under Icons → Entrance Splash
            Icon). Its halo is drawn from this too, so both move together.
            The wordmark text itself comes from Site Design → Header.
          </p>
        </div>

        {/* Tagline above the logo — optional, and off by default */}
        <div className="rounded-xl border border-black/10 dark:border-white/10 p-4 space-y-5">
          <div>
            <label
              htmlFor="intro-text-above"
              className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2"
            >
              Tagline Above
            </label>
            <input
              id="intro-text-above"
              type="text"
              value={value.introTextAbove}
              maxLength={MAX_INTRO_TEXT_LENGTH}
              onChange={(e) => onChange({ introTextAbove: e.target.value })}
              placeholder="Collection"
              className="w-full px-4 py-2.5 rounded-xl admin-input border text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors text-sm"
            />
            <p className="font-body text-[11px] text-ink-400 dark:text-ink-300 mt-1.5">
              Sits above the SCRIPTOVERNOVEL logo, exactly as typed. Leave it empty to
              show nothing there. {value.introTextAbove.length}/
              {MAX_INTRO_TEXT_LENGTH}
            </p>
          </div>
          <TaglineFontSelect
            id="intro-tagline-above-font"
            value={value.introTaglineAboveFontFamily}
            onChange={(introTaglineAboveFontFamily) => onChange({ introTaglineAboveFontFamily })}
          />
          {/* Back to one column at `lg`, where the config pane becomes a fixed
              ~22rem sidebar: `sm:` keys off the viewport, not this column, so
              two columns in here were half-width cells the controls didn't
              fit — the horizontal scrollbar under the pane. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-5">
            <div className="space-y-3">
              <TaglineSizeSlider
                id="intro-tagline-above-size"
                label="Font Size"
                value={value.introTaglineAboveFontSize}
                onChange={(introTaglineAboveFontSize) => onChange({ introTaglineAboveFontSize })}
              />
              <TaglineMobileSizeField
                id="intro-tagline-above-size-mobile"
                value={value.introTaglineAboveFontSizeMobile}
                desktopValue={value.introTaglineAboveFontSize}
                onChange={(introTaglineAboveFontSizeMobile) =>
                  onChange({ introTaglineAboveFontSizeMobile })
                }
              />
            </div>
            <div>
              <label
                htmlFor="intro-tagline-above-color"
                className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2"
              >
                Text Color
              </label>
              <HexColorField
                id="intro-tagline-above-color"
                value={value.introTaglineAboveColor}
                onChange={(introTaglineAboveColor) => onChange({ introTaglineAboveColor })}
                resetTo={INTRO_DEFAULTS.introTaglineAboveColor}
              />
            </div>
          </div>
        </div>

        {/* Tagline below the logo — the original one */}
        <div className="rounded-xl border border-black/10 dark:border-white/10 p-4 space-y-5">
          <div>
            <label
              htmlFor="intro-text"
              className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2"
            >
              Tagline Bottom
            </label>
            <input
              id="intro-text"
              type="text"
              value={value.introText}
              maxLength={MAX_INTRO_TEXT_LENGTH}
              onChange={(e) => onChange({ introText: e.target.value })}
              placeholder={INTRO_DEFAULTS.introText}
              className="w-full px-4 py-2.5 rounded-xl admin-input border text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors text-sm"
            />
            <p className="font-body text-[11px] text-ink-400 dark:text-ink-300 mt-1.5">
              Shown under the SCRIPTOVERNOVEL logo, exactly as typed — it&apos;s no
              longer forced to uppercase. {value.introText.length}/
              {MAX_INTRO_TEXT_LENGTH}
            </p>
          </div>
          <TaglineFontSelect
            id="intro-tagline-font"
            value={value.introTaglineFontFamily}
            onChange={(introTaglineFontFamily) => onChange({ introTaglineFontFamily })}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-5">
            <TaglineSizeSlider
              id="intro-tagline-size"
              label="Font Size"
              value={value.introTaglineFontSize}
              onChange={(introTaglineFontSize) => onChange({ introTaglineFontSize })}
            />
            <TaglineMobileSizeField
              id="intro-tagline-size-mobile"
              value={value.introTaglineFontSizeMobile}
              desktopValue={value.introTaglineFontSize}
              onChange={(introTaglineFontSizeMobile) => onChange({ introTaglineFontSizeMobile })}
            />
            <div>
              <label
                htmlFor="intro-tagline-color"
                className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2"
              >
                Text Color
              </label>
              <HexColorField
                id="intro-tagline-color"
                value={value.introTaglineColor}
                onChange={(introTaglineColor) => onChange({ introTaglineColor })}
                resetTo={INTRO_DEFAULTS.introTaglineColor}
              />
            </div>
          </div>
        </div>

        {/* Background color */}
        <div>
          <label
            htmlFor="intro-bg-color"
            className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2"
          >
            Splash Background Color
          </label>
          <HexColorField
            id="intro-bg-color"
            value={value.introBgColor}
            onChange={(introBgColor) => onChange({ introBgColor })}
            resetTo={INTRO_DEFAULTS.introBgColor}
          />
          <p className="font-body text-[11px] text-ink-400 dark:text-ink-300 mt-1.5">
            Fills the splash screen behind the logo. Defaults to near-black.
          </p>
        </div>

        {/* Glow / shimmer — the soft house light behind the lockup */}
        <div className="rounded-xl border border-black/10 dark:border-white/10 p-4 space-y-5">
          <div>
            <label
              htmlFor="intro-glow"
              className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2"
            >
              Glow Intensity —{" "}
              <span className="font-mono normal-case tracking-normal text-ink dark:text-cream">
                {value.introGlowIntensity === 0 ? "off" : `${value.introGlowIntensity}%`}
              </span>
            </label>
            <input
              id="intro-glow"
              type="range"
              min={MIN_INTRO_GLOW}
              max={MAX_INTRO_GLOW}
              value={value.introGlowIntensity}
              onChange={(e) => onChange({ introGlowIntensity: Number(e.target.value) })}
              className="w-full accent-sepia cursor-pointer"
            />
            <p className="font-body text-[11px] text-ink-400 dark:text-ink-300 mt-1.5">
              A soft light behind the logo, brightest at the centre and fading
              out to nothing. At 0 nothing is drawn at all.
            </p>
          </div>

          {/* Position. Sits on the lockup's centre by default; these move it
              off that centre for splashes where the light should read as
              coming from one side. */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300">
                Glow Position
              </p>
              {(value.introGlowOffsetX !== 0 || value.introGlowOffsetY !== 0) && (
                <button
                  type="button"
                  onClick={() => onChange({ introGlowOffsetX: 0, introGlowOffsetY: 0 })}
                  className="font-body text-xs text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream transition-colors"
                >
                  Recentre
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
              <GlowOffsetSlider
                id="intro-glow-offset-x"
                label="Horizontal"
                hint="Left / right"
                value={value.introGlowOffsetX}
                onChange={(introGlowOffsetX) => onChange({ introGlowOffsetX })}
              />
              <GlowOffsetSlider
                id="intro-glow-offset-y"
                label="Vertical"
                hint="Up / down"
                value={value.introGlowOffsetY}
                onChange={(introGlowOffsetY) => onChange({ introGlowOffsetY })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-5">
            <div>
              <label
                htmlFor="intro-glow-color"
                className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2"
              >
                Glow Color
              </label>
              <HexColorField
                id="intro-glow-color"
                value={value.introGlowColor}
                onChange={(introGlowColor) => onChange({ introGlowColor })}
                resetTo={INTRO_DEFAULTS.introGlowColor}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">
                Shimmer
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={value.introGlowShimmer}
                  onClick={() =>
                    onToggleSave(
                      { introGlowShimmer: !value.introGlowShimmer },
                      "Glow Shimmer",
                      !value.introGlowShimmer
                    )
                  }
                  className={`shrink-0 p-1.5 rounded-lg transition-colors ${
                    value.introGlowShimmer
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300"
                  }`}
                >
                  {value.introGlowShimmer ? <ToggleRight size={26} /> : <ToggleLeft size={26} />}
                </button>
                <p className="font-body text-[11px] text-ink-400 dark:text-ink-300">
                  Breathes the glow slowly in and out instead of holding it
                  steady. Respects Reduce Motion.
                </p>
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>
    </SettingsAccordion>
  );
}
