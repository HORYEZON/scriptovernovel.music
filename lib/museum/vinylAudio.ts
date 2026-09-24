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
// BACKMASKING
// -----------
// An <audio> element cannot play backwards at any playbackRate, so `reverse`
// switches the player's *source*: the file is fetched, decoded, copied
// sample-by-sample back to front, and played from an AudioBufferSourceNode
// into the same chain. Everything downstream — effects, crackle, the panel,
// the Lyrics Wall — is unchanged, and the two modes hand the playhead to each
// other so flipping mid-song carries on from the same point in the song.
//
// The cost is that the reported position has to be computed from the context
// clock (a buffer source has no currentTime) and that a decode needs the file
// over fetch(), which needs CORS on the bucket — the same requirement the
// element already has. A decode that fails leaves the record playing forwards
// and reports it, rather than dropping into silence.
//
// The audio file is fetched with crossOrigin="anonymous" through
// corsImageUrl() — R2 only sends the CORS header when the request carries
// an Origin, and a MediaElementSource over a non-CORS response is silent
// (see lib/images/corsUrl.ts for the cache-splitting reason).

import { corsImageUrl } from "@/lib/images/corsUrl";
import { DEFAULT_VINYL_EFFECTS, playbackRateFor, sanitizeVinylEffects, type VinylEffects } from "./vinylConfig";

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
  /** The record is turning backwards and the reversed copy is ready. */
  reversed: boolean;
  /** A reversed copy is being fetched and decoded right now. */
  decoding: boolean;
}

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

