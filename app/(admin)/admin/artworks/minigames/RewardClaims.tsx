"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  Mail,
  MailWarning,
  RefreshCw,
} from "lucide-react";
import toast from "@/lib/toast";
import { cn, formatDate } from "@/lib/utils";
import { formatScore } from "@/lib/minigames/scoring";
import type { AdminGameConfig, AdminRewardClaim } from "@/lib/minigames/types";

interface RewardClaimsProps {
  games: AdminGameConfig[];
}

type ClaimStatus = AdminRewardClaim["status"];

const STATUS_STYLES: Record<ClaimStatus, string> = {
  PENDING:
    "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  FULFILLED:
    "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  REJECTED:
    "bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 border-black/10 dark:border-white/10",
};

/**
 * Reward claims — the only screen in the mini-game system that shows a
 * visitor's email address. Nothing here is reachable from the public site, and
 * the leaderboard payload never carries these fields.
 */
export function RewardClaims({ games }: RewardClaimsProps) {
  const [claims, setClaims] = useState<AdminRewardClaim[]>([]);
  const [status, setStatus] = useState<ClaimStatus | "">("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      const response = await fetch(
        `/api/minigames/claims?${params.toString()}`
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data?.error ?? "Could not load reward claims.");
        return;
      }
      setClaims(data.claims ?? []);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  async function setClaimStatus(claim: AdminRewardClaim, next: ClaimStatus) {
    try {
      const response = await fetch(`/api/minigames/claims/${claim.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!response.ok) {
        toast.error("Could not update that claim");
        return;
      }
      setClaims((current) =>
        current.map((row) =>
          row.id === claim.id ? { ...row, status: next } : row
        )
      );
      toast.success(
        next === "FULFILLED" ? "Marked as fulfilled" : "Claim updated"
      );
    } catch {
      toast.error("Could not reach the server");
    }
  }

  const rewardGames = games.filter((game) => game.rewardEnabled);

  return (
    <div className="space-y-4">
      {rewardGames.length === 0 && (
        <p className="rounded-2xl border border-dashed border-black/15 dark:border-white/15 px-4 py-4 font-body text-sm text-ink-400 dark:text-ink-300">
          No game currently offers a reward. Turn one on in the Games tab to
          start collecting claims.
        </p>
      )}

      <div className="admin-card border rounded-2xl backdrop-blur-md shadow-sm overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-black/10 dark:border-white/10">
          <div className="flex items-center gap-2">
            <label htmlFor="mg-claim-status" className="sr-only">
              Filter by status
            </label>
            <div className="relative">
              <select
                id="mg-claim-status"
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as ClaimStatus | "")
                }
                className="pl-3 pr-9 py-1.5 rounded-lg admin-input border text-ink dark:text-cream focus:outline-none focus:border-sepia transition-colors text-xs cursor-pointer appearance-none"
              >
                <option value="">All claims</option>
                <option value="PENDING">Pending</option>
                <option value="FULFILLED">Fulfilled</option>
                <option value="REJECTED">Rejected</option>
              </select>
              <ChevronDown
                size={12}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-400"
              />
            </div>
            <p className="font-body text-xs text-ink-400 dark:text-ink-300">
              {claims.length} claim{claims.length !== 1 ? "s" : ""}
            </p>
          </div>
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
        ) : loading && claims.length === 0 ? (
          <p className="px-4 py-10 text-center font-body text-sm text-ink-400 dark:text-ink-300">
            Loading claims…
          </p>
        ) : claims.length === 0 ? (
          <p className="px-4 py-10 text-center font-body text-sm text-ink-400 dark:text-ink-300">
            No reward claims yet.
          </p>
        ) : (
          <ul className="divide-y divide-black/5 dark:divide-white/5">
            {claims.map((claim) => (
              <li key={claim.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="font-jakarta text-sm font-medium text-ink dark:text-cream">
                      {claim.displayName}
                      <span className="ml-2 font-mono text-xs text-sepia tabular-nums">
                        {formatScore(claim.score)}
                      </span>
                      <span className="ml-1 font-body text-[11px] text-ink-400 dark:text-ink-300">
                        / target {formatScore(claim.threshold)}
                      </span>
                    </p>
                    <p className="font-body text-xs text-ink-400 dark:text-ink-300 mt-0.5">
                      {claim.gameName}
                      {claim.artworkTitle
                        ? ` · ${claim.artworkTitle}`
                        : ""} · {formatDate(claim.createdAt)}
                    </p>
                  </div>

                  <span
                    className={cn(
                      "px-2 py-0.5 rounded-md text-[10px] font-medium uppercase tracking-wider border shrink-0",
                      STATUS_STYLES[claim.status]
                    )}
                  >
                    {claim.status.toLowerCase()}
                  </span>
                </div>

                <p className="font-body text-sm text-ink dark:text-cream">
                  Reward: <strong>{claim.reward}</strong>
                </p>

                <div className="flex items-center gap-2 flex-wrap">
                  <a
                    href={`mailto:${claim.email}`}
                    className="inline-flex items-center gap-1.5 font-mono text-xs text-sepia hover:underline break-all"
                  >
                    <Mail size={13} className="shrink-0" />
                    {claim.email}
                  </a>
                  {/* Surfaces a silent mail failure — the claim is safe either
                      way, but the admin should know they weren't told. */}
                  {!claim.notifiedAt && (
                    <span
                      className="inline-flex items-center gap-1 font-body text-[11px] text-amber-600 dark:text-amber-400"
                      title="No notification email was sent for this claim"
                    >
                      <MailWarning size={12} />
                      not emailed
                    </span>
                  )}
                </div>

                {claim.status !== "FULFILLED" && (
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setClaimStatus(claim, "FULFILLED")}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-body text-xs hover:bg-emerald-500/20 transition-colors"
                    >
                      Mark fulfilled
                    </button>
                    {claim.status !== "REJECTED" && (
                      <button
                        type="button"
                        onClick={() => setClaimStatus(claim, "REJECTED")}
                        className="px-3 py-1.5 rounded-lg border border-black/10 dark:border-white/10 text-ink-400 dark:text-ink-300 font-body text-xs hover:text-ink dark:hover:text-cream transition-colors"
                      >
                        Reject
                      </button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
