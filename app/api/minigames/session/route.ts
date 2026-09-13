// app/api/minigames/session/route.ts
//
// POST /api/minigames/session — start a round.
//
// This is where the server takes ownership of the round: it generates the
// puzzle, writes it to MiniGameSession along with the start time, and hands
// the browser a copy to render. Everything the submit route later checks is
// derived from this row, not from whatever the browser reports back.
import { NextRequest, NextResponse } from "next/server";
import type { MiniGameDifficulty, MiniGameType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createChallenge } from "@/lib/minigames/challenge";
import { ensurePlayerId } from "@/lib/minigames/player";
import {
  clientIp,
  LIMITS,
  rateLimit,
  tooManyRequests,
} from "@/lib/minigames/rate-limit";
import {
  getGame,
  readDifferences,
  unavailableReason,
} from "@/lib/minigames/server";
import { isGameType } from "@/lib/minigames/registry";
import type { Difficulty, StartGameResponse } from "@/lib/minigames/types";

export const dynamic = "force-dynamic";

/** How long an untimed round may stay open before it stops being scoreable. */
const DEFAULT_TTL_MS = 30 * 60 * 1000;

/**
 * Slack on top of a configured time limit, covering the gap between the last
 * move and the request landing (animation, a slow network, a backgrounded
 * tab). Generous enough not to punish a legitimate finish, far too small to
 * be useful for solving the puzzle by other means.
 */
const SUBMIT_GRACE_MS = 15 * 1000;

export async function POST(request: NextRequest) {
  const limit = rateLimit(
    `mg:start:${clientIp(request)}`,
    LIMITS.startSession.limit,
    LIMITS.startSession.windowMs
  );
  if (!limit.ok) return tooManyRequests(limit.retryAfterSec);

  try {
    const body = await request.json().catch(() => null);
    const type = (body as { type?: unknown } | null)?.type;
    if (!isGameType(type)) {
      return NextResponse.json({ error: "Unknown game." }, { status: 400 });
    }

    const game = await getGame(type);
    // Re-checked here rather than trusted from the selector payload: the
    // admin may have turned the game off or unpublished its artwork in the
    // seconds since the visitor opened the menu.
    if (!game) {
      return NextResponse.json(
        { error: "This game is not available yet." },
        { status: 409 }
      );
    }
    const blocked = unavailableReason(game);
    if (blocked) {
      return NextResponse.json({ error: blocked }, { status: 409 });
    }

    const playerId = await ensurePlayerId();
    const difficulty = game.difficulty as Difficulty;
    const challenge = createChallenge({
      type,
      difficulty,
      regions: readDifferences(game),
    });

    const now = Date.now();
    const ttlMs =
      game.timeLimitSec > 0
        ? game.timeLimitSec * 1000 + SUBMIT_GRACE_MS
        : DEFAULT_TTL_MS;

    const session = await prisma.miniGameSession.create({
      data: {
        gameId: game.id,
        type: type as MiniGameType,
        difficulty: difficulty as MiniGameDifficulty,
        playerId,
        artworkId: game.artworkId,
        challenge: challenge as unknown as object,
        status: "IN_PROGRESS",
        startedAt: new Date(now),
        expiresAt: new Date(now + ttlMs),
      },
      select: { id: true, startedAt: true, expiresAt: true },
    });

    const payload: StartGameResponse = {
      sessionId: session.id,
      type,
      difficulty,
      timeLimitSec: game.timeLimitSec,
      expiresAt: session.expiresAt.toISOString(),
      challenge,
      artwork: game.artwork
        ? {
            id: game.artwork.id,
            title: game.artwork.title,
            imageUrl: game.artwork.imageUrl,
          }
        : null,
      secondaryArtwork: game.secondaryArtwork
        ? {
            id: game.secondaryArtwork.id,
            title: game.secondaryArtwork.title,
            imageUrl: game.secondaryArtwork.imageUrl,
          }
        : null,
    };

    return NextResponse.json(payload, { status: 201 });
  } catch (error) {
    console.error("[minigames] failed to start session", error);
    return NextResponse.json(
      { error: "Could not start the game." },
      { status: 500 }
    );
  }
}
