"use client";

// lib/museum/museumMusicController.ts
//
// The museum's own soundtrack (MuseumClient.tsx's <audio>) versus the Vinyl
// Room's deck (lib/museum/vinylAudio.ts): the same handoff problem
// lib/site-music-controller.ts solves one level up, in the same shape. The
// deck lives deep inside MuseumScene; the soundtrack element lives in
// MuseumClient — siblings by any practical measure — so a tiny singleton
// beats threading pause/resume through four component layers.
//
// Rule: the moment a record starts, pause the soundtrack if it was playing;
// when the record is taken off the deck (or the visitor leaves the room's
// player behind by exiting the museum), resume it only if *we* paused it.

interface MuseumMusicControls {
  pause: () => void;
  resume: () => void;
  isPlaying: () => boolean;
}

let controls: MuseumMusicControls | null = null;
let pausedForVinyl = false;

/** Called by MuseumClient once, on mount. */
export function registerMuseumMusicControls(next: MuseumMusicControls) {
  controls = next;
}

export function unregisterMuseumMusicControls(current: MuseumMusicControls) {
  if (controls === current) controls = null;
  pausedForVinyl = false;
}

/** Called when a record starts playing on the deck. */
export function pauseMuseumMusicForVinyl() {
  if (!controls) return;
  if (controls.isPlaying()) {
    pausedForVinyl = true;
    controls.pause();
  }
}

/** Called when the deck goes quiet for good (record taken off / disposed). */
export function resumeMuseumMusicAfterVinyl() {
  if (!controls || !pausedForVinyl) return;
  pausedForVinyl = false;
  controls.resume();
}
