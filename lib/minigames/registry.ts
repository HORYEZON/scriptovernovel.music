// lib/minigames/registry.ts
//
// The one place a mini-game is declared. Adding a sixth game (ART_TRIVIA,
// COLOR_MEMORY, …) means:
//   1. add the value to enum MiniGameType in prisma/schema.prisma
//   2. add it to GameType/GAME_TYPES in ./types.ts
//   3. add an entry here (metadata + a preset per difficulty)
//   4. add a createChallenge case in ./challenge.ts and a verify case in
//      ./verify.ts — both switch on the same union, so TypeScript flags the
//      missing branch for you
//   5. add the playable component to components/public/minigames/games/
// Nothing else in the system special-cases a game type.
//
// This module is imported by client components, so it stays pure data: no
// Prisma, no crypto, no server-only APIs.

import type { Difficulty, GameType } from "./types";

/**
 * Everything the scorer and the challenge generator need to know about one
 * (game, difficulty) pairing. Kept in one struct so a difficulty tweak is a
 * single-line edit rather than a hunt through five modules.
 */
export interface GamePreset {
  /** Tiles per side, for the four grid-based games. */
  grid: number;
  /** MEMORY_CARDS: how many matching pairs are dealt. */
  pairs: number;
  /** SLIDING_PUZZLE: how many legal moves the scrambler walks back. */
  scrambleDepth: number;
  /** Seconds a competent player is expected to need. Drives the time bonus. */
  parSeconds: number;
  /** Points awarded per second finished under par. */
  timeWeight: number;
  /** Points deducted per move over the game's par move count. */
  movePenalty: number;
  /** Baseline points for finishing at all. */
  baseScore: number;
  /**
   * FIND_DIFFERENCE: how forgiving a click is, as a multiplier on the
   * admin-configured hotspot radius.
   */
  hitTolerance: number;
}

export interface GameDefinition {
  type: GameType;
  name: string;
  /** Shown in the selector and the preview modal. */
  description: string;
  /** How to play, one sentence, shown on the preview modal. */
  howToPlay: string;
  /** Key into GAME_ICONS in components/public/minigames/GameIcon.tsx. */
  icon: string;
  /** True when the game needs a second (altered) artwork configured. */
  needsSecondaryArtwork: boolean;
  presets: Record<Difficulty, GamePreset>;
}

/**
 * Shared skeleton for the four grid puzzles — they differ only in grid size,
 * pacing and how harshly extra moves are punished, so spelling all seven
 * fields out five times each would just invite drift.
 */
function preset(
  overrides: Partial<GamePreset> & Pick<GamePreset, "parSeconds">
): GamePreset {
  return {
    grid: 3,
    pairs: 0,
    scrambleDepth: 0,
    timeWeight: 12,
    movePenalty: 10,
    baseScore: 1000,
    hitTolerance: 1,
    ...overrides,
  };
}

