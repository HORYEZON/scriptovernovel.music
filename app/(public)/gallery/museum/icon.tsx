// app/(public)/gallery/museum/icon.tsx
//
// Next's "icon" file convention, same as app/icon.tsx, but scoped to just
// this route segment — Next resolves the *nearest* icon.tsx to a page, so
// this one wins over the site-wide default specifically for /gallery/museum
// (and nowhere else) without that file needing to know this exists. Static/
// no-JS tab icon; the color-cycling glow while actually inside the museum
// comes from components/AnimatedFavicon.tsx's own pathname check, which
// requests app/api/favicon-frame with the same MUSEUM_FAVICON_ICON override
// so both stay visually identical.
import { loadFaviconIconNode, buildFaviconSvg, FAVICON_STROKE_DEFAULT, MUSEUM_FAVICON_ICON } from "@/lib/favicon";

export const size = { width: 32, height: 32 };
export const contentType = "image/svg+xml";
export const revalidate = 3600;

export default async function MuseumIcon() {
  const iconNode = await loadFaviconIconNode(MUSEUM_FAVICON_ICON);
  const svg = buildFaviconSvg(iconNode, FAVICON_STROKE_DEFAULT);

  return new Response(svg, {
    headers: { "Content-Type": "image/svg+xml" },
  });
}
