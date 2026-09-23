// lib/intro-splash.ts
//
// Single source of truth for the public homepage's entrance splash
// (Profile.introEnabled/introEffect/introSpeedMs/introText) — shared by the
// admin Branding form's live preview, the public IntroSplash component, and
// the /api/profile route's sanitizer, so all three can never drift apart.
// Mirrors the shape of lib/gallery-carousel.ts on purpose — same
// "admin-tunable animation" feature category, same pattern.
import { THEME_FONT_OPTIONS, isValidThemeFont, isValidThemeLength } from "@/lib/theme";

export const INTRO_EFFECTS = [
  {
    value: "fade",
    label: "Fade",
    description: "A plain crossfade — no movement at all.",
  },
  {
    value: "slide-up",
    label: "Slide Up",
    description: "Slides down into place, then rises back up and off to clear.",
  },
  {
    value: "slide-down",
    label: "Slide Down",
    description: "Slides up into place, then drops back down and off to clear.",
  },
  {
    value: "portrait-half",
    label: "Portrait Half",
    description:
      "Two panels seal shut top and bottom, then split vertically apart to clear.",
  },
  {
    value: "landscape-half",
    label: "Landscape Half",
    description:
      "Two panels seal shut left and right, then split horizontally apart to clear.",
  },
] as const;

export type IntroEffect = (typeof INTRO_EFFECTS)[number]["value"];
const INTRO_EFFECT_VALUES = INTRO_EFFECTS.map((e) => e.value);

/** Milliseconds the splash holds before it starts clearing. */
export const INTRO_SPEED_PRESETS = [
  { label: "Slow", value: 2200 },
  { label: "Normal", value: 1400 },
  { label: "Fast", value: 800 },
] as const;

export const MIN_INTRO_SPEED = 500;
export const MAX_INTRO_SPEED = 3000;
export const MAX_INTRO_TEXT_LENGTH = 60;

// Curated starting points for the tagline's font size — still freely
// editable after via the admin's own size field, same "preset seeds a
// free-form field" idea as ThemeSection.tsx's WashPresetPicker.
export const INTRO_TAGLINE_SIZE_PRESETS = [
  { label: "Small", value: "0.65rem" },
  { label: "Default", value: "0.75rem" },
  { label: "Large", value: "0.95rem" },
  { label: "XL", value: "1.125rem" },
] as const;

// Font family reuses SiteTheme's own curated list (lib/theme.ts) rather than
// a second catalog — every option there is already loaded site-wide. Per-line,
// like size and color: the two taglines usually play different roles (a small
// caps label above, the house line below), and pairing families is a normal
// typographic choice rather than the mistake this was once assumed to be.
export const INTRO_TAGLINE_FONT_OPTIONS = THEME_FONT_OPTIONS;

// The size sliders' range, in rem. Storage stays a CSS length string (see
// taglineLengthFromRem below) so it keeps reusing isValidThemeLength and the
// presets above keep being valid values rather than a parallel format.
export const MIN_INTRO_TAGLINE_REM = 0.5;
export const MAX_INTRO_TAGLINE_REM = 3;
export const INTRO_TAGLINE_REM_STEP = 0.05;

/** rem → the stored length string. Two decimals max, which is exactly what
 *  isValidThemeLength accepts. */
export function taglineLengthFromRem(rem: number): string {
  const clamped = Math.min(MAX_INTRO_TAGLINE_REM, Math.max(MIN_INTRO_TAGLINE_REM, rem));
  return `${Number(clamped.toFixed(2))}rem`;
}

/**
 * The stored length string → the slider's number.
 *
 * px and em are accepted by isValidThemeLength too, so a value that isn't rem
 * (a preset from an older build, or a hand-typed one) is converted rather than
 * thrown away: px at the CSS default of 16px to the rem, em 1:1 with rem since
 * the tagline's parent carries no font-size of its own. Anything unparseable
 * falls back, so the slider always has a real position to sit at.
 */
export function taglineRemFromLength(value: string | undefined, fallback: number): number {
  const match = /^(\d{1,3}(?:\.\d{1,2})?)(px|rem|em)$/.exec((value ?? "").trim());
  if (!match) return fallback;
  const n = parseFloat(match[1]);
  if (!Number.isFinite(n)) return fallback;
  const rem = match[2] === "px" ? n / 16 : n;
  return Math.min(MAX_INTRO_TAGLINE_REM, Math.max(MIN_INTRO_TAGLINE_REM, rem));
}

