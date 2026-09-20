// lib/minigames/types.ts
//
// Shared vocabulary for the mini-game system. Everything here is transport
// shape — what crosses the browser/server boundary — plus the two Prisma
// enums mirrored as string unions so client components can import them
// without pulling in @prisma/client.
//
// The four moving parts and where they live:
//   registry.ts  — per-type metadata + difficulty presets (client-safe)
//   challenge.ts — server-side puzzle generation      (server only)
//   verify.ts    — server-side move replay            (server only)
//   scoring.ts   — server-side score computation      (server only)

export type GameType =
  | "ART_PUZZLE"
  | "ROTATE_SOLVE"
  | "SLIDING_PUZZLE"
  | "MEMORY_CARDS"
  | "FIND_DIFFERENCE"
  | "GUESS_THE_COVER"
  | "TRACKLIST_ORDER"
  | "LYRIC_FILL"
  | "NAME_THAT_TRACK"
  | "RELEASE_TIMELINE";

export const GAME_TYPES: GameType[] = [
  "ART_PUZZLE",
  "ROTATE_SOLVE",
  "SLIDING_PUZZLE",
  "MEMORY_CARDS",
  "FIND_DIFFERENCE",
  "GUESS_THE_COVER",
  "TRACKLIST_ORDER",
  "LYRIC_FILL",
  "NAME_THAT_TRACK",
  "RELEASE_TIMELINE",
];

/**
 * A release as the music games see it — the same shape the catalog games'
 * options carry to the browser. `year` rather than a full date so Release
 * Timeline can't be solved by reading the payload.
 */
export interface GameReleaseOption {
  id: string;
  title: string;
  coverImageUrl: string;
}

export type Difficulty = "EASY" | "MEDIUM" | "HARD";

export const DIFFICULTIES: Difficulty[] = ["EASY", "MEDIUM", "HARD"];

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  EASY: "Easy",
  MEDIUM: "Medium",
  HARD: "Hard",
};

/**
 * A Find-the-Difference hotspot. All three values are percentages of the
 * rendered image box (0–100) so the same region works at any display size —
 * the admin editor places them by clicking a preview, and the server checks
 * visitor clicks against them in the same coordinate space.
 */
export interface DifferenceRegion {
  id: string;
  x: number;
  y: number;
  radius: number;
}

// ── Challenges: server-issued, stored on MiniGameSession.challenge ──────
//
// The client gets a copy so it can render the puzzle, but the row in the
// database is what submit-time verification replays against — a browser that
// rewrites its local copy just fails verification.

export interface ArtPuzzleChallenge {
  kind: "ART_PUZZLE";
  grid: number;
  /** order[slot] = index of the piece currently sitting in that slot. */
  order: number[];
}

export interface RotateSolveChallenge {
  kind: "ROTATE_SOLVE";
  grid: number;
  /** rotations[tile] = quarter-turns (0–3) the tile starts rotated by. */
  rotations: number[];
}

export interface SlidingPuzzleChallenge {
  kind: "SLIDING_PUZZLE";
  grid: number;
  /** board[slot] = tile index; the highest index is the blank. */
  board: number[];
}

export interface MemoryCardsChallenge {
  kind: "MEMORY_CARDS";
  pairs: number;
  /** Side length of the crop grid `faces` indexes into. */
  grid: number;
  /** faces[pairId] = which cell of the grid that pair shows. */
  faces: number[];
  /** deck[cardSlot] = pair id. Every pair id appears exactly twice. */
  deck: number[];
}

export interface FindDifferenceChallenge {
  kind: "FIND_DIFFERENCE";
  /**
   * Deliberately sent to the browser: the visitor needs a hit/miss verdict on
   * every click, and round-tripping each click to the server is exactly the
   * chatty pattern this feature is supposed to avoid. The answer is already
   * visible in the two images, so shipping the coordinates leaks nothing a
   * careful look wouldn't. Server-side verification re-checks every submitted
   * click against its own copy, so a tampered client still cannot claim a hit
   * it did not make.
   */
  regions: DifferenceRegion[];
}

// ── Music games ────────────────────────────────────────────────────────
//
// Unlike the spatial puzzles above, these have an *answer* the browser must
// not see. Fields marked "server only" are stripped by redactChallenge()
// (challenge.ts) before the challenge leaves the session route; the stored
// row keeps them for verification. They are typed optional for that reason.

