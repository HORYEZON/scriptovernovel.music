// lib/embeds.ts
//
// One parser for every streaming link the site embeds — YouTube, Spotify,
// Bandcamp, SoundCloud, Apple Music. Client-safe (no Node APIs), shared by
// the public players (EmbedFrame), the admin forms' live previews, and the
// API sanitizers, so a URL that renders is exactly a URL that was allowed
// to be stored. Same "single source, imported by all three" arrangement as
// lib/contact.ts.
//
// Everything goes through `new URL()` and a host allow-list: only http(s),
// only known hosts, never longer than MAX_EMBED_URL. That is also the whole
// XSS guard for these fields — a pasted `javascript:` link never parses, so
// it never reaches an href or an iframe src.

export type EmbedProvider = "youtube" | "spotify" | "bandcamp" | "soundcloud" | "applemusic";

export type EmbedKind = "video" | "track" | "album" | "playlist" | "artist" | "link";

export interface ParsedEmbed {
  provider: EmbedProvider;
  kind: EmbedKind;
  /** Provider's own id where one exists (YouTube video id, Spotify id). */
  id: string | null;
  /** Cleaned "open in" link — tracking params dropped. */
  canonicalUrl: string;
  /** Player iframe src, or null when the provider can only be linked to. */
  embedUrl: string | null;
  /** Poster image, YouTube only. */
  thumbnailUrl: string | null;
}

export const EMBED_PROVIDERS: EmbedProvider[] = ["spotify", "bandcamp", "youtube", "soundcloud", "applemusic"];

export const EMBED_PROVIDER_LABELS: Record<EmbedProvider, string> = {
  youtube: "YouTube",
  spotify: "Spotify",
  bandcamp: "Bandcamp",
  soundcloud: "SoundCloud",
  applemusic: "Apple Music",
};

export const MAX_EMBED_URL = 2048;

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
  "youtu.be",
]);
const SPOTIFY_HOSTS = new Set(["open.spotify.com", "play.spotify.com"]);
const SOUNDCLOUD_HOSTS = new Set(["soundcloud.com", "www.soundcloud.com", "m.soundcloud.com", "on.soundcloud.com"]);
const APPLE_HOSTS = new Set(["music.apple.com", "embed.music.apple.com"]);

const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const SPOTIFY_ID_RE = /^[A-Za-z0-9]{22}$/;
const SPOTIFY_KINDS = new Set<EmbedKind>(["track", "album", "playlist", "artist"]);

function safeUrl(input: unknown): URL | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed || trimmed.length > MAX_EMBED_URL) return null;
  // Spotify URIs (spotify:track:ID) are the one non-http form we accept.
  const candidate = /^spotify:(track|album|playlist|artist):([A-Za-z0-9]{22})$/.exec(trimmed);
  if (candidate) return new URL(`https://open.spotify.com/${candidate[1]}/${candidate[2]}`);
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  return url;
}

/** "t=1m30s" / "start=90" → seconds, for a YouTube deep link. */
function youtubeStartSeconds(url: URL): number | null {
  const raw = url.searchParams.get("start") ?? url.searchParams.get("t");
  if (!raw) return null;
  if (/^\d+s?$/.test(raw)) return parseInt(raw, 10);
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(raw);
  if (!m || raw === "") return null;
  const secs = (parseInt(m[1] ?? "0", 10) || 0) * 3600 + (parseInt(m[2] ?? "0", 10) || 0) * 60 + (parseInt(m[3] ?? "0", 10) || 0);
  return secs > 0 ? secs : null;
}

export function parseYouTube(input: unknown): ParsedEmbed | null {
  const url = safeUrl(input);
  if (!url || !YOUTUBE_HOSTS.has(url.hostname)) return null;
  let id: string | null = null;
  const parts = url.pathname.split("/").filter(Boolean);
  if (url.hostname === "youtu.be") {
    id = parts[0] ?? null;
  } else if (parts[0] === "watch") {
    id = url.searchParams.get("v");
  } else if (parts[0] === "shorts" || parts[0] === "embed" || parts[0] === "live" || parts[0] === "v") {
    id = parts[1] ?? null;
  }
  if (!id || !YOUTUBE_ID_RE.test(id)) return null;
  const start = youtubeStartSeconds(url);
  return {
    provider: "youtube",
    kind: "video",
    id,
    canonicalUrl: `https://www.youtube.com/watch?v=${id}${start ? `&t=${start}s` : ""}`,
    embedUrl: `https://www.youtube-nocookie.com/embed/${id}${start ? `?start=${start}` : ""}`,
    thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
  };
}

export function parseSpotify(input: unknown): ParsedEmbed | null {
  const url = safeUrl(input);
  if (!url || !SPOTIFY_HOSTS.has(url.hostname)) return null;
  const parts = url.pathname.split("/").filter(Boolean);
  // Localised links carry an "intl-xx" segment first; embed links "embed".
  if (parts[0] && (/^intl-[a-z]{2}$/i.test(parts[0]) || parts[0] === "embed")) parts.shift();
  const kind = parts[0] as EmbedKind | undefined;
  const id = parts[1];
  if (!kind || !SPOTIFY_KINDS.has(kind) || !id || !SPOTIFY_ID_RE.test(id)) return null;
  return {
    provider: "spotify",
    kind,
    id,
    canonicalUrl: `https://open.spotify.com/${kind}/${id}`,
    embedUrl: `https://open.spotify.com/embed/${kind}/${id}?theme=0`,
    thumbnailUrl: null,
  };
}

