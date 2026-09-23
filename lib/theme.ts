// lib/theme.ts
//
// Single source of truth for the admin-configurable public theme:
// the TypeScript shape, defaults (mirroring the Prisma column defaults),
// the curated font choices, and the validators used to keep raw values
// out of the CSS injected by PublicThemeStyle.

export interface SiteThemeSettings {
  btnPrimaryColor: string;
  btnSecondaryColor: string;
  btnHoverColor: string;
  scrollbarTrackColor: string;
  scrollbarThumbColor: string;
  fontFamily: string;
  fontSizeBase: string;
  fontSizeHeading: string;
  fontSizeBody: string;
  // Desktop-only cursor glow trail (components/public/CursorGlow.tsx). Fixed
  // at exactly 4 colors — it drives a 4-stop CSS keyframe cycle
  // (0/25/50/75%), not a variable-length hover palette like
  // sidebarIconColors, so the count isn't admin-editable, just the hues.
  cursorGlowEnabled: boolean;
  cursorGlowColors: string[];
  // Per-mode "wash" tint — the frosted overlay (.page-glass in globals.css)
  // that sits over the background photo — plus a brightness multiplier for
  // that same photo (html::before's filter). Together these are the site's
  // whole color mood per mode, VS-Code-preset-picker style, without needing
  // to touch every individual card/surface color across the codebase.
  // PublicThemeStyle/AdminThemeStyle each emit these as mode-conditional CSS
  // vars (:root for light, .dark for dark) — which of the two components
  // actually applies them is gated per-mode by *WashScope below.
  darkWashColor: string;
  darkBrightness: number;
  lightWashColor: string;
  lightBrightness: number;
  // Where each mode's wash actually renders — the public site, the admin
  // dashboard (+ login/reset-password, which share the same root layout),
  // or both. Independent per mode since an admin may want a bold "Dark
  // Blue" only on the public site while leaving their own dashboard alone,
  // or vice versa.
  darkWashScope: WashScope;
  lightWashScope: WashScope;
  // Backdrop-filter blur radius for the public background photo's frosted
  // glass overlay (.page-glass in globals.css) — a CSS length like the
  // fontSize* fields above (validated the same way, via isValidThemeLength),
  // not mode-conditional like the wash color/brightness since blur strength
  // doesn't need a separate light/dark value.
  bgBlur: string;
  // Motion on the public background photo itself (html::before) — one of
  // BG_EFFECTS below, plus the loop length for the ones that loop. Applied by
  // PublicThemeStyle as a plain `animation:` on that pseudo-element (and, for
  // "parallax", a scroll-driven transform fed by BackgroundParallax.tsx), so
  // like bgBlur it is mode-independent and public-only.
  bgEffect: BgEffect;
  bgEffectSpeedMs: number;
  // Same idea, for the admin dashboard's own background photo
  // (adminBackgroundImage below, on .admin-shell) — independent knob since
  // an admin may want their own dashboard crisp while the public site is
  // frosted, or vice versa.
  adminBgBlur: string;
  // Admin-dashboard-only surface colors — no public-site counterpart and no
  // scope selector (unlike the wash colors above, these only ever apply
  // within /admin). AdminThemeStyle emits these as CSS vars consumed by
  // app/globals.css's .admin-card/.admin-modal/.admin-input classes.
  // Profile's adminBackgroundImage sibling deliberately isn't here — see
  // app/api/theme/route.ts's PUT handler for why.
  adminCardBgLight: string;
  adminCardBgDark: string;
  adminModalBgLight: string;
  adminModalBgDark: string;
  adminInputBgLight: string;
  adminInputBgDark: string;
}

export type WashScope = "public" | "admin" | "both";

