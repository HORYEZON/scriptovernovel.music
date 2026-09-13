// lib/museum/visionFilters.ts
//
// "Filter Vision" — the visitor-facing look filters in the Digital Museum.
// Press [Q] (or tap the HUD button on a phone) to cycle: Normal → each
// enabled filter → back to Normal.
//
// Client-safe (no prisma import) so the public museum, the admin's General
// Settings tab and the API route that validates the config all read the same
// definitions.
//
// ── Why these are CSS filter strings and nothing else ──────────────────────
//
// The obvious way to tint a 3D scene is a postprocessing pass. This project
// has no postprocessing library (only three / @react-three/fiber / drei), and
// adding one to recolour a picture would cost a render target, a second full-
// screen draw every frame and ~40KB of bundle — on a scene that already
// budgets carefully for old phones (see deviceTier.ts).
//
// A `filter` on the canvas element is free by comparison: the compositor
// already had to paint that element, and filtering it is GPU work the browser
// does anyway. It also composites *after* WebGL, so it costs the scene
// nothing at all — no extra frame, no shader recompile when the visitor
// switches filters.
//
// The second reason matters just as much: **`ctx.filter` on a 2D canvas
// accepts the identical syntax**, so ScreenshotCapture can reproduce the exact
// look the visitor is seeing by assigning the same string. A postprocessing
// pass would have been in the WebGL buffer and therefore in the screenshot
// too — but an overlay div with `mix-blend-mode`, the other cheap option,
// would not be, and a saved photo that doesn't match the screen is a bug
// nobody would think to look for. So: filter functions only, no overlays.
//
// ── How an arbitrary colour becomes a filter ───────────────────────────────
//
// There is no `tint(#rrggbb)` CSS filter. The standard trick — and what
// customFilterCss below does — is to flatten the image to a known single hue
// and then rotate that hue to the target:
//
//   grayscale(1)  strip the original colour, so the result is the *shape* of
//                 the scene rather than a blend with what it already was
//   sepia(1)      re-colourise to a fixed warm brown, whose hue is ~35–40°
//   hue-rotate(θ) turn that brown to the admin's chosen hue
//   saturate(s)   how strongly tinted (1 = as sepia gives it, higher = vivid)
//   brightness(b) recover the lightness sepia's flattening costs
//
// The 40° constant below is that sepia hue. It is an approximation of a
// non-linear matrix, so the result is "recognisably this colour", not a
// colorimetric match — which is the correct standard for a stylistic filter
// and the reason the admin gets a live preview rather than a number to trust.

/** One selectable look. Built-ins are defined here; custom ones are built by
 *  the admin and stored in the museum config. */
export interface VisionFilter {
  id: string;
  label: string;
  /** A CSS `filter` value — valid for both `element.style.filter` and a 2D
   *  canvas context's `.filter`. Empty string means "no filter". */
  css: string;
}

/**
 * The five built-in looks.
 *
 * Ordered as they cycle. Chosen to be obviously different from one another at
 * a glance — a visitor pressing [Q] repeatedly should never wonder whether
 * anything happened — and to stay legible: every one of these still lets you
 * read a wall label and tell one painting from another, because the museum is
 * still a museum while a filter is on.
 */
export const BUILT_IN_VISION_FILTERS: VisionFilter[] = [
  {
    id: "noir",
    label: "Noir",
    // Contrast pushed past 1 because plain grayscale of a well-lit gallery is
    // flat and grey; the extra contrast is what makes it read as black-and-
    // white *photography* rather than as a desaturated bug.
    css: "grayscale(1) contrast(1.35) brightness(0.95)",
  },
  {
    id: "sepia",
    label: "Sepia",
    css: "sepia(0.85) contrast(1.05) brightness(1.02) saturate(1.1)",
  },
  {
    id: "night-vision",
    label: "Night Vision",
    // Grayscale first so the scene's own colours don't fight the green, then
    // the tint pipeline described in this file's header. Brightness is well
    // over 1 on purpose — the look is an image gain stage, and a dim one
    // reads as "broken filter" rather than "night vision".
    css: "grayscale(1) sepia(1) hue-rotate(50deg) saturate(4) brightness(1.35) contrast(1.15)",
  },
  {
    id: "infrared",
    label: "Infrared",
    // The one filter that inverts. hue-rotate after invert puts the palette
    // back the right way round for skin/wood tones while keeping the
    // false-colour feel; saturate makes it a thermal picture rather than a
    // washed-out negative.
    css: "invert(1) hue-rotate(180deg) saturate(2.2) contrast(1.1)",
  },
  {
    id: "dreamscape",
    label: "Dreamscape",
    // No grayscale here — this one is meant to read as the room's own colours
    // pushed, not replaced, so it stays recognisably the gallery.
    css: "saturate(1.7) hue-rotate(-18deg) contrast(0.92) brightness(1.1)",
  },
];

export const BUILT_IN_FILTER_IDS = BUILT_IN_VISION_FILTERS.map((f) => f.id);

/** An admin-authored look — a colour, and how hard to apply it. */
export interface CustomVisionFilter {
  /** Stable id, generated when the admin adds it. Prefixed "custom-" so it
   *  can never collide with a built-in's id, which matters because the
   *  visitor's remembered choice is stored as a bare id. */
  id: string;
  label: string;
  /** Hex, e.g. "#48ff9c". The hue and saturation are what actually drive the
   *  filter; see this file's header for how. */
  color: string;
  /** 0–2. How strongly the tint reads. 1 is a clear, obvious tint. */
  intensity: number;
  /** 0.5–1.6. Lightness recovery — the tint pipeline's grayscale+sepia step
   *  costs some, and a dark colour costs more. */
  brightness: number;
}

