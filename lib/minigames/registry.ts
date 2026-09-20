// lib/minigames/registry.ts
//
// The one place a mini-game is declared. Adding a game means:
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
  /** True when the game needs a second (altered) image configured. */
  needsSecondaryArtwork: boolean;
  /**
   * What the game is built on: one release's cover ("release" — the admin
   * picks it), or the whole published catalogue ("catalog" — no pick; the
   * game needs `catalogMin` releases before it can be played).
   */
  subject: "release" | "catalog";
  catalogMin: number;
  presets: Record<Difficulty, GamePreset>;
}

/** Music-game presets reuse the grid fields loosely: `grid` = options shown
 *  (Guess the Cover, Name That Track) or blanks (Lyric Fill), `pairs` =
 *  reveal stages (Guess the Cover) or items ordered (Timeline). */

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
    name: "Cover Puzzle",
    description: "Reconstruct the record cover by arranging its scattered pieces.",
    howToPlay:
      "Tap or click one piece, then another, to swap them. Put every piece back where it belongs.",
    icon: "puzzle",
    needsSecondaryArtwork: false,
    subject: "release",
    catalogMin: 0,
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
      "Every tile has been turned. Spin them back until the cover stands upright.",
    howToPlay:
      "Tap a tile to rotate it 90°. The cover is solved when every tile is upright.",
    icon: "rotate",
    needsSecondaryArtwork: false,
    subject: "release",
    catalogMin: 0,
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
    name: "Sliding Cover",
    description: "The classic sliding tile puzzle, played on a record cover.",
    howToPlay:
      "Tap (or swipe) a tile next to the gap to slide it in. Rebuild the cover with the gap back in the corner.",
    icon: "sliding",
    needsSecondaryArtwork: false,
    subject: "release",
    catalogMin: 0,
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
    name: "Cover Memory",
    // Faces are crops of the configured artwork rather than separate uploads,
    // which is what keeps every game on the same one-artwork configuration.
    description:
      "Flip cards two at a time and match every detail of the cover.",
    howToPlay:
      "Flip two cards a turn. Matching details stay face up; the rest flip back.",
    icon: "memory",
    needsSecondaryArtwork: false,
    subject: "release",
    catalogMin: 0,
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
    description: "Two versions of one cover. Spot everything that changed.",
    howToPlay:
      "Compare the two images and click each difference you spot. Wrong guesses cost points.",
    icon: "difference",
    needsSecondaryArtwork: true,
    subject: "release",
    catalogMin: 0,
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

  GUESS_THE_COVER: {
    type: "GUESS_THE_COVER",
    name: "Guess the Cover",
    description: "A record cover comes into focus a step at a time. Name it before it's sharp.",
    howToPlay:
      "The cover starts blurred. Reveal a little more each step, or guess early — fewer reveals, more points. Wrong guesses cost points.",
    icon: "cover",
    needsSecondaryArtwork: false,
    subject: "catalog",
    catalogMin: 4,
    presets: {
      EASY: preset({ grid: 3, pairs: 5, parSeconds: 30, timeWeight: 6, movePenalty: 60, baseScore: 500 }),
      MEDIUM: preset({ grid: 4, pairs: 5, parSeconds: 25, timeWeight: 10, movePenalty: 90, baseScore: 1000 }),
      HARD: preset({ grid: 6, pairs: 6, parSeconds: 20, timeWeight: 14, movePenalty: 120, baseScore: 1500 }),
    },
  },

  NAME_THAT_TRACK: {
    type: "NAME_THAT_TRACK",
    name: "Name That Track",
    description: "A song title — which record is it on?",
    howToPlay: "Pick the cover the track belongs to. The round ends on the right answer; wrong picks cost points.",
    icon: "track",
    needsSecondaryArtwork: false,
    subject: "catalog",
    catalogMin: 2,
    presets: {
      EASY: preset({ grid: 3, parSeconds: 20, timeWeight: 8, movePenalty: 80, baseScore: 500 }),
      MEDIUM: preset({ grid: 4, parSeconds: 15, timeWeight: 12, movePenalty: 120, baseScore: 1000 }),
      HARD: preset({ grid: 6, parSeconds: 12, timeWeight: 16, movePenalty: 160, baseScore: 1500 }),
    },
  },

  LYRIC_FILL: {
    type: "LYRIC_FILL",
    name: "Fill the Lyric",
    description: "A few lines from a song with words missing. Put them back.",
    howToPlay: "Drop the right word into each blank from the choices below, then check.",
    icon: "lyric",
    needsSecondaryArtwork: false,
    subject: "release",
    catalogMin: 0,
    presets: {
      EASY: preset({ grid: 2, parSeconds: 45, timeWeight: 6, movePenalty: 100, baseScore: 500 }),
      MEDIUM: preset({ grid: 3, parSeconds: 40, timeWeight: 10, movePenalty: 150, baseScore: 1000 }),
      HARD: preset({ grid: 4, parSeconds: 35, timeWeight: 14, movePenalty: 200, baseScore: 1500 }),
    },
  },

  TRACKLIST_ORDER: {
    type: "TRACKLIST_ORDER",
    name: "Tracklist Order",
    description: "The songs of a record, shuffled. Put them back in running order.",
    howToPlay: "Tap two songs to swap them. Done when the tracklist runs the way the record does.",
    icon: "tracklist",
    needsSecondaryArtwork: false,
    subject: "release",
    catalogMin: 0,
    presets: {
      EASY: preset({ parSeconds: 60, timeWeight: 6, movePenalty: 15, baseScore: 500 }),
      MEDIUM: preset({ parSeconds: 45, timeWeight: 10, movePenalty: 25, baseScore: 1000 }),
      HARD: preset({ parSeconds: 35, timeWeight: 14, movePenalty: 35, baseScore: 1500 }),
    },
  },

  RELEASE_TIMELINE: {
    type: "RELEASE_TIMELINE",
    name: "Release Timeline",
    description: "The band's records, out of order. Line them up oldest to newest.",
    howToPlay: "Tap two covers to swap them. Done when they run from the first release to the latest.",
    icon: "timeline",
    needsSecondaryArtwork: false,
    subject: "catalog",
    catalogMin: 4,
    presets: {
      EASY: preset({ pairs: 4, parSeconds: 45, timeWeight: 6, movePenalty: 15, baseScore: 500 }),
      MEDIUM: preset({ pairs: 5, parSeconds: 40, timeWeight: 10, movePenalty: 25, baseScore: 1000 }),
      HARD: preset({ pairs: 6, parSeconds: 35, timeWeight: 14, movePenalty: 35, baseScore: 1500 }),
    },
  },
};

export const GAME_DEFINITIONS: GameDefinition[] = [
  GAME_REGISTRY.GUESS_THE_COVER,
  GAME_REGISTRY.NAME_THAT_TRACK,
  GAME_REGISTRY.LYRIC_FILL,
  GAME_REGISTRY.TRACKLIST_ORDER,
  GAME_REGISTRY.RELEASE_TIMELINE,
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
    case "GUESS_THE_COVER":
      return `${p.grid} covers to choose from, ${p.pairs} reveal steps`;
    case "NAME_THAT_TRACK":
      return `${p.grid} covers to choose from`;
    case "LYRIC_FILL":
      return `${p.grid} missing word${p.grid === 1 ? "" : "s"}`;
    case "TRACKLIST_ORDER":
      return "the whole tracklist";
    case "RELEASE_TIMELINE":
      return `${p.pairs} releases to order`;
  }
}
