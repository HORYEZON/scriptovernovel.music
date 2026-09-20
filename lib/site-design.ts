// lib/site-design.ts
//
// Single source of truth for the public site's chrome — the fixed header
// (search · logo · MENU), the full-screen menu overlay it opens, and the
// homepage hero — as configured from Admin → Site Design. The TypeScript
// shape, defaults (mirroring prisma/schema.prisma's SiteDesign/SiteMenuItem
// @default()s), the curated option lists, and the validators shared by the
// /api/site-design route (on write) and resolveSiteDesign (on read).
//
// Same layout as lib/theme.ts on purpose: values here end up interpolated
// into inline styles, so nothing free-form gets through un-validated in
// either direction.
import { THEME_FONT_OPTIONS, isValidThemeColor, isValidThemeFont, isValidThemeLength } from "@/lib/theme";

// ── Settings (the singleton) ────────────────────────────────────────────────

export interface SiteDesignSettings {
  faviconImage: string | null;
  // Header
  headerLogoImage: string | null;
  headerLogoText: string;
  headerLogoFontFamily: string;
  headerLogoFontSize: string;
  headerLogoHeight: string;
  headerBgColor: string;
  headerTextColor: string;
  headerMenuLabel: string;
  headerMenuHoverBgColor: string;
  headerMenuHoverTextColor: string;
  headerMenuHoverEffect: CloseHoverEffect;
  headerShowSearch: boolean;
  headerShowWishlist: boolean;
  headerShowCart: boolean;
  headerShowReleaseNotes: boolean;
  // Menu overlay
  menuOpenEffect: MenuOpenEffect;
  menuOpenSpeedMs: number;
  menuCloseEffect: MenuOpenEffect;
  menuCloseSpeedMs: number;
  menuItemsEffect: MenuItemsEffect;
  menuItemsSpeedMs: number;
  menuFontFamily: string;
  menuFontSize: string;
  menuFontSizeMobile: string;
  menuFontWeight: FontWeight;
  menuFontStyle: FontStyle;
  menuTextTransform: TextTransform;
  menuLetterSpacing: string;
  menuLineHeight: number;
  menuTextColor: string;
  menuHoverTextColor: string;
  menuBgColor: string;
  menuImage: string | null;
  menuPanelWidth: number;
  menuCloseBgColor: string;
  menuCloseIconColor: string;
  menuCloseHoverBgColor: string;
  menuCloseHoverIconColor: string;
  menuCloseHoverEffect: CloseHoverEffect;
  menuFooterText: string;
  menuFooterHref: string;
  menuShowSocialLinks: boolean;
  // Hero
  heroEnabled: boolean;
  heroBgColor: string;
  heroBgImage: string | null;
  heroImage: string | null;
  heroImageWidth: string;
  heroHeading: string;
  heroHeadingFontFamily: string;
  heroHeadingFontSize: string;
  heroHeadingFontWeight: FontWeight;
  heroHeadingColor: string;
  heroSubheading: string;
  heroCtaLabel: string;
  heroCtaHref: string;
  heroCtaBgColor: string;
  heroCtaTextColor: string;
  heroDecorImage: string | null;
  heroDecorPosition: DecorPosition;
  heroDecorWidth: string;
}

export const FONT_WEIGHT_OPTIONS = [
  { value: "400", label: "Regular" },
  { value: "500", label: "Medium" },
  { value: "600", label: "Semibold" },
  { value: "700", label: "Bold" },
  { value: "800", label: "Extra Bold" },
  { value: "900", label: "Black" },
] as const;
export type FontWeight = (typeof FONT_WEIGHT_OPTIONS)[number]["value"];
const FONT_WEIGHTS = FONT_WEIGHT_OPTIONS.map((o) => o.value);

export const FONT_STYLE_OPTIONS = [
  { value: "normal", label: "Normal" },
  { value: "italic", label: "Italic" },
] as const;
export type FontStyle = (typeof FONT_STYLE_OPTIONS)[number]["value"];
const FONT_STYLES = FONT_STYLE_OPTIONS.map((o) => o.value);

