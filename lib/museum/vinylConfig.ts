// lib/museum/vinylConfig.ts
//
// The Vinyl Room's room-wide settings: what the turntable is (the built-in
// procedural deck, or an uploaded .glb), where it stands, the effect
// amounts a record starts with when it's put on, and the Lyrics Wall —
// which wall, whether it's on, its colours. Stored as a kind-marked
// singleton MuseumSceneObject on the Vinyl Room with the JSON in its
// modelUrl column — the exact "config, not a placement" pattern of
// arcadeConfig.ts (read that file's header first). The museum page parses
// it onto the room (MuseumRoomPublic.vinylConfig), so the row itself never
// travels to the browser.
//
// Client-safe (no prisma) so MuseumScene, the Scene Editor and the API
// route all import it. DB provisioning lives in vinylRoom.ts.

import {
  type BannerFinish,
  MIN_BANNER_EDGE,
  MAX_BANNER_EDGE,
  MIN_BANNER_GLASS_OPACITY,
  MAX_BANNER_GLASS_OPACITY,
  MIN_BANNER_SHIMMER_SPEED,
  MAX_BANNER_SHIMMER_SPEED,
  MIN_BANNER_SHIMMER_STRENGTH,
  MAX_BANNER_SHIMMER_STRENGTH,
  MIN_BANNER_BRIGHTNESS,
  MAX_BANNER_BRIGHTNESS,
  MIN_BANNER_FONT_SCALE,
  MAX_BANNER_FONT_SCALE,
} from "./roomBanner";
import { parseYouTube } from "@/lib/embeds";

export const VINYL_CONFIG_KIND = "vinyl-room-config";

export type LyricsWallSide = "north" | "east" | "west";

/**
 * The Lyrics Wall's own panel, styled the way every other plaque in the museum
 * is: it extends BannerFinish (lib/museum/roomBanner.ts) so BannerPanel.tsx
 * draws it, which is where the uploaded texture, the glass mode, the shimmer,
 * the raised edge and the brightness all come from for free.
 *
 * It carries its own copy rather than reading the room's label style, the same
 * call each toolbar Banner makes (sceneBanner.ts): the Vinyl Room has no other
 * plaques to match, and this one is a two-metre screen rather than a caption —
 * a texture that reads well on a price tag is rarely what you want across it.
 *
 * `textColor` / `glowColor` predate this and keep their names: textColor is the
 * lyric lines, glowColor is the lit trim and the halo the deck's effects drive.
 * Both already exist in stored rows, so renaming them would cost a migration
 * for nothing.
 */
export interface LyricsWallConfig extends BannerFinish {
  enabled: boolean;
  wall: LyricsWallSide;
  /** The lyric lines themselves. */
  textColor: string;
  /** The lit trim, the text's halo and the track caption. Driven brighter by
   *  the deck's reverb / lo-fi amounts while a record plays. */
  glowColor: string;
  /** Font *path* from PLAQUE_FONT_OPTIONS, applied to every line on the wall.
   *  Unlike a room label there is no hierarchy to protect here — the previous
   *  and next lines are the same lyric, just dimmer. */
  fontFamily: string;
  /** Multiplier on the auto-fitted line size, so the wall can be tuned without
   *  losing the fit-to-width behaviour that keeps a long line on the panel. */
  fontScale: number;
  /** A moving picture behind the lyrics. "upload" plays `videoUrl` as a real
   *  WebGL texture (works in VR); "youtube" layers the YouTube player as DOM
   *  behind a transparent patch of the canvas, because a cross-origin iframe's
   *  pixels can never be read into a texture — which also means it can't be
   *  seen in a headset. Both URLs are kept so switching source doesn't lose
   *  the other one. */
  videoSource: LyricsVideoSource;
  /** Uploaded clip (R2), trimmed to the site's video cap on upload. */
  videoUrl: string | null;
  /** Anything parseYouTube accepts — watch, youtu.be, shorts, embed. */
  videoYoutubeUrl: string | null;
  /** 0–2. Under 1 dims the picture so the lyrics stay readable on top of it. */
  videoBrightness: number;
  /** On by default: the deck is already playing a record, and a second
   *  soundtrack from the wall fights it. */
  videoMuted: boolean;
}

