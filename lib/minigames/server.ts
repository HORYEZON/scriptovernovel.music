// lib/minigames/server.ts
//
// Server-only data access for the mini-game system. Every route handler goes
// through here so the "what counts as a playable game" rule and the "what may
// a visitor see" rule each live in exactly one place.
//
// Never import this from a client component: it pulls in Prisma.

import type { MiniGame, MiniGameType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { GAME_REGISTRY } from "./registry";
import { sanitizeDifferenceRegions } from "./config";
import type {
  AdminGameConfig,
  Difficulty,
  DifferenceRegion,
  GameType,
  PublicGame,
  PublicGameArtwork,
  PublicLeaderboardRow,
} from "./types";
import { GAME_TYPES } from "./types";

const ARTWORK_SELECT = {
  id: true,
  title: true,
  imageUrl: true,
  published: true,
  deletedAt: true,
} satisfies Prisma.ArtworkSelect;

type GameWithArtworks = MiniGame & {
  artwork: {
    id: string;
    title: string;
    imageUrl: string;
    published: boolean;
    deletedAt: Date | null;
  } | null;
  secondaryArtwork: {
    id: string;
    title: string;
    imageUrl: string;
    published: boolean;
    deletedAt: Date | null;
  } | null;
};

const GAME_INCLUDE = {
  artwork: { select: ARTWORK_SELECT },
  secondaryArtwork: { select: ARTWORK_SELECT },
} satisfies Prisma.MiniGameInclude;

/**
 * Every game type, whether or not it has been configured yet — a type with no
 * row is returned as a disabled row carrying registry defaults, so the admin
 * dashboard always lists exactly five games and the first save is an upsert.
 */
export async function loadAllGames(): Promise<GameWithArtworks[]> {
  const rows = await prisma.miniGame.findMany({ include: GAME_INCLUDE });
  const byType = new Map(rows.map((row) => [row.type as GameType, row]));

  return GAME_TYPES.map(
    (type) => byType.get(type) ?? (unsavedGameRow(type) as GameWithArtworks)
  );
}

export async function getGame(
  type: GameType
): Promise<GameWithArtworks | null> {
  return prisma.miniGame.findUnique({
    where: { type: type as MiniGameType },
    include: GAME_INCLUDE,
  });
}

/**
 * A placeholder standing in for a game type the admin has never saved. Not
 * persisted — writing five rows on first page view would be a side effect of
 * merely *looking* at the dashboard.
 */
function unsavedGameRow(type: GameType): GameWithArtworks {
  const now = new Date();
  return {
    id: "",
    type: type as MiniGameType,
    enabled: false,
    difficulty: "MEDIUM",
    artworkId: null,
    artwork: null,
    secondaryArtworkId: null,
    secondaryArtwork: null,
    timeLimitSec: 0,
    scoreMultiplier: 1,
    leaderboardEnabled: true,
    leaderboardSize: 10,
    rewardEnabled: false,
    rewardThreshold: 0,
    rewardDescription: null,
    rewardRequireEmail: true,
    differences: [],
    createdAt: now,
    updatedAt: now,
  } as unknown as GameWithArtworks;
}

/** Hotspots as a typed array — the column is Json, so it is re-validated on read. */
export function readDifferences(
  game: Pick<MiniGame, "differences">
): DifferenceRegion[] {
  return sanitizeDifferenceRegions(game.differences);
}

/**
 * Why this game cannot be played right now, or null when it can.
 *
 * Configuration can go stale without anyone touching the game — unpublishing
 * or trashing an artwork is enough — so this is checked on every read and
 * again when a session is created, rather than trusted from a saved flag.
 */
export function unavailableReason(game: GameWithArtworks): string | null {
  if (!game.enabled) return "This game is currently turned off.";

  const primary = game.artwork;
  if (!primary) return "No artwork has been chosen for this game yet.";
  if (!primary.published || primary.deletedAt) {
    return "The artwork for this game is no longer available.";
  }

  if (GAME_REGISTRY[game.type as GameType].needsSecondaryArtwork) {
    const secondary = game.secondaryArtwork;
    if (!secondary)
      return "The altered artwork for this game has not been chosen yet.";
    if (!secondary.published || secondary.deletedAt) {
      return "The altered artwork for this game is no longer available.";
    }
    if (readDifferences(game).length === 0) {
      return "No differences have been marked for this game yet.";
    }
  }

  return null;
}

function toPublicArtwork(
  artwork: GameWithArtworks["artwork"]
): PublicGameArtwork | null {
  if (!artwork || !artwork.published || artwork.deletedAt) return null;
  return { id: artwork.id, title: artwork.title, imageUrl: artwork.imageUrl };
}

function toAdminArtwork(
  artwork: GameWithArtworks["artwork"]
): PublicGameArtwork | null {
  if (!artwork) return null;
  return { id: artwork.id, title: artwork.title, imageUrl: artwork.imageUrl };
}

/**
 * The games a visitor may see, with a slice of leaderboard each. Unavailable
 * games are filtered out entirely — a visitor has no use for "this is broken",
 * and the admin dashboard is where that belongs.
 */
export async function buildPublicGames(
  playerId: string | null
): Promise<PublicGame[]> {
  const games = (await loadAllGames()).filter(
    (game) => unavailableReason(game) === null
  );
  if (games.length === 0) return [];

  const gameIds = games.map((game) => game.id);

  // Two queries for the whole selector rather than two per game: the top rows
  // for every game at once, then this visitor's personal bests at once.
  const [entries, personalBests] = await Promise.all([
    prisma.leaderboardEntry.findMany({
      where: { gameId: { in: gameIds } },
      orderBy: [
        { score: "desc" },
        { completionTime: "asc" },
        { createdAt: "asc" },
      ],
      // Enough rows to fill each game's configured board even in the worst
      // case where they all belong to one game.
      take:
        Math.max(...games.map((game) => game.leaderboardSize)) * games.length,
      select: {
        id: true,
        gameId: true,
        displayName: true,
        score: true,
        completionTime: true,
        createdAt: true,
        playerId: true,
      },
    }),
    playerId
      ? prisma.leaderboardEntry.groupBy({
          by: ["gameId"],
          where: { gameId: { in: gameIds }, playerId },
          _max: { score: true },
        })
      : Promise.resolve([]),
  ]);

  const bestByGame = new Map(
    personalBests.map((row) => [row.gameId, row._max.score ?? null])
  );

  return games.map((game) => {
    const definition = GAME_REGISTRY[game.type as GameType];
    const rows = entries
      .filter((entry) => entry.gameId === game.id)
      .slice(0, game.leaderboardSize)
      .map((entry, index) => toLeaderboardRow(entry, index, playerId));

    return {
      type: game.type as GameType,
      name: definition.name,
      description: definition.description,
      icon: definition.icon,
      enabled: game.enabled,
      difficulty: game.difficulty as Difficulty,
      timeLimitSec: game.timeLimitSec,
      leaderboardEnabled: game.leaderboardEnabled,
      rewardEnabled: game.rewardEnabled,
      rewardThreshold: game.rewardThreshold,
      rewardDescription: game.rewardDescription,
      rewardRequireEmail: game.rewardRequireEmail,
      artwork: toPublicArtwork(game.artwork),
      secondaryArtwork: toPublicArtwork(game.secondaryArtwork),
      topScores: game.leaderboardEnabled ? rows : [],
      bestScore: bestByGame.get(game.id) ?? null,
      unavailableReason: null,
    };
  });
}

/**
 * Every game type with its full configuration and a usage summary.
 *
 * Shared by the admin page (which server-renders the first paint) and
 * GET /api/minigames/config (which the client re-reads after each mutation),
 * so the two can never disagree about what a game's settings are.
 */
export async function buildAdminGames(): Promise<AdminGameConfig[]> {
  const games = await loadAllGames();
  const savedIds = games.map((game) => game.id).filter(Boolean);

  // Four aggregates for the whole dashboard rather than four per game.
  const [sessionCounts, completionCounts, entryStats, claimCounts] =
    await Promise.all([
      prisma.miniGameSession.groupBy({
        by: ["gameId"],
        where: { gameId: { in: savedIds } },
        _count: { _all: true },
      }),
      prisma.miniGameSession.groupBy({
        by: ["gameId"],
        where: { gameId: { in: savedIds }, status: "COMPLETED" },
        _count: { _all: true },
      }),
      prisma.leaderboardEntry.groupBy({
        by: ["gameId"],
        where: { gameId: { in: savedIds } },
        _count: { _all: true },
        _max: { score: true },
      }),
      prisma.rewardClaim.groupBy({
        by: ["gameId"],
        where: { gameId: { in: savedIds } },
        _count: { _all: true },
      }),
    ]);

  const plays = new Map(
    sessionCounts.map((row) => [row.gameId, row._count._all])
  );
  const completions = new Map(
    completionCounts.map((row) => [row.gameId, row._count._all])
  );
  const entries = new Map(
    entryStats.map((row) => [
      row.gameId,
      { count: row._count._all, best: row._max.score },
    ])
  );
  const claims = new Map(
    claimCounts.map((row) => [row.gameId, row._count._all])
  );

  return games.map((game) => {
    const definition = GAME_REGISTRY[game.type as GameType];
    const entryStat = entries.get(game.id);
    return {
      type: game.type as GameType,
      name: definition.name,
      description: definition.description,
      howToPlay: definition.howToPlay,
      icon: definition.icon,
      needsSecondaryArtwork: definition.needsSecondaryArtwork,

      enabled: game.enabled,
      difficulty: game.difficulty as Difficulty,
      artworkId: game.artworkId,
      secondaryArtworkId: game.secondaryArtworkId,
      timeLimitSec: game.timeLimitSec,
      scoreMultiplier: game.scoreMultiplier,
      leaderboardEnabled: game.leaderboardEnabled,
      leaderboardSize: game.leaderboardSize,
      rewardEnabled: game.rewardEnabled,
      rewardThreshold: game.rewardThreshold,
      rewardDescription: game.rewardDescription,
      rewardRequireEmail: game.rewardRequireEmail,
      differences: readDifferences(game),

      // Shown whatever its published state, unlike the public projection —
      // the admin needs to see the artwork they picked in order to understand
      // the warning that it has since been unpublished.
      artwork: toAdminArtwork(game.artwork),
      secondaryArtwork: toAdminArtwork(game.secondaryArtwork),
      // Only meaningful for an enabled game: a game that is off is not
      // "broken", it is just off.
      unavailableReason: game.enabled ? unavailableReason(game) : null,
      stats: {
        plays: plays.get(game.id) ?? 0,
        completions: completions.get(game.id) ?? 0,
        entries: entryStat?.count ?? 0,
        bestScore: entryStat?.best ?? null,
        claims: claims.get(game.id) ?? 0,
      },
    };
  });
}

interface EntryRow {
  id: string;
  displayName: string;
  score: number;
  completionTime: number;
  createdAt: Date;
  playerId: string;
}

/**
 * Public projection of a leaderboard row. The `playerId` and any email are
 * dropped here — this is the only shape that reaches the browser, so there is
 * no path by which a visitor's address ends up on a public board.
 */
function toLeaderboardRow(
  entry: EntryRow,
  index: number,
  playerId: string | null
): PublicLeaderboardRow {
  return {
    id: entry.id,
    rank: index + 1,
    displayName: entry.displayName,
    score: entry.score,
    completionTime: entry.completionTime,
    createdAt: entry.createdAt.toISOString(),
    isYou: playerId !== null && entry.playerId === playerId,
  };
}

export interface LeaderboardQuery {
  gameId: string;
  artworkId?: string | null;
  limit: number;
  playerId: string | null;
}

export async function getLeaderboard({
  gameId,
  artworkId,
  limit,
  playerId,
}: LeaderboardQuery): Promise<PublicLeaderboardRow[]> {
  const entries = await prisma.leaderboardEntry.findMany({
    where: { gameId, ...(artworkId ? { artworkId } : {}) },
    orderBy: [
      { score: "desc" },
      { completionTime: "asc" },
      { createdAt: "asc" },
    ],
    take: limit,
    select: {
      id: true,
      displayName: true,
      score: true,
      completionTime: true,
      createdAt: true,
      playerId: true,
    },
  });
  return entries.map((entry, index) =>
    toLeaderboardRow(entry, index, playerId)
  );
}

/**
 * Where a score sits on the board, counting every entry that beats it. Done
 * as a count rather than by scanning the board so a player ranked #4,000 gets
 * a real number instead of "off the list".
 */
export async function rankForScore(
  gameId: string,
  score: number,
  completionTime: number
): Promise<number> {
  const better = await prisma.leaderboardEntry.count({
    where: {
      gameId,
      OR: [
        { score: { gt: score } },
        // Ties break on the faster run, matching the board's ordering.
        { score, completionTime: { lt: completionTime } },
      ],
    },
  });
  return better + 1;
}
