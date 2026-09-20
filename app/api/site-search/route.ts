// app/api/site-search/route.ts
//
// The header search's one endpoint: everything a visitor might look for on
// the band site, as flat `SiteSearchItem`s the overlay filters client-side.
// Releases, videos and the store (merch), each with a `kind` so the overlay
// can label a row. Public, read-only, no query param
// — the catalogue is small and one fetch per open is cheaper than a round
// trip per keystroke.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { productHref, productImage, productTitle } from "@/lib/store/product-display";
import { getPublicReleases } from "@/lib/releases-server";
import { getPublicVideos } from "@/lib/videos-server";
import { VIDEO_KIND_LABELS, youtubeThumbnail } from "@/lib/videos";
import { RELEASE_TYPE_LABELS, formatReleaseDate } from "@/lib/releases";
import type { SiteSearchItem } from "@/lib/site-search";

export const dynamic = "force-dynamic";

export async function GET() {
  const products = await prisma.product
    .findMany({
      where: { available: true, deletedAt: null, artwork: { deletedAt: null } },
      include: { artwork: { select: { title: true, imageUrl: true, slug: true, tags: true, medium: true } } },
      orderBy: { createdAt: "desc" },
    })
    .catch(() => []);

  const [releases, videos] = await Promise.all([getPublicReleases().catch(() => []), getPublicVideos().catch(() => [])]);

  const items: SiteSearchItem[] = [];
  for (const r of releases) {
    items.push({
      id: `release:${r.id}`,
      kind: "release",
      title: r.title,
      subtitle: `${RELEASE_TYPE_LABELS[r.type]}${r.releaseDate ? ` · ${formatReleaseDate(r.releaseDate, "year")}` : ""}`,
      keywords: r.tracks.map((t) => t.title),
      imageUrl: r.coverImageUrl,
      href: `/music#${r.slug ?? r.id}`,
    });
  }
  for (const v of videos) {
    items.push({
      id: `video:${v.id}`,
      kind: "video",
      title: v.title,
      subtitle: `${VIDEO_KIND_LABELS[v.kind]}${v.release ? ` · ${v.release.title}` : ""}`,
      keywords: v.release ? [v.release.title] : [],
      imageUrl: youtubeThumbnail(v.youtubeId),
      href: `/videos#${v.id}`,
    });
  }
  for (const p of products) {
    const title = productTitle(p);
    if (!title) continue;
    items.push({
      id: `product:${p.id}`,
      kind: "merch",
      title,
      subtitle: p.artwork?.medium ?? null,
      keywords: p.artwork?.tags ?? [],
      imageUrl: productImage(p),
      href: productHref(p),
    });
  }

  return NextResponse.json({ items });
}