export type LyricsVideoSource = "none" | "upload" | "youtube";
export const MIN_LYRICS_VIDEO_BRIGHTNESS = 0;
export const MAX_LYRICS_VIDEO_BRIGHTNESS = 2;

/**
 * Effect amounts, 0–1, plus the platter speed in rpm.
 *
 * The first four are the room's original "old record" set. The five after
 * them are the shoegaze pedalboard — every classic modulation, in the order a
 * player would chain them (see vinylAudio.ts), because that genre is built out
 * of pitch and amplitude movement rather than EQ. `modRate` is one tempo for
 * all of them: each stage runs its own LFO at its own multiple of it, so the
 * board drifts together instead of five oscillators beating against each other.
 */
export interface VinylEffects {
  reverb: number;
  lofi: number;
  crackle: number;
  delay: number;
  /** Detuned doubling — the wash under a wall of guitars. */
  chorus: number;
  /** Chorus with feedback and a much shorter delay: the jet sweep. */
  flanger: number;
  /** Swept allpass notches. */
  phaser: number;
  /** Amplitude pulse. */
  tremolo: number;
  /** Pitch wobble — a warped-record warble at depth. */
  vibrato: number;
  /** Shared LFO tempo for all five modulations, 0 = a slow drift (~0.2 Hz),
   *  1 = a fast flutter (~6 Hz). */
  modRate: number;
  /** Backward play: the record turns the other way — the playhead runs from
   *  where it is back towards the start, and the timer counts down. Shipped
   *  first under the name "backmasking", which is why the admin had a "Start
   *  backmasked" switch for it; the stored key never changed. Unlike the
   *  amounts above this is not a knob on the signal path — the player decodes
   *  the whole file and plays a reversed copy (see vinylAudio.ts). */
  reverse: boolean;
  /** Backmasking proper: every moment of the song *sounds* reversed, but the
   *  song itself still moves forward — the timer counts up and the Lyrics Wall
   *  keeps its place. Built by reversing the audio a window at a time and
   *  keeping the windows in order. Mutually exclusive with `reverse` (see
   *  sanitizeVinylEffects). */
  backmask: boolean;
  /** How long each reversed window is, 0–1 → BACKMASK_WINDOW_MIN–MAX seconds.
   *  Short windows smear into a stutter; long ones let a whole phrase play
   *  backwards before the next begins. See backmaskWindowSec. */
  backmaskWindow: number;
  speed: 33 | 45 | 78;
  /** ±0.08 fine adjustment on top of the nominal speed. */
  fine: number;
}

export interface VinylRoomConfig {
  /** Uploaded .glb standing in for the procedural deck (origin on the floor
   *  at the deck's centre, facing +Z). Null = built-in. */
  turntableModelUrl: string | null;
  /** Room-local X/Z and facing; null = auto (centre of the room, facing the door). */
  turntable: { x: number; z: number; rotationY: number } | null;
  defaultEffects: VinylEffects;
  lyricsWall: LyricsWallConfig;
}

export const DEFAULT_VINYL_EFFECTS: VinylEffects = {
  reverb: 0.25,
  lofi: 0,
  crackle: 0.15,
  delay: 0,
  // The pedalboard starts flat: a record should sound like a record until
  // someone reaches for the knobs. modRate sits mid-slow (~1.4 Hz) so the
  // first modulation turned up already sounds like a pedal rather than a siren.
  chorus: 0,
  flanger: 0,
  phaser: 0,
  tremolo: 0,
  vibrato: 0,
  modRate: 0.2,
  reverse: false,
  backmask: false,
  // ~1.3 s: long enough that a sung phrase is recognisably a phrase run
  // backwards, short enough that the song's shape stays readable.
  backmaskWindow: 0.4,
  speed: 33,
  fine: 0,
};

export const BACKMASK_WINDOW_MIN = 0.25;
export const BACKMASK_WINDOW_MAX = 3;

/** The backmask knob (0–1) as a window length in seconds. */
export function backmaskWindowSec(amount: number): number {
  return BACKMASK_WINDOW_MIN + Math.min(1, Math.max(0, amount)) * (BACKMASK_WINDOW_MAX - BACKMASK_WINDOW_MIN);
}

