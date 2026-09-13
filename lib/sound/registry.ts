// lib/sound/registry.ts
//
// Every sound-effect key the site knows about, with the category it groups
// under in the admin (Sound settings, tabbed by category) and the defaults
// it plays with until an admin overrides it. Adding a new sound elsewhere in
// the app means adding one entry here and calling playSoundEffect(key) at
// the moment it should fire — nothing else has to change for it to show up
// in the admin UI.
import type { SoundEffectConfig, SoundSource, Waveform } from "./types";
import { DEFAULT_SOUND_VOLUME } from "./types";

export type SoundCategory =
  "toast" | "payment" | "minigame" | "admin" | "museum";

export const SOUND_CATEGORIES: { id: SoundCategory; label: string }[] = [
  { id: "toast", label: "Toast Sound" },
  { id: "admin", label: "Admin Actions Sound" },
  { id: "payment", label: "Payment Sound" },
  { id: "minigame", label: "Minigame Sound" },
  { id: "museum", label: "Digital Museum Sound" },
];

export interface SoundEffectDefinition {
  key: string;
  category: SoundCategory;
  label: string;
  description: string;
  defaultPreset: string;
  defaultWaveform: Waveform;
  defaultFrequency: number;
  defaultDurationMs: number;
}

export const SOUND_EFFECTS: SoundEffectDefinition[] = [
  {
    key: "toast.success",
    category: "toast",
    label: "Success toast",
    description:
      "Plays whenever a success notification appears, across the admin and the public site.",
    defaultPreset: "pop",
    defaultWaveform: "sine",
    defaultFrequency: 660,
    defaultDurationMs: 100,
  },
  {
    key: "toast.error",
    category: "toast",
    label: "Error toast",
    description: "Plays whenever an error notification appears.",
    defaultPreset: "buzz",
    defaultWaveform: "sawtooth",
    defaultFrequency: 180,
    defaultDurationMs: 130,
  },
  {
    key: "payment.success",
    category: "payment",
    label: "Payment confirmed",
    description:
      "Plays on the order confirmation page after a successful payment.",
    defaultPreset: "chime",
    defaultWaveform: "sine",
    defaultFrequency: 880,
    defaultDurationMs: 160,
  },
  {
    key: "payment.error",
    category: "payment",
    label: "Payment failed / cancelled",
    description: "Plays on the payment-cancelled page and when checkout fails.",
    defaultPreset: "buzz",
    defaultWaveform: "sawtooth",
    defaultFrequency: 160,
    defaultDurationMs: 150,
  },
  {
    key: "minigame.move",
    category: "minigame",
    label: "Move a piece",
    description:
      "Plays when a visitor moves a piece (currently the sliding puzzle).",
    defaultPreset: "click",
    defaultWaveform: "triangle",
    defaultFrequency: 420,
    defaultDurationMs: 70,
  },
  {
    key: "minigame.exit",
    category: "minigame",
    label: "Exit mid-game",
    description:
      "Plays when a visitor confirms leaving a round early, before it's finished.",
    defaultPreset: "tap",
    defaultWaveform: "sawtooth",
    defaultFrequency: 220,
    defaultDurationMs: 110,
  },
  {
    key: "admin.delete",
    category: "admin",
    label: "Item deleted",
    description:
      'Plays whenever the admin deletes, removes, or trashes something — detected from the toast message itself (e.g. "Artwork deleted"), so it fires without every delete action needing its own wiring.',
    defaultPreset: "tap",
    defaultWaveform: "sawtooth",
    defaultFrequency: 240,
    defaultDurationMs: 100,
  },
  {
    key: "admin.deleteConfirm",
    category: "admin",
    label: "Delete confirmation shown",
    description:
      'Plays the moment a "are you sure?" delete confirmation modal opens, before the admin decides.',
    defaultPreset: "tap",
    defaultWaveform: "triangle",
    defaultFrequency: 320,
    defaultDurationMs: 80,
  },
  {
    key: "minigame.highscore",
    category: "minigame",
    label: "New highscore",
    description:
      "Plays on the results screen when a visitor's round sets a new all-time highscore (rank #1).",
    defaultPreset: "chime",
    defaultWaveform: "sine",
    defaultFrequency: 990,
    defaultDurationMs: 180,
  },
  {
    key: "museum.exitConfirm",
    category: "museum",
    label: "Leave warning shown",
    description:
      'Plays the moment the "Leave the museum?" warning opens — when a visitor with unsaved progress clicks "Back to Gallery", before they decide.',
    defaultPreset: "tap",
    defaultWaveform: "triangle",
    defaultFrequency: 320,
    defaultDurationMs: 80,
  },
  {
    key: "museum.exit",
    category: "museum",
    label: "Leaving the museum",
    description:
      'Plays when a visitor actually leaves the Digital Museum — a direct "Back to Gallery" with nothing to lose, or confirming "Leave" on the warning.',
    defaultPreset: "tap",
    defaultWaveform: "sawtooth",
    defaultFrequency: 220,
    defaultDurationMs: 110,
  },
  {
    key: "museum.achievement",
    category: "museum",
    label: "Achievement unlocked",
    description:
      'Plays with the "Achievement Unlocked" banner when a visitor reaches a Digital Museum badge threshold.',
    defaultPreset: "chime",
    defaultWaveform: "sine",
    defaultFrequency: 880,
    defaultDurationMs: 170,
  },
];

const BY_KEY = new Map(
  SOUND_EFFECTS.map((definition) => [definition.key, definition])
);

export function getSoundEffectDefinition(
  key: string
): SoundEffectDefinition | null {
  return BY_KEY.get(key) ?? null;
}

export function isSoundEffectKey(value: unknown): value is string {
  return typeof value === "string" && BY_KEY.has(value);
}

export function defaultSoundEffectConfig(key: string): SoundEffectConfig {
  const definition = getSoundEffectDefinition(key);
  return {
    enabled: true,
    source: "prebuilt" as SoundSource,
    preset: definition?.defaultPreset ?? "click",
    url: null,
    volume: DEFAULT_SOUND_VOLUME,
    waveform: definition?.defaultWaveform ?? "triangle",
    frequency: definition?.defaultFrequency ?? 420,
    durationMs: definition?.defaultDurationMs ?? 70,
  };
}