export const TEXT_TRANSFORM_OPTIONS = [
  { value: "uppercase", label: "UPPERCASE" },
  { value: "none", label: "As typed" },
  { value: "capitalize", label: "Capitalize" },
] as const;
export type TextTransform = (typeof TEXT_TRANSFORM_OPTIONS)[number]["value"];
const TEXT_TRANSFORMS = TEXT_TRANSFORM_OPTIONS.map((o) => o.value);

export const DECOR_POSITION_OPTIONS = [
  { value: "bottom-left", label: "Bottom left" },
  { value: "bottom-right", label: "Bottom right" },
  { value: "top-left", label: "Top left" },
  { value: "top-right", label: "Top right" },
] as const;
export type DecorPosition = (typeof DECOR_POSITION_OPTIONS)[number]["value"];
const DECOR_POSITIONS = DECOR_POSITION_OPTIONS.map((o) => o.value);

// How the menu overlay enters when MENU is pressed. The look of each lives
// in components/public/site-design/MenuOpenTransition.tsx.
export const MENU_OPEN_EFFECTS = [
  { value: "drop", label: "Drop", description: "The whole sheet falls in from above the viewport." },
  { value: "rise", label: "Rise", description: "Slides up from below the viewport." },
  { value: "slide-left", label: "Slide from left", description: "Sweeps in from the left edge." },
  { value: "slide-right", label: "Slide from right", description: "Sweeps in from the right edge." },
  { value: "fade", label: "Fade", description: "A plain crossfade — no movement at all." },
  { value: "zoom", label: "Zoom", description: "Settles in from slightly larger while fading up." },
  { value: "curtain", label: "Curtain", description: "Parts open from the centre, both halves at once." },
  { value: "split", label: "Split — meet in the middle", description: "The colour panel slides in from the left, the photo from the right, and they meet in the centre." },
] as const;
export type MenuOpenEffect = (typeof MENU_OPEN_EFFECTS)[number]["value"];
const MENU_OPEN_EFFECT_VALUES = MENU_OPEN_EFFECTS.map((o) => o.value);

// How it leaves when × is pressed — same values as the open effects (so one
// validator covers both) but read as exits: "drop" here means the sheet
// falls away downward, not in from above.
export const MENU_CLOSE_EFFECTS: readonly { value: MenuOpenEffect; label: string; description: string }[] = [
  { value: "drop", label: "Drop", description: "The whole sheet falls away below the viewport." },
  { value: "rise", label: "Lift", description: "Lifts up and out above the viewport." },
  { value: "slide-left", label: "Slide out left", description: "Sweeps out through the left edge." },
  { value: "slide-right", label: "Slide out right", description: "Sweeps out through the right edge." },
  { value: "fade", label: "Fade", description: "A plain crossfade — no movement at all." },
  { value: "zoom", label: "Zoom", description: "Grows slightly past the camera while fading out." },
  { value: "curtain", label: "Curtain", description: "Both halves close in to the centre." },
  { value: "split", label: "Split — part to the edges", description: "The colour panel and the photo slide back apart, out through the left and right edges." },
];

// What the × does under the cursor, on top of its hover colours.
export const CLOSE_HOVER_EFFECTS = [
  { value: "spin", label: "Spin", description: "The × turns a quarter turn." },
  { value: "grow", label: "Grow", description: "Swells a little." },
  { value: "shrink", label: "Shrink", description: "Presses in a little." },
  { value: "none", label: "None", description: "Colours only, no movement." },
] as const;
export type CloseHoverEffect = (typeof CLOSE_HOVER_EFFECTS)[number]["value"];
const CLOSE_HOVER_EFFECT_VALUES = CLOSE_HOVER_EFFECTS.map((o) => o.value);

