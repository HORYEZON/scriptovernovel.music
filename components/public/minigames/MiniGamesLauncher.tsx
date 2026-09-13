"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Gamepad2, Play, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { GAME_REGISTRY } from "@/lib/minigames/registry";
import { formatScore } from "@/lib/minigames/scoring";
import { DIFFICULTY_LABELS, type GameType, type PublicGame } from "@/lib/minigames/types";
import { GameIcon } from "./GameIcon";
import { GamePreviewModal } from "./GamePreviewModal";
import { GameSession } from "./GameSession";

interface MiniGamesLauncherProps {
  /**
   * Rendered on the server with the gallery, so the entry point costs no
   * client request at all until the visitor actually opens it.
   */
  initialGames: PublicGame[];
  /**
   * Extra classes for the trigger button only — the gallery hides it below
   * `sm` (`hidden sm:inline-flex`) and opens this from its own mobile
   * "Explore" sheet instead, via openRequest. Only the button is affected;
   * the popover/sheet/preview/session still render regardless.
   */
  triggerClassName?: string;
  /**
   * Bump this number to open the menu from outside (the gallery's mobile
   * Explore sheet). A counter rather than a boolean so two requests in a
   * row both open it, even if the visitor closed it in between.
   */
  openRequest?: number;
}

/** How stale the cached list may get before opening the menu refetches it. */
const STALE_AFTER_MS = 20_000;

/**
 * The gallery's way in to the mini games.
 *
 * Desktop gets a popover anchored under the button; touch screens get a bottom
 * sheet built around a native <select>, because a hover-adjacent popover is
 * the wrong shape for a thumb. Both drive the same state — picking a game
 * opens the same preview, which opens the same session.
 */
