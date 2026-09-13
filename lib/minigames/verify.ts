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
};

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