// How the links appear once the sheet is open. "Together" variants start
// every link at once; "one by one" ones stagger them down the list.
export const MENU_ITEMS_EFFECTS = [
  { value: "fade", label: "Fade in together", description: "Every link fades up at once." },
  { value: "rise", label: "Rise together", description: "Every link fades up while lifting into place." },
  { value: "stagger-fade", label: "Fade one by one", description: "Fades in down the list, a beat apart." },
  { value: "stagger-rise", label: "Rise one by one", description: "Lifts in down the list, a beat apart." },
  { value: "none", label: "None", description: "Links are simply there when the sheet lands." },
] as const;
export type MenuItemsEffect = (typeof MENU_ITEMS_EFFECTS)[number]["value"];
const MENU_ITEMS_EFFECT_VALUES = MENU_ITEMS_EFFECTS.map((o) => o.value);

/** Milliseconds an open, close or link-entrance animation runs. */
export const MENU_OPEN_SPEED_PRESETS = [
  { label: "Slow", value: 900 },
  { label: "Normal", value: 500 },
  { label: "Fast", value: 250 },
] as const;
export const MIN_MENU_OPEN_SPEED = 100;
export const MAX_MENU_OPEN_SPEED = 2000;

// Same curated catalog the theme customizer uses — every entry is loaded
// site-wide in app/layout.tsx, so nothing here can reference a missing font.
export const SITE_DESIGN_FONT_OPTIONS = THEME_FONT_OPTIONS;

export const MIN_MENU_PANEL_WIDTH = 35;
export const MAX_MENU_PANEL_WIDTH = 70;
export const MIN_MENU_LINE_HEIGHT = 0.7;
export const MAX_MENU_LINE_HEIGHT = 1.6;
export const MAX_LABEL_LENGTH = 40;
export const MAX_TEXT_LENGTH = 120;
export const MAX_HREF_LENGTH = 500;

// Mirrors the reference design exactly: cream page, ink text, handwritten
// wordmark, a 50/50 overlay that rests near-black with white display-serif
// links and only takes a link's colour/photo/underline while it's hovered,
// and a centred hero with a pill CTA.
export const DEFAULT_SITE_DESIGN: SiteDesignSettings = {
  faviconImage: null,
  headerLogoImage: null,
  headerLogoText: "ScriptOverNovel",
  headerLogoFontFamily: "var(--font-caveat), cursive",
  headerLogoFontSize: "2rem",
  headerLogoHeight: "40px",
  headerBgColor: "#F2EFE6",
  headerTextColor: "#0D0D0D",
  headerMenuLabel: "MENU",
  headerMenuHoverBgColor: "#0D0D0D",
  headerMenuHoverTextColor: "#F2EFE6",
  headerMenuHoverEffect: "spin",
  headerShowSearch: true,
  headerShowWishlist: false,
  headerShowCart: false,
  headerShowReleaseNotes: false,

  menuOpenEffect: "drop",
  menuOpenSpeedMs: 500,
  menuCloseEffect: "drop",
  menuCloseSpeedMs: 500,
  menuItemsEffect: "fade",
  menuItemsSpeedMs: 500,
  menuFontFamily: "var(--font-playfair), Georgia, serif",
  menuFontSize: "6rem",
  menuFontSizeMobile: "3.25rem",
  menuFontWeight: "900",
  menuFontStyle: "normal",
  menuTextTransform: "uppercase",
  menuLetterSpacing: "-0.03em",
  menuLineHeight: 1,
  menuTextColor: "#FFFFFF",
  menuHoverTextColor: "#141414",
  menuBgColor: "#1C1C1C",
  menuImage: null,
  menuPanelWidth: 50,
  menuCloseBgColor: "#FFFFFF",
  menuCloseIconColor: "#0D0D0D",
  menuCloseHoverBgColor: "#141414",
  menuCloseHoverIconColor: "#FFFFFF",
  menuCloseHoverEffect: "spin",
  // Empty by default: the band has no mailing list. MenuPanel hides the
  // line when blank; an admin can still type one in.
  menuFooterText: "",
  menuFooterHref: "/contact",
  menuShowSocialLinks: true,

  heroEnabled: false,
  heroBgColor: "#F2EFE6",
  heroBgImage: null,
  heroImage: null,
  heroImageWidth: "480px",
  heroHeading: "New single out now",
  heroHeadingFontFamily: "var(--font-playfair), Georgia, serif",
  heroHeadingFontSize: "3rem",
  heroHeadingFontWeight: "700",
  heroHeadingColor: "#141414",
  heroSubheading: "",
  heroCtaLabel: "LISTEN",
  heroCtaHref: "/music",
  heroCtaBgColor: "#141414",
  heroCtaTextColor: "#FFFFFF",
  heroDecorImage: null,
  heroDecorPosition: "bottom-left",
  heroDecorWidth: "96px",
};

