// lib/museum/lyricsTimeline.ts
//
// Which lyric line the Lyrics Wall should be showing at a given moment of a
// record. Lyrics carry no timestamps (ReleaseTrack.lyrics is plain text), so
// this is an honest approximation: the audio's timeline is split across the
// release's tracks by their durationSec (evenly when unset), and inside a
// track the lines are spread in proportion to their length, with the first
// line landing 3 % in and the last one ending at 97 %. Pure functions, no
// I/O — shared by the wall (three.js) and the turntable panel (DOM).

export interface LyricLine {
  trackIndex: number;
  lineIndex: number;
  text: string;
  /** Start / end as fractions of the whole record (0–1). */
  start: number;
  end: number;
}

export interface LyricsTrack {
  title: string;
  durationSec: number | null;
  lyrics: string | null;
}

const LEAD_IN = 0.03;
const TAIL = 0.03;

/** Non-empty lines of a lyrics block; section headers in [brackets] and
 *  blank lines are dropped. */
export function lyricLines(lyrics: string | null | undefined): string[] {
  if (!lyrics) return [];
  return lyrics
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !/^\[.*\]$/.test(l));
}

/** The whole record's lyric timeline: every line with its fractional window. */
export function buildLyricsTimeline(tracks: LyricsTrack[]): LyricLine[] {
  if (tracks.length === 0) return [];
  // Track windows: by duration when every track has one, else evenly.
  const allTimed = tracks.every((t) => t.durationSec && t.durationSec > 0);
  const total = allTimed ? tracks.reduce((s, t) => s + (t.durationSec ?? 0), 0) : tracks.length;
  const out: LyricLine[] = [];
  let cursor = 0;
  tracks.forEach((track, trackIndex) => {
    const share = allTimed ? (track.durationSec ?? 0) / total : 1 / total;
    const trackStart = cursor;
    const trackEnd = cursor + share;
    cursor = trackEnd;
    const lines = lyricLines(track.lyrics);
    if (lines.length === 0) return;
    const usable = share * (1 - LEAD_IN - TAIL);
    const weight = lines.reduce((s, l) => s + Math.max(8, l.length), 0);
    let lineCursor = trackStart + share * LEAD_IN;
    lines.forEach((text, lineIndex) => {
      const w = (Math.max(8, text.length) / weight) * usable;
      out.push({ trackIndex, lineIndex, text, start: lineCursor, end: lineCursor + w });
      lineCursor += w;
    });
  });
  return out;
}

/** Index into the timeline for a playback position, or -1 before the first
 *  line / after the last. */
export function lineIndexAt(timeline: LyricLine[], currentTime: number, duration: number): number {
  if (timeline.length === 0 || !duration || duration <= 0) return -1;
  const f = Math.max(0, Math.min(1, currentTime / duration));
  for (let i = 0; i < timeline.length; i += 1) {
    if (f >= timeline[i].start && f < timeline[i].end) return i;
  }
  return -1;
}

/** Which track a playback position falls in (by the same split). */
export function trackIndexAt(tracks: LyricsTrack[], currentTime: number, duration: number): number {
  if (tracks.length === 0 || !duration) return -1;
  const allTimed = tracks.every((t) => t.durationSec && t.durationSec > 0);
  const total = allTimed ? tracks.reduce((s, t) => s + (t.durationSec ?? 0), 0) : tracks.length;
  const f = Math.max(0, Math.min(0.999999, currentTime / duration));
  let cursor = 0;
  for (let i = 0; i < tracks.length; i += 1) {
    const share = allTimed ? (tracks[i].durationSec ?? 0) / total : 1 / total;
    cursor += share;
    if (f < cursor) return i;
  }
  return tracks.length - 1;
}
