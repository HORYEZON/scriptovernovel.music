// lib/releases.ts
//
// Single source for the Release module (the band's singles / EPs / albums):
// the type list and labels, which streaming platforms a release can carry,
// the "which player do we show" rule, and the sanitizers the API route and
// the admin form share. Client-safe — mirrors lib/stories.ts.
import { EMBED_PROVIDERS, parseEmbed, sanitizeEmbedUrl, type EmbedProvider, type ParsedEmbed } from "@/lib/embeds";

export const RELEASE_TYPES = ["SINGLE", "EP", "ALBUM", "LIVE", "COMPILATION"] as const;
export type ReleaseType = (typeof RELEASE_TYPES)[number];

export const RELEASE_TYPE_LABELS: Record<ReleaseType, string> = {
  SINGLE: "Single",
  EP: "EP",
  ALBUM: "Album",
  LIVE: "Live",
  COMPILATION: "Compilation",
};

export function isReleaseType(value: unknown): value is ReleaseType {
  return typeof value === "string" && (RELEASE_TYPES as readonly string[]).includes(value);
}

/** The platform link columns on Release, keyed by provider. */
export const RELEASE_LINK_FIELDS: Record<EmbedProvider, "spotifyUrl" | "bandcampUrl" | "youtubeUrl" | "soundcloudUrl" | "appleMusicUrl"> = {
  spotify: "spotifyUrl",
  bandcamp: "bandcampUrl",
  youtube: "youtubeUrl",
  soundcloud: "soundcloudUrl",
  applemusic: "appleMusicUrl",
};

/** Which player to show when the admin hasn't picked one: the first of
 *  these that has a link *and* can actually embed (a Bandcamp page URL
 *  is link-only, so it never wins the player slot by itself). */
export const PLAYER_PREFERENCE: EmbedProvider[] = ["spotify", "bandcamp", "youtube", "soundcloud", "applemusic"];

export interface ReleaseLinks {
  spotifyUrl: string | null;
  bandcampUrl: string | null;
  youtubeUrl: string | null;
  soundcloudUrl: string | null;
  appleMusicUrl: string | null;
  primaryPlayer: string | null;
}

/** Every platform link a release has, parsed, in preference order. */
export function releaseEmbeds(r: ReleaseLinks): ParsedEmbed[] {
  const out: ParsedEmbed[] = [];
  for (const provider of PLAYER_PREFERENCE) {
    const url = r[RELEASE_LINK_FIELDS[provider]];
    const parsed = url ? parseEmbed(url) : null;
    if (parsed) out.push(parsed);
  }
  return out;
}

/** The one embed the site plays for this release, or null (links only). */
export function primaryEmbed(r: ReleaseLinks): ParsedEmbed | null {
  const embeds = releaseEmbeds(r);
  if (r.primaryPlayer) {
    const chosen = embeds.find((e) => e.provider === r.primaryPlayer && e.embedUrl);
    if (chosen) return chosen;
  }
  return embeds.find((e) => e.embedUrl) ?? null;
}

export const MAX_RELEASE_TITLE = 120;
export const MAX_RELEASE_DESCRIPTION = 2000;
export const MAX_TRACK_TITLE = 120;
export const MAX_TRACK_LYRICS = 8000;
export const MAX_TRACKS = 40;

export interface ReleaseTrackInput {
  title: string;
  durationSec: number | null;
  url: string | null;
  lyrics: string | null;
}

/** Tracklist as sent by the admin form → rows to store (numbered 1..n), or
 *  an error message. Blank titles are dropped rather than rejected so an
 *  admin can leave empty rows in the editor. */
export function sanitizeTracks(input: unknown): { tracks: ReleaseTrackInput[] } | { error: string } {
  if (input === undefined || input === null) return { tracks: [] };
  if (!Array.isArray(input)) return { error: "Tracks must be a list." };
  if (input.length > MAX_TRACKS) return { error: `A release can list at most ${MAX_TRACKS} tracks.` };
  const tracks: ReleaseTrackInput[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const t = raw as Record<string, unknown>;
    const title = typeof t.title === "string" ? t.title.trim() : "";
    if (!title) continue;
    if (title.length > MAX_TRACK_TITLE) return { error: `Track titles are at most ${MAX_TRACK_TITLE} characters.` };
    let durationSec: number | null = null;
    if (t.durationSec !== undefined && t.durationSec !== null && t.durationSec !== "") {
      const n = typeof t.durationSec === "number" ? t.durationSec : Number(t.durationSec);
      if (!Number.isInteger(n) || n < 0 || n > 24 * 3600) return { error: `"${title}": duration must be whole seconds.` };
      durationSec = n;
    }
    let url: string | null = null;
    if (typeof t.url === "string" && t.url.trim()) {
      const parsed = parseEmbed(t.url);
      if (!parsed) return { error: `"${title}": the link isn't a Spotify, YouTube, Bandcamp, SoundCloud or Apple Music URL.` };
      url = t.url.trim();
    }
    const lyricsRaw = typeof t.lyrics === "string" ? t.lyrics.replace(/\r\n/g, "\n").trim() : "";
    if (lyricsRaw.length > MAX_TRACK_LYRICS) return { error: `"${title}": lyrics are at most ${MAX_TRACK_LYRICS} characters.` };
    tracks.push({ title, durationSec, url, lyrics: lyricsRaw || null });
  }
  return { tracks };
}

/** Platform link fields from a request body → validated values (null =
 *  clear), or an error naming the bad one. Fields not present are left
 *  undefined so a PATCH can be partial. */
export function sanitizeReleaseLinks(
  body: Record<string, unknown>
): { links: Partial<ReleaseLinks> } | { error: string } {
  const links: Partial<ReleaseLinks> = {};
  for (const provider of EMBED_PROVIDERS) {
    const field = RELEASE_LINK_FIELDS[provider];
    if (!(field in body)) continue;
    const raw = body[field];
    if (raw === null || raw === "" || raw === undefined) {
      links[field] = null;
      continue;
    }
    const clean = sanitizeEmbedUrl(raw, provider);
    if (!clean) return { error: `That doesn't look like a ${provider === "applemusic" ? "Apple Music" : provider} link.` };
    links[field] = clean;
  }
  if ("primaryPlayer" in body) {
    const p = body.primaryPlayer;
    if (p === null || p === "" || p === undefined) links.primaryPlayer = null;
    else if (typeof p === "string" && (EMBED_PROVIDERS as readonly string[]).includes(p)) links.primaryPlayer = p;
    else return { error: "Unknown player." };
  }
  return { links };
}

/** "3:42" → 222; a bare number is seconds. Null for blank/unparseable. */
export function parseDuration(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  const m = /^(\d{1,3}):([0-5]?\d)$/.exec(t);
  if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  const n = Number(t);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

export function formatDuration(sec: number | null | undefined): string {
  if (sec === null || sec === undefined) return "";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatReleaseDate(iso: string | Date | null | undefined, style: "long" | "year" = "long"): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  if (style === "year") return d.toLocaleDateString("en-PH", { year: "numeric", timeZone: "Asia/Manila" });
  return d.toLocaleDateString("en-PH", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Manila" });
}
