// app/icon.tsx
//
// Next.js's "icon" file convention — the static default favicon every
// browser reads before/without JS, admin-pickable from the same
// Lucide/Tabler catalog as every other icon slot (Profile.faviconIcon,
// edited from Settings → Preferences → Branding → Icons). One fixed color,
// no motion — the color-cycling glow lives in components/AnimatedFavicon.tsx
// instead, which swaps <link rel="icon"> to point at
// app/api/favicon-frame/route.ts's colored variants of this exact same
// icon (see lib/favicon.ts, shared by both routes).
import { prisma } from "@/lib/prisma";
import { loadFaviconIconNode, buildFaviconSvg, FAVICON_STROKE_DEFAULT } from "@/lib/favicon";

export const size = { width: 32, height: 32 };
export const contentType = "image/svg+xml";
// DB-backed, but a favicon is requested on nearly every navigation — cache
// the generated SVG for an hour rather than hitting Postgres every time.
// An admin's icon change shows up within that window, not instantly.
export const revalidate = 3600;

export default async function Icon() {
  const profile = await prisma.profile.findFirst().catch(() => null);
  const iconNode = await loadFaviconIconNode(profile?.faviconIcon);
  const svg = buildFaviconSvg(iconNode, FAVICON_STROKE_DEFAULT);

  return new Response(svg, {
    headers: { "Content-Type": "image/svg+xml" },
  });
}