export const GAME_REGISTRY: Record<GameType, GameDefinition> = {
  ART_PUZZLE: {
    type: "ART_PUZZLE",
    name: "Art Puzzle",
    description: "Reconstruct the artwork by arranging its scattered pieces.",
    howToPlay:
      "Tap or click one piece, then another, to swap them. Put every piece back where it belongs.",
    icon: "puzzle",
    needsSecondaryArtwork: false,
    presets: {
      EASY: preset({
        grid: 3,
        parSeconds: 60,
        timeWeight: 8,
        movePenalty: 6,
        baseScore: 500,
      }),
      MEDIUM: preset({ grid: 4, parSeconds: 120 }),
      HARD: preset({
        grid: 5,
        parSeconds: 210,
        timeWeight: 16,
        movePenalty: 14,
        baseScore: 1500,
      }),
    },
  },

  ROTATE_SOLVE: {
    type: "ROTATE_SOLVE",
    name: "Rotate & Solve",
    description:
      "Every tile has been turned. Spin them back until the artwork stands upright.",
    howToPlay:
      "Tap a tile to rotate it 90°. The artwork is solved when every tile is upright.",
    icon: "rotate",
    needsSecondaryArtwork: false,
    presets: {
      EASY: preset({
        grid: 3,
        parSeconds: 45,
        timeWeight: 8,
        movePenalty: 6,
        baseScore: 500,
      }),
      MEDIUM: preset({ grid: 4, parSeconds: 90 }),
      HARD: preset({
        grid: 5,
        parSeconds: 150,
        timeWeight: 16,
        movePenalty: 14,
        baseScore: 1500,
      }),
    },
  },

  SLIDING_PUZZLE: {
    type: "SLIDING_PUZZLE",
    name: "Art Sliding Puzzle",
    description: "The classic sliding tile puzzle, played on a single artwork.",
    howToPlay:
      "Tap (or swipe) a tile next to the gap to slide it in. Rebuild the artwork with the gap back in the corner.",
    icon: "sliding",
    needsSecondaryArtwork: false,
    presets: {
      // Grid stays 3×3 for the two lower difficulties — this is the classic
      // 8-puzzle; difficulty is how far the scrambler walks from solved.
      EASY: preset({
        grid: 3,
        scrambleDepth: 25,
        parSeconds: 60,
        timeWeight: 8,
        movePenalty: 6,
        baseScore: 500,
      }),
      MEDIUM: preset({ grid: 3, scrambleDepth: 60, parSeconds: 120 }),
      HARD: preset({
        grid: 4,
        scrambleDepth: 120,
        parSeconds: 240,
        timeWeight: 16,
        movePenalty: 14,
        baseScore: 1500,
      }),
    },
  },

  MEMORY_CARDS: {
    type: "MEMORY_CARDS",
    name: "Art Memory Cards",
    // Faces are crops of the configured artwork rather than separate uploads,
    // which is what keeps every game on the same one-artwork configuration.
    description:
      "Flip cards two at a time and match every detail of the artwork.",
    howToPlay:
      "Flip two cards a turn. Matching details stay face up; the rest flip back.",
    icon: "memory",
    needsSecondaryArtwork: false,
    presets: {
      EASY: preset({
        grid: 3,
        pairs: 6,
        parSeconds: 45,
        timeWeight: 8,
        movePenalty: 6,
        baseScore: 500,
      }),
      MEDIUM: preset({ grid: 3, pairs: 8, parSeconds: 70 }),
      HARD: preset({
        grid: 4,
        pairs: 10,
        parSeconds: 100,
        timeWeight: 16,
        movePenalty: 14,
        baseScore: 1500,
      }),
    },
  },

  FIND_DIFFERENCE: {
    type: "FIND_DIFFERENCE",
    name: "Find the Difference",
    description: "Two versions of one artwork. Spot everything that changed.",
    howToPlay:
      "Compare the two images and click each difference you spot. Wrong guesses cost points.",
    icon: "difference",
    needsSecondaryArtwork: true,
    presets: {
      EASY: preset({
        parSeconds: 90,
        timeWeight: 8,
        movePenalty: 20,
        baseScore: 500,
        hitTolerance: 1.4,
      }),
      MEDIUM: preset({ parSeconds: 75, movePenalty: 30, hitTolerance: 1.15 }),
      HARD: preset({
        parSeconds: 60,
        timeWeight: 16,
        movePenalty: 45,
        baseScore: 1500,
        hitTolerance: 1,
      }),
    },
  },
};

export const GAME_DEFINITIONS: GameDefinition[] = [
  GAME_REGISTRY.ART_PUZZLE,
  GAME_REGISTRY.ROTATE_SOLVE,
  GAME_REGISTRY.SLIDING_PUZZLE,
  GAME_REGISTRY.MEMORY_CARDS,
  GAME_REGISTRY.FIND_DIFFERENCE,
];

export function getPreset(type: GameType, difficulty: Difficulty): GamePreset {
  return GAME_REGISTRY[type].presets[difficulty];
}

export function isGameType(value: unknown): value is GameType {
  return typeof value === "string" && value in GAME_REGISTRY;
}

/** Human-readable difficulty summary, e.g. "16 pieces" — used by the admin form. */
export function describePreset(type: GameType, difficulty: Difficulty): string {
  const p = getPreset(type, difficulty);
  switch (type) {
    case "ART_PUZZLE":
      return `${p.grid * p.grid} pieces (${p.grid}×${p.grid})`;
    case "ROTATE_SOLVE":
      return `${p.grid}×${p.grid} tiles`;
    case "SLIDING_PUZZLE":
      return `${p.grid}×${p.grid} board, ${p.scrambleDepth} shuffle moves`;
    case "MEMORY_CARDS":
      return `${p.pairs} pairs (${p.pairs * 2} cards)`;
    case "FIND_DIFFERENCE":
      return `${Math.round(p.hitTolerance * 100)}% click tolerance`;
  }
}
