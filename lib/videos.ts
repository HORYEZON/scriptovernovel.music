// lib/videos.ts
//
// Single source for the Videos module: kinds and labels, the YouTube-only
// sanitizer (stores the 11-char id beside the URL), and the shape the
// public page and the admin share. Client-safe.
import { parseYouTube } from "@/lib/embeds";

export const VIDEO_KINDS = ["MUSIC_VIDEO", "LIVE", "BEHIND_THE_SCENES"] as const;
export type VideoKind = (typeof VIDEO_KINDS)[number];

export const VIDEO_KIND_LABELS: Record<VideoKind, string> = {
  MUSIC_VIDEO: "Music video",
  LIVE: "Live",
  BEHIND_THE_SCENES: "Behind the scenes",
};

export function isVideoKind(value: unknown): value is VideoKind {
  return typeof value === "string" && (VIDEO_KINDS as readonly string[]).includes(value);
}

export const MAX_VIDEO_TITLE = 120;
export const MAX_VIDEO_DESCRIPTION = 1000;

/** A pasted YouTube link → { youtubeUrl, youtubeId }, or null. */
export function sanitizeYouTube(input: unknown): { youtubeUrl: string; youtubeId: string } | null {
  if (typeof input !== "string") return null;
  const parsed = parseYouTube(input);
  if (!parsed?.id) return null;
  return { youtubeUrl: input.trim(), youtubeId: parsed.id };
}

export function youtubeThumbnail(id: string, size: "hq" | "max" = "hq"): string {
  return `https://i.ytimg.com/vi/${id}/${size === "max" ? "maxresdefault" : "hqdefault"}.jpg`;
}

export interface PublicVideo {
  id: string;
  title: string;
  youtubeUrl: string;
  youtubeId: string;
  kind: VideoKind;
  description: string | null;
  featured: boolean;
  release: { id: string; title: string; slug: string | null } | null;
}
