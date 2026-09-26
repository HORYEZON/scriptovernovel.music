// lib/museum/lyricsTimeline.ts
//
// Which lyric line the Lyrics Wall should be showing at a given moment of a
// record. Pure functions, no I/O — shared by the wall (three.js) and the
// turntable panel (DOM).
//
// Two modes, and a record is in one or the other:
//
// - **Synced.** Every track that has lyrics has a full set of `lyricTimings` —
//   real per-line seconds into this record's audio file, tapped in by the admin
//   (Releases → a track → Sync lyrics). The wall follows them exactly.
// - **Estimated**, the original behaviour and the fallback: lyrics carry no
//   timestamps, so the audio is split across the tracks by `durationSec`
//   (evenly when unset) and inside a track the lines are spread in proportion
//   to their length, first line landing 3 % in, last ending at 97 %.
//
// All-or-nothing on purpose: a record that was synced for two tracks out of six
// would otherwise lurch between real timings and guesses mid-side, which reads
// as a bug rather than as a partial job.

export interface LyricLine {
  trackIndex: number;
  lineIndex: number;
  text: string;
  /** Start / end as fractions of the whole record (0–1). Estimated mode. */
  start: number;
  end: number;
  /** Absolute seconds into the record's audio. Present only in synced mode —
   *  its presence on the first line is what tells `lineIndexAt` which mode
   *  it's reading. */
  startSec?: number;
}

export interface LyricsTrack {
  title: string;
  durationSec: number | null;
  lyrics: string | null;
  /** The raw Json column; sanitized here rather than trusted. */
  lyricTimings?: unknown;
}

const LEAD_IN = 0.03;
const TAIL = 0.03;

export { lyricLines } from "@/lib/lyrics";
import { hasSyncedLyrics, lyricLines, resolveLyricTimings } from "@/lib/lyrics";

/**
 * Is every lyric-bearing track on this record fully timed?
 *
 * A record with no lyrics at all is not "synced" — there is nothing to sync —
 * so this is false for it and the estimator (which also produces nothing) runs.
 */
function isSynced(tracks: LyricsTrack[]): boolean {
  let sawLyrics = false;
  for (const track of tracks) {
    const lines = lyricLines(track.lyrics);
    if (lines.length === 0) continue;
    sawLyrics = true;
    if (!hasSyncedLyrics(resolveLyricTimings(track.lyricTimings, lines.length), lines.length)) {
      return false;
    }
  }
  return sawLyrics;
}

/** The whole record's lyric timeline: every line with its window. */
export function buildLyricsTimeline(tracks: LyricsTrack[]): LyricLine[] {
  if (tracks.length === 0) return [];

  if (isSynced(tracks)) {
    // Synced mode: the stored seconds are the answer. `start`/`end` are still
    // filled in (as a share of MAX-less span) only so the shape stays uniform —
    // nothing reads them once `startSec` is set.
    const out: LyricLine[] = [];
    tracks.forEach((track, trackIndex) => {
      const lines = lyricLines(track.lyrics);
      if (lines.length === 0) return;
      const timings = resolveLyricTimings(track.lyricTimings, lines.length);
      lines.forEach((text, lineIndex) => {
        out.push({
          trackIndex,
          lineIndex,
          text,
          start: 0,
          end: 0,
          startSec: timings[lineIndex],
        });
      });
    });
    // Tapped track by track, but the wall reads one continuous record.
    out.sort((a, b) => (a.startSec ?? 0) - (b.startSec ?? 0));
    return out;
  }

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

/**
 * Index into the timeline for a playback position, or -1 before the first line
 * (and, in estimated mode, in the gaps at either end).
 *
 * Synced mode needs no duration: a line runs from its own second until the next
 * one, and the last runs to the end of the record — which is why a synced wall
 * shows the closing line instead of blanking on the outro the estimator's 97 %
 * tail used to cut off.
 */
export function lineIndexAt(timeline: LyricLine[], currentTime: number, duration: number): number {
  if (timeline.length === 0) return -1;

  if (timeline[0].startSec !== undefined) {
    if (currentTime < (timeline[0].startSec ?? 0)) return -1;
    for (let i = timeline.length - 1; i >= 0; i -= 1) {
      if (currentTime >= (timeline[i].startSec ?? 0)) return i;
    }
    return -1;
  }

  if (!duration || duration <= 0) return -1;
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
