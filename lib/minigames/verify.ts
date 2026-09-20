// lib/minigames/verify.ts
//
// Server-side replay of a submitted move log against the challenge the server
// issued. This is what makes the leaderboard worth having: the browser does
// not send a score, it sends what it *did*, and the server decides whether
// those moves actually solve the puzzle it handed out — and, from the replay,
// how many moves that took.
//
// A forged submission therefore has to be a genuine solution to a specific
// server-generated puzzle. The remaining lever (solving it by script, instantly)
// is closed off by the elapsed-time floor in scoring.ts, which measures the
// clock server-side rather than trusting a client-reported duration.

import { slidingNeighbours } from "./challenge";
import type { GameChallenge, GameMoves, VerificationResult } from "./types";

/**
 * Ceiling on how long a move log may be, per game. Solving any of these
 * legitimately takes far fewer moves; the cap exists so a hostile request
 * can't hand the server a million-entry array to chew through.
 */
const MOVE_LIMITS: Record<GameMoves["kind"], number> = {
  ART_PUZZLE: 2000,
  ROTATE_SOLVE: 2000,
  SLIDING_PUZZLE: 5000,
  MEMORY_CARDS: 1000,
  FIND_DIFFERENCE: 300,
  GUESS_THE_COVER: 20,
  TRACKLIST_ORDER: 500,
  LYRIC_FILL: 20,
  NAME_THAT_TRACK: 20,
  RELEASE_TIMELINE: 500,
};

/** Case-, accent- and punctuation-insensitive word match for Lyric Fill. */
function sameWord(a: string, b: string): boolean {
  const norm = (w: string) => w.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();
  return norm(a) === norm(b);
}

/** Replay swaps over a shuffled `order` and report whether it ended sorted. */
function replaySwaps(order: number[], swaps: unknown, limit: number, kindLabel: string): VerificationResult {
  if (!Array.isArray(swaps)) return fail("Malformed result.");
  if (swaps.length > limit) return fail("Too many moves submitted.");
  const board = [...order];
  const minMoves = minimumSwaps(order);
  for (const swap of swaps) {
    if (!Array.isArray(swap) || swap.length !== 2) return fail("Malformed move.");
    const [a, b] = swap;
    if (!isSlot(a, board.length) || !isSlot(b, board.length) || a === b) return fail("Invalid move.");
    [board[a], board[b]] = [board[b], board[a]];
  }
  if (!board.every((v, i) => v === i)) return fail(`The ${kindLabel} isn't in order yet.`);
  return { ok: true, moves: swaps.length, stats: { minMoves } };
}

function fail(reason: string): VerificationResult {
  return { ok: false, reason, moves: 0, stats: {} };
}