/**
 * The SCRIPT/N(squid)VEL lockup's three coloured words, in the order they are
 * drawn — colour is per word, not per letter (the N and "vel" around the
 * icon both wear NOVEL's). Hard-coded in the wordmark's markup before this existed — lifted out
 * so the admin's own picker can show the real colours rather than a
 * hand-copied set that quietly drifts from them.
 *
 * The colours themselves are not admin-editable: they are the brand's, and
 * the same three appear on the footer wordmark. What *is* editable is whether
 * they only show on hover.
 */
export const INTRO_LETTER_COLORS = [
  { syllable: "Script", color: "#FFD700" }, // yellow gold
  { syllable: "/", color: "#9A9A9A" }, // grey
  { syllable: "Novel", color: "#F5F1E8" }, // off-white
] as const;

/**
 * "hover" — each syllable takes its colour only while the pointer is over it,
 * which is how the splash has always behaved. "always" — every syllable wears
 * its colour for the whole splash.
 *
 * Hover is the default, so nothing changes for an existing splash. It is also
 * an effect a touch visitor can never see: a phone has no pointer to hover
 * with, and the splash is gone in about a second and a half either way, so on
 * mobile the coloured wordmark simply never happened. That is what "always"
 * is for.
 */
export type IntroLetterColors = "hover" | "always";
export const INTRO_LETTER_COLOR_MODES: IntroLetterColors[] = ["hover", "always"];

export function sanitizeIntroLetterColors(value: unknown): IntroLetterColors {
  return typeof value === "string" && (INTRO_LETTER_COLOR_MODES as string[]).includes(value)
    ? (value as IntroLetterColors)
    : "hover";
}

export const INTRO_DEFAULTS = {
  introEnabled: true,
  introEffect: "fade" as IntroEffect,
  introSpeedMs: 1400,
  introText: "Shoegaze · Dreampop · Math rock · Post-rock",
  // Empty on purpose: the line above the logo is opt-in, so an existing splash
  // looks exactly as it did until an admin types something into it.
  introTextAbove: "",
  // Same value as the `ink` Tailwind color (#0D0D0D) — the splash's
  // historical, hardcoded backdrop before this became admin-tunable.
  introBgColor: "#0D0D0D",
  introTaglineFontSize: "0.75rem",
  introTaglineFontFamily: "var(--font-dm-sans), system-ui, sans-serif",
  // --sepia-light from globals.css — the hex behind the `text-sepia-light/80`
  // the tagline was hardcoded to before the color became admin-tunable.
  introTaglineColor: "#E8D5A8",
  introTaglineAboveFontSize: "0.75rem",
  introTaglineAboveColor: "#E8D5A8",
  introTaglineAboveFontFamily: "var(--font-dm-sans), system-ui, sans-serif",
  // Null = "follow the desktop size". See the schema comment on these columns
  // for why size is the only thing that gets a phone-specific value.
  introTaglineFontSizeMobile: null as string | null,
  introTaglineAboveFontSizeMobile: null as string | null,
  // The light behind the lockup. Off by default (0), so nothing about an
  // existing splash changes until an admin reaches for the slider.
  introGlowIntensity: 0,
  introGlowColor: "#E8D5A8",
  // The squid standing in for the O in NOVEL. Off-white — the same hex NOVEL
  // wears (INTRO_LETTER_COLORS above), so the word reads as one piece
  // instead of two fragments plus a stray coloured squid, which is
  // what it inherited before this was settable at all.
  introSquidColor: "#F5F1E8",
  introGlowShimmer: true,
  // Centred on the lockup by default — the offsets exist for splashes where
  // the light should read as coming from off to one side, not to correct a
  // drift. See the glow layer in IntroSplashContent.
  introGlowOffsetX: 0,
  introGlowOffsetY: 0,
  // The wordmark's colours stay a hover effect unless an admin says otherwise
  // — see IntroLetterColors above for why the alternative exists.
  introLetterColors: "hover" as IntroLetterColors,
};

/** The glow slider's range, as a percentage — it's the radial gradient's alpha
 *  at its centre, so the units are already the thing being tuned. */
export const MIN_INTRO_GLOW = 0;
export const MAX_INTRO_GLOW = 100;

/** Glow position, as a percentage of the lockup's own box away from centre.
 *  ±50 puts the light's centre at the lockup's edge, which is as far as it can
 *  travel and still read as lighting the logo rather than as a stray blob. */
