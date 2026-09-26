// app/sitemap.ts
//
// Next.js App Router convention — this file is automatically served at
// /sitemap.xml, no route handler needed. Only lists real, indexable,
// non-personalized URLs: the band's pages (the Menu bar's, plus Shows, the
// fan wall and the Digital Museum), then one entry per published release.
// Per-video / per-merch entries join as those pages land. Deliberately
// excludes /gallery (redirects to "/"), /wall (redirects to the wall), /cart
// /checkout /wishlist (personalized), /artwork/* (only reachable from inside
// the museum now), and everything under /admin (see robots.ts, which
// disallows crawling it entirely).
//
// A DB hiccup must not take the sitemap down with it: the release query is
// caught and the static list is served on its own.
import type { MetadataRoute } from "next";

/**
 * Re-generated hourly.
 *
 * Without this the sitemap is prerendered once at build time, so a release or a
 * lyrics page published afterwards is missing from it until the next deploy —
 * which is exactly the content whose whole point is being found. An hour is far
 * more often than a crawler asks, and one query an hour is nothing.
 */
export const revalidate = 3600;

import { prisma } from "@/lib/prisma";
import { PUBLIC_RELEASE_ORDER, PUBLIC_RELEASE_WHERE, getPublicLyricTracks } from "@/lib/releases-server";
import { releaseHref } from "@/lib/releases";
import { trackLyricsHref } from "@/lib/lyrics";
import { SITE_URL } from "@/lib/site-url";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const [releases, lyricTracks] = await Promise.all([
    prisma.release
      .findMany({
        where: PUBLIC_RELEASE_WHERE,
        orderBy: PUBLIC_RELEASE_ORDER,
        select: { id: true, slug: true, updatedAt: true },
      })
      .catch(() => []),
    getPublicLyricTracks().catch(() => []),
  ]);

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
    // The press kit: low traffic, but it is the page a booker or a blog
    // searches for by name ("<band> press kit"), so it has to be findable.
    { url: `${SITE_URL}/press`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    // Listed so it can be linked from a bio or a post — the footer carries the
    // form itself, but this is the address to hand someone.
    { url: `${SITE_URL}/subscribe`, lastModified: now, changeFrequency: "yearly", priority: 0.4 },
    { url: `${SITE_URL}/gallery/freedom-wall`, lastModified: now, changeFrequency: "daily", priority: 0.5 },
    { url: `${SITE_URL}/gallery/museum`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    // Each release's own page, at the same weight as /music: for a band, a
    // record *is* the thing being searched for. `lastModified` is the row's
    // own updatedAt, so re-crawling follows real edits.
    ...releases.map((r) => ({
      url: `${SITE_URL}${releaseHref(r)}`,
      lastModified: r.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.9,
    })),
    // One page per song that has lyrics. Worth listing individually: "<song>
    // lyrics" is a phrase people type, and each of these is the only page on
    // the site that answers it.
    ...lyricTracks.map((t) => ({
      url: `${SITE_URL}${trackLyricsHref(t.release, t)}`,
      lastModified: t.release.updatedAt,
      changeFrequency: "yearly" as const,
      priority: 0.7,
    })),
  ];
}
