"use client";

// lib/museum/vinylAudio.ts
//
// The Vinyl Room's deck: the record's audio routed through a Web Audio
// effects chain the visitor can tweak from the turntable panel. Browser-only
// — MuseumScene.tsx creates one player per museum visit and disposes it on
// the way out.
//
// Chain (left to right), a pedalboard in the order a player would chain one:
//
//   input (element source, or the reversed buffer — see BACKMASKING)
//     → lo-fi:   BiquadFilter (lowpass, 20 kHz → 1.8 kHz as the amount
//                rises) + a WaveShaper soft-clip, crossfaded in with the
//                amount so 0 is a clean bypass
//     → phaser:  four swept allpass stages with feedback; dry/wet
//     → flanger: a 4 ms delay swept ±2 ms with feedback; dry/wet
//     → chorus:  two delays around 18/26 ms swept gently, panned apart;
//                dry/wet
//     → vibrato: a 6 ms delay swept ±1.5 ms, fully wet at the knob's amount
//                (pitch modulation has no dry component to speak of)
//     → tremolo: a gain swept by its own LFO, in series
//     → delay:   DelayNode 0.28 s with a feedback loop; a wet gain mixed
//                beside the dry path
//     → reverb:  ConvolverNode over a generated exponential-decay noise
//                impulse (no file to host); dry/wet crossfade
//     → master GainNode → destination
//
//   crackle:     a looping AudioBufferSourceNode of sparse impulse noise
//                through a bandpass, on its own gain — the "dust on the
//                record" bed; it only sounds while the deck is playing.
//
// Every modulation runs its own OscillatorNode rather than sharing one, so
// they can sit at different multiples of the single `modRate` knob and drift
// against each other the way five pedals do. The oscillators run for the life
// of the graph; a stage at 0 simply has its depth and wet gains at 0.
//
// Speed is playbackRate with preservesPitch off, so 45 on a 33 sounds the way
// it does on a real deck (pitch follows). The rpm→rate maths lives in
// vinylConfig.ts (playbackRateFor) so the admin's default-effects card and
// this player agree.
//
// BACKWARD PLAY AND BACKMASKING
// -----------------------------
// Two different things that both need audio an <audio> element can't produce
// at any playbackRate, so both switch the player's *source* to a decoded copy
// of the file played from an AudioBufferSourceNode into the same chain:
//
//   backward play (`reverse`) — the whole file copied back to front. The
//     playhead runs from where it is back towards the start; the timer counts
//     down and the Lyrics Wall walks backwards through the song.
//   backmasking (`backmask`) — the file reversed a window at a time, the
//     windows left in order (see makeBackmaskBuffer). Every moment *sounds*
//     backwards but the song still moves forward: the timer counts up, the
//     wall keeps its place, and the song ends at its end.
//
// Everything downstream — effects, crackle, the panel, the Lyrics Wall — is
// unchanged. The three sources hand the playhead to each other in song time,
// so flipping mid-song carries on from the same point in the song.
//
// The cost is that the reported position has to be computed from the context
// clock (a buffer source has no currentTime) and that a decode needs the file
// over fetch(), which needs CORS on the bucket — the same requirement the
// element already has. A decode that fails leaves the record playing forwards
// and reports it, rather than dropping into silence. The decode is done once
// per record; both derived copies are built from it and cached.
//
// The audio file is fetched with crossOrigin="anonymous" through
// corsImageUrl() — R2 only sends the CORS header when the request carries
// an Origin, and a MediaElementSource over a non-CORS response is silent
// (see lib/images/corsUrl.ts for the cache-splitting reason).

import { corsImageUrl } from "@/lib/images/corsUrl";
import {
  DEFAULT_VINYL_EFFECTS,
  backmaskWindowSec,
  playbackRateFor,
  sanitizeVinylEffects,
  type VinylEffects,
} from "./vinylConfig";

export interface VinylPlayer {
  /** Point the deck at a record. Stops whatever was on it first. */
  load: (audioUrl: string) => void;
  play: () => Promise<void>;
  pause: () => void;
  /** Stop and unload — the record comes off the platter. */
  stop: () => void;
  setEffects: (next: Partial<VinylEffects>) => VinylEffects;
  getEffects: () => VinylEffects;
  isPlaying: () => boolean;
  currentTime: () => number;
  duration: () => number;
  seek: (seconds: number) => void;
  /** Subscribe to play/pause/ended/time changes; returns the unsubscribe. */
  subscribe: (listener: (state: VinylPlayerState) => void) => () => void;
  dispose: () => void;
}

export interface VinylPlayerState {
  playing: boolean;
  currentTime: number;
  duration: number;
  ended: boolean;
  error: string | null;
  /** What the deck is actually playing from right now — which can lag the
   *  effects for the moment a decode takes. */
  source: VinylSource;
  /** The record is being fetched and decoded for backward play/backmasking. */
  decoding: boolean;
}