export const MIN_INTRO_GLOW_OFFSET = -50;
export const MAX_INTRO_GLOW_OFFSET = 50;

export function clampIntroGlowIntensity(value: unknown): number {
  const n = typeof value === "number" ? value : parseInt(String(value), 10);
  if (!Number.isFinite(n)) return INTRO_DEFAULTS.introGlowIntensity;
  return Math.min(MAX_INTRO_GLOW, Math.max(MIN_INTRO_GLOW, Math.round(n)));
}

/** Shared by both axes — they have the same range and the same units. */
export function clampIntroGlowOffset(value: unknown): number {
  const n = typeof value === "number" ? value : parseInt(String(value), 10);
  if (!Number.isFinite(n)) return 0;
  return Math.min(MAX_INTRO_GLOW_OFFSET, Math.max(MIN_INTRO_GLOW_OFFSET, Math.round(n)));
}

export function sanitizeIntroGlowColor(value: unknown): string {
  return typeof value === "string" && isHexColor(value)
    ? value.trim()
    : INTRO_DEFAULTS.introGlowColor;
}

/**
 * The splash seal's colour — or the empty string, meaning "leave it on the
 * brand glow".
 *
 * A stored hex pins the icon to one colour, which is what this setting was
 * for. But it was *always* a hex (the default is cream), so the seal could
 * never do what the same seal does in the footer and the sidebar: drift
 * through the logo's gold / grey / white. "" is the opt-in to that, and it
 * costs no migration — the column is already a String.
 */
export function sanitizeIntroSquidColor(value: unknown): string {
  if (value === "") return "";
  return typeof value === "string" && isHexColor(value)
    ? value.trim()
    : INTRO_DEFAULTS.introSquidColor;
}

export function sanitizeIntroEffect(value: unknown): IntroEffect {
  return typeof value === "string" &&
    (INTRO_EFFECT_VALUES as string[]).includes(value)
    ? (value as IntroEffect)
    : INTRO_DEFAULTS.introEffect;
}

const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** Shared by the sanitizer below and the admin color-picker's own input validation. */
export function isHexColor(value: string): boolean {
  return HEX_COLOR_RE.test(value.trim());
}

export function sanitizeIntroBgColor(value: unknown): string {
  return typeof value === "string" && isHexColor(value)
    ? value.trim()
    : INTRO_DEFAULTS.introBgColor;
}

export function sanitizeIntroTaglineFontSize(value: unknown): string {
  return typeof value === "string" && isValidThemeLength(value.trim())
    ? value.trim()
    : INTRO_DEFAULTS.introTaglineFontSize;
}

export function sanitizeIntroTaglineAboveFontSize(value: unknown): string {
  return typeof value === "string" && isValidThemeLength(value.trim())
    ? value.trim()
    : INTRO_DEFAULTS.introTaglineAboveFontSize;
}

/**
 * A phone-only tagline size, or null to follow the desktop one.
 *
 * Null is load-bearing and distinct from "invalid": it is how an admin turns
 * the override *off*, and how every row from before this existed reads. So
 * unlike the sanitizers around it, this one never substitutes a default —
 * falling back to a size would make the override impossible to remove.
 */
export function sanitizeIntroTaglineFontSizeMobile(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  return typeof value === "string" && isValidThemeLength(value.trim()) ? value.trim() : null;
}

export function sanitizeIntroTaglineColor(value: unknown): string {
  return typeof value === "string" && isHexColor(value)
    ? value.trim()
    : INTRO_DEFAULTS.introTaglineColor;
}

export function sanitizeIntroTaglineAboveColor(value: unknown): string {
  return typeof value === "string" && isHexColor(value)
    ? value.trim()
    : INTRO_DEFAULTS.introTaglineAboveColor;
}

export function sanitizeIntroTaglineFontFamily(value: unknown): string {
  return typeof value === "string" && isValidThemeFont(value)
    ? value
    : INTRO_DEFAULTS.introTaglineFontFamily;
}

export function sanitizeIntroTaglineAboveFontFamily(value: unknown): string {
  return typeof value === "string" && isValidThemeFont(value)
    ? value
    : INTRO_DEFAULTS.introTaglineAboveFontFamily;
}

