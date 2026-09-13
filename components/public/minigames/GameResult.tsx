"use client";

import { useEffect, useState } from "react";
import { Gift, RotateCcw, Send, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { playSoundEffect } from "@/lib/sound/engine";
import { formatDuration, formatScore } from "@/lib/minigames/scoring";
import {
  MAX_DISPLAY_NAME_LENGTH,
  MIN_DISPLAY_NAME_LENGTH,
} from "@/lib/minigames/config";
import type { PublicLeaderboardRow, SubmitResultResponse } from "@/lib/minigames/types";
import { Leaderboard } from "./Leaderboard";

interface GameResultProps {
  sessionId: string;
  gameName: string;
  result: SubmitResultResponse;
  onPlayAgain: () => void;
  onClose: () => void;
}

/**
 * The end-of-round screen: what the server scored, then the two optional
 * follow-ups — putting the run on the board, and claiming a reward it
 * qualified for.
 *
 * Both follow-ups are separate requests from the one that scored the round.
 * The score already exists on the server by the time this renders; naming it
 * and claiming against it never re-submit a result.
 */
export function GameResult({
  sessionId,
  gameName,
  result,
  onPlayAgain,
  onClose,
}: GameResultProps) {
  const [displayName, setDisplayName] = useState("");
  const [entries, setEntries] = useState<PublicLeaderboardRow[]>(result.leaderboard);
  const [rank, setRank] = useState<number | null>(result.rank);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);

  const rewardEligible = result.reward.eligible;

  // Rank #1 straight from the round's own score, before any leaderboard
  // name has even been submitted — same "rank 1 = new all-time highscore"
  // threshold as lib/notifications/highscore.ts's admin alert. Fires once
  // on mount, not on every `rank` state change (submitting a name doesn't
  // itself earn a fresh fanfare).
  useEffect(() => {
    if (result.rank === 1) playSoundEffect("minigame.highscore");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submitScore() {
    const trimmed = displayName.trim();
    if (trimmed.length < MIN_DISPLAY_NAME_LENGTH) {
      setNameError(`Please use at least ${MIN_DISPLAY_NAME_LENGTH} characters.`);
      return;
    }

    setSubmitting(true);
    setNameError(null);
    try {
      const response = await fetch("/api/minigames/leaderboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, displayName: trimmed }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setNameError(data?.error ?? "Could not save your score.");
        return;
      }

      setEntries(data.entries ?? []);
      setRank(data.rank ?? rank);
      setSubmitted(true);
    } catch {
      setNameError("Network error — please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function claimReward() {
    setClaiming(true);
    setClaimError(null);
    try {
      const response = await fetch("/api/minigames/reward", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          email: email.trim(),
          displayName: displayName.trim() || undefined,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setClaimError(data?.error ?? "Could not record your claim.");
        return;
      }
      setClaimed(true);
    } catch {
      setClaimError("Network error — please check your connection and try again.");
    } finally {
      setClaiming(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Score summary ── */}
      <div className="text-center">
        <p className="font-body text-[11px] tracking-[0.3em] uppercase text-sepia mb-2">
          Round complete
        </p>
        <p className="font-mono text-5xl sm:text-6xl text-cream tabular-nums leading-none">
          {formatScore(result.score)}
        </p>
        <p className="font-body text-xs text-white/40 mt-2">
          out of a possible {formatScore(result.maxScore)}
        </p>
      </div>

      <dl className="grid grid-cols-3 gap-2 text-center">
        <Stat label="Time" value={formatDuration(result.durationMs)} />
        <Stat label="Moves" value={String(result.moves)} />
        <Stat label="Rank" value={rank ? `#${rank}` : "—"} />
      </dl>

      {/* ── Reward ── */}
      {rewardEligible && (
        <div className="rounded-xl border border-sepia/40 bg-sepia/5 p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={16} className="text-sepia" aria-hidden="true" />
            <h3 className="font-grotesk text-sm font-semibold tracking-widest uppercase text-sepia">
              Reward unlocked
            </h3>
          </div>

          {claimed ? (
            <p className="font-body text-sm text-cream/80 flex items-start gap-2">
              <Gift size={16} className="text-sepia shrink-0 mt-0.5" aria-hidden="true" />
              <span>
                Your claim is in. The artist has been notified and will be in touch
                about your{" "}
                <strong className="text-cream">{result.reward.description}</strong>.
              </span>
            </p>
          ) : (
            <>
              <p className="font-body text-sm text-cream/80">
                You reached {formatScore(result.reward.threshold)} points and unlocked{" "}
                <strong className="text-cream">
                  {result.reward.description ?? "a reward"}
                </strong>
                .
              </p>
              <p className="font-body text-xs text-white/40 mt-1.5">
                Your email is used only to send the reward — it is never shown on the
                leaderboard.
              </p>

              <div className="mt-3 flex flex-col sm:flex-row gap-2">
                <label className="sr-only" htmlFor="mg-reward-email">
                  Email address
                </label>
                <input
                  id="mg-reward-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className="flex-1 min-w-0 px-3 py-2.5 rounded-lg bg-black/40 border border-white/15 text-cream placeholder-white/25 font-body text-sm focus:outline-none focus:border-sepia transition-colors"
                  aria-invalid={claimError ? true : undefined}
                  aria-describedby={claimError ? "mg-reward-error" : undefined}
                />
                <button
                  type="button"
                  onClick={claimReward}
                  disabled={claiming || email.trim().length === 0}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-sepia text-ink font-body text-sm font-medium hover:bg-sepia-light disabled:opacity-50 transition-colors shrink-0"
                >
                  {claiming ? "Sending…" : "Claim reward"}
                </button>
              </div>

              {claimError && (
                <p id="mg-reward-error" role="alert" className="font-body text-xs text-vermillion mt-2">
                  {claimError}
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Leaderboard entry ── */}
      {result.leaderboardEnabled && (
        <div className="rounded-xl border border-white/10 bg-black/30 p-4 sm:p-5">
          {submitted ? (
            <Leaderboard
              entries={entries}
              you={
                rank !== null
                  ? { rank, displayName: displayName.trim(), score: result.score }
                  : null
              }
              title={`${gameName} leaderboard`}
            />
          ) : (
            <>
              <label
                htmlFor="mg-display-name"
                className="block font-body text-[11px] tracking-[0.25em] uppercase text-white/50 mb-2"
              >
                Add your score to the board
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  id="mg-display-name"
                  type="text"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") submitScore();
                  }}
                  maxLength={MAX_DISPLAY_NAME_LENGTH}
                  placeholder="Your name"
                  autoComplete="nickname"
                  className="flex-1 min-w-0 px-3 py-2.5 rounded-lg bg-black/40 border border-white/15 text-cream placeholder-white/25 font-body text-sm focus:outline-none focus:border-sepia transition-colors"
                  aria-invalid={nameError ? true : undefined}
                  aria-describedby={nameError ? "mg-name-error" : "mg-name-hint"}
                />
                <button
                  type="button"
                  onClick={submitScore}
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-cream text-ink font-body text-sm font-medium hover:bg-white disabled:opacity-50 transition-colors shrink-0"
                >
                  <Send size={14} aria-hidden="true" />
                  {submitting ? "Saving…" : "Submit score"}
                </button>
              </div>
              <p id="mg-name-hint" className="font-body text-xs text-white/30 mt-2">
                {MIN_DISPLAY_NAME_LENGTH}–{MAX_DISPLAY_NAME_LENGTH} characters. Only your
                name and score are shown publicly.
              </p>
              {nameError && (
                <p id="mg-name-error" role="alert" className="font-body text-xs text-vermillion mt-1.5">
                  {nameError}
                </p>
              )}

              {entries.length > 0 && (
                <div className="mt-4 pt-4 border-t border-white/10">
                  <Leaderboard entries={entries} title="Current top scores" />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Actions ── */}
      <div className="flex flex-col sm:flex-row gap-2">
        <button
          type="button"
          onClick={onPlayAgain}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-sepia/50 text-sepia font-body text-sm tracking-wide hover:bg-sepia/10 transition-colors"
        >
          <RotateCcw size={15} aria-hidden="true" />
          Play again
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex-1 inline-flex items-center justify-center px-4 py-3 rounded-lg border border-white/15 text-white/70 font-body text-sm tracking-wide hover:text-cream hover:border-white/30 transition-colors"
        >
          Back to gallery
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/5 py-3">
      <dt className="font-body text-[10px] tracking-[0.2em] uppercase text-white/35">
        {label}
      </dt>
      <dd className={cn("font-mono text-lg text-cream tabular-nums mt-0.5")}>{value}</dd>
    </div>
  );
}
