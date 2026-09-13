// lib/minigames/challenge.ts
//
// Server-side puzzle generation. Runs only inside route handlers — the
// challenge it returns is written to MiniGameSession.challenge, and that
// stored row (never the browser's copy) is what verify.ts replays against.
//
// Two invariants every generator here holds to:
//   • the puzzle is always solvable — scrambles are walks back from the
//     solved state, never blind permutations
//   • the puzzle never starts solved, or a player could "win" by doing nothing

import { randomInt } from "crypto";
import { getPreset } from "./registry";
import type {
  Difficulty,
  DifferenceRegion,
  GameChallenge,
  GameType,
} from "./types";

/** Fisher–Yates over a crypto RNG. Mutates and returns the array. */
function shuffle<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function pickDistinct(count: number, ceiling: number): number[] {
  const pool = Array.from({ length: ceiling }, (_, i) => i);
  return shuffle(pool).slice(0, count);
}

export interface ChallengeContext {
  type: GameType;
  difficulty: Difficulty;
  /** FIND_DIFFERENCE only — the admin-configured hotspots. */
  regions?: DifferenceRegion[];
}

export function createChallenge(ctx: ChallengeContext): GameChallenge {
  const preset = getPreset(ctx.type, ctx.difficulty);

  switch (ctx.type) {
    case "ART_PUZZLE": {
      const count = preset.grid * preset.grid;
      const order = Array.from({ length: count }, (_, i) => i);
      // Reshuffle rather than nudge: a swap-anything puzzle has no parity
      // constraint, so any permutation is reachable and the only thing to
      // guard against is landing back on the solved arrangement.
      do {
        shuffle(order);
      } while (order.every((piece, slot) => piece === slot));
      return { kind: "ART_PUZZLE", grid: preset.grid, order };
    }

    case "ROTATE_SOLVE": {
      const count = preset.grid * preset.grid;
      const rotations = Array.from({ length: count }, () => randomInt(4));
      // Solved is "every tile at 0 turns", so an all-zero draw would hand the
      // player a finished artwork. Phrased with `some` rather than `every`
      // because `every(r => r === 0)` narrows the array to the literal type
      // `0[]` inside the branch, and the whole point is to write a 1–3 into it.
      if (!rotations.some((r) => r !== 0)) {
        rotations[randomInt(count)] = 1 + randomInt(3);
      }
      return { kind: "ROTATE_SOLVE", grid: preset.grid, rotations };
    }

    case "SLIDING_PUZZLE": {
      const size = preset.grid;
      const count = size * size;
      const board = Array.from({ length: count }, (_, i) => i);
      let blank = count - 1;
      let previous = -1;

      // Walking legal moves backwards from solved is what guarantees the
      // board is solvable — half of all raw permutations of a 15-puzzle are
      // not, and a player cannot tell which they got until they have wasted
      // the whole round on it.
      for (let step = 0; step < preset.scrambleDepth; step++) {
        const neighbours = slidingNeighbours(blank, size).filter(
          (n) => n !== previous
        );
        const next = neighbours[randomInt(neighbours.length)];
        [board[blank], board[next]] = [board[next], board[blank]];
        previous = blank;
        blank = next;
      }

      // A short walk can wander back to solved; one extra legal move fixes it
      // without breaking solvability.
      if (board.every((tile, slot) => tile === slot)) {
        const neighbours = slidingNeighbours(blank, size);
        const next = neighbours[randomInt(neighbours.length)];
        [board[blank], board[next]] = [board[next], board[blank]];
      }

      return { kind: "SLIDING_PUZZLE", grid: size, board };
    }

    case "MEMORY_CARDS": {
      const pairs = preset.pairs;
      // Card faces are distinct crops of the one configured artwork, which is
      // what lets every game in the system share a single artwork setting.
      const faces = pickDistinct(pairs, preset.grid * preset.grid);
      const deck = shuffle(
        Array.from({ length: pairs * 2 }, (_, i) => Math.floor(i / 2))
      );
      return { kind: "MEMORY_CARDS", pairs, grid: preset.grid, faces, deck };
    }

    case "FIND_DIFFERENCE": {
      // Tolerance is baked into the stored radius so the browser's hit test
      // and the server's replay are arithmetically identical — no chance of
      // the two disagreeing about a borderline click.
      const regions: DifferenceRegion[] = (ctx.regions ?? []).map((r) => ({
        id: r.id,
        x: r.x,
        y: r.y,
        radius: Math.round(r.radius * preset.hitTolerance * 100) / 100,
      }));
      return { kind: "FIND_DIFFERENCE", regions };
    }
  }
}

/** Slot indices orthogonally adjacent to `slot` on a size×size board. */
export function slidingNeighbours(slot: number, size: number): number[] {
  const row = Math.floor(slot / size);
  const col = slot % size;
  const out: number[] = [];
  if (row > 0) out.push(slot - size);
  if (row < size - 1) out.push(slot + size);
  if (col > 0) out.push(slot - 1);
  if (col < size - 1) out.push(slot + 1);
  return out;
}
