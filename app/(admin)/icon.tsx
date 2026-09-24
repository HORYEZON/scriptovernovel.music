// app/(admin)/icon.tsx
//
// Next's "icon" file convention scoped to the admin route group — Next
// resolves the *nearest* icon.tsx to a page, so this one wins over
// app/icon.tsx for everything under /admin and nowhere else. Exactly the
// pattern app/(public)/gallery/museum/icon.tsx uses.
//
// Static/no-JS tab icon only; the colour-cycling glow comes from
// components/AnimatedFavicon.tsx's own pathname check, which requests
// app/api/favicon-frame with the same ADMIN_FAVICON_ICON override so the two
// can never drift apart.
import { loadFaviconIconNode, buildFaviconSvg, FAVICON_STROKE_DEFAULT, ADMIN_FAVICON_ICON } from "@/lib/favicon";

export const size = { width: 32, height: 32 };
export const contentType = "image/svg+xml";
export const revalidate = 3600;

export default async function AdminIcon() {
  const iconNode = await loadFaviconIconNode(ADMIN_FAVICON_ICON);
  const svg = buildFaviconSvg(iconNode, FAVICON_STROKE_DEFAULT);

  return new Response(svg, {
    headers: { "Content-Type": "image/svg+xml" },
  });
}