/** "element" is the ordinary forward <audio> path. */
export type VinylSource = "element" | "reverse" | "backmask";

// A real Web Audio context per player is fine here — there is only ever one
// deck, and a MediaElementSource can only be created once per element, so
// the element and its context live and die together.
type AudioContextCtor = typeof AudioContext;
function getContextCtor(): AudioContextCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/** An exponentially decaying stereo noise burst — a serviceable "room"
 *  impulse without hosting a file. ~2.2 s tail. */
function makeImpulse(ctx: AudioContext, seconds = 2.2, decay = 3.2): AudioBuffer {
  const rate = ctx.sampleRate;
  const length = Math.max(1, Math.floor(rate * seconds));
  const buffer = ctx.createBuffer(2, length, rate);
  for (let ch = 0; ch < 2; ch += 1) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return buffer;
}

/** Sparse impulses on a faint noise floor — dust and scratches. Looped. */
function makeCrackle(ctx: AudioContext, seconds = 4): AudioBuffer {
  const rate = ctx.sampleRate;
  const length = Math.floor(rate * seconds);
  const buffer = ctx.createBuffer(1, length, rate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    // Floor: very quiet pink-ish hiss.
    let v = (Math.random() * 2 - 1) * 0.02;
    // Pops: roughly 12 per second, random amplitude, a 2–6 sample tail.
    if (Math.random() < 12 / rate) {
      const amp = 0.35 + Math.random() * 0.65;
      const tail = 2 + Math.floor(Math.random() * 5);
      for (let k = 0; k < tail && i + k < length; k += 1) {
        data[i + k] += amp * (1 - k / tail) * (Math.random() < 0.5 ? -1 : 1);
      }
    }
    data[i] += v;
    v = 0;
  }
  return buffer;
}

