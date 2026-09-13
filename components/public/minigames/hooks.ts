"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { optimizedImageUrl, type OptimizedWidth } from "@/lib/minigames/images";
import { isSoundMuted, playSoundEffect, setSoundMuted } from "@/lib/sound/engine";

export type AssetStatus = "loading" | "ready" | "error";

export interface ImageAsset {
  status: AssetStatus;
  /** Width ÷ height of the source artwork; 1 until it is known. */
  ratio: number;
}

/**
 * Preloads the exact optimized URL the tiles will use and reports its natural
 * proportions.
 *
 * Two reasons this exists rather than just pointing CSS at the image:
 *   • the board is laid out from the artwork's real aspect ratio, so tiles
 *     never stretch it — that number is only knowable after a load
 *   • a game that starts before its artwork is decoded pops in tile by tile,
 *     and a game whose artwork 404s needs to say so instead of dealing a board
 *     of empty squares
 */
export function useImageAsset(url: string | null, width?: OptimizedWidth): ImageAsset {
  const [asset, setAsset] = useState<ImageAsset>({ status: "loading", ratio: 1 });

  useEffect(() => {
    if (!url) {
      setAsset({ status: "error", ratio: 1 });
      return;
    }

    let cancelled = false;
    setAsset({ status: "loading", ratio: 1 });

    const image = new window.Image();
    image.onload = () => {
      if (cancelled) return;
      const ratio =
        image.naturalWidth > 0 && image.naturalHeight > 0
          ? image.naturalWidth / image.naturalHeight
          : 1;
      setAsset({ status: "ready", ratio });
    };
    image.onerror = () => {
      if (!cancelled) setAsset({ status: "error", ratio: 1 });
    };
    image.src = optimizedImageUrl(url, width);

    return () => {
      cancelled = true;
    };
  }, [url, width]);

  return asset;
}

/**
 * Elapsed milliseconds since the round started, ticking about four times a
 * second — enough for a smooth mm:ss readout, cheap enough not to matter.
 *
 * The value is display-only. The score is computed from the server's own
 * clock, so a paused tab or a fiddled Date.now() changes what the player
 * sees here and nothing that counts.
 */
export function useGameClock(running: boolean, startedAt: number | null): number {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!running || startedAt === null) return;
    setElapsed(Date.now() - startedAt);
    const id = window.setInterval(() => setElapsed(Date.now() - startedAt), 250);
    return () => window.clearInterval(id);
  }, [running, startedAt]);

  return elapsed;
}

/** True when the visitor has asked for reduced motion. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

/**
 * Focus trap + restore for the mini-game modals. The gallery's existing
 * modals close on Escape but leave focus loose behind them; games are longer
 * interactions, so keyboard users get a proper enclosure here.
 */
export function useFocusTrap(active: boolean) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!active) return;
    const container = ref.current;
    if (!container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusables = () =>
      Array.from(
        container.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((element) => element.offsetParent !== null || element === document.activeElement);

    // Move focus in on open so the first Tab lands inside, not in the page
    // behind the overlay.
    const initial = focusables()[0];
    initial?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    container.ownerDocument.addEventListener("keydown", onKeyDown);
    return () => {
      container.ownerDocument.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [active]);

  return ref;
}

/**
 * The mini-game sound effects ("minigame.move", "minigame.exit" — see
 * lib/sound/registry.ts): exposes `play(key)` plus a mute toggle whose state
 * persists across sessions (so muting once keeps it muted next visit, and
 * mutes every other sound effect on the site too — see lib/sound/engine.ts).
 */
export function useGameSound() {
  const [muted, setMuted] = useState(isSoundMuted);

  const play = useCallback((key: string) => {
    playSoundEffect(key);
  }, []);

  const toggleMuted = useCallback(() => {
    setMuted((current) => {
      const next = !current;
      setSoundMuted(next);
      return next;
    });
  }, []);

  return { muted, play, toggleMuted };
}
