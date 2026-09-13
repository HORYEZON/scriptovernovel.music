"use client";

import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDuration, formatScore } from "@/lib/minigames/scoring";
import type { PublicLeaderboardRow } from "@/lib/minigames/types";

interface LeaderboardProps {
  entries: PublicLeaderboardRow[];
  /**
   * The run that just finished, so it can be pinned below the board when it
   * didn't place high enough to appear in it.
   */
  you?: { rank: number; displayName: string; score: number } | null;
  title?: string;
  emptyMessage?: string;
  className?: string;
}

export function Leaderboard({
  entries,
  you = null,
  title = "Leaderboard",
  emptyMessage = "No scores yet — be the first.",
  className,
}: LeaderboardProps) {
  const alreadyListed =
    you !== null && entries.some((entry) => entry.isYou && entry.rank === you.rank);

  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center gap-2 mb-3">
        <Trophy size={14} className="text-sepia" strokeWidth={1.5} aria-hidden="true" />
        <h3 className="font-body text-[11px] tracking-[0.25em] uppercase text-white/50">
          {title}
        </h3>
      </div>

      {entries.length === 0 ? (
        <p className="font-body text-xs text-white/35 py-3">{emptyMessage}</p>
      ) : (
        <ol className="space-y-0.5">
          {entries.map((entry) => (
            <LeaderboardLine key={entry.id} row={entry} />
          ))}

          {/* Outside the visible board — shown after a rule so the gap is
              explicit rather than implied by a jump in rank numbers. */}
          {you && !alreadyListed && (
            <>
              <li aria-hidden="true" className="py-1.5">
                <span className="block border-t border-dashed border-white/15" />
              </li>
              <LeaderboardLine
                row={{
                  id: "you",
                  rank: you.rank,
                  displayName: you.displayName,
                  score: you.score,
                  completionTime: 0,
                  createdAt: "",
                  isYou: true,
                }}
                hideTime
              />
            </>
          )}
        </ol>
      )}
    </div>
  );
}

function LeaderboardLine({
  row,
  hideTime = false,
}: {
  row: PublicLeaderboardRow;
  hideTime?: boolean;
}) {
  return (
    <li
      className={cn(
        "flex items-center gap-3 px-2.5 py-1.5 rounded-lg",
        // The current player's row is marked three ways — tint, left rule and
        // a "you" tag — so it never depends on colour alone.
        row.isYou
          ? "bg-sepia/10 border-l-2 border-sepia"
          : "border-l-2 border-transparent"
      )}
    >
      <span className="font-mono text-xs text-white/40 w-6 tabular-nums shrink-0">
        {row.rank}
      </span>
      <span className="font-body text-sm text-cream truncate flex-1 min-w-0">
        {row.displayName}
        {row.isYou && (
          <span className="ml-2 font-body text-[10px] tracking-widest uppercase text-sepia">
            You
          </span>
        )}
      </span>
      {!hideTime && row.completionTime > 0 && (
        <span className="font-mono text-[11px] text-white/30 tabular-nums hidden sm:inline shrink-0">
          {formatDuration(row.completionTime)}
        </span>
      )}
      <span className="font-mono text-sm text-sepia tabular-nums shrink-0">
        {formatScore(row.score)}
      </span>
    </li>
  );
}