/** A gentle soft-clip curve for the lo-fi stage. */
function makeSoftClip(amount: number): Float32Array<ArrayBuffer> {
  const n = 2048;
  const curve = new Float32Array(new ArrayBuffer(n * 4));
  const k = 2 + amount * 18;
  for (let i = 0; i < n; i += 1) {
    const x = (i * 2) / n - 1;
    curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  return curve;
}

/** The shared modulation tempo, in Hz: a slow drift at 0, a flutter at 1. */
function lfoHz(modRate: number): number {
  return 0.2 + modRate * 5.8;
}

/** One LFO: a running oscillator and the depth gain that scales it into
 *  whatever AudioParam the stage sweeps. Started once, never stopped. */
interface Lfo {
  osc: OscillatorNode;
  depth: GainNode;
}
function makeLfo(ctx: AudioContext, type: OscillatorType = "sine"): Lfo {
  const osc = ctx.createOscillator();
  osc.type = type;
  const depth = ctx.createGain();
  depth.gain.value = 0;
  osc.connect(depth);
  osc.start();
  return { osc, depth };
}

/** A parallel dry/wet stage: everything in `build` sits on the wet path. */
interface WetStage {
  input: GainNode;
  output: GainNode;
  dry: GainNode;
  wet: GainNode;
}

/** The whole file back to front — backward play. */
function reverseBuffer(ctx: AudioContext, buffer: AudioBuffer): AudioBuffer {
  const out = ctx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
  for (let ch = 0; ch < buffer.numberOfChannels; ch += 1) {
    const src = buffer.getChannelData(ch);
    const dst = out.getChannelData(ch);
    const n = buffer.length;
    for (let i = 0; i < n; i += 1) dst[i] = src[n - 1 - i];
  }
  return out;
}

/** Fade at each window's edges, seconds. Without it every seam is a click:
 *  the last sample of one reversed window is the *first* sample of that
 *  stretch of song, which has nothing to do with the sample that follows. */
const BACKMASK_FADE_SEC = 0.012;

/**
 * Backmasking: each `windowSec` of the file reversed in place, the windows
 * left in their original order, so song time maps 1:1 onto buffer time. That
 * 1:1 mapping is the whole difference from backward play — it's what lets the
 * timer, the seek bar and the Lyrics Wall carry on as if nothing had changed.
 */
function makeBackmaskBuffer(ctx: AudioContext, buffer: AudioBuffer, windowSec: number): AudioBuffer {
  const out = ctx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
  const n = buffer.length;
  const win = Math.max(1, Math.round(windowSec * buffer.sampleRate));
  const fade = Math.min(Math.floor(win / 2), Math.round(BACKMASK_FADE_SEC * buffer.sampleRate));
  for (let ch = 0; ch < buffer.numberOfChannels; ch += 1) {
    const src = buffer.getChannelData(ch);
    const dst = out.getChannelData(ch);
    for (let start = 0; start < n; start += win) {
      const end = Math.min(n, start + win);
      const len = end - start;
      for (let i = 0; i < len; i += 1) {
        let v = src[end - 1 - i];
        if (fade > 0) {
          if (i < fade) v *= i / fade;
          else if (i >= len - fade) v *= (len - 1 - i) / fade;
        }
        dst[start + i] = v;
      }
    }
  }
  return out;
}

export function createVinylPlayer(initial: Partial<VinylEffects> = {}): VinylPlayer {
  const Ctor = getContextCtor();
  const audio = typeof Audio !== "undefined" ? new Audio() : null;
  let effects: VinylEffects = sanitizeVinylEffects({ ...DEFAULT_VINYL_EFFECTS, ...initial });
  const listeners = new Set<(state: VinylPlayerState) => void>();
  let error: string | null = null;
  let disposed = false;

  // Graph nodes — null when Web Audio is unavailable (the element still
  // plays plain, just without effects).
  let ctx: AudioContext | null = null;
  let source: MediaElementAudioSourceNode | null = null;
  /** Everything that can feed the chain connects here: the element source and
   *  any reversed buffer source. */
  let input: GainNode | null = null;
  let lofiFilter: BiquadFilterNode | null = null;
  let lofiShaper: WaveShaperNode | null = null;
  let lofiDry: GainNode | null = null;
  let lofiWet: GainNode | null = null;
  let phaser: WetStage | null = null;
  let phaserFilters: BiquadFilterNode[] = [];
  let phaserLfo: Lfo | null = null;
  let phaserFeedback: GainNode | null = null;
  let flanger: WetStage | null = null;
  let flangerDelay: DelayNode | null = null;
  let flangerLfo: Lfo | null = null;
  let flangerFeedback: GainNode | null = null;
  let chorus: WetStage | null = null;
  let chorusDelays: DelayNode[] = [];
  let chorusLfos: Lfo[] = [];
  let vibrato: WetStage | null = null;
  let vibratoDelay: DelayNode | null = null;
  let vibratoLfo: Lfo | null = null;
  let tremoloGain: GainNode | null = null;
  let tremoloLfo: Lfo | null = null;
  let delayNode: DelayNode | null = null;
  let delayFeedback: GainNode | null = null;
  let delayWet: GainNode | null = null;
  let reverb: ConvolverNode | null = null;
  let reverbDry: GainNode | null = null;
  let reverbWet: GainNode | null = null;
  let master: GainNode | null = null;
  let crackleSource: AudioBufferSourceNode | null = null;
  let crackleGain: GainNode | null = null;

  // Buffer-source state (backward play and backmasking). `decoded` is the
  // record as decoded, forwards; the two derived copies are built from it and
  // cached, the backmask one per window length. `src` is which source owns
  // the playhead *right now* — deliberately not read off `effects`, which
  // changes the instant a switch is flipped while the playhead still belongs
  // to the old source until switchSource has handed it over.
  let currentUrl: string | null = null;
  let decoded: AudioBuffer | null = null;
  let decodedFor: string | null = null;
  let decodePromise: Promise<AudioBuffer | null> | null = null;
  let decoding = false;
  let reversedCopy: AudioBuffer | null = null;
  let backmaskCopy: AudioBuffer | null = null;
  let backmaskCopyWindow = -1;
  let src: VinylSource = "element";
  let bufNode: AudioBufferSourceNode | null = null;
  let bufRunning = false;
  let bufEnded = false;
  /** ctx.currentTime when the buffer source started. */
  let bufStartedAt = 0;
  /** Offset into the buffer it started from. */
  let bufStartOffset = 0;
  /** Where the playhead rests, in song time, while a buffer source is paused. */
  let bufPaused = 0;
  let ticker: number | null = null;
  let rebuildTimer: number | null = null;

  if (audio) {
    audio.crossOrigin = "anonymous";
    audio.preload = "auto";
    audio.loop = false;
    // Pitch follows speed, like a real deck.
    const a = audio as HTMLAudioElement & { preservesPitch?: boolean; mozPreservesPitch?: boolean; webkitPreservesPitch?: boolean };
    a.preservesPitch = false;
    a.mozPreservesPitch = false;
    a.webkitPreservesPitch = false;
  }

  /** Playing from any source. */
  function playingNow(): boolean {
    if (bufRunning) return true;
    return audio ? !audio.paused && !audio.ended : false;
  }

  /** The buffer the current source plays, if it's a buffer source. */
  function activeBuffer(): AudioBuffer | null {
    if (src === "reverse") return reversedCopy;
    if (src === "backmask") return backmaskCopy;
    return null;
  }

  /** Buffer offset ↔ song time. Backward play mirrors; backmasking is 1:1,
   *  which is the whole point of it (see makeBackmaskBuffer). */
  function songToBuffer(song: number, d: number): number {
    return src === "reverse" ? d - song : song;
  }
  function bufferToSong(offset: number, d: number): number {
    return src === "reverse" ? d - offset : offset;
  }

  /** The playhead in *song* time, whichever source owns it and whichever way
   *  it's turning. */
  function positionNow(): number {
    const buf = activeBuffer();
    if (buf) {
      const d = buf.duration;
      if (bufRunning && ctx) {
        const rate = bufNode?.playbackRate.value ?? playbackRateFor(effects);
        const offset = bufStartOffset + (ctx.currentTime - bufStartedAt) * rate;
        return Math.max(0, Math.min(d, bufferToSong(offset, d)));
      }
      return Math.max(0, Math.min(d, bufPaused));
    }
    return audio?.currentTime ?? 0;
  }

  function durationNow(): number {
    const buf = activeBuffer();
    if (buf) return buf.duration;
    return audio && Number.isFinite(audio.duration) ? audio.duration : 0;
  }

  function emit() {
    const state: VinylPlayerState = {
      playing: playingNow(),
      currentTime: positionNow(),
      duration: durationNow(),
      ended: activeBuffer() ? bufEnded : Boolean(audio?.ended),
      error,
      source: src,
      decoding,
    };
    listeners.forEach((l) => l(state));
  }

  // A buffer source fires no timeupdate, so reversed playback needs its own
  // heartbeat for the panel's progress bar and the Lyrics Wall.
  function startTicker() {
    if (ticker !== null || typeof window === "undefined") return;
    ticker = window.setInterval(emit, 200);
  }
  function stopTicker() {
    if (ticker === null) return;
    window.clearInterval(ticker);
    ticker = null;
  }

  /** Wire up a parallel dry/wet pair around a stage the caller fills in. */
  function makeWetStage(context: AudioContext): WetStage {
    const stageIn = context.createGain();
    const stageOut = context.createGain();
    const dry = context.createGain();
    const wet = context.createGain();
    dry.gain.value = 1;
    wet.gain.value = 0;
    stageIn.connect(dry).connect(stageOut);
    wet.connect(stageOut);
    return { input: stageIn, output: stageOut, dry, wet };
  }

  function buildGraph() {
    if (!Ctor || !audio || ctx) return;
    try {
      ctx = new Ctor();
      source = ctx.createMediaElementSource(audio);
      // One junction for both sources, so backmasking swaps what feeds the
      // board without touching the board itself.
      input = ctx.createGain();
      source.connect(input);

      // ── Lo-fi: filter + soft clip on the wet path, clean on the dry path.
      lofiFilter = ctx.createBiquadFilter();
      lofiFilter.type = "lowpass";
      lofiFilter.Q.value = 0.9;
      lofiShaper = ctx.createWaveShaper();
      lofiShaper.curve = makeSoftClip(0.5);
      lofiShaper.oversample = "2x";
      lofiDry = ctx.createGain();
      lofiWet = ctx.createGain();
      const lofiOut = ctx.createGain();
      input.connect(lofiDry).connect(lofiOut);
      input.connect(lofiFilter).connect(lofiShaper).connect(lofiWet).connect(lofiOut);

      // ── Phaser: four allpass stages swept together, with feedback round
      // the lot. The notches this puts in the spectrum are the whole effect,
      // so the stages sit in series on the wet path.
      phaser = makeWetStage(ctx);
      lofiOut.connect(phaser.input);
      phaserLfo = makeLfo(ctx);
      phaserFeedback = ctx.createGain();
      phaserFeedback.gain.value = 0;
      phaserFilters = [350, 700, 1200, 2200].map((base) => {
        const f = ctx!.createBiquadFilter();
        f.type = "allpass";
        f.Q.value = 0.6;
        f.frequency.value = base;
        // The LFO adds to each stage's own base frequency, so they sweep in
        // formation rather than collapsing onto one another.
        phaserLfo!.depth.connect(f.frequency);
        return f;
      });
      phaser.input.connect(phaserFilters[0]);
      for (let i = 0; i < phaserFilters.length - 1; i += 1) phaserFilters[i].connect(phaserFilters[i + 1]);
      const phaserLast = phaserFilters[phaserFilters.length - 1];
      phaserLast.connect(phaser.wet);
      phaserLast.connect(phaserFeedback).connect(phaserFilters[0]);

      // ── Flanger: a very short swept delay, fed back on itself.
      flanger = makeWetStage(ctx);
      phaser.output.connect(flanger.input);
      flangerDelay = ctx.createDelay(0.05);
      flangerDelay.delayTime.value = 0.004;
      flangerLfo = makeLfo(ctx);
      flangerLfo.depth.connect(flangerDelay.delayTime);
      flangerFeedback = ctx.createGain();
      flangerFeedback.gain.value = 0;
      flanger.input.connect(flangerDelay);
      flangerDelay.connect(flangerFeedback).connect(flangerDelay);
      flangerDelay.connect(flanger.wet);

      // ── Chorus: two voices at different delays and rates, panned apart —
      // the width is what makes it read as a wash rather than a wobble.
      chorus = makeWetStage(ctx);
      flanger.output.connect(chorus.input);
      chorusDelays = [];
      chorusLfos = [];
      [
        { time: 0.018, pan: -0.6 },
        { time: 0.026, pan: 0.6 },
      ].forEach(({ time, pan }) => {
        const d = ctx!.createDelay(0.1);
        d.delayTime.value = time;
        const lfo = makeLfo(ctx!);
        lfo.depth.connect(d.delayTime);
        const panner = ctx!.createStereoPanner();
        panner.pan.value = pan;
        chorus!.input.connect(d).connect(panner).connect(chorus!.wet);
        chorusDelays.push(d);
        chorusLfos.push(lfo);
      });

      // ── Vibrato: the same trick as the flanger with no feedback and a
      // smaller sweep, so what you hear is pitch rather than comb filtering.
      vibrato = makeWetStage(ctx);
      chorus.output.connect(vibrato.input);
      vibratoDelay = ctx.createDelay(0.05);
      vibratoDelay.delayTime.value = 0.006;
      vibratoLfo = makeLfo(ctx);
      vibratoLfo.depth.connect(vibratoDelay.delayTime);
      vibrato.input.connect(vibratoDelay).connect(vibrato.wet);

      // ── Tremolo: in series, not parallel — a parallel dry path would just
      // fill in the dips and cancel the effect.
      tremoloGain = ctx.createGain();
      tremoloGain.gain.value = 1;
      tremoloLfo = makeLfo(ctx);
      tremoloLfo.depth.connect(tremoloGain.gain);
      vibrato.output.connect(tremoloGain);

      // ── Delay: feedback loop beside the dry path.
      delayNode = ctx.createDelay(1.5);
      delayNode.delayTime.value = 0.28;
      delayFeedback = ctx.createGain();
      delayFeedback.gain.value = 0.35;
      delayWet = ctx.createGain();
      const delayOut = ctx.createGain();
      tremoloGain.connect(delayOut);
      tremoloGain.connect(delayNode);
      delayNode.connect(delayFeedback).connect(delayNode);
      delayNode.connect(delayWet).connect(delayOut);

      // ── Reverb: dry/wet crossfade.
      reverb = ctx.createConvolver();
      reverb.buffer = makeImpulse(ctx);
      reverbDry = ctx.createGain();
      reverbWet = ctx.createGain();
      master = ctx.createGain();
      master.gain.value = 0.9;
      delayOut.connect(reverbDry).connect(master);
      delayOut.connect(reverb).connect(reverbWet).connect(master);
      master.connect(ctx.destination);

      // Crackle bed — its own source, gated by play/pause.
      crackleGain = ctx.createGain();
      crackleGain.gain.value = 0;
      const crackleBand = ctx.createBiquadFilter();
      crackleBand.type = "bandpass";
      crackleBand.frequency.value = 3200;
      crackleBand.Q.value = 0.7;
      crackleGain.connect(crackleBand).connect(master);

      applyEffects();
    } catch {
      ctx = null;
    }
  }

  function startCrackle() {
    if (!ctx || !crackleGain || crackleSource) return;
    crackleSource = ctx.createBufferSource();
    crackleSource.buffer = makeCrackle(ctx);
    crackleSource.loop = true;
    crackleSource.connect(crackleGain);
    crackleSource.start();
  }

  function stopCrackle() {
    if (!crackleSource) return;
    try {
      crackleSource.stop();
    } catch {
      /* already stopped */
    }
    crackleSource.disconnect();
    crackleSource = null;
  }

  function applyEffects() {
    const rate = playbackRateFor(effects);
    if (audio) audio.playbackRate = rate;
    if (bufNode && ctx) {
      // Re-anchor before changing the rate: positionNow() integrates elapsed
      // context time at the *current* rate, so the old rate's contribution has
      // to be banked into the offset or the playhead jumps.
      if (bufRunning) {
        bufStartOffset += (ctx.currentTime - bufStartedAt) * bufNode.playbackRate.value;
        bufStartedAt = ctx.currentTime;
      }
      bufNode.playbackRate.value = rate;
    }
    if (!ctx) return;
    const t = ctx.currentTime;
    const ramp = 0.05;
    // Lo-fi: 0 → clean; 1 → 1.8 kHz lowpass through the clip, dry muted.
    if (lofiFilter && lofiDry && lofiWet && lofiShaper) {
      const cutoff = 20000 * Math.pow(1800 / 20000, effects.lofi);
      lofiFilter.frequency.setTargetAtTime(cutoff, t, ramp);
      lofiShaper.curve = makeSoftClip(effects.lofi);
      lofiDry.gain.setTargetAtTime(1 - effects.lofi, t, ramp);
      lofiWet.gain.setTargetAtTime(effects.lofi, t, ramp);
    }

    // ── The pedalboard. Each stage gets its LFO rate as a multiple of the
    // shared tempo (slow sweeps for the phaser and flanger, faster movement
    // for vibrato and tremolo) so turning up two at once sounds like two
    // pedals rather than one.
    const hz = lfoHz(effects.modRate);
    if (phaserLfo && phaser && phaserFeedback) {
      phaserLfo.osc.frequency.setTargetAtTime(hz * 0.22, t, ramp);
      // Sweep width grows with the amount: ±900 Hz around each stage's base.
      phaserLfo.depth.gain.setTargetAtTime(900 * effects.phaser, t, ramp);
      phaserFeedback.gain.setTargetAtTime(effects.phaser * 0.45, t, ramp);
      phaser.wet.gain.setTargetAtTime(effects.phaser, t, ramp);
      phaser.dry.gain.setTargetAtTime(1 - effects.phaser * 0.5, t, ramp);
    }
    if (flangerLfo && flanger && flangerFeedback && flangerDelay) {
      flangerLfo.osc.frequency.setTargetAtTime(hz * 0.12, t, ramp);
      flangerLfo.depth.gain.setTargetAtTime(0.002 * effects.flanger, t, ramp);
      flangerDelay.delayTime.setTargetAtTime(0.004, t, ramp);
      flangerFeedback.gain.setTargetAtTime(effects.flanger * 0.65, t, ramp);
      flanger.wet.gain.setTargetAtTime(effects.flanger * 0.85, t, ramp);
      flanger.dry.gain.setTargetAtTime(1 - effects.flanger * 0.35, t, ramp);
    }
    if (chorus && chorusLfos.length) {
      chorusLfos.forEach((lfo, i) => {
        lfo.osc.frequency.setTargetAtTime(hz * (i === 0 ? 0.3 : 0.41), t, ramp);
        lfo.depth.gain.setTargetAtTime(0.004 * effects.chorus, t, ramp);
      });
      chorus.wet.gain.setTargetAtTime(effects.chorus * 0.7, t, ramp);
      chorus.dry.gain.setTargetAtTime(1 - effects.chorus * 0.25, t, ramp);
    }
    if (vibratoLfo && vibrato) {
      vibratoLfo.osc.frequency.setTargetAtTime(hz * 1.1, t, ramp);
      vibratoLfo.depth.gain.setTargetAtTime(0.0018 * effects.vibrato, t, ramp);
      // Pitch modulation only exists on the wet path, so this one crossfades
      // fully rather than sitting beside the dry signal.
      vibrato.wet.gain.setTargetAtTime(effects.vibrato, t, ramp);
      vibrato.dry.gain.setTargetAtTime(1 - effects.vibrato, t, ramp);
    }
    if (tremoloLfo && tremoloGain) {
      tremoloLfo.osc.frequency.setTargetAtTime(hz * 0.9, t, ramp);
      // Centre the gain so the pulse dips rather than doubling the level.
      const depth = effects.tremolo * 0.5;
      tremoloGain.gain.setTargetAtTime(1 - depth, t, ramp);
      tremoloLfo.depth.gain.setTargetAtTime(depth, t, ramp);
    }

    if (delayWet && delayFeedback) {
      delayWet.gain.setTargetAtTime(effects.delay * 0.6, t, ramp);
      delayFeedback.gain.setTargetAtTime(0.2 + effects.delay * 0.4, t, ramp);
    }
    if (reverbDry && reverbWet) {
      reverbDry.gain.setTargetAtTime(1 - effects.reverb * 0.6, t, ramp);
      reverbWet.gain.setTargetAtTime(effects.reverb, t, ramp);
    }
    if (crackleGain) {
      crackleGain.gain.setTargetAtTime(playingNow() ? effects.crackle * 0.5 : 0, t, ramp);
    }
  }

  // ── Buffer sources: backward play and backmasking ─────────────────────

  /** Which source the effects are asking for. */
  function wantedSource(): VinylSource {
    if (effects.reverse) return "reverse";
    if (effects.backmask) return "backmask";
    return "element";
  }

  /** Fetch + decode the loaded record once per URL. Both derived copies are
   *  built from this, so a flip between them never refetches. */
  function ensureDecoded(): Promise<AudioBuffer | null> {
    const context = ctx;
    const url = currentUrl;
    if (!context || !url) return Promise.resolve(null);
    if (decodedFor === url && decoded) return Promise.resolve(decoded);
    if (decodePromise) return decodePromise;
    decoding = true;
    emit();
    decodePromise = (async () => {
      try {
        const res = await fetch(corsImageUrl(url), { mode: "cors" });
        if (!res.ok) throw new Error(String(res.status));
        const bytes = await res.arrayBuffer();
        const buf = await context.decodeAudioData(bytes);
        // A different record may have gone on while this was in flight.
        if (currentUrl !== url) return null;
        decoded = buf;
        decodedFor = url;
        return buf;
      } catch {
        return null;
      } finally {
        decoding = false;
        decodePromise = null;
        emit();
      }
    })();
    return decodePromise;
  }

  /** The buffer a source plays, building (and caching) it on first use. */
  async function bufferFor(kind: "reverse" | "backmask"): Promise<AudioBuffer | null> {
    const base = await ensureDecoded();
    if (!base || !ctx) return null;
    if (kind === "reverse") {
      if (!reversedCopy) reversedCopy = reverseBuffer(ctx, base);
      return reversedCopy;
    }
    if (!backmaskCopy || backmaskCopyWindow !== effects.backmaskWindow) {
      backmaskCopy = makeBackmaskBuffer(ctx, base, backmaskWindowSec(effects.backmaskWindow));
      backmaskCopyWindow = effects.backmaskWindow;
    }
    return backmaskCopy;
  }

  function stopBufferNode() {
    if (!bufNode) return;
    bufNode.onended = null;
    try {
      bufNode.stop();
    } catch {
      /* already stopped */
    }
    bufNode.disconnect();
    bufNode = null;
    bufRunning = false;
    stopTicker();
  }

  /** Start the current buffer source at `fromSong` seconds of song time. */
  function startBuffer(fromSong: number) {
    const buf = activeBuffer();
    if (!ctx || !input || !buf) return;
    stopBufferNode();
    const d = buf.duration;
    const offset = Math.max(0, Math.min(d, songToBuffer(fromSong, d)));
    // Already at the end of the buffer: nothing left to play this way.
    if (offset >= d) {
      bufEnded = true;
      bufPaused = bufferToSong(d, d);
      emit();
      return;
    }
    const node = ctx.createBufferSource();
    node.buffer = buf;
    node.playbackRate.value = playbackRateFor(effects);
    node.connect(input);
    node.onended = () => {
      if (bufNode !== node) return;
      bufRunning = false;
      bufEnded = true;
      // Backward play runs out at the start of the song; backmasking at its end.
      bufPaused = bufferToSong(d, d);
      bufNode = null;
      stopTicker();
      stopCrackle();
      applyEffects();
      emit();
    };
    bufNode = node;
    bufStartedAt = ctx.currentTime;
    bufStartOffset = offset;
    bufRunning = true;
    bufEnded = false;
    node.start(0, offset);
    startCrackle();
    startTicker();
    applyEffects();
    emit();
  }

  /** Where a fresh start from a resting buffer source should begin: from the
   *  resting point, unless the run already finished — then from the top of
   *  this direction (the end of the song for backward play, the start for
   *  backmasking). */
  function restartPoint(buf: AudioBuffer): number {
    if (!bufEnded) return bufPaused;
    return src === "reverse" ? buf.duration : 0;
  }

  /** Hand the playhead from whatever source had it to the one the effects now
   *  ask for, at the same point in the song. `pos`/`wasPlaying` are read
   *  *before* the effects changed, by setEffects. */
  async function switchSource(pos: number, wasPlaying: boolean) {
    const next = wantedSource();
    if (next === "element") {
      stopBufferNode();
      stopCrackle();
      src = "element";
      if (audio) {
        const d = Number.isFinite(audio.duration) ? audio.duration : 0;
        audio.currentTime = Math.max(0, Math.min(d || pos, pos));
        if (wasPlaying) {
          audio.play().catch(() => {
            /* the panel's Play button is the way back */
          });
        }
      }
      applyEffects();
      emit();
      return;
    }

    buildGraph();
    if (ctx && ctx.state === "suspended") {
      try {
        await ctx.resume();
      } catch {
        /* the gesture that flipped the switch should be enough */
      }
    }
    const buf = await bufferFor(next);
    // The switch may have been flipped again while this decoded.
    if (wantedSource() !== next) return;
    if (!buf) {
      // No decode, no buffer source — say so and keep the record turning the
      // way it was rather than dropping into silence.
      effects = sanitizeVinylEffects({ ...effects, reverse: false, backmask: false });
      error = next === "reverse" ? "This record can't be played backwards here." : "This record can't be backmasked here.";
      emit();
      return;
    }
    audio?.pause();
    stopBufferNode();
    src = next;
    bufEnded = false;
    // Backward play from the very start of a song would have nothing to play,
    // so a record that hasn't started yet starts backwards from its end.
    bufPaused = next === "reverse" && pos <= 0 ? buf.duration : pos;
    if (wasPlaying) startBuffer(bufPaused);
    else emit();
  }

  /** Rebuild the backmask copy for a new window length and carry on from the
   *  same point. Debounced — a slider drag would otherwise rebuild a whole
   *  record's worth of samples on every step. */
  function scheduleBackmaskRebuild() {
    if (typeof window === "undefined") return;
    if (rebuildTimer !== null) window.clearTimeout(rebuildTimer);
    rebuildTimer = window.setTimeout(async () => {
      rebuildTimer = null;
      if (src !== "backmask") return;
      const pos = positionNow();
      const wasPlaying = playingNow();
      const buf = await bufferFor("backmask");
      if (!buf || src !== "backmask") return;
      bufPaused = pos;
      if (wasPlaying) startBuffer(pos);
      else emit();
    }, 250);
  }

  if (audio) {
    audio.addEventListener("play", () => {
      startCrackle();
      applyEffects();
      emit();
    });
    audio.addEventListener("pause", () => {
      applyEffects();
      emit();
    });
    audio.addEventListener("ended", () => {
      stopCrackle();
      applyEffects();
      emit();
    });
    // While a buffer source has the playhead the element is parked, so its
    // clock says nothing about where the deck is — the ticker reports instead.
    audio.addEventListener("timeupdate", () => {
      if (src === "element") emit();
    });
    audio.addEventListener("loadedmetadata", emit);
    audio.addEventListener("error", () => {
      error = "This record couldn't be loaded.";
      emit();
    });
  }

  return {
    load(audioUrl) {
      if (!audio || disposed) return;
      error = null;
      stopBufferNode();
      stopCrackle();
      // A different record means every decoded copy is worthless; drop them so
      // the next flip decodes the right file.
      currentUrl = audioUrl;
      decoded = null;
      decodedFor = null;
      reversedCopy = null;
      backmaskCopy = null;
      backmaskCopyWindow = -1;
      src = "element";
      bufPaused = 0;
      bufEnded = false;
      audio.pause();
      audio.src = corsImageUrl(audioUrl);
      audio.currentTime = 0;
      audio.load();
      emit();
    },
    async play() {
      if (!audio || disposed) return;
      buildGraph();
      if (ctx && ctx.state === "suspended") {
        try {
          await ctx.resume();
        } catch {
          /* autoplay policy — the click that got us here should be enough */
        }
      }
      const wanted = wantedSource();
      if (wanted !== "element") {
        if (bufRunning) return;
        const buf = await bufferFor(wanted);
        if (buf) {
          if (src !== wanted) {
            // First play since the record went on with a buffer source
            // already chosen (a room that starts backmasked, say).
            src = wanted;
            bufEnded = false;
            bufPaused = wanted === "reverse" ? buf.duration : audio.currentTime || 0;
          }
          startBuffer(restartPoint(buf));
          return;
        }
        // Fall back to forwards rather than refusing to play at all.
        effects = sanitizeVinylEffects({ ...effects, reverse: false, backmask: false });
        error = wanted === "reverse" ? "This record can't be played backwards here." : "This record can't be backmasked here.";
        src = "element";
      }
      try {
        await audio.play();
      } catch {
        error = "Tap the deck again to play.";
        emit();
      }
    },
    pause() {
      if (bufRunning) {
        bufPaused = positionNow();
        stopBufferNode();
        stopCrackle();
        applyEffects();
        emit();
        return;
      }
      audio?.pause();
    },
    stop() {
      if (!audio) return;
      audio.pause();
      stopBufferNode();
      stopCrackle();
      src = "element";
      bufPaused = 0;
      bufEnded = false;
      audio.removeAttribute("src");
      audio.load();
      error = null;
      emit();
    },
    setEffects(next) {
      // Read the playhead under the *old* source before anything changes.
      const before = wantedSource();
      const pos = positionNow();
      const wasPlaying = playingNow();
      const prevWindow = effects.backmaskWindow;
      effects = sanitizeVinylEffects({ ...effects, ...next });
      if (wantedSource() !== before) void switchSource(pos, wasPlaying);
      else if (src === "backmask" && effects.backmaskWindow !== prevWindow) scheduleBackmaskRebuild();
      applyEffects();
      return effects;
    },
    getEffects: () => effects,
    isPlaying: () => playingNow(),
    currentTime: () => positionNow(),
    duration: () => durationNow(),
    seek(seconds) {
      const buf = activeBuffer();
      if (buf) {
        const target = Math.max(0, Math.min(buf.duration, seconds));
        bufPaused = target;
        bufEnded = false;
        if (bufRunning) startBuffer(target);
        else emit();
        return;
      }
      if (!audio) return;
      const d = Number.isFinite(audio.duration) ? audio.duration : 0;
      audio.currentTime = Math.max(0, Math.min(d || seconds, seconds));
    },
    subscribe(listener) {
      listeners.add(listener);
      emit();
      return () => {
        listeners.delete(listener);
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      stopBufferNode();
      stopTicker();
      if (rebuildTimer !== null && typeof window !== "undefined") window.clearTimeout(rebuildTimer);
      if (audio) {
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
      }
      stopCrackle();
      decoded = null;
      reversedCopy = null;
      backmaskCopy = null;
      listeners.clear();
      if (ctx) {
        ctx.close().catch(() => {});
        ctx = null;
      }
    },
  };
}