export interface GuessTheCoverChallenge {
  kind: "GUESS_THE_COVER";
  /** The cover being revealed, blurred in `stages` steps. */
  coverImageUrl: string;
  options: GameReleaseOption[];
  /** How many reveal steps the visitor may take before guessing. */
  stages: number;
  /** Server only. */
  answerId?: string;
}

export interface TracklistOrderChallenge {
  kind: "TRACKLIST_ORDER";
  release: GameReleaseOption;
  /** Track titles in the shuffled order shown; slot i holds `order[i]`. */
  titles: string[];
  /** order[slot] = index of the track sitting in that slot (0 = first on the record). */
  order: number[];
}

export interface LyricFillChallenge {
  kind: "LYRIC_FILL";
  release: GameReleaseOption;
  trackTitle: string;
  /** The lines shown, with each blanked word replaced by "____". */
  lines: string[];
  /** Word choices, blanks' answers shuffled in with decoys. */
  choices: string[];
  /** How many blanks there are — the visitor submits this many answers, in order. */
  blanks: number;
  /** Server only: the right word for each blank, in order. */
  answers?: string[];
}

export interface NameThatTrackChallenge {
  kind: "NAME_THAT_TRACK";
  trackTitle: string;
  options: GameReleaseOption[];
  /** Server only. */
  answerId?: string;
}

export interface ReleaseTimelineChallenge {
  kind: "RELEASE_TIMELINE";
  /** Releases in the shuffled order shown; slot i holds `order[i]`. */
  options: GameReleaseOption[];
  /** order[slot] = chronological index (0 = earliest) of the release in that slot. */
  order: number[];
}

export type GameChallenge =
  | ArtPuzzleChallenge
  | RotateSolveChallenge
  | SlidingPuzzleChallenge
  | MemoryCardsChallenge
  | FindDifferenceChallenge
  | GuessTheCoverChallenge
  | TracklistOrderChallenge
  | LyricFillChallenge
  | NameThatTrackChallenge
  | ReleaseTimelineChallenge;

// ── Move logs: client-submitted, replayed server-side ───────────────────

export interface ArtPuzzleMoves {
  kind: "ART_PUZZLE";
  /** Each entry swaps the contents of two slots. */
  swaps: [number, number][];
}

export interface RotateSolveMoves {
  kind: "ROTATE_SOLVE";
  /** Tile indices; each tap turns that tile one quarter-turn clockwise. */
  taps: number[];
}

export interface SlidingPuzzleMoves {
  kind: "SLIDING_PUZZLE";
  /** Slot index of the tile pushed into the blank, in order. */
  moves: number[];
}

export interface MemoryCardsMoves {
  kind: "MEMORY_CARDS";
  /** Each entry is one turn: the two card slots revealed. */
  flips: [number, number][];
}

export interface FindDifferenceMoves {
  kind: "FIND_DIFFERENCE";
  /** Every click the visitor made, in percentages of the image box. */
  clicks: { x: number; y: number }[];
}

export interface GuessTheCoverMoves {
  kind: "GUESS_THE_COVER";
  /** Every guess, with the reveal stage (0-based) it was made at. */
  picks: { stage: number; releaseId: string }[];
}

export interface TracklistOrderMoves {
  kind: "TRACKLIST_ORDER";
  /** Each entry swaps the contents of two slots. */
  swaps: [number, number][];
}

export interface LyricFillMoves {
  kind: "LYRIC_FILL";
  /** One chosen word per blank, in order. */
  answers: string[];
}

export interface NameThatTrackMoves {
  kind: "NAME_THAT_TRACK";
  /** Every guess, in order — the round ends on the right one. */
  picks: string[];
}

export interface ReleaseTimelineMoves {
  kind: "RELEASE_TIMELINE";
  swaps: [number, number][];
}

export type GameMoves =
  | ArtPuzzleMoves
  | RotateSolveMoves
  | SlidingPuzzleMoves
  | MemoryCardsMoves
  | FindDifferenceMoves
  | GuessTheCoverMoves
  | TracklistOrderMoves
  | LyricFillMoves
  | NameThatTrackMoves
  | ReleaseTimelineMoves;

/** Outcome of replaying a move log against a stored challenge. */
export interface VerificationResult {
  ok: boolean;
  /** Set when ok is false — surfaced to the visitor as a friendly message. */
  reason?: string;
  /** Authoritative move count, taken from the replay rather than the request. */
  moves: number;
  /** Extra per-game facts the scorer needs (wrong clicks, matches, …). */
  stats: Record<string, number>;
}

// ── Public API payloads ────────────────────────────────────────────────

