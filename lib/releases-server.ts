// lib/releases-server.ts
//
// Server-only Release helpers: the Prisma include every reader uses, the
// public query, and the "which release fronts the site" pick. Imported by
// the API routes, /music, and the homepage's hero and Latest release
// sections. Not client-safe (imports Prisma).
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ReleaseTrackInput } from "@/lib/releases";

export const RELEASE_INCLUDE = {
  tracks: { orderBy: { trackNumber: "asc" as const } },
} satisfies Prisma.ReleaseInclude;

export type ReleaseWithTracks = Prisma.ReleaseGetPayload<{ include: typeof RELEASE_INCLUDE }>;

/** Live, published releases: newest release date first, undated last, then
 *  the admin's manual order. */
export const PUBLIC_RELEASE_ORDER: Prisma.ReleaseOrderByWithRelationInput[] = [
  { releaseDate: { sort: "desc", nulls: "last" } },
  { sortOrder: "asc" },
  { createdAt: "desc" },
];

export const PUBLIC_RELEASE_WHERE: Prisma.ReleaseWhereInput = { published: true, deletedAt: null };

export async function getPublicReleases(): Promise<ReleaseWithTracks[]> {
  return prisma.release.findMany({
    where: PUBLIC_RELEASE_WHERE,
    include: RELEASE_INCLUDE,
    orderBy: PUBLIC_RELEASE_ORDER,
  });
}

/**
 * Everything /music/[slug] shows: the tracklist, the videos made for this
 * release and whether it exists as a record in the Vinyl Room. The nested
 * `where`s matter — an unpublished video or a trashed vinyl must not surface
 * on a public page just because its release is published.
 */
export const RELEASE_DETAIL_INCLUDE = {
  tracks: { orderBy: { trackNumber: "asc" as const } },
  videos: {
    where: { published: true, deletedAt: null },
    orderBy: [{ featured: "desc" as const }, { sortOrder: "asc" as const }, { createdAt: "desc" as const }],
  },
  vinyls: {
    where: { published: true, deletedAt: null },
    orderBy: { sortOrder: "asc" as const },
    select: { id: true, sideLabel: true },
  },
} satisfies Prisma.ReleaseInclude;

export type ReleaseDetail = Prisma.ReleaseGetPayload<{ include: typeof RELEASE_DETAIL_INCLUDE }>;

/**
 * One published release by its slug — or by its id, because `Release.slug` is
 * nullable: it is generated on create, so a row that predates that is only
 * reachable by id, and every link on the site is written `slug ?? id`. Looking
 * both up here is what keeps those links from 404ing.
 */
export async function getPublicReleaseBySlug(slugOrId: string): Promise<ReleaseDetail | null> {
  return prisma.release.findFirst({
    where: { ...PUBLIC_RELEASE_WHERE, OR: [{ slug: slugOrId }, { id: slugOrId }] },
    include: RELEASE_DETAIL_INCLUDE,
  });
}

/**
 * One track's lyrics page: the track, its release, the neighbours either side,
 * and the record's audio (so a synced track can actually be played along to).
 *
 * `trackKey` is a slug *or* a track number — `ReleaseTrack.slug` is nullable for
 * rows written before it existed, and `trackLyricsHref` writes
 * `slug ?? trackNumber` for exactly that reason.
 */
export async function getPublicTrackPage(releaseSlugOrId: string, trackKey: string) {
  const release = await prisma.release.findFirst({
    where: { ...PUBLIC_RELEASE_WHERE, OR: [{ slug: releaseSlugOrId }, { id: releaseSlugOrId }] },
    include: {
      tracks: { orderBy: { trackNumber: "asc" } },
      vinyls: {
        where: { published: true, deletedAt: null },
        orderBy: { sortOrder: "asc" },
        take: 1,
        select: { audioUrl: true, sideLabel: true },
      },
    },
  });
  if (!release) return null;

  const asNumber = Number(trackKey);
  const track =
    release.tracks.find((t) => t.slug === trackKey) ??
    (Number.isInteger(asNumber) ? release.tracks.find((t) => t.trackNumber === asNumber) : undefined);
  if (!track) return null;

  const index = release.tracks.findIndex((t) => t.id === track.id);
  return {
    release,
    track,
    trackIndex: index,
    previous: index > 0 ? release.tracks[index - 1] : null,
    next: index < release.tracks.length - 1 ? release.tracks[index + 1] : null,
    // Timings are seconds into this file — see lib/lyrics.ts.
    vinylAudioUrl: release.vinyls[0]?.audioUrl ?? null,
  };
}

/** Every published track that has lyrics, for the sitemap's lyrics pages. */
export async function getPublicLyricTracks() {
  return prisma.releaseTrack.findMany({
    where: { lyrics: { not: null }, release: PUBLIC_RELEASE_WHERE },
    orderBy: [{ releaseId: "asc" }, { trackNumber: "asc" }],
    select: {
      slug: true,
      trackNumber: true,
      release: { select: { id: true, slug: true, updatedAt: true } },
    },
  });
}

/** The rest of the discography, for the "More releases" strip at the foot of
 *  a release page. */
export async function getOtherReleases(excludeId: string, take = 6) {
  return prisma.release.findMany({
    where: { ...PUBLIC_RELEASE_WHERE, NOT: { id: excludeId } },
    orderBy: PUBLIC_RELEASE_ORDER,
    take,
    select: { id: true, title: true, slug: true, type: true, coverImageUrl: true, releaseDate: true },
  });
}

/** The release the homepage leads with: the featured one (newest if several),
 *  else the newest published. Null when nothing is published. */
export async function getLeadRelease(): Promise<ReleaseWithTracks | null> {
  const featured = await prisma.release.findFirst({
    where: { ...PUBLIC_RELEASE_WHERE, featured: true },
    include: RELEASE_INCLUDE,
    orderBy: PUBLIC_RELEASE_ORDER,
  });
  if (featured) return featured;
  return prisma.release.findFirst({
    where: PUBLIC_RELEASE_WHERE,
    include: RELEASE_INCLUDE,
    orderBy: PUBLIC_RELEASE_ORDER,
  });
}

/**
 * Sanitized track rows → Prisma create input, numbered 1..n.
 *
 * Exists for one reason: `lyricTimings` is a *nullable* Json column, and Prisma
 * refuses a plain `null` there — a JSON `null` and a SQL NULL are different
 * values, so it makes you say which (`Prisma.DbNull` is the SQL one). Both write
 * routes go through this so they can't spell it differently.
 */
export function trackCreateRows<T extends ReleaseTrackInput>(tracks: T[]) {
  return tracks.map((t, i) => ({
    title: t.title,
    durationSec: t.durationSec,
    url: t.url,
    lyrics: t.lyrics,
    slug: t.slug,
    lyricTimings: t.lyricTimings ?? Prisma.DbNull,
    trackNumber: i + 1,
  }));
}

/** Every page a release shows on. The `"page"` form clears every instance of
 *  the dynamic route at once — a title or tracklist edit has to land on the
 *  release's own page too, not only on the list. */
export function revalidateReleasePaths() {
  revalidatePath("/", "layout");
  revalidatePath("/music");
  revalidatePath("/music/[slug]", "page");
  revalidatePath("/admin/releases");
}