export function verifySolution(
  challenge: GameChallenge,
  moves: GameMoves
): VerificationResult {
  if (challenge.kind !== moves.kind) {
    return fail("This result does not match the game that was started.");
  }

  switch (challenge.kind) {
    case "ART_PUZZLE": {
      const swaps = (moves as { swaps: unknown }).swaps;
      if (!Array.isArray(swaps)) return fail("Malformed result.");
      if (swaps.length > MOVE_LIMITS.ART_PUZZLE)
        return fail("Too many moves submitted.");

      const board = [...challenge.order];
      const minMoves = minimumSwaps(challenge.order);

      for (const swap of swaps) {
        if (!Array.isArray(swap) || swap.length !== 2)
          return fail("Malformed move.");
        const [a, b] = swap;
        if (!isSlot(a, board.length) || !isSlot(b, board.length) || a === b) {
          return fail("Invalid move.");
        }
        [board[a], board[b]] = [board[b], board[a]];
      }

      if (!board.every((piece, slot) => piece === slot)) {
        return fail("The puzzle was not solved.");
      }
      return { ok: true, moves: swaps.length, stats: { minMoves } };
    }

    case "ROTATE_SOLVE": {
      const taps = (moves as { taps: unknown }).taps;
      if (!Array.isArray(taps)) return fail("Malformed result.");
      if (taps.length > MOVE_LIMITS.ROTATE_SOLVE)
        return fail("Too many moves submitted.");

      const rotations = [...challenge.rotations];
      // Every tile needs however many quarter-turns bring it back to upright.
      const minMoves = rotations.reduce(
        (sum, r) => sum + ((4 - (r % 4)) % 4),
        0
      );

      for (const tile of taps) {
        if (!isSlot(tile, rotations.length)) return fail("Invalid move.");
        rotations[tile] = (rotations[tile] + 1) % 4;
      }

      if (!rotations.every((r) => r === 0)) {
        return fail("Some tiles are still turned the wrong way.");
      }
      return { ok: true, moves: taps.length, stats: { minMoves } };
    }

    case "SLIDING_PUZZLE": {
      const log = (moves as { moves: unknown }).moves;
      if (!Array.isArray(log)) return fail("Malformed result.");
      if (log.length > MOVE_LIMITS.SLIDING_PUZZLE)
        return fail("Too many moves submitted.");

      const board = [...challenge.board];
      const size = challenge.grid;
      const blankTile = size * size - 1;
      let blank = board.indexOf(blankTile);
      if (blank < 0) return fail("Malformed puzzle state.");

      for (const slot of log) {
        if (!isSlot(slot, board.length)) return fail("Invalid move.");
        // Only a tile orthogonally touching the gap can move into it. This is
        // the check that stops a "solution" that teleports tiles around.
        if (!slidingNeighbours(blank, size).includes(slot)) {
          return fail("Illegal move: that tile was not next to the gap.");
        }
        [board[blank], board[slot]] = [board[slot], board[blank]];
        blank = slot;
      }

      if (!board.every((tile, slot) => tile === slot)) {
        return fail("The puzzle was not solved.");
      }
      return {
        ok: true,
        moves: log.length,
        stats: { minMoves: manhattanLowerBound(challenge.board, size) },
      };
    }

    case "MEMORY_CARDS": {
      const flips = (moves as { flips: unknown }).flips;
      if (!Array.isArray(flips)) return fail("Malformed result.");
      if (flips.length > MOVE_LIMITS.MEMORY_CARDS)
        return fail("Too many moves submitted.");

      const deck = challenge.deck;
      const matched = new Array<boolean>(deck.length).fill(false);
      let matches = 0;

      for (const flip of flips) {
        if (!Array.isArray(flip) || flip.length !== 2)
          return fail("Malformed move.");
        const [a, b] = flip;
        if (!isSlot(a, deck.length) || !isSlot(b, deck.length) || a === b) {
          return fail("Invalid move.");
        }
        if (matched[a] || matched[b]) {
          return fail("Illegal move: that card was already matched.");
        }
        if (deck[a] === deck[b]) {
          matched[a] = true;
          matched[b] = true;
          matches++;
        }
      }

      if (matches !== challenge.pairs) {
        return fail("Not every pair was matched.");
      }
      return {
        ok: true,
        moves: flips.length,
        stats: { minMoves: challenge.pairs, matches },
      };
    }

    case "FIND_DIFFERENCE": {
      const clicks = (moves as { clicks: unknown }).clicks;
      if (!Array.isArray(clicks)) return fail("Malformed result.");
      if (clicks.length > MOVE_LIMITS.FIND_DIFFERENCE)
        return fail("Too many clicks submitted.");
      if (challenge.regions.length === 0)
        return fail("This round has no differences configured.");

      const found = new Set<string>();
      let wrongClicks = 0;

      for (const click of clicks) {
        if (!click || typeof click !== "object")
          return fail("Malformed click.");
        const { x, y } = click as { x: unknown; y: unknown };
        if (!isPercent(x) || !isPercent(y)) return fail("Invalid click.");

        // First unfound hotspot containing the point wins, matching how the
        // browser resolved the same click while the visitor was playing.
        const hit = challenge.regions.find(
          (r) => !found.has(r.id) && Math.hypot(r.x - x, r.y - y) <= r.radius
        );
        if (hit) found.add(hit.id);
        else wrongClicks++;
      }

      if (found.size !== challenge.regions.length) {
        return fail("Not every difference was found.");
      }
      return {
        ok: true,
        moves: clicks.length,
        stats: {
          minMoves: challenge.regions.length,
          wrongClicks,
          found: found.size,
        },
      };
    }

    case "GUESS_THE_COVER": {
      const picks = (moves as { picks: unknown }).picks;
      if (!Array.isArray(picks)) return fail("Malformed result.");
      if (picks.length === 0) return fail("No guess was made.");
      if (picks.length > MOVE_LIMITS.GUESS_THE_COVER) return fail("Too many moves submitted.");
      const optionIds = new Set(challenge.options.map((o) => o.id));
      let stage = 0;
      for (const pick of picks) {
        if (!pick || typeof pick !== "object") return fail("Malformed move.");
        const { stage: s, releaseId } = pick as { stage: unknown; releaseId: unknown };
        if (!Number.isInteger(s) || (s as number) < stage || (s as number) >= challenge.stages) return fail("Invalid move.");
        if (typeof releaseId !== "string" || !optionIds.has(releaseId)) return fail("Invalid move.");
        stage = s as number;
      }
      const last = picks[picks.length - 1] as { stage: number; releaseId: string };
      if (last.releaseId !== challenge.answerId) return fail("That wasn't the right cover.");
      // Every guess before the last was wrong (the round ends on a right one).
      return { ok: true, moves: picks.length, stats: { minMoves: 1, wrongPicks: picks.length - 1, stageUsed: last.stage, stages: challenge.stages } };
    }

    case "NAME_THAT_TRACK": {
      const picks = (moves as { picks: unknown }).picks;
      if (!Array.isArray(picks) || picks.length === 0) return fail("No guess was made.");
      if (picks.length > MOVE_LIMITS.NAME_THAT_TRACK) return fail("Too many moves submitted.");
      const optionIds = new Set(challenge.options.map((o) => o.id));
      for (const pick of picks) if (typeof pick !== "string" || !optionIds.has(pick)) return fail("Invalid move.");
      if (picks[picks.length - 1] !== challenge.answerId) return fail("That wasn't the right record.");
      return { ok: true, moves: picks.length, stats: { minMoves: 1, wrongPicks: picks.length - 1 } };
    }

    case "LYRIC_FILL": {
      const answers = (moves as { answers: unknown }).answers;
      if (!Array.isArray(answers)) return fail("Malformed result.");
      if (answers.length > MOVE_LIMITS.LYRIC_FILL) return fail("Too many moves submitted.");
      const key = challenge.answers ?? [];
      if (answers.length !== key.length) return fail("Fill every blank before checking.");
      let correct = 0;
      for (let i = 0; i < key.length; i++) {
        if (typeof answers[i] !== "string") return fail("Malformed move.");
        if (sameWord(answers[i] as string, key[i])) correct += 1;
      }
      if (correct === 0) return fail("None of the words were right.");
      return { ok: true, moves: key.length, stats: { minMoves: key.length, correct, blanks: key.length } };
    }

    case "TRACKLIST_ORDER":
      return replaySwaps(challenge.order, (moves as { swaps: unknown }).swaps, MOVE_LIMITS.TRACKLIST_ORDER, "tracklist");

    case "RELEASE_TIMELINE":
      return replaySwaps(challenge.order, (moves as { swaps: unknown }).swaps, MOVE_LIMITS.RELEASE_TIMELINE, "timeline");
  }
}

