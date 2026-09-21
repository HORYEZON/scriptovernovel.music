"use client";

// lib/museum/vinylAudio.ts
//
// The Vinyl Room's deck: one hidden <audio> element for the record's file,
// routed through a Web Audio effects chain the visitor can tweak from the
// turntable panel. Browser-only — MuseumScene.tsx creates one player per
// museum visit and disposes it on the way out.
//
// Chain (left to right):
//
//   MediaElementSource
//     → lo-fi:   BiquadFilter (lowpass, 20 kHz → 1.8 kHz as the amount
//                rises) + a WaveShaper soft-clip, crossfaded in with the
//                amount so 0 is a clean bypass
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
// Speed is the <audio> element's playbackRate with preservesPitch off, so
// 45 on a 33 sounds the way it does on a real deck (pitch follows). The
// rpm→rate maths lives in vinylConfig.ts (playbackRateFor) so the admin's
// default-effects card and this player agree.
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
  let lofiFilter: BiquadFilterNode | null = null;
  let lofiShaper: WaveShaperNode | null = null;
  let lofiDry: GainNode | null = null;
  let lofiWet: GainNode | null = null;
  let delayNode: DelayNode | null = null;
  let delayFeedback: GainNode | null = null;
  let delayWet: GainNode | null = null;
  let reverb: ConvolverNode | null = null;
  let reverbDry: GainNode | null = null;
  let reverbWet: GainNode | null = null;
  let master: GainNode | null = null;
  let crackleSource: AudioBufferSourceNode | null = null;
  let crackleGain: GainNode | null = null;

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

  function emit() {
    if (!audio) return;
    const state: VinylPlayerState = {
      playing: !audio.paused && !audio.ended,
      currentTime: audio.currentTime || 0,
      duration: Number.isFinite(audio.duration) ? audio.duration : 0,
      ended: audio.ended,
      error,
    };
    listeners.forEach((l) => l(state));
  }

  function buildGraph() {
    if (!Ctor || !audio || ctx) return;
    try {
      ctx = new Ctor();
      source = ctx.createMediaElementSource(audio);

      // Lo-fi: filter + soft clip on the wet path, clean on the dry path.
      lofiFilter = ctx.createBiquadFilter();
      lofiFilter.type = "lowpass";
      lofiFilter.Q.value = 0.9;
      lofiShaper = ctx.createWaveShaper();
      lofiShaper.curve = makeSoftClip(0.5);
      lofiShaper.oversample = "2x";
      lofiDry = ctx.createGain();
      lofiWet = ctx.createGain();
      const lofiOut = ctx.createGain();
      source.connect(lofiDry).connect(lofiOut);
      source.connect(lofiFilter).connect(lofiShaper).connect(lofiWet).connect(lofiOut);

      // Delay: feedback loop beside the dry path.
      delayNode = ctx.createDelay(1.5);
      delayNode.delayTime.value = 0.28;
      delayFeedback = ctx.createGain();
      delayFeedback.gain.value = 0.35;
      delayWet = ctx.createGain();
      const delayOut = ctx.createGain();
      lofiOut.connect(delayOut);
      lofiOut.connect(delayNode);
      delayNode.connect(delayFeedback).connect(delayNode);
      delayNode.connect(delayWet).connect(delayOut);

      // Reverb: dry/wet crossfade.
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
    if (audio) audio.playbackRate = playbackRateFor(effects);
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
    if (delayWet && delayFeedback) {
      delayWet.gain.setTargetAtTime(effects.delay * 0.6, t, ramp);
      delayFeedback.gain.setTargetAtTime(0.2 + effects.delay * 0.4, t, ramp);
    }
    if (reverbDry && reverbWet) {
      reverbDry.gain.setTargetAtTime(1 - effects.reverb * 0.6, t, ramp);
      reverbWet.gain.setTargetAtTime(effects.reverb, t, ramp);
    }
    if (crackleGain) {
      const playing = audio ? !audio.paused && !audio.ended : false;
      crackleGain.gain.setTargetAtTime(playing ? effects.crackle * 0.5 : 0, t, ramp);
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
    audio.addEventListener("timeupdate", emit);
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
      try {
        await audio.play();
      } catch {
        error = "Tap the deck again to play.";
        emit();
      }
    },
    pause() {
      audio?.pause();
    },
    stop() {
      if (!audio) return;
      audio.pause();
      stopCrackle();
      audio.removeAttribute("src");
      audio.load();
      error = null;
      emit();
    },
    setEffects(next) {
      effects = sanitizeVinylEffects({ ...effects, ...next });
      applyEffects();
      return effects;
    },
    getEffects: () => effects,
    isPlaying: () => (audio ? !audio.paused && !audio.ended : false),
    currentTime: () => audio?.currentTime ?? 0,
    duration: () => (audio && Number.isFinite(audio.duration) ? audio.duration : 0),
    seek(seconds) {
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
      if (audio) {
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
      }
      stopCrackle();
      listeners.clear();
      if (ctx) {
        ctx.close().catch(() => {});
        ctx = null;
      }
    },
  };
}
