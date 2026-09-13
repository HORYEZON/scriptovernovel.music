"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  Gift,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import toast from "@/lib/toast";
import { cn, formatDate } from "@/lib/utils";
import { AdminConfirmModal } from "@/components/admin/AdminConfirmModal";
import { formatDuration, formatScore } from "@/lib/minigames/scoring";
import {
  DIFFICULTY_LABELS,
  type AdminGameConfig,
  type AdminLeaderboardRow,
  type GameType,
} from "@/lib/minigames/types";

interface LeaderboardManagerProps {
  games: AdminGameConfig[];
  onChanged: () => void;
}

/**
 * Moderation for recorded scores: filter, inspect, remove a bad row, or reset
 * a whole board.
 *
 * There is no "edit score" here by design — a score is what the server
 * computed from a verified round, so the only honest corrections are to
 * delete a row or clear the board.
 */
export function LeaderboardManager({
  games,
  onChanged,
}: LeaderboardManagerProps) {
  const [type, setType] = useState<GameType | "">("");
  const [artworkId, setArtworkId] = useState("");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<AdminLeaderboardRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resetting, setResetting] = useState<GameType | null>(null);
  // What's awaiting confirmation — one row to remove, or one whole board to
  // reset. Same in-app dialog every other admin module uses (with its
  // sound), replacing the browser's own confirm() these two had.
  const [pendingRemove, setPendingRemove] = useState<AdminLeaderboardRow | null>(null);
  const [pendingReset, setPendingReset] = useState<AdminGameConfig | null>(null);
  const [removing, setRemoving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (type) params.set("type", type);
      if (artworkId) params.set("artworkId", artworkId);
      if (search.trim()) params.set("q", search.trim());

      const response = await fetch(
        `/api/minigames/entries?${params.toString()}`
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data?.error ?? "Could not load leaderboard entries.");
        return;
      }
      setRows(data.entries ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }, [artworkId, search, type]);

  // Debounced so typing in the search box doesn't fire a request per keypress.
  useEffect(() => {
    const timer = window.setTimeout(load, 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function removeEntry(row: AdminLeaderboardRow) {
    setRemoving(true);
    try {
      const response = await fetch(`/api/minigames/leaderboard/${row.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        toast.error("Could not remove that entry");
        return;
      }
      setRows((current) => current.filter((entry) => entry.id !== row.id));
      setTotal((current) => Math.max(0, current - 1));
      toast.success("Entry removed");
      onChanged();
    } catch {
      toast.error("Could not reach the server");
    } finally {
      setRemoving(false);
      setPendingRemove(null);
    }
  }

  async function resetBoard(game: AdminGameConfig) {
    setPendingReset(null);
    setResetting(game.type);
    try {
      const response = await fetch(
        `/api/minigames/leaderboard?type=${game.type}`,
        {
          method: "DELETE",
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(data?.error ?? "Could not reset that leaderboard");
        return;
      }
      toast.success(
        `Cleared ${data.deleted ?? 0} score${data.deleted === 1 ? "" : "s"}`
      );
      await load();
      onChanged();
    } catch {
      toast.error("Could not reach the server");
    } finally {
      setResetting(null);
    }
  }

  const artworkOptions = Array.from(
    new Map(
      games
        .filter((game) => game.artwork)
        .map((game) => [game.artwork!.id, game.artwork!])
    ).values()
  );

  return (
    <div className="space-y-4">
      {/* ── Filters ── */}
      <div className="admin-card border rounded-2xl backdrop-blur-md shadow-sm p-4 grid gap-3 sm:grid-cols-3">
        <div>
          <label
            htmlFor="mg-filter-game"
            className="block font-body text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-1.5"
          >
            Game
          </label>
          <div className="relative">
            <select
              id="mg-filter-game"
              value={type}
              onChange={(event) =>
                setType(event.target.value as GameType | "")
              }
              className="w-full px-3 py-2 pr-9 rounded-xl admin-input border text-ink dark:text-cream focus:outline-none focus:border-sepia transition-colors text-sm cursor-pointer appearance-none"
            >
              <option value="">All games</option>
              {games.map((game) => (
                <option key={game.type} value={game.type}>
                  {game.name}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-400"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="mg-filter-artwork"
            className="block font-body text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-1.5"
          >
            Artwork
          </label>
          <div className="relative">
            <select
              id="mg-filter-artwork"
              value={artworkId}
              onChange={(event) => setArtworkId(event.target.value)}
              className="w-full px-3 py-2 pr-9 rounded-xl admin-input border text-ink dark:text-cream focus:outline-none focus:border-sepia transition-colors text-sm cursor-pointer appearance-none"
            >
              <option value="">All artworks</option>
              {artworkOptions.map((artwork) => (
                <option key={artwork.id} value={artwork.id}>
                  {artwork.title}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-400"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="mg-filter-search"
            className="block font-body text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-1.5"
          >
            Player
          </label>
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none"
            />
            <input
              id="mg-filter-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search names…"
              className="w-full pl-8 pr-3 py-2 rounded-xl admin-input border text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors text-sm"
            />
          </div>
        </div>
      </div>

      {/* ── Entries ── */}
      <div className="admin-card border rounded-2xl backdrop-blur-md shadow-sm overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-black/10 dark:border-white/10">
          <p className="font-body text-xs tracking-widest uppercase text-ink-400 dark:text-ink-300">
            {total} score{total !== 1 ? "s" : ""}
            {rows.length < total ? ` — showing ${rows.length}` : ""}
          </p>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1.5 font-body text-xs text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={cn(loading && "animate-spin")} />
            Refresh
          </button>
        </div>

        {error ? (
          <p className="flex items-center gap-2 px-4 py-8 justify-center font-body text-sm text-vermillion">
            <AlertTriangle size={15} />
            {error}
          </p>
        ) : loading && rows.length === 0 ? (
          <p className="px-4 py-10 text-center font-body text-sm text-ink-400 dark:text-ink-300">
            Loading scores…
          </p>
        ) : rows.length === 0 ? (
          <p className="px-4 py-10 text-center font-body text-sm text-ink-400 dark:text-ink-300">
            No scores recorded yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-black/10 dark:border-white/10">
                  <Th>Player</Th>
                  <Th>Game</Th>
                  <Th className="text-right">Score</Th>
                  <Th className="text-right hidden sm:table-cell">Time</Th>
                  <Th className="text-right hidden md:table-cell">Moves</Th>
                  <Th className="hidden lg:table-cell">Artwork</Th>
                  <Th className="hidden md:table-cell">Date</Th>
                  <Th>Reward</Th>
                  <Th className="w-10 sr-only">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-black/5 dark:border-white/5 last:border-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                  >
                    <Td>
                      <span className="font-jakarta text-sm text-ink dark:text-cream">
                        {row.displayName}
                      </span>
                    </Td>
                    <Td>
                      <span className="font-body text-xs text-ink-400 dark:text-ink-300">
                        {row.gameName}
                        <span className="block text-[11px] opacity-70">
                          {DIFFICULTY_LABELS[row.difficulty]}
                        </span>
                      </span>
                    </Td>
                    <Td className="text-right">
                      <span className="font-mono text-sm text-ink dark:text-cream tabular-nums">
                        {formatScore(row.score)}
                      </span>
                    </Td>
                    <Td className="text-right hidden sm:table-cell">
                      <span className="font-mono text-xs text-ink-400 dark:text-ink-300 tabular-nums">
                        {formatDuration(row.completionTime)}
                      </span>
                    </Td>
                    <Td className="text-right hidden md:table-cell">
                      <span className="font-mono text-xs text-ink-400 dark:text-ink-300 tabular-nums">
                        {row.moves}
                      </span>
                    </Td>
                    <Td className="hidden lg:table-cell">
                      <span className="font-body text-xs text-ink-400 dark:text-ink-300">
                        {row.artwork?.title ?? "—"}
                      </span>
                    </Td>
                    <Td className="hidden md:table-cell">
                      <span className="font-body text-xs text-ink-400 dark:text-ink-300 whitespace-nowrap">
                        {formatDate(row.createdAt)}
                      </span>
                    </Td>
                    <Td>
                      {row.claim ? (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium uppercase tracking-wider bg-sepia/10 text-sepia border border-sepia/20"
                          title={`${row.claim.reward} — ${row.claim.status.toLowerCase()}`}
                        >
                          <Gift size={10} />
                          {row.claim.status.toLowerCase()}
                        </span>
                      ) : (
                        <span className="font-body text-xs text-ink-400/60">
                          —
                        </span>
                      )}
                    </Td>
                    <Td className="text-right">
                      <button
                        type="button"
                        onClick={() => setPendingRemove(row)}
                        aria-label={`Remove ${row.displayName}'s score`}
                        className="p-1.5 rounded-lg text-ink-400 hover:text-vermillion hover:bg-vermillion/10 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Reset ── */}
      <div className="bg-white dark:bg-black/40 border border-vermillion/20 rounded-2xl backdrop-blur-md shadow-sm p-4 sm:p-5">
        <p className="font-body text-xs tracking-widest uppercase text-ink-400 dark:text-ink-300 mb-1">
          Reset a leaderboard
        </p>
        <p className="font-body text-xs text-ink-400 dark:text-ink-300 mb-4">
          Permanently deletes every recorded score for one game. Reward claims
          are kept.
        </p>
        <div className="flex flex-wrap gap-2">
          {games.map((game) => (
            <button
              key={game.type}
              type="button"
              onClick={() => setPendingReset(game)}
              disabled={resetting !== null || game.stats.entries === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-vermillion/30 text-vermillion font-body text-xs hover:bg-vermillion/10 transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <Trash2 size={13} />
              {game.name}
              <span className="opacity-60">({game.stats.entries})</span>
            </button>
          ))}
        </div>
      </div>

      <AdminConfirmModal
        open={pendingRemove !== null}
        title={pendingRemove ? `Remove ${pendingRemove.displayName}'s score?` : ""}
        description={
          pendingRemove
            ? `${formatScore(pendingRemove.score)} on ${pendingRemove.gameName}. This cannot be undone.`
            : undefined
        }
        confirmLabel="Remove"
        loading={removing}
        onConfirm={() => pendingRemove && removeEntry(pendingRemove)}
        onCancel={() => setPendingRemove(null)}
      />

      {/* The count makes the scale of the action concrete before it happens. */}
      <AdminConfirmModal
        open={pendingReset !== null}
        title={pendingReset ? `Reset the ${pendingReset.name} leaderboard?` : ""}
        description="This permanently deletes every recorded score for this game. It cannot be undone."
        detail={
          pendingReset ? (
            <>
              <strong>{pendingReset.stats.entries}</strong> recorded score
              {pendingReset.stats.entries !== 1 ? "s" : ""} will be deleted. Reward
              claims are kept.
            </>
          ) : undefined
        }
        confirmLabel="Reset leaderboard"
        onConfirm={() => pendingReset && resetBoard(pendingReset)}
        onCancel={() => setPendingReset(null)}
      />
    </div>
  );
}

function Th({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={cn(
        "px-4 py-2.5 font-body text-[10px] font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300",
        className
      )}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={cn("px-4 py-2.5 align-middle", className)}>{children}</td>
  );
}
