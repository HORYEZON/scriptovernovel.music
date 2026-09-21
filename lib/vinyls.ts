// lib/vinyls.ts
//
// Single source for the Vinyls module (the records that hang in the Digital
// Museum's Vinyl Room): limits and the shared types. Client-safe — mirrors
// lib/videos.ts. A vinyl is one Release plus one uploaded audio file; the
// cover, title and tracklist all come from the release.

export const MAX_SIDE_LABEL = 40;

/** The audio formats the deck can play — same list the museum soundtrack
 *  uploader accepts (lib/background-music.ts). */
export const VINYL_AUDIO_EXTENSIONS = [".mp3", ".wav", ".ogg", ".aac", ".m4a"] as const;

export interface VinylReleaseSummary {
  id: string;
  title: string;
  slug: string | null;
  coverImageUrl: string;
  published: boolean;
  trackCount: number;
}

/** One record as the admin list sees it. */
export interface AdminVinyl {
  id: string;
  releaseId: string;
  audioUrl: string;
  sideLabel: string | null;
  published: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  release: VinylReleaseSummary;
}