export const CUSTOM_FILTER_MAX = 5;
export const CUSTOM_INTENSITY_MIN = 0;
export const CUSTOM_INTENSITY_MAX = 2;
export const CUSTOM_BRIGHTNESS_MIN = 0.5;
export const CUSTOM_BRIGHTNESS_MAX = 1.6;

export const DEFAULT_CUSTOM_FILTER: Omit<CustomVisionFilter, "id"> = {
  label: "My Filter",
  color: "#7cc4ff",
  intensity: 1,
  brightness: 1.05,
};

/** Hue angle (0–360) of a hex colour. Returns 0 for greys, which is correct
 *  and harmless: with no hue to rotate to, the tint lands on sepia's own warm
 *  brown, and an admin who picked grey wanted a monochrome look anyway. */
export function hexHue(hex: string): number {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return 0;
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (delta === 0) return 0;
  let hue: number;
  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;
  hue *= 60;
  return hue < 0 ? hue + 360 : hue;
}

/** The hue `sepia(1)` lands on. See this file's header. */
const SEPIA_BASE_HUE = 40;

/** Build the CSS `filter` value for an admin-authored colour. */
export function customFilterCss(filter: CustomVisionFilter): string {
  const rotation = Math.round(hexHue(filter.color) - SEPIA_BASE_HUE);
  // `saturate` carries the intensity because it is what decides how much of
  // the tint survives; at 0 the result is the plain sepia-grey underneath,
  // which is a legitimate "monochrome" choice rather than a broken one.
  const saturation = (filter.intensity * 3.5).toFixed(2);
  return `grayscale(1) sepia(1) hue-rotate(${rotation}deg) saturate(${saturation}) brightness(${filter.brightness.toFixed(2)})`;
}

/** What the museum stores in DigitalMuseum.visionFilterConfig. */
export interface VisionFilterConfig {
  /**
   * Which built-ins a visitor can cycle to. Absent means "all of them" — the
   * state a museum is in before an admin has ever opened this section, and
   * the one that makes the feature work out of the box.
   */
  enabledBuiltIns?: string[];
  /** Admin-authored looks, in cycle order after the built-ins. */
  custom?: CustomVisionFilter[];
}

export const DEFAULT_VISION_FILTER_CONFIG: Required<VisionFilterConfig> = {
  enabledBuiltIns: BUILT_IN_FILTER_IDS,
  custom: [],
};

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

/** Parse the config JSON. Anything unparseable falls back to "all built-ins,
 *  no custom" rather than to no filters at all — the same forgiving contract
 *  the other config-in-a-column parsers here keep. */
export function parseVisionFilterConfig(
  raw: string | null | undefined
): Required<VisionFilterConfig> {
  if (!raw) return { ...DEFAULT_VISION_FILTER_CONFIG };
  try {
    const parsed = JSON.parse(raw) as VisionFilterConfig;
    return {
      enabledBuiltIns: Array.isArray(parsed.enabledBuiltIns)
        ? // Filtered against the known list, so a built-in that is later
          // renamed or removed doesn't leave a dead id enabled forever.
          parsed.enabledBuiltIns.filter((id) => BUILT_IN_FILTER_IDS.includes(id))
        : BUILT_IN_FILTER_IDS,
      custom: Array.isArray(parsed.custom)
        ? parsed.custom
            .filter((c): c is CustomVisionFilter => Boolean(c) && typeof c.id === "string")
            .slice(0, CUSTOM_FILTER_MAX)
            .map((c) => ({
              id: c.id,
              label:
                typeof c.label === "string" && c.label.trim()
                  ? c.label.trim().slice(0, 40)
                  : DEFAULT_CUSTOM_FILTER.label,
              color:
                typeof c.color === "string" && /^#[0-9a-fA-F]{6}$/.test(c.color)
                  ? c.color
                  : DEFAULT_CUSTOM_FILTER.color,
              intensity: clampNumber(
                c.intensity,
                CUSTOM_INTENSITY_MIN,
                CUSTOM_INTENSITY_MAX,
                DEFAULT_CUSTOM_FILTER.intensity
              ),
              brightness: clampNumber(
                c.brightness,
                CUSTOM_BRIGHTNESS_MIN,
                CUSTOM_BRIGHTNESS_MAX,
                DEFAULT_CUSTOM_FILTER.brightness
              ),
            }))
        : [],
    };
  } catch {
    return { ...DEFAULT_VISION_FILTER_CONFIG };
  }
}

export function serializeVisionFilterConfig(config: VisionFilterConfig): string {
  return JSON.stringify({ ...DEFAULT_VISION_FILTER_CONFIG, ...config });
}

/**
 * The filters a visitor can actually cycle through, in order: the enabled
 * built-ins (in their canonical order, not the admin's click order — the
 * cycle should be stable across edits) followed by the custom ones.
 *
 * Returns an empty array when everything is switched off, which the museum
 * treats as "the feature is not available here" — no [Q] handler, no HUD
 * button, rather than a button that cycles between Normal and Normal.
 */
export function resolveVisionFilters(
  config: Required<VisionFilterConfig>
): VisionFilter[] {
  const builtIns = BUILT_IN_VISION_FILTERS.filter((f) =>
    config.enabledBuiltIns.includes(f.id)
  );
  const custom = config.custom.map((c) => ({
    id: c.id,
    label: c.label,
    css: customFilterCss(c),
  }));
  return [...builtIns, ...custom];
}

/** Where the visitor's current pick is remembered between visits. Their
 *  choice, not the museum's, so it belongs in their browser rather than the
 *  database — same reasoning as the museum's dark-mode preference. */
export const VISION_FILTER_STORAGE_KEY = "scriptovernovel:museum:vision-filter";
