// app/api/favicon-frame/route.ts
//
// One colored "frame" of the animated favicon glow — components/
// AnimatedFavicon.tsx cycles <link rel="icon"> through a handful of these
// (one request per color in Profile.faviconIconColors) to fake a
// color-cycling favicon, since browsers render an SVG favicon as a single
// static snapshot and never actually run @keyframes inside app/icon.tsx.
// Not the app/icon.tsx metadata-route convention (that's one fixed URL) —
// a plain Route Handler instead, so it can take a ?color= query param.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { loadFaviconIconNode, buildFaviconSvg, FAVICON_STROKE_DEFAULT } from "@/lib/favicon";
import { isHexColor } from "@/lib/intro-splash";

export async function GET(request: NextRequest) {
  const requested = request.nextUrl.searchParams.get("color") ?? "";
  const color = isHexColor(requested) ? requested.trim() : FAVICON_STROKE_DEFAULT;

  // Optional per-request icon override ("platform:name") — AnimatedFavicon.tsx
  // passes this while on /gallery/museum so the tab shows a museum-flavored
  // icon there instead of the site-wide Profile.faviconIcon, still cycling
  // through the exact same glow colors. Falls through the same
  // parseIconValue+fallback path loadFaviconIconNode already uses for the
  // admin-picked icon, so a garbage value just falls back to the squid same
  // as an unset Profile.faviconIcon would.
  const iconOverride = request.nextUrl.searchParams.get("icon");
  const profile = await prisma.profile.findFirst().catch(() => null);
  const iconNode = await loadFaviconIconNode(iconOverride ?? profile?.faviconIcon);
  const svg = buildFaviconSvg(iconNode, color);

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      // Same hour-long window as app/icon.tsx — an admin's icon change
      // shows up within that window, not instantly. Keyed by color, so
      // changing the picked icon while keeping the same color palette still
      // needs this window to elapse before every cached frame catches up.
      "Cache-Control": "public, max-age=3600",
    },
  });
}
