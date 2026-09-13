// lib/museum-splash.ts
//
// Single source of truth for the Digital Museum's room-entry splash
// (DigitalMuseum.splash*) — shown every time a visitor's walk brings them
// into a room, including re-entries (see RoomSplash.tsx). Deliberately reuses
// lib/intro-splash.ts's transition mechanics (effects, phase timing, exit
// duration) rather than re-implementing them — the two splashes are the
// same underlying animation system with different content: the site-wide
// one always shows the SCRIPT/N(squid)VEL wordmark, this one shows the room's
// own name/type icon instead. Only the defaults/sanitizers below are
// museum-specific; everything else (INTRO_EFFECTS, introTransitionClasses,
// introSplitOrientation, introExitMs, INTRO_ENTER_DELAY_MS) is imported
// straight from lib/intro-splash.ts by RoomSplash.tsx/RoomSplashContent.tsx.
import { isHexColor, type IntroEffect } from "@/lib/intro-splash";
import { THEME_FONT_OPTIONS, isValidThemeFont, isValidThemeLength } from "@/lib/theme";

export const MIN_SPLASH_SPEED = 500;
export const MAX_SPLASH_SPEED = 3000;

export const SPLASH_SPEED_PRESETS = [
  { label: "Slow", value: 2200 },
  { label: "Normal", value: 1400 },
  { label: "Fast", value: 800 },
] as const;

export const SPLASH_TAGLINE_SIZE_PRESETS = [
  { label: "Small", value: "0.65rem" },
  { label: "Default", value: "0.75rem" },
  { label: "Large", value: "0.95rem" },
  { label: "XL", value: "1.125rem" },
] as const;

// Same curated list the site-wide splash's tagline font picker uses.
export const SPLASH_TAGLINE_FONT_OPTIONS = THEME_FONT_OPTIONS;

export const MUSEUM_SPLASH_DEFAULTS = {
  splashEnabled: true,
  splashEffect: "fade" as IntroEffect,
  splashSpeedMs: 1400,
  splashBgColor: "#0D0D0D",
  splashTaglineFontSize: "0.75rem",
  splashTaglineFontFamily: "var(--font-dm-sans), system-ui, sans-serif",
  splashStyle: "full-page" as const,
  splashStyleMobile: "full-page" as const,
};

const INTRO_EFFECT_VALUES = ["fade", "slide-up", "slide-down", "portrait-half", "landscape-half"];

export function sanitizeSplashEffect(value: unknown): IntroEffect {
  return typeof value === "string" && INTRO_EFFECT_VALUES.includes(value)
    ? (value as IntroEffect)
    : MUSEUM_SPLASH_DEFAULTS.splashEffect;
}

// "full-page" — the original fullscreen reveal (RoomSplashContent.tsx).
// "side-popup" — a small card sliding in from the right edge instead
// (RoomSplashPopup.tsx). See prisma/schema.prisma's DigitalMuseum.splashStyle.
export type SplashStyle = "full-page" | "side-popup";
const SPLASH_STYLE_VALUES: SplashStyle[] = ["full-page", "side-popup"];
export const DEFAULT_SPLASH_STYLE: SplashStyle = "full-page";

export function sanitizeSplashStyle(value: unknown): SplashStyle {
  return typeof value === "string" && (SPLASH_STYLE_VALUES as string[]).includes(value)
    ? (value as SplashStyle)
    : DEFAULT_SPLASH_STYLE;
}

export function sanitizeSplashBgColor(value: unknown): string {
  return typeof value === "string" && isHexColor(value)
    ? value.trim()
    : MUSEUM_SPLASH_DEFAULTS.splashBgColor;
}

export function sanitizeSplashTaglineFontSize(value: unknown): string {
  return typeof value === "string" && isValidThemeLength(value.trim())
    ? value.trim()
    : MUSEUM_SPLASH_DEFAULTS.splashTaglineFontSize;
}

export function sanitizeSplashTaglineFontFamily(value: unknown): string {
  return typeof value === "string" && isValidThemeFont(value)
    ? value
    : MUSEUM_SPLASH_DEFAULTS.splashTaglineFontFamily;
}

export function clampSplashSpeed(value: unknown): number {
  const n = typeof value === "number" ? value : parseInt(String(value), 10);
  if (!Number.isFinite(n)) return MUSEUM_SPLASH_DEFAULTS.splashSpeedMs;
  return Math.min(MAX_SPLASH_SPEED, Math.max(MIN_SPLASH_SPEED, Math.round(n)));
}
