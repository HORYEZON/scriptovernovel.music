// app/sitemap.ts
//
// Next.js App Router convention — this file is automatically served at
// /sitemap.xml, no route handler needed. Only lists real, indexable,
// non-personalized URLs: the band's pages (the Menu bar's, plus Shows, the
// fan wall and the Digital Museum). Per-release / per-video / per-merch
// entries join as those pages land (Phases 2, 3 and 5 of the band-site
// plan). Deliberately excludes /gallery (redirects to "/"), /wall (redirects
// to the wall), /cart /checkout /wishlist (personalized), /artwork/* (only
// reachable from inside the museum now), and everything under /admin (see
// robots.ts, which disallows crawling it entirely).
import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-url";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  return [
    { url: SITE_URL, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/music`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    // Above Videos: a gig has a deadline, and it is the page most likely to
    // be searched for by name ("scriptovernovel tickets").
    { url: `${SITE_URL}/shows`, lastModified: now, changeFrequency: "weekly", priority: 0.85 },
    { url: `${SITE_URL}/videos`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/shop`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE_URL}/gallery/freedom-wall`, lastModified: now, changeFrequency: "daily", priority: 0.5 },
    { url: `${SITE_URL}/gallery/museum`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];
}