export function MiniGamesLauncher({
  initialGames,
  triggerClassName,
  openRequest = 0,
}: MiniGamesLauncherProps) {
  const [games, setGames] = useState<PublicGame[]>(initialGames);
  const [open, setOpen] = useState(false);
  const [previewType, setPreviewType] = useState<GameType | null>(null);
  const [playingType, setPlayingType] = useState<GameType | null>(null);
  const [selected, setSelected] = useState<GameType | null>(initialGames[0]?.type ?? null);

  const fetchedAt = useRef(Date.now());
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  /**
   * Leaderboards are read on demand, never polled — opening the menu, and
   * finishing a round, are the only two moments the numbers can have changed
   * in a way the visitor is looking at.
   */
  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/minigames");
      if (!response.ok) return;
      const data = await response.json();
      if (Array.isArray(data?.games)) {
        setGames(data.games);
        fetchedAt.current = Date.now();
        setSelected((current) =>
          current && data.games.some((game: PublicGame) => game.type === current)
            ? current
            : (data.games[0]?.type ?? null)
        );
      }
    } catch {
      // Keep showing the last good list; the menu is still usable and a
      // stale "best score" is not worth an error banner over.
    }
  }, []);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && Date.now() - fetchedAt.current > STALE_AFTER_MS) refresh();
  }

  // Deep-link: /gallery?minigames=open (the admin Minigames page's "Go to
  // Minigames" button) opens the menu on arrival.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("minigames") === "open") {
      setOpen(true);
      refresh();
    }
  }, [refresh]);

  // Opened from outside (see openRequest) — same path as a tap on the button.
  useEffect(() => {
    if (openRequest > 0) {
      setOpen(true);
      if (Date.now() - fetchedAt.current > STALE_AFTER_MS) refresh();
    }
  }, [openRequest, refresh]);

  // Close the desktop popover on an outside click or Escape.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent | TouchEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Nothing configured and playable — no entry point, rather than a button
  // that opens onto an apology.
  if (games.length === 0) return null;

  const previewGame = games.find((game) => game.type === previewType) ?? null;
  const playingGame = games.find((game) => game.type === playingType) ?? null;
  const selectedGame = games.find((game) => game.type === selected) ?? games[0];

  function choose(type: GameType) {
    setPreviewType(type);
    setOpen(false);
  }

  function startGame(type: GameType) {
    setPreviewType(null);
    setPlayingType(type);
  }

  function endGame() {
    setPlayingType(null);
    // Scores may have moved — pick them up before the menu is next opened.
    refresh();
  }

  return (
    <>
      <div ref={containerRef} className="relative inline-block">
        <motion.button
          ref={buttonRef}
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-haspopup="menu"
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className={cn(
            "relative inline-flex items-center gap-2 px-4 py-2 rounded-full border backdrop-blur-sm whitespace-nowrap",
            triggerClassName,
            "bg-gradient-to-br from-red-900 via-vermillion to-red-400/90",
            "font-body text-xs font-medium tracking-[0.2em] uppercase text-white transition-shadow duration-300",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-vermillion focus-visible:ring-offset-2 focus-visible:ring-offset-black",
            open
              ? "border-red-200/70 shadow-[0_2px_20px_-2px_rgba(217,79,56,0.8)]"
              : "border-red-300/50 shadow-[0_2px_16px_-2px_rgba(217,79,56,0.55)]"
          )}
        >
          {/* Clipping lives on this static inner layer, not on the button
              itself — Safari leaks a filtered child (the icon's glow) outside
              a rounded overflow-hidden ancestor while that ancestor is mid
              hover/tap transform, which read as the icon drifting loose. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-hidden rounded-full"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
          </span>

          <span className="relative inline-flex items-center gap-2">
            <motion.span
              className="flex"
              animate={open ? { rotate: [0, -10, 8, -4, 0] } : { rotate: 0 }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
            >
              <Gamepad2 size={15} strokeWidth={1.5} aria-hidden="true" />
            </motion.span>
            Mini Games
            <motion.span
              className="flex"
              animate={{ rotate: open ? 180 : 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
            >
              <ChevronDown size={13} aria-hidden="true" />
            </motion.span>
          </span>
        </motion.button>

        {/* ── Desktop: popover ── */}
        <AnimatePresence>
          {open && (
            <motion.div
              role="menu"
              aria-label="Mini games"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              className="hidden md:block absolute left-0 top-full mt-2 z-50 w-72 rounded-xl border border-white/10 bg-black/85 backdrop-blur-md shadow-2xl overflow-hidden"
            >
              <p className="px-4 pt-3 pb-2 font-body text-[10px] tracking-[0.25em] uppercase text-white/35">
                Choose a game
              </p>
              <ul className="pb-2">
                {games.map((game) => (
                  <li key={game.type}>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => choose(game.type)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white/5 focus:bg-white/5 focus:outline-none transition-colors group"
                    >
                      <span className="shrink-0 text-white/40 group-hover:text-sepia transition-colors">
                        <GameIcon icon={game.icon} size={17} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-body text-sm text-cream truncate">
                          {game.name}
                        </span>
                        <span className="block font-body text-[11px] text-white/35 truncate">
                          {DIFFICULTY_LABELS[game.difficulty]}
                          {game.bestScore !== null
                            ? ` · best ${formatScore(game.bestScore)}`
                            : ""}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Mobile: bottom sheet with a native select ──
            Nested inside containerRef (rather than a sibling) so the
            outside-click listener above recognizes taps inside the sheet as
            "inside" — as a sibling, every tap in here read as an outside
            click and closed the sheet before its own handler could run. */}
        <AnimatePresence>
          {open && (
            <motion.div
              className="md:hidden fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-end"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setOpen(false)}
              role="dialog"
              aria-modal="true"
              aria-label="Select a mini game"
            >
              <motion.div
                className="w-full rounded-t-2xl border-t border-white/10 bg-ink-900/95 backdrop-blur-md p-5 pb-8 space-y-4"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ duration: 0.24, ease: "easeOut" }}
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-center justify-between">
                  <h2 className="flex items-center gap-2 font-grotesk text-sm font-semibold tracking-widest uppercase text-cream">
                    <Gamepad2 size={16} className="text-sepia" aria-hidden="true" />
                    Select Mini Game
                  </h2>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Close"
                    className="p-1.5 -m-1 text-white/50 hover:text-cream transition-colors"
                  >
                    <X size={20} strokeWidth={1.5} />
                  </button>
                </div>

                <div>
                  <label htmlFor="mg-select" className="sr-only">
                    Mini game
                  </label>
                  {/* A real <select> so the platform's own picker does the work —
                      big touch targets, no hover, no custom scroll trap. */}
                  {/* appearance-none strips the browser's arrow, so the
                      dropdown has to draw its own or it reads as a text box. */}
                  <div className="relative">
                    <select
                      id="mg-select"
                      value={selectedGame?.type ?? ""}
                      onChange={(event) => setSelected(event.target.value as GameType)}
                      className="w-full appearance-none pl-4 pr-10 py-3 rounded-lg bg-black/50 border border-white/15 text-cream font-body text-sm focus:outline-none focus:border-sepia transition-colors"
                    >
                      {games.map((game) => (
                        <option key={game.type} value={game.type} className="bg-ink-900">
                          {game.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={16}
                      className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-cream/50"
                    />
                  </div>
                </div>

                {selectedGame && (
                  <div className="space-y-1">
                    <p className="flex items-center gap-2 font-body text-sm text-cream">
                      <span className="text-sepia">
                        <GameIcon icon={selectedGame.icon} size={15} />
                      </span>
                      {selectedGame.name}
                    </p>
                    <p className="font-body text-xs text-white/45 leading-relaxed">
                      {selectedGame.description}
                    </p>
                    <p className="font-body text-[11px] text-white/30 pt-1">
                      {DIFFICULTY_LABELS[selectedGame.difficulty]}
                      {selectedGame.bestScore !== null
                        ? ` · your best ${formatScore(selectedGame.bestScore)}`
                        : ""}
                    </p>
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => selectedGame && choose(selectedGame.type)}
                    className="flex-1 px-4 py-3 rounded-lg border border-white/20 text-white/75 font-body text-sm tracking-wide hover:text-cream transition-colors"
                  >
                    Preview
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!selectedGame) return;
                      setOpen(false);
                      startGame(selectedGame.type);
                    }}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-sepia text-ink font-body text-sm font-medium tracking-wide hover:bg-sepia-light transition-colors"
                  >
                    <Play size={15} aria-hidden="true" />
                    Play
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Preview ── */}
      <AnimatePresence>
        {previewGame && (
          <GamePreviewModal
            game={previewGame}
            howToPlay={GAME_REGISTRY[previewGame.type].howToPlay}
            onStart={() => startGame(previewGame.type)}
            onClose={() => setPreviewType(null)}
          />
        )}
      </AnimatePresence>

      {/* ── Round ── */}
      <AnimatePresence>
        {playingGame && <GameSession game={playingGame} onClose={endGame} />}
      </AnimatePresence>
    </>
  );
}
