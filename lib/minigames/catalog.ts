// lib/minigames/catalog.ts
//
// The music games' raw material: every published release with its tracks
// (and their lyrics), read once per session start. Server only. The
// challenge generator picks from this; nothing here reaches the browser
// except what a redacted challenge carries.
import { prisma } from "@/lib/prisma";
import type { GameReleaseOption } from "./types";

export interface CatalogTrack {
  id: string;
  title: string;
  lyrics: string | null;
}

export interface CatalogRelease extends GameReleaseOption {
  releaseDate: Date | null;
  tracks: CatalogTrack[];
}

export type CatalogSnapshot = CatalogRelease[];

export async function loadCatalog(): Promise<CatalogSnapshot> {
  const rows = await prisma.release.findMany({
    where: { published: true, deletedAt: null },
    orderBy: [{ releaseDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    select: {
      id: true,
      title: true,
      coverImageUrl: true,
      releaseDate: true,
      tracks: { orderBy: { trackNumber: "asc" }, select: { id: true, title: true, lyrics: true } },
    },
  });
  return rows;
}

/** Counts the admin's "is this game playable" check needs — one query,
 *  shared by every game on the dashboard. */
export interface CatalogCounts {
  releases: number;
  datedReleases: number;
  releasesWithTracks: number;
  tracksWithLyrics: number;
}

export async function loadCatalogCounts(): Promise<CatalogCounts> {
  const [releases, datedReleases, releasesWithTracks, tracksWithLyrics] = await Promise.all([
    prisma.release.count({ where: { published: true, deletedAt: null } }),
    prisma.release.count({ where: { published: true, deletedAt: null, releaseDate: { not: null } } }),
    prisma.release.count({ where: { published: true, deletedAt: null, tracks: { some: {} } } }),
    prisma.releaseTrack.count({ where: { lyrics: { not: null }, release: { published: true, deletedAt: null } } }),
  ]);
  return { releases, datedReleases, releasesWithTracks, tracksWithLyrics };
}

/** Lyric lines usable for a blank: at least three words, no chorus tags. */
export function lyricLines(lyrics: string): string[] {
  return lyrics
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !/^\[.*\]$/.test(l) && l.split(/\s+/).length >= 3);
}

/** Words worth blanking: 4+ letters, not stopwords. */
const STOPWORDS = new Set(["that", "this", "with", "from", "have", "your", "what", "when", "were", "they", "them", "then", "than", "there", "here", "just", "into", "like", "will", "been", "some", "every", "over", "only"]);
export function blankableWords(line: string): string[] {
  return line
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}'-]/gu, ""))
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w.toLowerCase()));
}
