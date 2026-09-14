"use client";

// lib/site-music-controller.ts
//
// Coordinates the site-wide background track (BackgroundMusicPlayer.tsx,
// mounted once in app/(public)/layout.tsx and never unmounted across
// client-side navigation) with the Digital Museum, which has its own
// separate soundtrack (MuseumClient.tsx's own <audio>). The two aren't
// parent/child — they're siblings under the same persistent layout — so
// this is a tiny singleton controller rather than prop drilling, the same
// shape lib/sound/engine.ts already uses for sound effects.
//
// Before this, walking from the homepage (site music playing) into the
// museum left the site's <audio> element running, just visually hidden
// behind the museum's z-50 canvas — so a visitor heard the museum's own
// soundtrack *layered over* the site's, or one drowning out the other.
// Reported as "the music just stops" (it doesn't; it becomes both
// inaudible-under and indistinguishable-from the museum's own track). The
// actual fix is to make the handoff deliberate: pause the site track the
// moment the museum mounts, and — only if it was actually playing — resume
// it the moment the museum unmounts (Back to Gallery, or any way out).
//
// A "was playing" flag, not an unconditional resume: a visitor who never
// pressed play shouldn't get music sprung on them just for having left the
// museum, and `.pause()` on an already-paused element is a no-op anyway so
// pausing unconditionally on entry is safe either way.

interface SiteMusicControls {
  pause: () => void;
  resume: () => void;
  isPlaying: () => boolean;
}

let controls: SiteMusicControls | null = null;
let wasPlayingBeforeMuseum = false;

/** Called by BackgroundMusicPlayer once, on mount. */
export function registerSiteMusicControls(next: SiteMusicControls) {
  controls = next;
}

/** Called by BackgroundMusicPlayer's cleanup — defensive; that component
 *  never actually unmounts mid-session, but a stale reference here would
 *  otherwise silently no-op every call below forever if it ever did. */
export function unregisterSiteMusicControls(current: SiteMusicControls) {
  if (controls === current) controls = null;
}

/** Called on entering the Digital Museum. */
export function pauseSiteMusicForMuseum() {
  if (!controls) return;
  wasPlayingBeforeMuseum = controls.isPlaying();
  if (wasPlayingBeforeMuseum) controls.pause();
}

/** Called on leaving the Digital Museum. */
export function resumeSiteMusicAfterMuseum() {
  if (!controls || !wasPlayingBeforeMuseum) return;
  wasPlayingBeforeMuseum = false;
  controls.resume();
}