// The look the wall shipped with, restated as a banner finish so a room that
// has never been edited renders exactly as it did before these controls
// existed: near-black glass at 0.92, a 4cm lit trim (the old "frame line" was
// a plane 8cm wider, i.e. 4cm a side), no texture and no shimmer.
export const DEFAULT_LYRICS_WALL: LyricsWallConfig = {
  enabled: true,
  wall: "north",
  textColor: "#F5F1E8",
  glowColor: "#c8a96e",
  fontFamily: "/fonts/DMSans-Regular.woff",
  fontScale: 1,
  panelColor: "#08080a",
  edgeColor: "#c8a96e",
  edgeThickness: 0.04,
  textureUrl: null,
  glassEnabled: true,
  glassOpacity: 0.92,
  shimmerEnabled: false,
  shimmerSpeed: 0.5,
  shimmerStrength: 0.5,
  brightness: 1,
  videoSource: "none",
  videoUrl: null,
  videoYoutubeUrl: null,
  // Dimmed out of the box: the words are the point of the wall, and a
  // full-brightness video under white type is the one thing guaranteed to
  // make them hard to read.
  videoBrightness: 0.7,
  videoMuted: true,
};

export const DEFAULT_VINYL_CONFIG: VinylRoomConfig = {
  turntableModelUrl: null,
  turntable: null,
  defaultEffects: DEFAULT_VINYL_EFFECTS,
  lyricsWall: DEFAULT_LYRICS_WALL,
};

