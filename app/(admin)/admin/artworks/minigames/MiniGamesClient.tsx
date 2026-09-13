"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Gamepad2, Trophy, Gift, Volume2 } from "lucide-react";
import toast from "@/lib/toast";
import { cn } from "@/lib/utils";
import { formatScore } from "@/lib/minigames/scoring";
import type { AdminGameConfig, GameType } from "@/lib/minigames/types";
import { GameIcon } from "@/components/public/minigames/GameIcon";
import { GameConfigPanel } from "./GameConfigPanel";
import { LeaderboardManager } from "./LeaderboardManager";
import { RewardClaims } from "./RewardClaims";

export interface ArtworkOption {
  id: string;
  title: string;
  imageUrl: string;
  published: boolean;
}

interface MiniGamesClientProps {
  initialGames: AdminGameConfig[];
  artworks: ArtworkOption[];
}

type Tab = "games" | "leaderboard" | "rewards";

const TABS: { id: Tab; label: string; icon: typeof Gamepad2 }[] = [
  { id: "games", label: "Games", icon: Gamepad2 },
  { id: "leaderboard", label: "Leaderboard", icon: Trophy },
  { id: "rewards", label: "Rewards", icon: Gift },
];

/**
 * The Mini Games admin module.
 *
 * Follows the same shape as the Announcements page: one tabbed client
 * component over server-rendered initial data, re-reading from the API after
 * each mutation rather than doing a full navigation, so a save doesn't lose
 * the admin's place in a long list.
 */
export function MiniGamesClient({
  initialGames,
  artworks,
}: MiniGamesClientProps) {
  const [games, setGames] = useState<AdminGameConfig[]>(initialGames);
  const [tab, setTab] = useState<Tab>("games");
  const [selected, setSelected] = useState<GameType | null>(
    initialGames[0]?.type ?? null
  );

  const reload = useCallback(async () => {
    try {
      const response = await fetch("/api/minigames/config");
      if (!response.ok) return;
      const data = await response.json();
      if (Array.isArray(data?.games)) setGames(data.games);
    } catch {
      toast.error("Could not refresh mini game settings");
    }
  }, []);

  const selectedGame = games.find((game) => game.type === selected) ?? null;
  const enabledCount = games.filter((game) => game.enabled).length;
  const brokenCount = games.filter((game) => game.unavailableReason).length;

  return (
    <div className="space-y-5">
      {/* Warnings first — an enabled game that can't run is invisible to
          visitors, which is exactly the failure an admin won't notice. */}
      {brokenCount > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30">
          <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
          <p className="font-body text-sm text-amber-700 dark:text-amber-300">
            <strong>
              {brokenCount} enabled game{brokenCount !== 1 ? "s are" : " is"}{" "}
              not playable.
            </strong>{" "}
            Visitors won&apos;t see {brokenCount !== 1 ? "them" : "it"} until
            the missing artwork or configuration is filled in below.
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-black/10 dark:border-white/10">
        {TABS.map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-2 px-4 py-2.5 font-jakarta text-sm font-medium transition-colors border-b-2 -mb-px",
                active
                  ? "border-sepia text-ink dark:text-cream"
                  : "border-transparent text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream"
              )}
            >
              <Icon size={15} />
              {item.label}
            </button>
          );
        })}
      </div>

      {tab === "games" && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] items-start">
          {/* ── Game list ── */}
          <div className="admin-card border rounded-2xl backdrop-blur-md shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-black/10 dark:border-white/10">
              <p className="font-body text-xs tracking-widest uppercase text-ink-400 dark:text-ink-300">
                Games
              </p>
              <p className="font-body text-xs text-ink-400 dark:text-ink-300">
                {enabledCount} of {games.length} on
              </p>
            </div>
            <ul>
              {games.map((game) => {
                const active = game.type === selected;
                return (
                  <li key={game.type}>
                    <button
                      type="button"
                      onClick={() => setSelected(game.type)}
                      aria-current={active ? "true" : undefined}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-l-2",
                        active
                          ? "bg-sepia/10 border-sepia"
                          : "border-transparent hover:bg-black/5 dark:hover:bg-white/5"
                      )}
                    >
                      <span
                        className={cn(
                          "shrink-0 w-9 h-9 rounded-lg flex items-center justify-center",
                          game.enabled
                            ? "bg-sepia/15 text-sepia"
                            : "bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300"
                        )}
                      >
                        <GameIcon icon={game.icon} size={17} />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block font-jakarta text-sm font-medium text-ink dark:text-cream truncate">
                          {game.name}
                        </span>
                        <span className="block font-body text-xs text-ink-400 dark:text-ink-300 truncate">
                          {game.artwork?.title ?? "No artwork chosen"}
                        </span>
                      </span>

                      <span className="shrink-0 flex items-center gap-1.5">
                        {game.unavailableReason && (
                          <AlertTriangle
                            size={14}
                            className="text-amber-500"
                            aria-label="Not playable"
                          />
                        )}
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-md text-[10px] font-medium uppercase tracking-wider border",
                            game.enabled
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                              : "bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 border-black/10 dark:border-white/10"
                          )}
                        >
                          {game.enabled ? "On" : "Off"}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {/* Roll-up of the numbers the stats API already returns. */}
            <dl className="grid grid-cols-3 gap-px bg-black/10 dark:bg-white/10 border-t border-black/10 dark:border-white/10">
              <Summary
                label="Rounds"
                value={games.reduce((sum, game) => sum + game.stats.plays, 0)}
              />
              <Summary
                label="Scores"
                value={games.reduce((sum, game) => sum + game.stats.entries, 0)}
              />
              <Summary
                label="Claims"
                value={games.reduce((sum, game) => sum + game.stats.claims, 0)}
              />
            </dl>
          </div>

          {/* ── Configuration ── */}
          {selectedGame ? (
            <GameConfigPanel
              key={selectedGame.type}
              game={selectedGame}
              artworks={artworks}
              onSaved={reload}
            />
          ) : (
            <p className="font-body text-sm text-ink-400 dark:text-ink-300">
              Select a game to configure it.
            </p>
          )}
        </div>
      )}

      {tab === "leaderboard" && (
        <LeaderboardManager games={games} onChanged={reload} />
      )}
      {tab === "rewards" && <RewardClaims games={games} />}

      {/* Sound settings live in their own module — see Preferences > Sound. */}
      <Link
        href="/admin/settings/Preferences?tab=sound"
        className="inline-flex items-center gap-2 font-body text-xs text-ink-400 dark:text-ink-300 hover:text-sepia transition-colors"
      >
        <Volume2 size={13} />
        Move &amp; exit sounds are configured under Settings &rsaquo; Preferences &rsaquo; Sound &rsaquo; Minigame Sound
      </Link>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white dark:bg-black/40 px-3 py-3 text-center">
      <dt className="font-body text-[10px] tracking-widest uppercase text-ink-400 dark:text-ink-300">
        {label}
      </dt>
      <dd className="font-mono text-sm text-ink dark:text-cream tabular-nums mt-0.5">
        {formatScore(value)}
      </dd>
    </div>
  );
}
