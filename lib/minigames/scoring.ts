// lib/minigames/scoring.ts
//
// The score is computed here, on the server, from facts the server owns:
// the elapsed time between the session row's startedAt and the moment the
// submission arrived, and the move count returned by verify.ts's replay.
//
// Nothing in the request body feeds this function. A client that posts
// { score: 999999 } is posting a field nobody reads.

import { getPreset } from "./registry";
import type { Difficulty, GameType } from "./types";

/**
 * How much slack over the theoretical minimum counts as "par". Below par
 * costs nothing; above it, each extra move shaves the score.
 */
const PAR_MOVE_FACTOR: Record<GameType, number> = {
  ART_PUZZLE: 1.5,
  ROTATE_SOLVE: 1.4,
  SLIDING_PUZZLE: 2.2,
  MEMORY_CARDS: 1.8,
  FIND_DIFFERENCE: 1.5,
  // Quiz games: par is exactly the right answer; every extra pick is a
  // wrong one and is charged through wrongPicks instead.
  GUESS_THE_COVER: 1,
  NAME_THAT_TRACK: 1,
  LYRIC_FILL: 1,
  TRACKLIST_ORDER: 1.5,
  RELEASE_TIMELINE: 1.5,
};

/**
 * The fastest a human could plausibly make one move, in milliseconds. A
 * submission that beats `minMoves × this` is not a fast player, it is a
 * script — the one thing move-replay verification on its own cannot catch,
 * since a script can submit a genuinely valid solution.
 */
const MIN_MS_PER_MOVE: Record<GameType, number> = {
  ART_PUZZLE: 120,
  ROTATE_SOLVE: 120,
  SLIDING_PUZZLE: 100,
  MEMORY_CARDS: 350,
  FIND_DIFFERENCE: 400,
  GUESS_THE_COVER: 800,
  NAME_THAT_TRACK: 800,
  LYRIC_FILL: 600,
  TRACKLIST_ORDER: 200,
  RELEASE_TIMELINE: 200,
};

/** No round, however small, may be completed faster than this. */
const ABSOLUTE_MIN_MS = 1500;

/** Wrong clicks in Find the Difference cost this many points each. */
const WRONG_CLICK_PENALTY = 40;

export interface ScoreInput {
  type: GameType;
  difficulty: Difficulty;
  scoreMultiplier: number;
  /** Server-measured, from MiniGameSession.startedAt to submission. */
  elapsedMs: number;
  /** Authoritative count from the replay, not from the request. */
  moves: number;
  /** Extra facts verify.ts derived, e.g. minMoves and wrongClicks. */
  stats: Record<string, number>;
}

export interface ScoreResult {
  score: number;
  /** Ceiling for this configuration; the score is clamped to it. */
  maxScore: number;
  parMoves: number;
  parSeconds: number;
  /** Below this the run is rejected as impossible. */
  minPlausibleMs: number;
}

export function computeScore(input: ScoreInput): ScoreResult {
  const preset = getPreset(input.type, input.difficulty);
  const minMoves = Math.max(0, input.stats.minMoves ?? 0);
  const parMoves = Math.ceil(minMoves * PAR_MOVE_FACTOR[input.type]);
  const elapsedSec = input.elapsedMs / 1000;

  const timeBonus = Math.round(
    Math.max(0, preset.parSeconds - elapsedSec) * preset.timeWeight
  );
  const movePenalty = Math.round(
    Math.max(0, input.moves - parMoves) * preset.movePenalty
  );
  const accuracyPenalty = Math.round(
    (input.stats.wrongClicks ?? 0) * WRONG_CLICK_PENALTY +
      // Quiz games: each wrong pick costs the preset's movePenalty.
      (input.stats.wrongPicks ?? 0) * preset.movePenalty
  );

  // Guess the Cover: the base is worth less the more of the cover was
  // revealed; Lyric Fill: the base scales with the share of blanks right.
  let base = preset.baseScore;
  if (input.stats.stages !== undefined && input.stats.stages > 0) {
    base = Math.round(base * (1 - (input.stats.stageUsed ?? 0) / input.stats.stages));
  }
  if (input.stats.blanks !== undefined && input.stats.blanks > 0) {
    base = Math.round(base * ((input.stats.correct ?? 0) / input.stats.blanks));
  }

  const raw = base + timeBonus - movePenalty - accuracyPenalty;
  const maxScore = maxPossibleScore(
    input.type,
    input.difficulty,
    input.scoreMultiplier
  );
  const score = clamp(Math.round(raw * input.scoreMultiplier), 0, maxScore);

  return {
    score,
    maxScore,
    parMoves,
    parSeconds: preset.parSeconds,
    minPlausibleMs: Math.max(
      ABSOLUTE_MIN_MS,
      minMoves * MIN_MS_PER_MOVE[input.type]
    ),
  };
}

/**
 * The best score this configuration can produce: finish instantly, at par
 * moves, with no mistakes. Doubles as the rejection bound — anything above
 * this could only come from a bug or a tampered request.
 */
export function maxPossibleScore(
  type: GameType,
  difficulty: Difficulty,
  scoreMultiplier: number
): number {
  const preset = getPreset(type, difficulty);
  return Math.round(
    (preset.baseScore + preset.parSeconds * preset.timeWeight) * scoreMultiplier
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** mm:ss, shared by the game HUD, the result screen and the admin tables. */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function formatScore(score: number): string {
  return score.toLocaleString("en-US");
}