export function clampIntroSpeed(value: unknown): number {
  const n = typeof value === "number" ? value : parseInt(String(value), 10);
  if (!Number.isFinite(n)) return INTRO_DEFAULTS.introSpeedMs;
  return Math.min(MAX_INTRO_SPEED, Math.max(MIN_INTRO_SPEED, Math.round(n)));
}

export function sanitizeIntroText(value: unknown): string {
  if (typeof value !== "string") return INTRO_DEFAULTS.introText;
  const trimmed = value.trim();
  if (!trimmed) return INTRO_DEFAULTS.introText;
  return trimmed.slice(0, MAX_INTRO_TEXT_LENGTH);
}

/**
 * The line above the logo. Unlike sanitizeIntroText, empty stays empty rather
 * than falling back to a default — blank is how an admin turns this line off,
 * and substituting copy they deleted would make it impossible to remove.
 */
export function sanitizeIntroTextAbove(value: unknown): string {
  if (typeof value !== "string") return INTRO_DEFAULTS.introTextAbove;
  return value.trim().slice(0, MAX_INTRO_TEXT_LENGTH);
}

/**
 * Both IntroSplash.tsx (public) and the admin preview mount the visual in an
 * "off" state first, then flip to "visible" one tick later so the browser
 * has actually painted the off frame before the transition to visible is
 * asked to animate — flipping in the same tick as mount would just paint
 * the end state directly, with nothing to transition from.
 */
export const INTRO_ENTER_DELAY_MS = 20;

/**
 * The exit transition takes a fraction of the hold time — proportional so
 * "Speed" reads as one dial instead of two, clamped so a fast hold still
 * gets a perceptible exit and a slow hold doesn't drag one out.
 */
export function introExitMs(speedMs: number): number {
  return Math.min(900, Math.max(300, Math.round(speedMs * 0.4)));
}

type IntroPhase = "visible" | "exiting";

/**
 * Effects that render as two solid panels sealing shut / splitting apart,
 * rather than one fading/transforming box — handled by a separate branch in
 * IntroSplashContent, not by introTransitionClasses below. "landscape-half"
 * is the left/right seam; "portrait-half" is the top/bottom seam.
 */
export function introSplitOrientation(
  effect: IntroEffect
): "vertical" | "horizontal" | null {
  switch (effect) {
    case "landscape-half":
      return "vertical";
    case "portrait-half":
      return "horizontal";
    default:
      return null;
  }
}

/**
 * Tailwind class strings for each phase/effect combination on the single
 * moving backdrop+content box — the one place both the public splash and
 * the admin live preview read from, so the preview can never show something
 * visitors don't actually get. Split-panel effects (see introSplitOrientation
 * above) are handled separately by their caller — this only covers the
 * effects that fit a single element.
 *
 * `forceMotion` drops the `motion-reduce:` fallback below — pass it from the
 * admin's own live preview (IntroSplashSection.tsx), which is a deliberate,
 * self-triggered demo the admin explicitly asked to see, not ambient motion.
 * Without it, an admin previewing with the OS's Reduce Motion setting on
 * would see the slide effects silently collapse to a plain opacity fade —
 * indistinguishable from "Fade" — which is exactly what was reported as a
 * bug. The real public splash always omits it, so visitors with that
 * setting on keep getting the accessibility-friendly fallback as intended.
 */
export function introTransitionClasses(
  effect: IntroEffect,
  phase: IntroPhase,
  forceMotion = false
): string {
  const exiting = phase === "exiting";
  // Appends a `motion-reduce:` fallback utility unless the caller opted out.
  const reduced = (fallbackClass: string) =>
    forceMotion ? "" : ` motion-reduce:${fallbackClass}`;
  switch (effect) {
    case "fade":
      return exiting ? "opacity-0" : "opacity-100";
    case "slide-up":
      return exiting
        ? `opacity-0 -translate-y-full${reduced("translate-y-0")}`
        : "opacity-100 translate-y-0";
    case "slide-down":
      return exiting
        ? `opacity-0 translate-y-full${reduced("translate-y-0")}`
        : "opacity-100 translate-y-0";
    default:
      // Percentage-based (10% of the box's own height), not a fixed
      // translate-y-3 (12px) — a fixed px lift reads fine in the ~256px
      // admin preview but is nearly invisible against a full viewport
      // height on the real site. Same reasoning as the zoom bump above:
      // needs to still be a visible lift by the time opacity has faded.
      return exiting
        ? `opacity-0 -translate-y-[10%]${reduced("translate-y-0")}`
        : "opacity-100 translate-y-0";
  }
}