// Site Background Effects — what the background photo does behind the page.
// Same card-picker language as the Entrance Splash's INTRO_EFFECTS
// (lib/intro-splash.ts); the CSS for each lives under `html::before` in
// app/globals.css, keyed by the value here.
export const BG_EFFECTS = [
  { value: "none", label: "Still", description: "The photo just sits there — no motion at all." },
  { value: "zoom", label: "Slow Zoom", description: "A gentle Ken Burns push in and back out, on a loop." },
  { value: "drift", label: "Drift", description: "Pans slowly across the photo and back, like a slow camera slide." },
  { value: "breathe", label: "Breathe", description: "The photo's brightness swells and fades, like slow breathing." },
  { value: "parallax", label: "Parallax", description: "Moves with the page as the visitor scrolls, a little slower than the content." },
] as const;
export type BgEffect = (typeof BG_EFFECTS)[number]["value"];
const BG_EFFECT_VALUES = BG_EFFECTS.map((e) => e.value);

/** Whether an effect's speed slider means anything — "none" has no motion
 *  and "parallax" is driven by the visitor's own scrolling, not a clock. */
export function bgEffectLoops(effect: BgEffect): boolean {
  return effect === "zoom" || effect === "drift" || effect === "breathe";
}

/**
 * The CSS that plays a background effect on a full-bleed photo layer —
 * html::before on the public site (PublicThemeStyle turns this into a rule),
 * the preview's own image div in the admin (applied as inline style). The
 * @keyframes named here are in app/globals.css. Parallax reads
 * `--bg-parallax` (0 at the top of the page, 1 at the bottom — set by
 * BackgroundParallax.tsx, or by the preview from its own scroll box): the
 * photo is overscaled by 25% and slides from its top edge to its bottom edge
 * across that range, so it always covers the viewport however long the page.
 * The slide is in % of the layer's own height (not vh) so the same rule is
 * right on the full-viewport html::before and inside the admin's preview box.
 */
export function bgEffectCss(
  effect: BgEffect,
  speedMs: number
): { animation?: string; transform?: string; willChange?: string } {
  if (effect === "parallax") {
    return {
      transform: "translateY(calc(12.5% - var(--bg-parallax, 0) * 25%)) scale(1.25)",
      willChange: "transform",
    };
  }
  if (!bgEffectLoops(effect)) return {};
  return {
    animation: `bg-effect-${effect} ${speedMs}ms ease-in-out infinite alternate`,
    willChange: effect === "breathe" ? "filter" : "transform",
  };
}

/** Milliseconds one full loop of a looping effect takes. */
export const BG_EFFECT_SPEED_PRESETS = [
  { label: "Slow", value: 30000 },
  { label: "Normal", value: 20000 },
  { label: "Fast", value: 10000 },
] as const;
export const MIN_BG_EFFECT_SPEED = 5000;
export const MAX_BG_EFFECT_SPEED = 60000;

// Matches the current hard-coded look of app/(public) exactly, so a site
// with no SiteTheme row yet (or an admin who hasn't customized anything)
// renders identically to before this feature existed.
export const DEFAULT_SITE_THEME: SiteThemeSettings = {
  btnPrimaryColor: "#E8D5A8",
  btnSecondaryColor: "#E8D5A8",
  btnHoverColor: "#C8A96E",
  scrollbarTrackColor: "transparent",
  scrollbarThumbColor: "#C8A96E",
  fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
  fontSizeBase: "16px",
  fontSizeHeading: "2rem",
  fontSizeBody: "1rem",
  cursorGlowEnabled: true,
  cursorGlowColors: ["#FFE135", "#44D700", "#5BC8F5", "#FF6B9D"],
  // Mirrors the .page-glass / html::before defaults hardcoded in
  // globals.css exactly, so an un-customized site (or one saved with these
  // untouched) renders pixel-identical to before this feature existed.
  darkWashColor: "rgba(6, 6, 10, 0.72)",
  darkBrightness: 90,
  lightWashColor: "rgba(151, 150, 150, 0.54)",
  lightBrightness: 90,
  // Public-only by default — matches the original behavior of this feature
  // before the scope selector existed, so existing saved themes (which
  // predate these two columns) don't suddenly start reskinning the admin
  // dashboard on their next load.
  darkWashScope: "public",
  lightWashScope: "public",
  // Mirrors .page-glass's previously-hardcoded blur(10px) exactly.
  bgBlur: "10px",
  // Still by default — an existing site's background doesn't start moving
  // until an admin picks an effect.
  bgEffect: "none",
  bgEffectSpeedMs: 20000,
  // No admin background blur/glass existed before this field — "0px" keeps
  // an unconfigured (or pre-existing) admin background exactly as sharp as
  // it's always been.
  adminBgBlur: "0px",
  // Mirrors today's hardcoded .admin-card/.admin-modal/.admin-input look
  // exactly (bg-white dark:bg-black/40, bg-white dark:bg-ink-900, and
  // bg-black/5 dark:bg-white/5 respectively) so an unconfigured site
  // renders pixel-identical to before this feature existed.
  adminCardBgLight: "#FFFFFF",
  adminCardBgDark: "rgba(0, 0, 0, 0.4)",
  adminModalBgLight: "#FFFFFF",
  adminModalBgDark: "#0D0D0D",
  adminInputBgLight: "rgba(0, 0, 0, 0.05)",
  adminInputBgDark: "rgba(255, 255, 255, 0.05)",
};

