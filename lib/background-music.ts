// lib/background-music.ts
//
// Shared constants/validation for the site-wide background music track
// (Profile.musicUrl/musicEnabled/musicVolume) — same "small sanitizer
// module" pattern as lib/maintenance.ts and lib/gallery-carousel.ts, used
// by both the admin upload/save flow and the public player.
export const MIN_MUSIC_VOLUME = 0;
export const MAX_MUSIC_VOLUME = 100;
export const DEFAULT_MUSIC_VOLUME = 50;

export const MAX_AUDIO_FILE_SIZE_MB = 15;
export const MAX_AUDIO_FILE_SIZE = MAX_AUDIO_FILE_SIZE_MB * 1024 * 1024;

// Kept in sync with app/api/upload/audio/route.ts's ALLOWED_TYPES.
export const ALLOWED_AUDIO_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/ogg",
  "audio/aac",
  "audio/x-m4a",
  "audio/mp4",
];

export function clampMusicVolume(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_MUSIC_VOLUME;
  return Math.min(MAX_MUSIC_VOLUME, Math.max(MIN_MUSIC_VOLUME, Math.round(n)));
}
