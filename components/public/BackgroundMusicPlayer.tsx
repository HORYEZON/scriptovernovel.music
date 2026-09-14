// components/public/BackgroundMusicPlayer.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import { registerSiteMusicControls, unregisterSiteMusicControls } from "@/lib/site-music-controller";

// Mounted once in app/(public)/layout.tsx (same spot as CursorGlow/BackToTop)
// so the <audio> element persists — and keeps playing — across client-side
// navigation between public pages. Browsers block real autoplay-with-sound,
// so this never tries to start itself; it just gives visitors a floating
// toggle. A hard page reload always starts paused again, same as any other
// site with a music toggle.
//
// The Digital Museum has its own separate soundtrack and used to just sit
// on top of this one (z-50, hiding the toggle) while this track kept
// running underneath — two tracks at once, one of them with no visible way
// to stop. Registers its pause/resume with lib/site-music-controller.ts so
// MuseumClient.tsx can pause this on entry and resume it (only if it was
// actually playing) on the way back out.
export function BackgroundMusicPlayer({
  musicUrl,
  volume,
}: {
  musicUrl?: string | null;
  volume: number;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  // Mirrors `isPlaying` for the controller's isPlaying() — a museum-entry
  // pause can happen well after this component's own closures were last
  // created, so that read has to come from a ref, not a stale state value.
  const isPlayingRef = useRef(false);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = Math.min(100, Math.max(0, volume)) / 100;
    }
  }, [volume]);

  const pause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    setIsPlaying(false);
  }, []);

  const resume = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.play().catch(() => {
      // Same guard as the manual toggle below — stay paused rather than
      // show a "playing" state that isn't real.
      setIsPlaying(false);
    });
    setIsPlaying(true);
  }, []);

  useEffect(() => {
    const controls = { pause, resume, isPlaying: () => isPlayingRef.current };
    registerSiteMusicControls(controls);
    return () => unregisterSiteMusicControls(controls);
  }, [pause, resume]);

  function toggle() {
    if (isPlaying) pause();
    else resume();
  }

  if (!musicUrl) return null;

  return (
    <>
      <audio ref={audioRef} src={musicUrl} loop preload="none" />
      <button
        type="button"
        onClick={toggle}
        aria-label={isPlaying ? "Pause background music" : "Play background music"}
        title={isPlaying ? "Pause background music" : "Play background music"}
        className={cn(
          "fixed bottom-5 left-5 sm:bottom-6 sm:left-6 z-40",
          "flex items-center justify-center w-12 h-12 rounded-full",
          "shadow-xl backdrop-blur-md border transition-all duration-200 hover:scale-105 active:scale-95",
          isPlaying
            ? "bg-sepia text-white border-sepia/60"
            : "bg-white/80 dark:bg-ink/80 text-ink dark:text-cream border-black/10 dark:border-white/15"
        )}
      >
        {isPlaying && (
          <span className="absolute inset-0 rounded-full bg-sepia/40 animate-ping" />
        )}
        {isPlaying ? (
          <Volume2 size={19} strokeWidth={1.5} className="relative" />
        ) : (
          <VolumeX size={19} strokeWidth={1.5} className="relative" />
        )}
      </button>
    </>
  );
}
