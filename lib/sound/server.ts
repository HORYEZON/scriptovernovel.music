// lib/sound/server.ts
//
// Server-side reads of the SoundEffect table, merged against the registry's
// defaults — the same "sparse override" pattern lib/minigames/server.ts uses
// for MiniGame: a key with no row just plays its registry default, and only
// gets a row once an admin actually changes it.
import { prisma } from "@/lib/prisma";
import {
  clampSoundDurationMs,
  clampSoundFrequency,
  clampSoundVolume,
  sanitizeSoundPreset,
  sanitizeSoundSource,
  sanitizeSoundUrl,
  sanitizeWaveform,
  type SoundEffectConfig,
} from "./types";
import { SOUND_EFFECTS, defaultSoundEffectConfig, type SoundCategory } from "./registry";

/** Every registry key → its effective (override or default) playback config. */
export async function getSoundEffectConfigs(): Promise<Record<string, SoundEffectConfig>> {
  const rows = await prisma.soundEffect.findMany();
  const byKey = new Map(rows.map((row) => [row.key, row]));

  const result: Record<string, SoundEffectConfig> = {};
  for (const definition of SOUND_EFFECTS) {
    const row = byKey.get(definition.key);
    result[definition.key] = row
      ? {
          enabled: row.enabled,
          source: sanitizeSoundSource(row.source),
          preset: sanitizeSoundPreset(row.preset),
          url: sanitizeSoundUrl(row.url),
          volume: clampSoundVolume(row.volume),
          waveform: sanitizeWaveform(row.waveform),
          frequency: clampSoundFrequency(row.frequency),
          durationMs: clampSoundDurationMs(row.durationMs),
        }
      : defaultSoundEffectConfig(definition.key);
  }
  return result;
}

export interface AdminSoundEffect extends SoundEffectConfig {
  key: string;
  category: SoundCategory;
  label: string;
  description: string;
}

/** The admin Sound page's full list — every registry key with its metadata and config. */
export async function buildAdminSoundEffects(): Promise<AdminSoundEffect[]> {
  const configs = await getSoundEffectConfigs();
  return SOUND_EFFECTS.map((definition) => ({
    key: definition.key,
    category: definition.category,
    label: definition.label,
    description: definition.description,
    ...configs[definition.key],
  }));
}