const clamp01 = (v: unknown, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback;
const finiteOr = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const hexOr = (v: unknown, fallback: string) => (typeof v === "string" && HEX_RE.test(v) ? v : fallback);
const boolOr = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);
const rangeOr = (v: unknown, fallback: number, min: number, max: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;

/**
 * Coerce a stored blob into a complete Lyrics Wall config.
 *
 * Every field goes through here and the caller never lists keys of its own —
 * the mistake roomBanner.ts documents (a field added to the interface but not
 * to the serializer, so the editor appeared to work and the value vanished on
 * reload) is only avoidable if there is exactly one place that knows the shape.
 */
export function coerceLyricsWall(raw: unknown): LyricsWallConfig {
  const d = DEFAULT_LYRICS_WALL;
  const lw = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof LyricsWallConfig, unknown>>;
  return {
    enabled: lw.enabled !== false,
    wall: lw.wall === "east" || lw.wall === "west" ? lw.wall : "north",
    textColor: hexOr(lw.textColor, d.textColor),
    glowColor: hexOr(lw.glowColor, d.glowColor),
    // A font *path*; the editor only ever offers PLAQUE_FONT_OPTIONS values,
    // and troika falls back to its built-in face on anything it can't load.
    fontFamily: typeof lw.fontFamily === "string" && lw.fontFamily ? lw.fontFamily : d.fontFamily,
    fontScale: rangeOr(lw.fontScale, d.fontScale, MIN_BANNER_FONT_SCALE, MAX_BANNER_FONT_SCALE),
    panelColor: hexOr(lw.panelColor, d.panelColor),
    edgeColor: hexOr(lw.edgeColor, d.edgeColor),
    edgeThickness: rangeOr(lw.edgeThickness, d.edgeThickness, MIN_BANNER_EDGE, MAX_BANNER_EDGE),
    // Only a real string is an upload; null and "" both mean "no texture".
    textureUrl: typeof lw.textureUrl === "string" && lw.textureUrl ? lw.textureUrl : null,
    glassEnabled: boolOr(lw.glassEnabled, d.glassEnabled),
    glassOpacity: rangeOr(lw.glassOpacity, d.glassOpacity, MIN_BANNER_GLASS_OPACITY, MAX_BANNER_GLASS_OPACITY),
    shimmerEnabled: boolOr(lw.shimmerEnabled, d.shimmerEnabled),
    shimmerSpeed: rangeOr(lw.shimmerSpeed, d.shimmerSpeed, MIN_BANNER_SHIMMER_SPEED, MAX_BANNER_SHIMMER_SPEED),
    shimmerStrength: rangeOr(lw.shimmerStrength, d.shimmerStrength, MIN_BANNER_SHIMMER_STRENGTH, MAX_BANNER_SHIMMER_STRENGTH),
    brightness: rangeOr(lw.brightness, d.brightness, MIN_BANNER_BRIGHTNESS, MAX_BANNER_BRIGHTNESS),
    videoSource: lw.videoSource === "upload" || lw.videoSource === "youtube" ? lw.videoSource : "none",
    // Same "only a real string is an upload" rule as textureUrl.
    videoUrl: typeof lw.videoUrl === "string" && lw.videoUrl ? lw.videoUrl : null,
    // Stored as typed, but only if it actually parses — the wall builds an
    // embed URL from it, and an unparseable one would be a dead iframe.
    videoYoutubeUrl:
      typeof lw.videoYoutubeUrl === "string" && parseYouTube(lw.videoYoutubeUrl) ? lw.videoYoutubeUrl : null,
    videoBrightness: rangeOr(lw.videoBrightness, d.videoBrightness, MIN_LYRICS_VIDEO_BRIGHTNESS, MAX_LYRICS_VIDEO_BRIGHTNESS),
    videoMuted: boolOr(lw.videoMuted, d.videoMuted),
  };
}

export function sanitizeVinylEffects(raw: unknown, base: VinylEffects = DEFAULT_VINYL_EFFECTS): VinylEffects {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof VinylEffects, unknown>>;
  const speed = r.speed === 45 || r.speed === 78 || r.speed === 33 ? r.speed : base.speed;
  const reverse = boolOr(r.reverse, base.reverse);
  return {
    reverb: clamp01(r.reverb, base.reverb),
    lofi: clamp01(r.lofi, base.lofi),
    crackle: clamp01(r.crackle, base.crackle),
    delay: clamp01(r.delay, base.delay),
    chorus: clamp01(r.chorus, base.chorus),
    flanger: clamp01(r.flanger, base.flanger),
    phaser: clamp01(r.phaser, base.phaser),
    tremolo: clamp01(r.tremolo, base.tremolo),
    vibrato: clamp01(r.vibrato, base.vibrato),
    modRate: clamp01(r.modRate, base.modRate),
    reverse,
    // The two are different sources for the deck (a reversed copy played
    // backwards, a window-reversed copy played forwards), so only one can be
    // on. Callers that flip one always send the other as false; this is the
    // tie-break for a blob that somehow has both, and backward play wins
    // because it's the older setting.
    backmask: reverse ? false : boolOr(r.backmask, base.backmask),
    backmaskWindow: clamp01(r.backmaskWindow, base.backmaskWindow),
    speed,
    fine: Math.min(0.08, Math.max(-0.08, finiteOr(r.fine, base.fine))),
  };
}

export function parseVinylConfig(raw: string | null | undefined): VinylRoomConfig {
  if (!raw) return structuredClone(DEFAULT_VINYL_CONFIG);
  try {
    const p = JSON.parse(raw) as Partial<VinylRoomConfig>;
    const t = p.turntable && typeof p.turntable === "object" ? p.turntable : null;
    return {
      turntableModelUrl: typeof p.turntableModelUrl === "string" && p.turntableModelUrl ? p.turntableModelUrl : null,
      turntable: t ? { x: finiteOr(t.x, 0), z: finiteOr(t.z, 0), rotationY: finiteOr(t.rotationY, 0) } : null,
      defaultEffects: sanitizeVinylEffects(p.defaultEffects),
      lyricsWall: coerceLyricsWall(p.lyricsWall),
    };
  } catch {
    return structuredClone(DEFAULT_VINYL_CONFIG);
  }
}

export function serializeVinylConfig(config: VinylRoomConfig): string {
  return JSON.stringify(parseVinylConfig(JSON.stringify(config)));
}

/** Platter speed → playbackRate, 33⅓ being "as recorded". */
export function playbackRateFor(effects: Pick<VinylEffects, "speed" | "fine">): number {
  return (effects.speed / (100 / 3)) * (1 + effects.fine);
}