export const CURSOR_GLOW_COLOR_COUNT = 4;

// Curated starting points for the wash-color pickers, VS Code's theme-picker
// style — each just seeds the two underlying fields (still freely editable
// after) rather than being its own persisted concept, so no schema/validator
// changes were needed beyond the two fields above.
export interface WashPreset {
  name: string;
  washColor: string;
  brightness: number;
}

export const DARK_WASH_PRESETS: WashPreset[] = [
  { name: "Signature (default)", washColor: "rgba(6, 6, 10, 0.72)", brightness: 90 },
  { name: "GitHub Dark", washColor: "rgba(13, 17, 23, 0.78)", brightness: 88 },
  { name: "Dark Blue", washColor: "rgba(10, 25, 47, 0.75)", brightness: 88 },
  { name: "Midnight Purple", washColor: "rgba(21, 15, 36, 0.75)", brightness: 85 },
  { name: "Forest", washColor: "rgba(9, 26, 20, 0.75)", brightness: 88 },
];

export const LIGHT_WASH_PRESETS: WashPreset[] = [
  { name: "Signature (default)", washColor: "rgba(151, 150, 150, 0.54)", brightness: 90 },
  { name: "GitHub Light", washColor: "rgba(246, 248, 250, 0.55)", brightness: 100 },
  { name: "Warm Paper", washColor: "rgba(240, 233, 220, 0.50)", brightness: 95 },
  { name: "Cool Sky", washColor: "rgba(228, 237, 245, 0.50)", brightness: 100 },
];

export const MIN_WASH_BRIGHTNESS = 50;
export const MAX_WASH_BRIGHTNESS = 150;

// Blur/glass intensity meter (bgBlur / adminBgBlur) — a plain px range
// rather than a mode-conditional preset like the wash colors above, since
// "how frosted" doesn't need a separate light/dark answer. Stored as a
// length string ("10px") so it reuses isValidThemeLength below instead of
// its own validator; these helpers just convert to/from the slider's number.
export const MIN_BG_BLUR = 0;
export const MAX_BG_BLUR = 24;

export interface BlurPreset {
  name: string;
  px: number;
}

// "Heavy" (18px) used to sit at the end of this list and read as broken: the
// slider runs to MAX_BG_BLUR (24), so from the top of the range the chip that
// sounds like the strongest setting *lowered* the blur, and at 24 no chip was
// highlighted at all. Removed rather than re-pointed at the maximum — the
// slider is already the way to go past Frosted, and a preset whose whole job
// is "the end of the slider" earns nothing.
export const BG_BLUR_PRESETS: BlurPreset[] = [
  { name: "None", px: 0 },
  { name: "Subtle", px: 6 },
  { name: "Frosted (default)", px: 10 },
];

/** "10px" -> 10; anything unparsable/out-of-range falls back to 0. */
export function parseBlurPx(value: string): number {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n)) return 0;
  return Math.min(MAX_BG_BLUR, Math.max(MIN_BG_BLUR, n));
}

