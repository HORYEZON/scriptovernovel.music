// app/sitemap.ts
//
// Next.js App Router convention — this file is automatically served at
// /sitemap.xml, no route handler needed. Only lists real, indexable,
// non-personalized URLs:
//   - the static marketing pages (including /stories, the public shelf)
//   - one entry per published artwork's dedicated page
// Stories themselves have no per-item route yet — they're read in a modal on
// /stories — so only the shelf itself is listed.
// Deliberately excludes /gallery (just redirects to "/"), /shop /cart
// /checkout /wishlist (personalized or not yet live — Shop is Phase 2,
// see the commented-out nav link in Navbar.tsx), and everything under
// /admin (see robots.ts, which disallows crawling it entirely).
import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/site-url";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const artworks = await prisma.artwork
    .findMany({
      where: { published: true, deletedAt: null, slug: { not: null } },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    })
    .catch(() => []);

  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/stories`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/about`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/contact`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
  ];

  const artworkPages: MetadataRoute.Sitemap = artworks.map((artwork) => ({
    url: `${SITE_URL}/artwork/${artwork.slug}`,
    lastModified: artwork.updatedAt,
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  return [...staticPages, ...artworkPages];
}
