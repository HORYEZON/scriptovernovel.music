// lib/sound/engine.ts
//
// The client-side half of the sound system: plays a `SoundEffectConfig`
// (tone synthesis or an uploaded clip), tracks the one site-wide mute flag,
// and caches the admin's configured sounds after a single fetch so any
// component anywhere can call playSoundEffect(key) without its own
// data-fetching. Everything here only runs in the browser — every exported
// function is safe to call from a client component, but nothing here should
// be imported by server code.
"use client";

import { getSoundPreset, type SoundEffectConfig, type Waveform } from "./types";

// ── Mute ──────────────────────────────────────────────────────────────
// One flag for every sound effect on the site (toasts, payments, minigames,
// admin actions) — not per-category, so muting once is muting done. The
// minigame session header is the one place with a visible toggle for it
// today; other surfaces just respect whatever it's currently set to.

const MUTE_STORAGE_KEY = "sfx:muted";

export function isSoundMuted(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(MUTE_STORAGE_KEY) === "1";
}

export function setSoundMuted(muted: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MUTE_STORAGE_KEY, muted ? "1" : "0");
}

// ── Config cache ─────────────────────────────────────────────────────
// Fetched once (lazily, on the first sound anyone tries to play) and kept
// for the life of the page. A sound effect changes rarely enough that
// re-fetching per play, or even per page, isn't worth the round trip — the
// admin's next full page load is enough for a change to take effect.

let configsPromise: Promise<Record<string, SoundEffectConfig>> | null = null;

function loadConfigs(): Promise<Record<string, SoundEffectConfig>> {
  if (!configsPromise) {
    configsPromise = fetch("/api/sound-effects")
      .then((response) => (response.ok ? response.json() : {}))
      .catch(() => ({}));
  }
  return configsPromise;
}

// ── Playback ─────────────────────────────────────────────────────────

let audioContext: AudioContext | null = null;

/**
 * Lazily creates (and resumes) the shared AudioContext. Browsers refuse to
 * start one before a user gesture, but every call site here is already
 * inside a click/keydown handler (or fires right after one, like a toast),
 * so this is never the first attempt.
 */
function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;

  if (!audioContext) audioContext = new Ctor();
  if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
  return audioContext;
}

/** One short tone with a quick attack and an exponential decay to silence. */
function playTone(waveform: Waveform, frequency: number, durationMs: number, volume: number) {
  const context = getAudioContext();
  if (!context) return;

  const duration = durationMs / 1000;
  // 0.09 is the loudest a single tone gets at 100% — leaves headroom so
  // "louder" always still sounds like a UI cue, not a klaxon.
  const peakGain = (Math.min(100, Math.max(0, volume)) / 100) * 0.09;
  if (peakGain <= 0) return;

  const start = context.currentTime;
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = waveform;
  oscillator.frequency.value = frequency;

  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(peakGain, start + 0.008);
  // exponentialRamp can't target exactly 0, so land just above silence.
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  oscillator.connect(gain).connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

// Uploaded clips are cached by URL and cloned per play, so two effects
// firing in quick succession both get heard instead of the second cutting
// the first off.
const uploadedSoundCache = new Map<string, HTMLAudioElement>();

function playUploadedSound(url: string, volume: number) {
  let base = uploadedSoundCache.get(url);
  if (!base) {
    base = new Audio(url);
    base.preload = "auto";
    uploadedSoundCache.set(url, base);
  }
  const instance = base.cloneNode(true) as HTMLAudioElement;
  instance.volume = Math.min(100, Math.max(0, volume)) / 100;
  instance.play().catch(() => {
    // Blocked or the file failed to decode — a missing sound effect isn't
    // worth surfacing an error over.
  });
}

function playConfig(config: SoundEffectConfig) {
  if (!config.enabled) return;

  if (config.source === "upload") {
    if (config.url) playUploadedSound(config.url, config.volume);
    return;
  }

  const { waveform, frequency, durationMs } =
    config.source === "prebuilt" ? getSoundPreset(config.preset) : config;
  playTone(waveform, frequency, durationMs, config.volume);
}

/**
 * Plays the admin-configured sound for a registry key (see registry.ts),
 * unless the visitor has muted sound. Fire-and-forget: the config fetch
 * this depends on may still be in flight on the very first call of a page
 * load, so this resolves the sound asynchronously rather than blocking
 * whatever triggered it.
 */
export function playSoundEffect(key: string) {
  if (isSoundMuted()) return;
  loadConfigs().then((configs) => {
    const config = configs[key];
    if (config) playConfig(config);
  });
}

/** Plays a config directly — used by the admin's preview buttons, which
 * already have the draft config in hand and shouldn't wait on a fetch. */
export function previewSoundEffect(config: SoundEffectConfig) {
  playConfig(config);
}