/** 10 -> "10px" */
export function formatBlurPx(px: number): string {
  return `${Math.min(MAX_BG_BLUR, Math.max(MIN_BG_BLUR, Math.round(px)))}px`;
}

// Fonts already loaded site-wide (next/font variables in app/layout.tsx,
// or @font-face declarations in app/globals.css) — kept to a fixed list so
// the picker never references a font that isn't actually available, and so
// the stored value never needs to be treated as free-form CSS text.
export const THEME_FONT_OPTIONS: { label: string; value: string }[] = [
  { label: "DM Sans (default)", value: "var(--font-dm-sans), system-ui, sans-serif" },
  { label: "Cormorant Garamond (serif)", value: "var(--font-cormorant), Georgia, serif" },
  { label: "Space Grotesk", value: "var(--font-space-grotesk), system-ui, sans-serif" },
  { label: "Plus Jakarta Sans", value: "var(--font-plus-jakarta), system-ui, sans-serif" },
  { label: "Anime Ace", value: '"AnimeAce", serif' },
  { label: "BadaBoom BB", value: '"BadaBoomBB", serif' },
  // Display serifs + handwriting added for the Site Design module (menu
  // overlay / hero / header wordmark) — loaded in app/layout.tsx like the
  // rest, so they're just as safe to offer everywhere this list is used.
  { label: "Playfair Display (display serif)", value: "var(--font-playfair), Georgia, serif" },
  { label: "Bodoni Moda (display serif)", value: "var(--font-bodoni), Georgia, serif" },
  { label: "Fraunces (display serif)", value: "var(--font-fraunces), Georgia, serif" },
  { label: "Caveat (handwriting)", value: "var(--font-caveat), cursive" },
];

const COLOR_RE =
  /^(transparent|#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})|rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*(?:,\s*[\d.]+\s*)?\))$/;
const LENGTH_RE = /^\d{1,3}(?:\.\d{1,2})?(?:px|rem|em)$/;
const FONT_VALUES = new Set(THEME_FONT_OPTIONS.map((f) => f.value));

export function isValidThemeColor(value: unknown): value is string {
  return typeof value === "string" && value.length <= 64 && COLOR_RE.test(value.trim());
}

export function isValidThemeLength(value: unknown): value is string {
  return typeof value === "string" && LENGTH_RE.test(value.trim());
}

export function isValidThemeFont(value: unknown): value is string {
  return typeof value === "string" && FONT_VALUES.has(value);
}

export function isValidCursorGlowColors(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length === CURSOR_GLOW_COLOR_COUNT &&
    value.every((v) => isValidThemeColor(v))
  );
}

export function isValidWashBrightness(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= MIN_WASH_BRIGHTNESS &&
    value <= MAX_WASH_BRIGHTNESS
  );
}

export function isValidBgEffect(value: unknown): value is BgEffect {
  return typeof value === "string" && (BG_EFFECT_VALUES as readonly string[]).includes(value);
}

export function isValidBgEffectSpeed(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= MIN_BG_EFFECT_SPEED &&
    value <= MAX_BG_EFFECT_SPEED
  );
}

const WASH_SCOPES: WashScope[] = ["public", "admin", "both"];

export function isValidWashScope(value: unknown): value is WashScope {
  return typeof value === "string" && WASH_SCOPES.includes(value as WashScope);
}

/** Whether a mode's wash scope setting should render for a given rendering
 * context — "both" always does, otherwise the two must match exactly.
 * Exported for AdminThemeStyle's --admin-shell-wash, which needs the same
 * scope check outside of buildWashDeclarations' --theme-wash output (see
 * that var's comment there for why it can't just reuse --theme-wash). */
export function washScopeMatches(scope: WashScope, context: "public" | "admin"): boolean {
  return scope === "both" || scope === context;
}

/** Builds the mode-conditional wash CSS var declarations (--theme-wash,
 * --theme-bg-brightness) for one rendering context, honoring each mode's
 * independent scope. Shared by PublicThemeStyle and AdminThemeStyle so
 * the two contexts can never drift out of sync on this logic. A mode whose
 * scope excludes `context` contributes an empty string, letting globals.css's
 * own :root/.dark fallback show through unchanged instead. */