/** Reverse a decoded buffer, channel by channel — the backmasked copy. */
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

  // Backmasking state. `reversed` is the decoded, back-to-front copy of the
  // record currently loaded; the anchor pair is how a buffer source (which
  // has no clock of its own) reports a position.
  let currentUrl: string | null = null;
  let reversedBuffer: AudioBuffer | null = null;
  let reversedFor: string | null = null;
  let decodePromise: Promise<AudioBuffer | null> | null = null;
  let decoding = false;
  let revNode: AudioBufferSourceNode | null = null;
  let revRunning = false;
  let revEnded = false;
  /** ctx.currentTime when the reversed source started. */
  let revStartedAt = 0;
  /** Offset into the reversed buffer it started from. */
  let revStartOffset = 0;
  /** Where the playhead rests (song time, forwards) while reversed + paused. */
  let revPaused = 0;
  let ticker: number | null = null;

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

  /** Playing in either mode. */
  function playingNow(): boolean {
    if (revRunning) return true;
    return audio ? !audio.paused && !audio.ended : false;
  }

  /** The playhead in *song* time (always forwards), whichever way it turns. */
  function positionNow(): number {
    if (effects.reverse && reversedBuffer) {
      const d = reversedBuffer.duration;
      if (revRunning && ctx) {
        const rate = revNode?.playbackRate.value ?? playbackRateFor(effects);
        const elapsed = (ctx.currentTime - revStartedAt) * rate;
        return Math.max(0, Math.min(d, d - (revStartOffset + elapsed)));
      }
      return Math.max(0, Math.min(d, revPaused));
    }
    return audio?.currentTime ?? 0;
  }

  function durationNow(): number {
    if (effects.reverse && reversedBuffer) return reversedBuffer.duration;
    return audio && Number.isFinite(audio.duration) ? audio.duration : 0;
  }

  function emit() {
    const state: VinylPlayerState = {
      playing: playingNow(),
      currentTime: positionNow(),
      duration: durationNow(),
      ended: effects.reverse && reversedBuffer ? revEnded : Boolean(audio?.ended),
      error,
      reversed: effects.reverse && reversedBuffer !== null,
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
    if (revNode && ctx) {
      // Re-anchor before changing the rate: positionNow() integrates elapsed
      // context time at the *current* rate, so the old rate's contribution has
      // to be banked into the offset or the playhead jumps.
      if (revRunning) {
        const elapsed = (ctx.currentTime - revStartedAt) * revNode.playbackRate.value;
        revStartOffset += elapsed;
        revStartedAt = ctx.currentTime;
      }
      revNode.playbackRate.value = rate;
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

  // ── Backmasking ────────────────────────────────────────────────────────

  /** Fetch + decode + reverse the loaded record, once per URL. */
  function ensureReversed(): Promise<AudioBuffer | null> {
    const context = ctx;
    const url = currentUrl;
    if (!context || !url) return Promise.resolve(null);
    if (reversedFor === url && reversedBuffer) return Promise.resolve(reversedBuffer);
    if (decodePromise) return decodePromise;
    decoding = true;
    emit();
    decodePromise = (async () => {
      try {
        const res = await fetch(corsImageUrl(url), { mode: "cors" });
        if (!res.ok) throw new Error(String(res.status));
        const bytes = await res.arrayBuffer();
        const decoded = await context.decodeAudioData(bytes);
        const rev = reverseBuffer(context, decoded);
        reversedBuffer = rev;
        reversedFor = url;
        return rev;
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

  function stopReverseNode() {
    if (!revNode) return;
    revNode.onended = null;
    try {
      revNode.stop();
    } catch {
      /* already stopped */
    }
    revNode.disconnect();
    revNode = null;
    revRunning = false;
    stopTicker();
  }

  /** Start the reversed copy at `fromSong` seconds of the song's own (forward)
   *  timeline — the mirrored offset is what the buffer actually plays from. */
  function startReverse(fromSong: number) {
    if (!ctx || !input || !reversedBuffer) return;
    stopReverseNode();
    const d = reversedBuffer.duration;
    const offset = Math.max(0, Math.min(d, d - fromSong));
    // Already at the run-out groove: nothing left to play backwards.
    if (offset >= d) {
      revEnded = true;
      revPaused = 0;
      emit();
      return;
    }
    const node = ctx.createBufferSource();
    node.buffer = reversedBuffer;
    node.playbackRate.value = playbackRateFor(effects);
    node.connect(input);
    node.onended = () => {
      if (revNode !== node) return;
      revRunning = false;
      revEnded = true;
      revPaused = 0;
      revNode = null;
      stopTicker();
      stopCrackle();
      applyEffects();
      emit();
    };
    revNode = node;
    revStartedAt = ctx.currentTime;
    revStartOffset = offset;
    revRunning = true;
    revEnded = false;
    node.start(0, offset);
    startCrackle();
    startTicker();
    applyEffects();
    emit();
  }

  /** Hand the playhead between the element and the reversed buffer when the
   *  backmasking switch is flipped, so the song carries on from where it was. */
  async function switchDirection() {
    const wasPlaying = playingNow();
    const pos = positionNow();
    if (effects.reverse) {
      buildGraph();
      if (ctx && ctx.state === "suspended") {
        try {
          await ctx.resume();
        } catch {
          /* the gesture that flipped the switch should be enough */
        }
      }
      const rev = await ensureReversed();
      if (!rev) {
        // No decode, no backmasking — say so and keep the record turning the
        // way it was rather than dropping into silence.
        effects = sanitizeVinylEffects({ ...effects, reverse: false });
        error = "This record can't be played backwards here.";
        emit();
        return;
      }
      audio?.pause();
      revEnded = false;
      revPaused = pos > 0 ? pos : rev.duration;
      if (wasPlaying) startReverse(revPaused);
      else emit();
    } else {
      stopReverseNode();
      stopCrackle();
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
    }
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
    // While the record runs backwards the element is parked, so its clock
    // says nothing about where the deck is — the ticker reports instead.
    audio.addEventListener("timeupdate", () => {
      if (!revRunning) emit();
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
      stopReverseNode();
      stopCrackle();
      // A different record means the decoded copy is worthless; drop it so
      // the next backmask decodes the right file.
      currentUrl = audioUrl;
      reversedBuffer = null;
      reversedFor = null;
      revPaused = 0;
      revEnded = false;
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
      if (effects.reverse) {
        const rev = await ensureReversed();
        if (!rev) {
          // Fall back to forwards rather than refusing to play at all.
          effects = sanitizeVinylEffects({ ...effects, reverse: false });
          error = "This record can't be played backwards here.";
        } else {
          if (revRunning) return;
          startReverse(revEnded || revPaused <= 0 ? rev.duration : revPaused);
          return;
        }
      }
      try {
        await audio.play();
      } catch {
        error = "Tap the deck again to play.";
        emit();
      }
    },
    pause() {
      if (revRunning) {
        revPaused = positionNow();
        stopReverseNode();
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
      stopReverseNode();
      stopCrackle();
      revPaused = 0;
      revEnded = false;
      audio.removeAttribute("src");
      audio.load();
      error = null;
      emit();
    },
    setEffects(next) {
      const wasReverse = effects.reverse;
      effects = sanitizeVinylEffects({ ...effects, ...next });
      if (effects.reverse !== wasReverse) void switchDirection();
      applyEffects();
      return effects;
    },
    getEffects: () => effects,
    isPlaying: () => playingNow(),
    currentTime: () => positionNow(),
    duration: () => durationNow(),
    seek(seconds) {
      if (effects.reverse && reversedBuffer) {
        const target = Math.max(0, Math.min(reversedBuffer.duration, seconds));
        revPaused = target;
        revEnded = false;
        if (revRunning) startReverse(target);
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
      stopReverseNode();
      stopTicker();
      if (audio) {
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
      }
      stopCrackle();
      reversedBuffer = null;
      reversedFor = null;
      listeners.clear();
      if (ctx) {
        ctx.close().catch(() => {});
        ctx = null;
      }
    },
  };
}
