// lib/lyrics.ts
//
// Single source for lyrics: the line splitter, the per-line timings, and the
// address of a track's lyrics page. Client-safe (no Prisma) — shared by the
// public lyrics page, the Vinyl Room's wall, the admin's sync tool and the
// write routes, so none of them can disagree about what a "line" is or what a
// timing means.
//
// **What a timing is.** Seconds into the *record's audio file*
// (VinylRecord.audioUrl), not into the track. That file is the only audio the
// site has — one per record, the thing the turntable plays and the thing the
// admin taps against — so it is the only clock every consumer shares. Storing
// seconds-into-the-track would need a per-track offset nothing can supply, and
// would break the moment a durationSec was left blank.
import { slugify } from "@/lib/utils";

/**
 * Non-empty lines of a lyrics block; section headers in [brackets] and blank
 * lines are dropped.
 *
 * Timings are indexed against *this* list, so every consumer has to split the
 * same way — which is why it lives here and lib/museum/lyricsTimeline.ts
 * re-exports it rather than keeping the copy it used to have.
 *
 * Not to be confused with lib/minigames/catalog.ts's same-named function, which
 * is a different filter (it also drops lines under three words, because a
 * two-word line makes a poor fill-in-the-blank) and is deliberately left alone.
 */
export function lyricLines(lyrics: string | null | undefined): string[] {
  if (!lyrics) return [];
  return lyrics
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !/^\[.*\]$/.test(l));
}

/** Lines *with* the section headers kept, for reading rather than timing — the
 *  page shows "[Chorus]" because that is how the band wrote it down. */
export interface LyricBlock {
  /** The text as written. */
  text: string;
  /** True for a `[Section]` header — rendered differently and never timed. */
  heading: boolean;
  /** Index into the timed line list, or -1 for a heading. */
  timedIndex: number;
}

export function lyricBlocks(lyrics: string | null | undefined): LyricBlock[] {
  if (!lyrics) return [];
  const out: LyricBlock[] = [];
  let timedIndex = 0;
  for (const raw of lyrics.replace(/\r\n/g, "\n").split("\n")) {
    const text = raw.trim();
    if (!text) continue;
    const heading = /^\[.*\]$/.test(text);
    out.push({ text, heading, timedIndex: heading ? -1 : timedIndex });
    if (!heading) timedIndex += 1;
  }
  return out;
}

/** Longest a record can be, for the timing sanity check — 90 minutes is longer
 *  than any vinyl and short enough to catch a milliseconds-vs-seconds mix-up. */
export const MAX_LYRIC_TIMING_SEC = 90 * 60;

/**
 * A stored `lyricTimings` value → a clean number[], or null.
 *
 * Non-negative, non-decreasing, within the record's plausible length, at most
 * `lineCount` long. Sorting rather than rejecting an out-of-order pair is
 * deliberate: the admin nudging one line a second earlier than the one before
 * it means "this line comes first", not "discard my work".
 */
export function sanitizeLyricTimings(input: unknown, lineCount: number): number[] | null {
  if (!Array.isArray(input) || lineCount <= 0) return null;
  const nums: number[] = [];
  for (const raw of input.slice(0, lineCount)) {
    const n = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(n) || n < 0 || n > MAX_LYRIC_TIMING_SEC) return null;
    // Hundredths: finer than anyone can tap, coarser than float noise.
    nums.push(Math.round(n * 100) / 100);
  }
  if (nums.length === 0) return null;
  nums.sort((a, b) => a - b);
  return nums;
}

export function resolveLyricTimings(value: unknown, lineCount: number): number[] {
  return sanitizeLyricTimings(value, lineCount) ?? [];
}

/** Are *all* of this track's lines timed? A partially timed track falls back to
 *  the estimator rather than jumping between the two. */
export function hasSyncedLyrics(timings: number[], lineCount: number): boolean {
  return lineCount > 0 && timings.length >= lineCount;
}

/**
 * Which timed line is showing at `seconds` into the record's audio, or -1
 * before the first. A line runs until the next one starts; the last runs to the
 * end of the audio.
 */
export function lineIndexAtSeconds(timings: number[], seconds: number): number {
  if (timings.length === 0) return -1;
  if (seconds < timings[0]) return -1;
  for (let i = timings.length - 1; i >= 0; i -= 1) {
    if (seconds >= timings[i]) return i;
  }
  return -1;
}

/** "1:23" / "12:05.4" — the admin tool's readout. */
export function formatTimestamp(seconds: number, withTenths = false): string {
  if (!Number.isFinite(seconds) || seconds < 0) return withTenths ? "0:00.0" : "0:00";
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  const whole = Math.floor(s);
  const base = `${m}:${String(whole).padStart(2, "0")}`;
  return withTenths ? `${base}.${Math.floor((s - whole) * 10)}` : base;
}

export const MAX_TRACK_SLUG = 80;

/**
 * A track's slug, from its title, unique within the release.
 *
 * `taken` is every slug already used by the release's other tracks; a clash
 * gets `-2`, `-3` … A title with nothing sluggable (an instrumental called
 * "...") falls back to `track-<n>`, so every track can always be addressed.
 */
export function trackSlug(title: string, trackNumber: number, taken: Set<string>): string {
  const base = slugify(title).slice(0, MAX_TRACK_SLUG) || `track-${trackNumber}`;
  if (!taken.has(base)) return base;
  for (let i = 2; i < 100; i += 1) {
    const candidate = `${base}-${i}`.slice(0, MAX_TRACK_SLUG);
    if (!taken.has(candidate)) return candidate;
  }
  return `track-${trackNumber}`;
}

/** The address of a track's lyrics page. `slug ?? trackNumber` for the same
 *  reason releaseHref is `slug ?? id` — rows predate the slug. */
export function trackLyricsHref(
  release: { slug: string | null; id: string },
  track: { slug: string | null; trackNumber: number }
): string {
  return `/music/${release.slug ?? release.id}/${track.slug ?? track.trackNumber}`;
}
