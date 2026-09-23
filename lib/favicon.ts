// lib/favicon.ts
//
// Shared server-side SVG-building logic for the favicon — app/icon.tsx (the
// static default browser reads, one color, always available) and
// app/api/favicon-frame/route.ts (colored glow frames, requested by
// components/AnimatedFavicon.tsx to fake a color-cycling favicon — browsers
// render an SVG favicon as a single static snapshot, they don't run
// @keyframes inside it, so the actual "animation" is this client component
// swapping which frame's URL the <link rel="icon"> points at). Both draw
// whichever icon Profile.faviconIcon points at (falling back to the squid)
// through the exact same path-data extraction and glow filter, so the
// static favicon and the animated frames can never visually drift apart.
//
// Can't use react-dom/server here — Next's metadata-route loader for
// app/icon.tsx explicitly rejects any module that imports it ("You're
// importing a component that imports react-dom/server"), and this module is
// shared with that file. So instead of rendering the icon component through
// React at all, this reaches for the plain [tag, attrs][] data every
// Lucide/Tabler icon is built from internally — Tabler's per-icon module
// exports that array directly as `__iconNode`; Lucide's wrapper component
// takes it as a prop one level in, reachable by calling its (plain,
// hookless) render function directly — and serializes that by hand. No
// renderer, no react-dom, just a handful of <path>/<circle>/... tags either
// way. Verified against a live dev server for both platforms, not just
// typechecked — their two component shapes turned out to differ enough
// (see loadIconNode) that this was worth actually running.
import { isValidElement, type ReactElement } from "react";
import lucideDynamicImports from "lucide-react/dynamicIconImports";
import tablerDynamicImports from "@/lib/tabler-icon-imports.generated";
import { parseIconValue, type IconPlatform } from "@/components/ui/icon-values";
import { SquidIcon } from "@/components/ui/SquidIcon";

// Matches the old static favicon's backdrop/accent so a custom icon isn't
// also a brand-color change.
export const FAVICON_BG = "#0b0b0f";
// The logo's gold. This is the still favicon every browser reads before the
// animated one takes over (and the only one a browser that ignores dynamic
// <link rel="icon"> swaps ever sees), so it is the first colour of
// AnimatedFavicon's cycle rather than a shade of its own.
export const FAVICON_STROKE_DEFAULT = "#E5AD06";

// The Digital Museum's own favicon while a visitor is on /gallery/museum —
// swapped in by app/(public)/gallery/museum/icon.tsx (the static/no-JS tab
// icon, via Next's nested "icon" route-segment convention) and by
// AnimatedFavicon.tsx (the color-cycling glow, via app/api/favicon-frame's
// ?icon= override) so both agree on the same shape. Not admin-configurable
// (unlike Profile.faviconIcon) — a fixed "landmark" building glyph, same
// icon already used for MAIN_HALL/museum branding elsewhere in this
// codebase (RoomsTab.tsx, MuseumMap.tsx, MuseumDoor.tsx), so this doesn't
// introduce a fourth visual language for "museum" on top of those three.
export const MUSEUM_FAVICON_ICON = "lucide:landmark";

export type IconNode = [string, Record<string, unknown>][];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type IconImporter = () => Promise<{ default: any; __iconNode?: IconNode }>;
const PLATFORM_IMPORTS: Record<string, Record<string, IconImporter>> = {
  lucide: lucideDynamicImports as unknown as Record<string, IconImporter>,
  tabler: tablerDynamicImports as unknown as Record<string, IconImporter>,
};

// Lucide's per-icon component is forwardRef(({...}, ref) =>
// createElement(SharedIcon, {iconNode, ...})) — one layer of indirection
// around a shared inner renderer, so the raw path-data array shows up as a
// *prop* on the element its (plain, hookless — safe to call directly, no
// React tree, no hooks fire) render function returns. Tabler's per-icon
// module doesn't need this at all: it exports the same array directly as
// `__iconNode` (checked first, in loadIconNode below) since its component
// builds the <svg> itself from a closured variable rather than a prop.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveIconNode(Icon: any): IconNode | null {
  if (typeof Icon !== "function" && typeof Icon?.render !== "function") return null;
  const element: ReactElement | null =
    typeof Icon === "function" ? Icon({}) : Icon.render({}, null);
  if (!isValidElement(element)) return null;
  const props = element.props as { iconNode?: IconNode };
  return Array.isArray(props.iconNode) ? props.iconNode : null;
}