// ── Menu items ──────────────────────────────────────────────────────────────

export const UNDERLINE_STYLE_OPTIONS = [
  { value: "scribble", label: "Scribble", description: "A loose hand-drawn stroke, slightly bowed." },
  { value: "wave", label: "Wave", description: "A gentle S-curve through the word." },
  { value: "straight", label: "Straight", description: "One quick, level swipe." },
  { value: "arc", label: "Arc", description: "A single upward sweep, like a tick." },
  { value: "none", label: "None", description: "No underline — colour and photo only." },
] as const;
export type UnderlineStyle = (typeof UNDERLINE_STYLE_OPTIONS)[number]["value"];
const UNDERLINE_STYLES = UNDERLINE_STYLE_OPTIONS.map((o) => o.value);

export interface SiteMenuItem {
  id: string;
  label: string;
  href: string;
  bgColor: string;
  underlineColor: string;
  underlineStyle: UnderlineStyle;
  image: string | null;
  openInNewTab: boolean;
  isVisible: boolean;
  sortOrder: number;
}

// The reference's palette, one pair per row, mapped onto the band site's
// five pages. Used publicly when the SiteMenuItem table is empty (a fresh
// install), and as the admin editor's starting rows — the first save
// persists them as real rows.
export const DEFAULT_MENU_ITEMS: SiteMenuItem[] = [
  { id: "default-music", label: "Music", href: "/music", bgColor: "#F5D480", underlineColor: "#FDA063", underlineStyle: "scribble", image: null, openInNewTab: false, isVisible: true, sortOrder: 0 },
  { id: "default-store", label: "Store", href: "/shop", bgColor: "#6BC08D", underlineColor: "#F7C4C4", underlineStyle: "wave", image: null, openInNewTab: false, isVisible: true, sortOrder: 1 },
  { id: "default-videos", label: "Videos", href: "/videos", bgColor: "#F0645A", underlineColor: "#F5D480", underlineStyle: "straight", image: null, openInNewTab: false, isVisible: true, sortOrder: 2 },
  { id: "default-about", label: "About", href: "/about", bgColor: "#A6C4DA", underlineColor: "#E07BE0", underlineStyle: "scribble", image: null, openInNewTab: false, isVisible: true, sortOrder: 3 },
  { id: "default-contact", label: "Contact", href: "/contact", bgColor: "#E07BE0", underlineColor: "#5FCFC6", underlineStyle: "wave", image: null, openInNewTab: false, isVisible: true, sortOrder: 4 },
];

// Quick-pick swatches for a new row, straight from the reference (each
// panel colour with the underline colour the design paired it with).
export const MENU_COLOR_PRESETS: { name: string; bgColor: string; underlineColor: string }[] = [
  { name: "Butter", bgColor: "#F5D480", underlineColor: "#FDA063" },
  { name: "Coral", bgColor: "#F0645A", underlineColor: "#F5D480" },
  { name: "Mint", bgColor: "#6BC08D", underlineColor: "#F7C4C4" },
  { name: "Sky", bgColor: "#A6C4DA", underlineColor: "#E07BE0" },
  { name: "Orchid", bgColor: "#E07BE0", underlineColor: "#5FCFC6" },
  { name: "Aqua", bgColor: "#5FCFC6", underlineColor: "#FFFFFF" },
  { name: "Tangerine", bgColor: "#FDA063", underlineColor: "#F0645A" },
  { name: "Blush", bgColor: "#F7C4C4", underlineColor: "#6BC08D" },
];