export function parseBandcamp(input: unknown): ParsedEmbed | null {
  const url = safeUrl(input);
  if (!url) return null;
  const host = url.hostname;
  if (host !== "bandcamp.com" && !host.endsWith(".bandcamp.com")) return null;
  // Bandcamp's player needs an album/track id that only its Share → Embed
  // dialog knows, so a page URL is link-only. An EmbeddedPlayer URL pasted
  // from that dialog is used as-is.
  const isPlayer = host === "bandcamp.com" && url.pathname.startsWith("/EmbeddedPlayer/");
  const canonical = `${url.origin}${url.pathname}`;
  return {
    provider: "bandcamp",
    kind: isPlayer ? "album" : url.pathname.startsWith("/track/") ? "track" : url.pathname.startsWith("/album/") ? "album" : "link",
    id: null,
    canonicalUrl: canonical,
    embedUrl: isPlayer ? `https://bandcamp.com${url.pathname}` : null,
    thumbnailUrl: null,
  };
}

export function parseSoundCloud(input: unknown): ParsedEmbed | null {
  const url = safeUrl(input);
  if (!url || !SOUNDCLOUD_HOSTS.has(url.hostname)) return null;
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length === 0) return null;
  const canonical = `https://soundcloud.com/${parts.join("/")}`;
  const kind: EmbedKind = parts.length >= 3 && parts[1] === "sets" ? "playlist" : parts.length >= 2 ? "track" : "artist";
  return {
    provider: "soundcloud",
    kind,
    id: null,
    canonicalUrl: canonical,
    // Public permalinks work directly in the widget — no oEmbed round-trip.
    embedUrl: `https://w.soundcloud.com/player/?url=${encodeURIComponent(canonical)}&color=%23c8a96e&auto_play=false&hide_related=true&show_comments=false&visual=true`,
    thumbnailUrl: null,
  };
}

export function parseAppleMusic(input: unknown): ParsedEmbed | null {
  const url = safeUrl(input);
  if (!url || !APPLE_HOSTS.has(url.hostname)) return null;
  const parts = url.pathname.split("/").filter(Boolean);
  // /{storefront}/{album|song|playlist|artist}/{slug}/{id}
  const kindWord = parts[1];
  if (!kindWord) return null;
  const kind: EmbedKind =
    kindWord === "song" ? "track" : kindWord === "album" ? "album" : kindWord === "playlist" ? "playlist" : kindWord === "artist" ? "artist" : "link";
  const path = `/${parts.join("/")}`;
  const query = url.searchParams.get("i") ? `?i=${encodeURIComponent(url.searchParams.get("i") as string)}` : "";
  return {
    provider: "applemusic",
    kind,
    id: parts[parts.length - 1] ?? null,
    canonicalUrl: `https://music.apple.com${path}${query}`,
    embedUrl: kind === "link" ? null : `https://embed.music.apple.com${path}${query}`,
    thumbnailUrl: null,
  };
}

const PARSERS: Record<EmbedProvider, (input: unknown) => ParsedEmbed | null> = {
  youtube: parseYouTube,
  spotify: parseSpotify,
  bandcamp: parseBandcamp,
  soundcloud: parseSoundCloud,
  applemusic: parseAppleMusic,
};

export function providerFromUrl(input: unknown): EmbedProvider | null {
  const url = safeUrl(input);
  if (!url) return null;
  const host = url.hostname;
  if (YOUTUBE_HOSTS.has(host)) return "youtube";
  if (SPOTIFY_HOSTS.has(host)) return "spotify";
  if (host === "bandcamp.com" || host.endsWith(".bandcamp.com")) return "bandcamp";
  if (SOUNDCLOUD_HOSTS.has(host)) return "soundcloud";
  if (APPLE_HOSTS.has(host)) return "applemusic";
  return null;
}

/** Any supported link → its parsed form, or null when it isn't one. */
export function parseEmbed(input: unknown): ParsedEmbed | null {
  const provider = providerFromUrl(input);
  return provider ? PARSERS[provider](input) : null;
}

/** API-side check: a link that parses (for the given provider, if named). */
export function isValidEmbedUrl(input: unknown, provider?: EmbedProvider): input is string {
  const parsed = provider ? PARSERS[provider](input) : parseEmbed(input);
  return parsed !== null;
}

/** Trimmed URL to store, or null for empty/invalid — the API's field
 *  sanitizer. Stores what the admin typed (trimmed), not the canonical form,
 *  so a Bandcamp EmbeddedPlayer URL survives a round trip. */
export function sanitizeEmbedUrl(input: unknown, provider: EmbedProvider): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  return PARSERS[provider](trimmed) ? trimmed : null;
}