async function loadIconNode(platform: string, name: string): Promise<IconNode | null> {
  const importFn = PLATFORM_IMPORTS[platform]?.[name];
  if (!importFn) return null;
  const mod = await importFn().catch(() => null);
  if (!mod) return null;
  if (Array.isArray(mod.__iconNode)) return mod.__iconNode;
  return mod.default ? resolveIconNode(mod.default) : null;
}

// SquidIcon's own two <path> elements, read off its rendered element tree
// instead of duplicating its `d` data by hand here.
function squidIconNode(): IconNode {
  const element = SquidIcon({}) as ReactElement<{ children?: ReactElement | ReactElement[] }>;
  const children = element.props.children;
  const paths = Array.isArray(children) ? children : [children];
  return paths
    .filter(isValidElement)
    .map((p) => ["path", p.props as Record<string, unknown>] as [string, Record<string, unknown>]);
}

/** Profile.faviconIcon ("platform:name") → its path data, falling back to the squid when unset/invalid. */
export async function loadFaviconIconNode(faviconIcon?: string | null): Promise<IconNode> {
  const parsed = parseIconValue(faviconIcon);
  if (!parsed) return squidIconNode();
  const node = await loadIconNode(parsed.platform, parsed.name);
  return node ?? squidIconNode();
}

// camelCase → kebab-case only for the handful of SVG presentation
// attributes that actually need it (viewBox, cx, d, points, etc. are
// already correctly-cased as-is — kebab-casing everything indiscriminately
// would wrongly turn "viewBox" into "view-box").
const ATTR_NAME_MAP: Record<string, string> = {
  strokeWidth: "stroke-width",
  strokeLinecap: "stroke-linecap",
  strokeLinejoin: "stroke-linejoin",
  strokeDasharray: "stroke-dasharray",
  strokeDashoffset: "stroke-dashoffset",
  strokeMiterlimit: "stroke-miterlimit",
  fillRule: "fill-rule",
  clipRule: "clip-rule",
};

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function serializeIconNode(iconNode: IconNode): string {
  return iconNode
    .map(([tag, attrs]) => {
      const attrStr = Object.entries(attrs)
        .filter(([k]) => k !== "key")
        .map(([k, v]) => `${ATTR_NAME_MAP[k] ?? k}="${escapeAttr(String(v))}"`)
        .join(" ");
      return `<${tag}${attrStr ? " " + attrStr : ""}/>`;
    })
    .join("");
}

/**
 * Renders the full 32×32 favicon SVG for one icon + stroke color, with a
 * soft Gaussian-blur glow behind the strokes — the "glow" the original
 * hand-crafted app/icon.svg had (see git history), lost when this became
 * admin-icon-aware. Static per call (no CSS @keyframes — those never
 * actually play in a browser's tab), so the color cycle instead comes from
 * AnimatedFavicon.tsx calling this (via the frame route) once per color.
 */
export function buildFaviconSvg(iconNode: IconNode, strokeColor: string): string {
  // Every source icon here is drawn on a 24x24 grid (Lucide, Tabler, and
  // SquidIcon all use viewBox="0 0 24 24") — translate(4,4) centers that
  // inside our 32x32 canvas with an even 4px margin on all sides, no
  // per-icon scaling math needed.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><defs><filter id="g" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="1.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><rect width="32" height="32" rx="7" fill="${FAVICON_BG}"/><g transform="translate(4,4)" stroke="${strokeColor}" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" filter="url(#g)">${serializeIconNode(iconNode)}</g></svg>`;
}

export type { IconPlatform };