// ── Validators ──────────────────────────────────────────────────────────────

// Letter-spacing may be negative (tight display type), which
// isValidThemeLength deliberately never allows for font sizes.
const LETTER_SPACING_RE = /^-?\d(?:\.\d{1,3})?(?:em|px)$/;
// Internal path, absolute http(s) URL, or mailto — nothing that could smuggle
// a javascript: scheme into an <a href>.
const HREF_RE = /^(\/(?!\/)[^\s]*|https?:\/\/[^\s]+|mailto:[^\s]+)$/;

export function isValidLetterSpacing(value: unknown): value is string {
  return typeof value === "string" && LETTER_SPACING_RE.test(value.trim());
}

export function isValidHref(value: unknown): value is string {
  return typeof value === "string" && value.length <= MAX_HREF_LENGTH && HREF_RE.test(value.trim());
}

export function isValidFontWeight(value: unknown): value is FontWeight {
  return typeof value === "string" && (FONT_WEIGHTS as readonly string[]).includes(value);
}

export function isValidFontStyle(value: unknown): value is FontStyle {
  return typeof value === "string" && (FONT_STYLES as readonly string[]).includes(value);
}

export function isValidTextTransform(value: unknown): value is TextTransform {
  return typeof value === "string" && (TEXT_TRANSFORMS as readonly string[]).includes(value);
}

export function isValidDecorPosition(value: unknown): value is DecorPosition {
  return typeof value === "string" && (DECOR_POSITIONS as readonly string[]).includes(value);
}

export function isValidUnderlineStyle(value: unknown): value is UnderlineStyle {
  return typeof value === "string" && (UNDERLINE_STYLES as readonly string[]).includes(value);
}

export function isValidCloseHoverEffect(value: unknown): value is CloseHoverEffect {
  return typeof value === "string" && (CLOSE_HOVER_EFFECT_VALUES as readonly string[]).includes(value);
}

export function isValidMenuItemsEffect(value: unknown): value is MenuItemsEffect {
  return typeof value === "string" && (MENU_ITEMS_EFFECT_VALUES as readonly string[]).includes(value);
}

export function isValidMenuOpenEffect(value: unknown): value is MenuOpenEffect {
  return typeof value === "string" && (MENU_OPEN_EFFECT_VALUES as readonly string[]).includes(value);
}

export function isValidMenuOpenSpeed(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= MIN_MENU_OPEN_SPEED &&
    value <= MAX_MENU_OPEN_SPEED
  );
}

export function isValidPanelWidth(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= MIN_MENU_PANEL_WIDTH &&
    value <= MAX_MENU_PANEL_WIDTH
  );
}

export function isValidLineHeight(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= MIN_MENU_LINE_HEIGHT &&
    value <= MAX_MENU_LINE_HEIGHT
  );
}

function isText(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length <= max;
}

/** Uploaded-image URLs are passed through like Profile.logoImage — a URL,
 *  not a themed value, so "present and a string" is the whole check. Empty
 *  string and null both mean "unset". */
function imageOrNull(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  return typeof value === "string" && value.length <= 2000 ? value : undefined;
}

const COLOR_FIELDS = [
  "headerBgColor",
  "headerTextColor",
  "headerMenuHoverBgColor",
  "headerMenuHoverTextColor",
  "menuTextColor",
  "menuHoverTextColor",
  "menuBgColor",
  "menuCloseBgColor",
  "menuCloseIconColor",
  "menuCloseHoverBgColor",
  "menuCloseHoverIconColor",
  "heroBgColor",
  "heroHeadingColor",
  "heroCtaBgColor",
  "heroCtaTextColor",
] as const satisfies readonly (keyof SiteDesignSettings)[];

const LENGTH_FIELDS = [
  "headerLogoFontSize",
  "headerLogoHeight",
  "menuFontSize",
  "menuFontSizeMobile",
  "heroImageWidth",
  "heroHeadingFontSize",
  "heroDecorWidth",
] as const satisfies readonly (keyof SiteDesignSettings)[];

