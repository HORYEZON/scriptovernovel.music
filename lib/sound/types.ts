// lib/sound/types.ts
//
// Shared shape for every sound effect on the site — one `SoundEffectConfig`
// per registry key (see registry.ts), whether it's a minigame move, a toast,
// a payment result, or an admin delete. Same "small sanitizer module shared
// by the admin form and the API route" pattern as lib/background-music.ts.

export type SoundSource = "prebuilt" | "upload" | "synthesized";
export const SOUND_SOURCES: SoundSource[] = ["prebuilt", "upload", "synthesized"];

export type Waveform = "sine" | "triangle" | "square" | "sawtooth";
export const WAVEFORMS: Waveform[] = ["sine", "triangle", "square", "sawtooth"];

export const MIN_SOUND_VOLUME = 0;
export const MAX_SOUND_VOLUME = 100;
export const DEFAULT_SOUND_VOLUME = 70;

export const MIN_SOUND_FREQUENCY = 100;
export const MAX_SOUND_FREQUENCY = 2000;

export const MIN_SOUND_DURATION_MS = 20;
export const MAX_SOUND_DURATION_MS = 300;

export interface SoundPreset {
  id: string;
  label: string;
  waveform: Waveform;
  frequency: number;
  durationMs: number;
}

/**
 * The "prebuilt" library — fixed, ready-to-use recipes an admin picks by
 * name rather than by dialing in a waveform/frequency/duration themselves.
 * There are no audio files behind these; each is synthesized the same way
 * a "synthesized" custom sound is, just with the numbers already chosen.
 * Shared across every category (toast, payment, minigame, admin) — a
 * "Classic Click" sounds the same wherever it's picked.
 */
export const SOUND_PRESETS: SoundPreset[] = [
  { id: "click", label: "Classic Click", waveform: "triangle", frequency: 420, durationMs: 70 },
  { id: "pop", label: "Soft Pop", waveform: "sine", frequency: 520, durationMs: 90 },
  { id: "chime", label: "Bright Chime", waveform: "sine", frequency: 880, durationMs: 140 },
  { id: "blip", label: "Arcade Blip", waveform: "square", frequency: 660, durationMs: 55 },
  { id: "tap", label: "Wood Tap", waveform: "sawtooth", frequency: 260, durationMs: 90 },
  { id: "buzz", label: "Low Buzz", waveform: "sawtooth", frequency: 160, durationMs: 140 },
];

export function getSoundPreset(id: string): SoundPreset {
  return SOUND_PRESETS.find((preset) => preset.id === id) ?? SOUND_PRESETS[0];
}

/** What the browser needs to actually play a sound — no admin-only metadata. */
export interface SoundEffectConfig {
  enabled: boolean;
  source: SoundSource;
  preset: string;
  url: string | null;
  volume: number;
  waveform: Waveform;
  frequency: number;
  durationMs: number;
}

// ── Sanitizers, shared by every admin form and API route that touches a
// SoundEffectConfig. ────────────────────────────────────────────────────

export function sanitizeSoundSource(value: unknown): SoundSource {
  return typeof value === "string" && (SOUND_SOURCES as string[]).includes(value)
    ? (value as SoundSource)
    : "prebuilt";
}

export function sanitizeSoundPreset(value: unknown): string {
  return typeof value === "string" && SOUND_PRESETS.some((preset) => preset.id === value)
    ? value
    : SOUND_PRESETS[0].id;
}

export function sanitizeWaveform(value: unknown): Waveform {
  return typeof value === "string" && (WAVEFORMS as string[]).includes(value)
    ? (value as Waveform)
    : "triangle";
}

export function clampSoundVolume(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_SOUND_VOLUME;
  return Math.min(MAX_SOUND_VOLUME, Math.max(MIN_SOUND_VOLUME, Math.round(n)));
}

export function clampSoundFrequency(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 420;
  return Math.min(MAX_SOUND_FREQUENCY, Math.max(MIN_SOUND_FREQUENCY, Math.round(n)));
}

export function clampSoundDurationMs(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 70;
  return Math.min(MAX_SOUND_DURATION_MS, Math.max(MIN_SOUND_DURATION_MS, Math.round(n)));
}

/** A same-origin path or an https URL, or null — same shape as an uploaded track. */
export function sanitizeSoundUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 2048) return null;
  if (trimmed.startsWith("/")) return trimmed;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "https:" ? trimmed : null;
  } catch {
    return null;
  }
}