// ── helpers ────────────────────────────────────────────────────────────

function isSlot(value: unknown, length: number): value is number {
  return (
    Number.isInteger(value) &&
    (value as number) >= 0 &&
    (value as number) < length
  );
}

function isPercent(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= -5 &&
    value <= 105
  );
}

/**
 * Minimum number of swaps that sorts a permutation: n minus its cycle count.
 * Used as the Art Puzzle's par, so a player who finds a tight solution is
 * rewarded over one who flails at the same clock.
 */
function minimumSwaps(order: number[]): number {
  const seen = new Array<boolean>(order.length).fill(false);
  let cycles = 0;
  for (let i = 0; i < order.length; i++) {
    if (seen[i]) continue;
    cycles++;
    let j = i;
    while (!seen[j]) {
      seen[j] = true;
      j = order[j];
    }
  }
  return order.length - cycles;
}

/**
 * Sum of each tile's Manhattan distance from its home square — the standard
 * admissible lower bound for a sliding puzzle, and cheap where computing the
 * true optimum (IDA*) is not. Used as par, so a tidy solve beats a flailing
 * one on the same clock.
 */
function manhattanLowerBound(board: number[], size: number): number {
  const blankTile = size * size - 1;
  let total = 0;
  for (let slot = 0; slot < board.length; slot++) {
    const tile = board[slot];
    if (tile === blankTile) continue;
    total +=
      Math.abs(Math.floor(slot / size) - Math.floor(tile / size)) +
      Math.abs((slot % size) - (tile % size));
  }
  return total;
}