const FONT_FIELDS = ["headerLogoFontFamily", "menuFontFamily", "heroHeadingFontFamily"] as const satisfies readonly (keyof SiteDesignSettings)[];

const IMAGE_FIELDS = ["faviconImage", "headerLogoImage", "menuImage", "heroBgImage", "heroImage", "heroDecorImage"] as const satisfies readonly (keyof SiteDesignSettings)[];

const BOOLEAN_FIELDS = [
  "headerShowSearch",
  "headerShowWishlist",
  "headerShowCart",
  "headerShowReleaseNotes",
  "menuShowSocialLinks",
  "heroEnabled",
] as const satisfies readonly (keyof SiteDesignSettings)[];

const LABEL_FIELDS = ["headerLogoText", "headerMenuLabel", "heroCtaLabel"] as const satisfies readonly (keyof SiteDesignSettings)[];
const TEXT_FIELDS = ["menuFooterText", "heroHeading", "heroSubheading"] as const satisfies readonly (keyof SiteDesignSettings)[];
const HREF_FIELDS = ["menuFooterHref", "heroCtaHref"] as const satisfies readonly (keyof SiteDesignSettings)[];

/** Field-by-field validation, returning only the entries safe to persist/render. */
export function sanitizeSiteDesignInput(
  input: Partial<Record<keyof SiteDesignSettings, unknown>>
): Partial<SiteDesignSettings> {
  const out: Partial<SiteDesignSettings> = {};
  // Same loosely-typed alias trick as lib/theme.ts's sanitizeThemeInput —
  // each write below is guarded by its own validator on the line before it.
  const outAny = out as Record<string, unknown>;

  for (const f of COLOR_FIELDS) if (f in input && isValidThemeColor(input[f])) outAny[f] = (input[f] as string).trim();
  for (const f of LENGTH_FIELDS) if (f in input && isValidThemeLength(input[f])) outAny[f] = (input[f] as string).trim();
  for (const f of FONT_FIELDS) if (f in input && isValidThemeFont(input[f])) outAny[f] = input[f];
  for (const f of BOOLEAN_FIELDS) if (f in input && typeof input[f] === "boolean") outAny[f] = input[f];
  for (const f of LABEL_FIELDS) if (f in input && isText(input[f], MAX_LABEL_LENGTH)) outAny[f] = (input[f] as string).trim();
  for (const f of TEXT_FIELDS) if (f in input && isText(input[f], MAX_TEXT_LENGTH)) outAny[f] = (input[f] as string).trim();
  for (const f of HREF_FIELDS) if (f in input && isValidHref(input[f])) outAny[f] = (input[f] as string).trim();
  for (const f of IMAGE_FIELDS) {
    if (!(f in input)) continue;
    const v = imageOrNull(input[f]);
    if (v !== undefined) outAny[f] = v;
  }

  if ("menuFontWeight" in input && isValidFontWeight(input.menuFontWeight)) out.menuFontWeight = input.menuFontWeight;
  if ("heroHeadingFontWeight" in input && isValidFontWeight(input.heroHeadingFontWeight)) out.heroHeadingFontWeight = input.heroHeadingFontWeight;
  if ("menuFontStyle" in input && isValidFontStyle(input.menuFontStyle)) out.menuFontStyle = input.menuFontStyle;
  if ("menuTextTransform" in input && isValidTextTransform(input.menuTextTransform)) out.menuTextTransform = input.menuTextTransform;
  if ("menuLetterSpacing" in input && isValidLetterSpacing(input.menuLetterSpacing)) out.menuLetterSpacing = (input.menuLetterSpacing as string).trim();
  if ("menuLineHeight" in input && isValidLineHeight(input.menuLineHeight)) out.menuLineHeight = input.menuLineHeight;
  if ("menuPanelWidth" in input && isValidPanelWidth(input.menuPanelWidth)) out.menuPanelWidth = input.menuPanelWidth;
  if ("menuOpenEffect" in input && isValidMenuOpenEffect(input.menuOpenEffect)) out.menuOpenEffect = input.menuOpenEffect;
  if ("menuOpenSpeedMs" in input && isValidMenuOpenSpeed(input.menuOpenSpeedMs)) out.menuOpenSpeedMs = input.menuOpenSpeedMs;
  if ("menuCloseEffect" in input && isValidMenuOpenEffect(input.menuCloseEffect)) out.menuCloseEffect = input.menuCloseEffect;
  if ("menuCloseHoverEffect" in input && isValidCloseHoverEffect(input.menuCloseHoverEffect)) out.menuCloseHoverEffect = input.menuCloseHoverEffect;
  if ("headerMenuHoverEffect" in input && isValidCloseHoverEffect(input.headerMenuHoverEffect)) out.headerMenuHoverEffect = input.headerMenuHoverEffect;
  if ("menuItemsEffect" in input && isValidMenuItemsEffect(input.menuItemsEffect)) out.menuItemsEffect = input.menuItemsEffect;
  if ("menuItemsSpeedMs" in input && isValidMenuOpenSpeed(input.menuItemsSpeedMs)) out.menuItemsSpeedMs = input.menuItemsSpeedMs;
  if ("menuCloseSpeedMs" in input && isValidMenuOpenSpeed(input.menuCloseSpeedMs)) out.menuCloseSpeedMs = input.menuCloseSpeedMs;
  if ("heroDecorPosition" in input && isValidDecorPosition(input.heroDecorPosition)) out.heroDecorPosition = input.heroDecorPosition;

  return out;
}

