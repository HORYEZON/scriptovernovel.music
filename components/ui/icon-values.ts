// components/ui/icon-values.ts
// Cheap, dependency-free helpers for the "platform:name" icon values stored
// on Profile (sidebarIcon, chatIcon). Deliberately kept separate from
// DynamicIcon.tsx, which pulls in the full Lucide + Tabler icon-import maps
// (~3,000 entries combined) — components that only need to know *whether*
// a custom icon is configured (AdminSidebar.tsx, FaqChatbox.tsx) import
// from here instead, so they don't drag those maps into their own module
// graph just to answer that question. That matters in dev (webpack
// compiles each route's whole graph on first visit) and modestly in prod.
// The actual icon-rendering component is dynamically imported by those
// call sites only once a value is present — see DynamicIcon.tsx.
export type IconPlatform = "lucide" | "tabler";

export const ICON_PLATFORMS: { id: IconPlatform; label: string }[] = [
  { id: "lucide", label: "Lucide" },
  { id: "tabler", label: "Tabler" },
];

// A plausible-looking kebab-case name — format check only, not an exact
// catalog lookup (that would require the same heavy maps this file exists
// to avoid). In practice this is exact enough: IconPicker.tsx only ever
// writes names it found in a live search against the real catalog, so a
// non-existent-but-plausible name here would only happen from a
// hand-edited DB value. DynamicIcon.tsx's importer degrades gracefully
// (renders nothing) if the name doesn't actually resolve.
const KEBAB_NAME_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

export function isIconName(_platform: IconPlatform, name: string): boolean {
  return KEBAB_NAME_RE.test(name);
}

// Stored icon values are a single "platform:name" string (e.g.
// "tabler:mood-smile"). Values saved before platform tabs existed have no
// prefix — those are treated as Lucide for backward compatibility.
export function parseIconValue(value?: string | null): { platform: IconPlatform; name: string } | null {
  if (!value) return null;
  const sep = value.indexOf(":");
  if (sep === -1) {
    return isIconName("lucide", value) ? { platform: "lucide", name: value } : null;
  }
  const platform = value.slice(0, sep) as IconPlatform;
  const name = value.slice(sep + 1);
  if (!ICON_PLATFORMS.some((p) => p.id === platform)) return null;
  return isIconName(platform, name) ? { platform, name } : null;
}

export function toIconValue(platform: IconPlatform, name: string): string {
  return `${platform}:${name}`;
}
