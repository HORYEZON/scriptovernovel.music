// lib/press-server.ts
//
// Everything /press puts on one page, in one call. Not client-safe (Prisma).
//
// The press kit is almost entirely a second view of data the site already has —
// the bio, the members, the photos, the records, the shows — so this module is
// mostly a gather, and the page stays readable instead of opening with a
// fifteen-line Promise.all.
import { prisma } from "@/lib/prisma";
import { getProfile, getSocialLinks } from "@/lib/public-data";
import { getPublicBandMembers } from "@/lib/band-members-server";
import { getSiteLogoUrl } from "@/lib/site-logo";
import { PUBLIC_RELEASE_ORDER, PUBLIC_RELEASE_WHERE } from "@/lib/releases-server";
import { PUBLIC_VIDEO_ORDER, PUBLIC_VIDEO_WHERE } from "@/lib/videos-server";
import { getPublicShows } from "@/lib/shows-server";
import { resolvePressQuotes } from "@/lib/press";
import { splitShows } from "@/lib/shows-server";

/** How many of each list the page shows. A press kit is a summary — the rest
 *  of the site is one click away, and a booker reading twenty shows is a booker
 *  who has stopped reading. */
const RELEASE_LIMIT = 6;
const VIDEO_LIMIT = 2;
const SHOW_LIMIT = 6;
const PHOTO_LIMIT = 8;

export async function getPressKit() {
  const [profile, members, skills, socialLinks, releases, videos, shows, awards] = await Promise.all([
    getProfile().catch(() => null),
    getPublicBandMembers().catch(() => []),
    prisma.artistSkill.findMany({ orderBy: { sortOrder: "asc" } }).catch(() => []),
    getSocialLinks().catch(() => []),
    prisma.release
      .findMany({
        where: PUBLIC_RELEASE_WHERE,
        orderBy: PUBLIC_RELEASE_ORDER,
        take: RELEASE_LIMIT,
        select: {
          id: true,
          title: true,
          slug: true,
          type: true,
          coverImageUrl: true,
          releaseDate: true,
          spotifyUrl: true,
          bandcampUrl: true,
          youtubeUrl: true,
          soundcloudUrl: true,
          appleMusicUrl: true,
          primaryPlayer: true,
          _count: { select: { tracks: true } },
        },
      })
      .catch(() => []),
    prisma.video
      .findMany({
        where: PUBLIC_VIDEO_WHERE,
        orderBy: PUBLIC_VIDEO_ORDER,
        take: VIDEO_LIMIT,
        select: { id: true, title: true, youtubeUrl: true, youtubeId: true, kind: true },
      })
      .catch(() => []),
    getPublicShows().catch(() => []),
    prisma.certificateAward.findMany({ orderBy: { displayOrder: "asc" } }).catch(() => []),
  ]);

  const { upcoming, past } = splitShows(shows);
  // Upcoming first, then the most recent played — what a booker wants to know
  // is "are they active", and those are the rows that answer it.
  const selectedShows = [...upcoming, ...past].slice(0, SHOW_LIMIT);

  const photos = (
    profile?.profileImages?.length ? profile.profileImages : profile?.profileImage ? [profile.profileImage] : []
  ).slice(0, PHOTO_LIMIT);

  return {
    profile,
    bandName: profile?.displayName || "ScriptOverNovel",
    members,
    genres: skills.map((s) => s.name),
    socialLinks,
    releases,
    videos,
    selectedShows,
    showCount: shows.length,
    awards,
    photos,
    // Split, not a total: "shows played" has to mean shows that happened. The
    // band's four dated-as-TBA rows are all *upcoming*, and counting them as
    // played would have the press kit claim a history it doesn't have.
    playedCount: past.length,
    upcomingCount: upcoming.length,
    quotes: resolvePressQuotes(profile?.pressQuotes),
    logoUrl: await getSiteLogoUrl(profile?.logoImage).catch(() => null),
  };
}

export type PressKit = Awaited<ReturnType<typeof getPressKit>>;