/** Which keys of `input` are settings fields that failed validation — so the
 *  API can reject the whole request and name the offenders, rather than
 *  silently dropping them. */
export function rejectedSiteDesignFields(input: Record<string, unknown>): string[] {
  const clean = sanitizeSiteDesignInput(input);
  return Object.keys(input).filter((key) => key in DEFAULT_SITE_DESIGN && !(key in clean));
}

/** Merges a partial/nullable DB record over the defaults, dropping anything invalid. */
export function resolveSiteDesign(
  record: Partial<Record<keyof SiteDesignSettings, unknown>> | null | undefined
): SiteDesignSettings {
  return { ...DEFAULT_SITE_DESIGN, ...sanitizeSiteDesignInput(record ?? {}) };
}

/** One menu row, or null if any required field is missing/invalid. Ids are
 *  kept as-is (an existing cuid, or a client-side temp id the API replaces). */
export function sanitizeMenuItem(input: unknown, sortOrder: number): SiteMenuItem | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  const label = typeof raw.label === "string" ? raw.label.trim() : "";
  if (!label || label.length > MAX_LABEL_LENGTH) return null;
  if (!isValidHref(raw.href)) return null;
  const image = imageOrNull(raw.image);
  return {
    id: typeof raw.id === "string" && raw.id.length <= 64 ? raw.id : "",
    label,
    href: raw.href.trim(),
    bgColor: isValidThemeColor(raw.bgColor) ? raw.bgColor.trim() : DEFAULT_MENU_ITEMS[0].bgColor,
    underlineColor: isValidThemeColor(raw.underlineColor) ? raw.underlineColor.trim() : DEFAULT_MENU_ITEMS[0].underlineColor,
    underlineStyle: isValidUnderlineStyle(raw.underlineStyle) ? raw.underlineStyle : "scribble",
    image: image === undefined ? null : image,
    openInNewTab: raw.openInNewTab === true,
    isVisible: raw.isVisible !== false,
    sortOrder,
  };
}

/** Rows straight from the DB → validated, ordered list. Falls back to the
 *  built-in defaults only when there are no rows at all (fresh install) —
 *  an admin who deliberately hid every row gets an empty menu, not the
 *  defaults sneaking back. */
export function resolveMenuItems(rows: unknown[] | null | undefined): SiteMenuItem[] {
  if (!rows || rows.length === 0) return DEFAULT_MENU_ITEMS;
  const items: SiteMenuItem[] = [];
  for (const row of rows) {
    const item = sanitizeMenuItem(row, items.length);
    if (item) items.push(item);
  }
  return items;
}