export function buildWashDeclarations(
  resolved: SiteThemeSettings,
  context: "public" | "admin"
): { root: string; dark: string } {
  const root = washScopeMatches(resolved.lightWashScope, context)
    ? `--theme-wash:${resolved.lightWashColor};--theme-bg-brightness:${resolved.lightBrightness / 100};`
    : "";
  const dark = washScopeMatches(resolved.darkWashScope, context)
    ? `--theme-wash:${resolved.darkWashColor};--theme-bg-brightness:${resolved.darkBrightness / 100};`
    : "";
  return { root, dark };
}

/** Field-by-field validation, returning only the entries safe to persist/render. */
export function sanitizeThemeInput(
  input: Partial<Record<keyof SiteThemeSettings, unknown>>
): Partial<SiteThemeSettings> {
  const out: Partial<SiteThemeSettings> = {};
  // Loop-assigns below write through this loosely-typed alias — each write
  // is guarded by its own validator immediately before it, but TypeScript
  // can't trace that through a generic `keyof` loop against a heterogeneous
  // (string | boolean | string[]) interface, so the precise `out` type
  // above is what callers see while this bypasses the loop's index-signature
  // resolution.
  const outAny = out as Record<string, unknown>;
  const colorFields: (keyof SiteThemeSettings)[] = [
    "btnPrimaryColor",
    "btnSecondaryColor",
    "btnHoverColor",
    "scrollbarTrackColor",
    "scrollbarThumbColor",
    "darkWashColor",
    "lightWashColor",
    "adminCardBgLight",
    "adminCardBgDark",
    "adminModalBgLight",
    "adminModalBgDark",
    "adminInputBgLight",
    "adminInputBgDark",
  ];
  const lengthFields: (keyof SiteThemeSettings)[] = [
    "fontSizeBase",
    "fontSizeHeading",
    "fontSizeBody",
    "bgBlur",
    "adminBgBlur",
  ];
  const brightnessFields: (keyof SiteThemeSettings)[] = [
    "darkBrightness",
    "lightBrightness",
  ];

  for (const field of colorFields) {
    if (field in input && isValidThemeColor(input[field])) outAny[field] = input[field];
  }
  for (const field of lengthFields) {
    if (field in input && isValidThemeLength(input[field])) outAny[field] = input[field];
  }
  for (const field of brightnessFields) {
    if (field in input && isValidWashBrightness(input[field])) outAny[field] = input[field];
  }
  const scopeFields: (keyof SiteThemeSettings)[] = ["darkWashScope", "lightWashScope"];
  for (const field of scopeFields) {
    if (field in input && isValidWashScope(input[field])) outAny[field] = input[field];
  }
  if ("fontFamily" in input && isValidThemeFont(input.fontFamily)) {
    out.fontFamily = input.fontFamily as string;
  }
  if ("cursorGlowEnabled" in input && typeof input.cursorGlowEnabled === "boolean") {
    out.cursorGlowEnabled = input.cursorGlowEnabled;
  }
  if ("cursorGlowColors" in input && isValidCursorGlowColors(input.cursorGlowColors)) {
    out.cursorGlowColors = input.cursorGlowColors;
  }
  if ("bgEffect" in input && isValidBgEffect(input.bgEffect)) {
    out.bgEffect = input.bgEffect;
  }
  if ("bgEffectSpeedMs" in input && isValidBgEffectSpeed(input.bgEffectSpeedMs)) {
    out.bgEffectSpeedMs = input.bgEffectSpeedMs;
  }
  return out;
}

/** Merges a partial/nullable DB record over the defaults, dropping anything invalid. */
export function resolveSiteTheme(
  record: Partial<Record<keyof SiteThemeSettings, unknown>> | null | undefined
): SiteThemeSettings {
  return { ...DEFAULT_SITE_THEME, ...sanitizeThemeInput(record ?? {}) };
}