/** One game as the public gallery sees it. Never carries reward emails. */
export interface PublicGame {
  type: GameType;
  name: string;
  description: string;
  icon: string;
  enabled: boolean;
  difficulty: Difficulty;
  timeLimitSec: number;
  leaderboardEnabled: boolean;
  rewardEnabled: boolean;
  rewardThreshold: number;
  rewardDescription: string | null;
  rewardRequireEmail: boolean;
  artwork: PublicGameArtwork | null;
  secondaryArtwork: PublicGameArtwork | null;
  /** Top scores, small enough to ship with the selector payload. */
  topScores: PublicLeaderboardRow[];
  /** The visitor's own best on this game, if they have one. */
  bestScore: number | null;
  /** Present only when the game cannot be played, e.g. missing artwork. */
  unavailableReason: string | null;
}

/**
 * The game's subject as the browser sees it: a release cover today, an
 * artwork for a game still configured on one. Still called `artwork` on the
 * payloads so the Digital Museum's Arcade Room (which reads
 * `game.artwork?.imageUrl` for its cabinet screens) keeps working untouched.
 */
export interface GameSubject {
  id: string;
  title: string;
  imageUrl: string;
}
export type PublicGameArtwork = GameSubject;

export interface PublicLeaderboardRow {
  id: string;
  rank: number;
  displayName: string;
  score: number;
  completionTime: number;
  createdAt: string;
  /** True for rows belonging to the current anonymous visitor. */
  isYou: boolean;
}

/** One game as the admin module sees it — configuration plus a usage summary. */
export interface AdminGameConfig {
  type: GameType;
  name: string;
  description: string;
  howToPlay: string;
  icon: string;
  needsSecondaryArtwork: boolean;

  enabled: boolean;
  difficulty: Difficulty;
  artworkId: string | null;
  secondaryArtworkId: string | null;
  /** The release whose cover the game is built on (the current subject). */
  releaseId: string | null;
  /** Find the Difference's uploaded altered cover. */
  secondaryImageUrl: string | null;
  /** "release": one release's cover; "catalog": every published release. */
  subject: "release" | "catalog";
  timeLimitSec: number;
  scoreMultiplier: number;
  leaderboardEnabled: boolean;
  leaderboardSize: number;
  rewardEnabled: boolean;
  rewardThreshold: number;
  rewardDescription: string | null;
  rewardRequireEmail: boolean;
  differences: DifferenceRegion[];

  artwork: PublicGameArtwork | null;
  secondaryArtwork: PublicGameArtwork | null;
  /** The release picked for this game, whatever its published state. */
  release: GameReleaseOption | null;
  /** Set when the game is enabled but cannot actually be played. */
  unavailableReason: string | null;
  stats: AdminGameStats;
}

export interface AdminGameStats {
  /** Rounds started. */
  plays: number;
  /** Rounds that passed verification. */
  completions: number;
  entries: number;
  bestScore: number | null;
  claims: number;
}

/** A leaderboard row as the admin sees it — still no email; that's on the claim. */
export interface AdminLeaderboardRow {
  id: string;
  type: GameType;
  gameName: string;
  displayName: string;
  score: number;
  completionTime: number;
  moves: number;
  difficulty: Difficulty;
  createdAt: string;
  artwork: { id: string; title: string } | null;
  /** Present when this run also produced a reward claim. */
  claim: AdminRewardClaim | null;
}

export interface AdminRewardClaim {
  id: string;
  displayName: string;
  email: string;
  score: number;
  threshold: number;
  reward: string;
  artworkTitle: string | null;
  status: "PENDING" | "FULFILLED" | "REJECTED";
  notifiedAt: string | null;
  createdAt: string;
  gameType: GameType;
  gameName: string;
}

/** Response to POST /api/minigames/session. */
export interface StartGameResponse {
  sessionId: string;
  type: GameType;
  difficulty: Difficulty;
  timeLimitSec: number;
  expiresAt: string;
  challenge: GameChallenge;
  artwork: PublicGameArtwork | null;
  secondaryArtwork: PublicGameArtwork | null;
}

/** Response to POST /api/minigames/submit. */
export interface SubmitResultResponse {
  accepted: boolean;
  score: number;
  maxScore: number;
  moves: number;
  durationMs: number;
  rank: number | null;
  leaderboard: PublicLeaderboardRow[];
  leaderboardEnabled: boolean;
  reward: {
    eligible: boolean;
    threshold: number;
    description: string | null;
    requireEmail: boolean;
    claimed: boolean;
  };
}
