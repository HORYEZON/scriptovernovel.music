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
import { blankableWords, lyricLines, type CatalogRelease, type CatalogSnapshot } from "./catalog";
import type {
  Difficulty,
  DifferenceRegion,
  GameChallenge,
  GameReleaseOption,
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
  /** Music games — every published release (lib/minigames/catalog.ts). */
  catalog?: CatalogSnapshot;
  /** Release-subject music games — the release the admin picked. */
  release?: CatalogRelease | null;
}

/**
 * The copy of a challenge the browser may see. The spatial puzzles ship
 * whole (their answer is the picture); the music quizzes carry an answer
 * key the visitor must not have, so it is stripped here and re-read from
 * the stored row at verification.
 */
export function redactChallenge(challenge: GameChallenge): GameChallenge {
  switch (challenge.kind) {
    case "GUESS_THE_COVER":
    case "NAME_THAT_TRACK": {
      const { answerId: _answer, ...rest } = challenge;
      void _answer;
      return rest as GameChallenge;
    }
    case "LYRIC_FILL": {
      const { answers: _answers, ...rest } = challenge;
      void _answers;
      return rest as GameChallenge;
    }
    default:
      return challenge;
  }
}

function toOption(r: CatalogRelease): GameReleaseOption {
  return { id: r.id, title: r.title, coverImageUrl: r.coverImageUrl };
}

/** Shuffle `items` until the order isn't the identity. */
function shuffledNotIdentity(count: number): number[] {
  const order = Array.from({ length: count }, (_, i) => i);
  if (count < 2) return order;
  do {
    shuffle(order);
  } while (order.every((v, i) => v === i));
  return order;
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

    case "GUESS_THE_COVER": {
      const catalog = ctx.catalog ?? [];
      const optionCount = Math.min(preset.grid, catalog.length);
      const picked = shuffle([...catalog]).slice(0, optionCount);
      const answer = picked[randomInt(picked.length)];
      return {
        kind: "GUESS_THE_COVER",
        coverImageUrl: answer.coverImageUrl,
        options: shuffle(picked.map(toOption)),
        stages: preset.pairs,
        answerId: answer.id,
      };
    }

    case "NAME_THAT_TRACK": {
      const catalog = (ctx.catalog ?? []).filter((r) => r.tracks.length > 0);
      const optionCount = Math.min(preset.grid, catalog.length);
      const picked = shuffle([...catalog]).slice(0, optionCount);
      const answer = picked[randomInt(picked.length)];
      const track = answer.tracks[randomInt(answer.tracks.length)];
      return {
        kind: "NAME_THAT_TRACK",
        trackTitle: track.title,
        options: shuffle(picked.map(toOption)),
        answerId: answer.id,
      };
    }

    case "LYRIC_FILL": {
      const release = ctx.release;
      const tracks = (release?.tracks ?? []).filter((t) => t.lyrics && lyricLines(t.lyrics).length > 0);
      const track = tracks[randomInt(tracks.length)];
      const allLines = lyricLines(track.lyrics as string);
      // A window of up to four consecutive lines, chosen so it contains
      // enough blankable words for the difficulty.
      const want = preset.grid;
      let start = 0;
      let window: string[] = [];
      const starts = shuffle(Array.from({ length: allLines.length }, (_, i) => i));
      for (const candidate of starts) {
        const w = allLines.slice(candidate, candidate + 4);
        if (w.flatMap(blankableWords).length >= want) {
          start = candidate;
          window = w;
          break;
        }
      }
      if (window.length === 0) {
        window = allLines.slice(0, 4);
        start = 0;
      }
      void start;
      // Blank `want` distinct words across the window (or as many as exist).
      const candidates = shuffle(Array.from(new Set(window.flatMap(blankableWords)))).slice(0, want);
      const answers: string[] = [];
      const lines = window.map((line) => {
        return line
          .split(/(\s+)/)
          .map((token) => {
            const bare = token.replace(/[^\p{L}\p{N}'-]/gu, "");
            if (bare && candidates.includes(bare) && !answers.includes(bare)) {
              answers.push(bare);
              return token.replace(bare, "____");
            }
            return token;
          })
          .join("");
      });
      // Decoys: other blankable words from the same song, not already answers.
      const decoyPool = Array.from(new Set(allLines.flatMap(blankableWords))).filter((w) => !answers.includes(w));
      const decoys = shuffle(decoyPool).slice(0, Math.max(2, answers.length));
      return {
        kind: "LYRIC_FILL",
        release: toOption(release as CatalogRelease),
        trackTitle: track.title,
        lines,
        choices: shuffle([...answers, ...decoys]),
        blanks: answers.length,
        answers,
      };
    }

    case "TRACKLIST_ORDER": {
      const release = ctx.release as CatalogRelease;
      const titles = release.tracks.map((t) => t.title);
      const order = shuffledNotIdentity(titles.length);
      return {
        kind: "TRACKLIST_ORDER",
        release: toOption(release),
        titles: order.map((trackIndex) => titles[trackIndex]),
        order,
      };
    }

    case "RELEASE_TIMELINE": {
      const dated = (ctx.catalog ?? []).filter((r) => r.releaseDate);
      const count = Math.min(preset.pairs, dated.length);
      // Pick `count` releases, keep them chronological, then shuffle the slots.
      const chosen = shuffle([...dated]).slice(0, count).sort((a, b) => (a.releaseDate as Date).getTime() - (b.releaseDate as Date).getTime());
      const order = shuffledNotIdentity(chosen.length);
      return {
        kind: "RELEASE_TIMELINE",
        options: order.map((chronoIndex) => toOption(chosen[chronoIndex])),
        order,
      };
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
