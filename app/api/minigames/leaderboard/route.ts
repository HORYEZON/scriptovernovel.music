// app/api/minigames/leaderboard/route.ts
//
// GET    — public board for one game (optionally filtered to one artwork)
// POST   — put an already-validated result on the board under a display name
// DELETE — admin-only reset of one game's board
//
// Note what POST does *not* do: it never takes a score. Scoring happened in
// /api/minigames/submit and was written to the session row; this route only
// attaches a name to that stored result. A caller who skips submit has
// nothing to name.
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import type { MiniGameDifficulty, MiniGameType } from "@prisma/client";
import type { GameType } from "@/lib/minigames/types";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { readPlayerId } from "@/lib/minigames/player";
import {
  clientIp,
  LIMITS,
  rateLimit,
  tooManyRequests,
} from "@/lib/minigames/rate-limit";
import { getGame, getLeaderboard, rankForScore } from "@/lib/minigames/server";
import { isGameType } from "@/lib/minigames/registry";
import { notifyAdminOfNewHighscore } from "@/lib/notifications/highscore";
import {
  sanitizeArtworkId,
  sanitizeDisplayName,
  MAX_LEADERBOARD_SIZE,
} from "@/lib/minigames/config";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const limit = rateLimit(
    `mg:board:${clientIp(request)}`,
    LIMITS.readLeaderboard.limit,
    LIMITS.readLeaderboard.windowMs
  );
  if (!limit.ok) return tooManyRequests(limit.retryAfterSec);

  try {
    const params = request.nextUrl.searchParams;
    const type = params.get("type");
    if (!isGameType(type)) {
      return NextResponse.json({ error: "Unknown game." }, { status: 400 });
    }

    const game = await getGame(type);
    if (!game) return NextResponse.json({ entries: [] });

    const requested = parseInt(params.get("limit") ?? "", 10);
    const take = Number.isFinite(requested)
      ? Math.min(MAX_LEADERBOARD_SIZE, Math.max(1, requested))
      : game.leaderboardSize;

    const playerId = await readPlayerId();
    const entries = await getLeaderboard({
      gameId: game.id,
      artworkId: sanitizeArtworkId(params.get("artworkId")),
      limit: take,
      playerId,
    });

    return NextResponse.json({ entries });
  } catch (error) {
    console.error("[minigames] failed to read leaderboard", error);
    return NextResponse.json(
      { error: "Failed to load the leaderboard." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const limit = rateLimit(
    `mg:enter:${clientIp(request)}`,
    LIMITS.submitScore.limit,
    LIMITS.submitScore.windowMs
  );
  if (!limit.ok) return tooManyRequests(limit.retryAfterSec);

  try {
    const body = (await request.json().catch(() => null)) as {
      sessionId?: unknown;
      displayName?: unknown;
    } | null;

    const sessionId =
      typeof body?.sessionId === "string" ? body.sessionId : null;
    const displayName = sanitizeDisplayName(body?.displayName);

    if (!sessionId) {
      return NextResponse.json(
        { error: "Malformed request." },
        { status: 400 }
      );
    }
    if (!displayName) {
      return NextResponse.json(
        { error: "Please enter a name between 2 and 20 characters." },
        { status: 400 }
      );
    }

    const playerId = await readPlayerId();
    if (!playerId) {
      return NextResponse.json(
        { error: "This round has expired." },
        { status: 400 }
      );
    }

    const session = await prisma.miniGameSession.findUnique({
      where: { id: sessionId },
      include: { game: true, entry: true },
    });

    if (!session || session.playerId !== playerId) {
      return NextResponse.json(
        { error: "This round no longer exists." },
        { status: 404 }
      );
    }
    if (session.status !== "COMPLETED" || session.score === null) {
      return NextResponse.json(
        { error: "This round has not been completed yet." },
        { status: 409 }
      );
    }
    // The unique index on LeaderboardEntry.sessionId is the real guarantee;
    // this just turns the race into a friendly message instead of a 500.
    if (session.entry) {
      return NextResponse.json(
        { error: "This round is already on the leaderboard." },
        { status: 409 }
      );
    }
    if (!session.game.leaderboardEnabled) {
      return NextResponse.json(
        { error: "The leaderboard is turned off for this game." },
        { status: 409 }
      );
    }

    const completionTime = session.durationMs ?? 0;

    await prisma.leaderboardEntry.create({
      data: {
        gameId: session.gameId,
        type: session.type as MiniGameType,
        sessionId: session.id,
        artworkId: session.artworkId,
        playerId,
        displayName,
        // Straight off the session row the server wrote — the request body
        // has no say in any of these three.
        score: session.score,
        completionTime,
        moves: session.moves ?? 0,
        difficulty: session.difficulty as MiniGameDifficulty,
      },
    });

    const [rank, entries] = await Promise.all([
      rankForScore(session.gameId, session.score, completionTime),
      getLeaderboard({
        gameId: session.gameId,
        limit: session.game.leaderboardSize,
        playerId,
      }),
    ]);

    // rank 1 means this entry beat every prior row for the game — a genuine
    // new all-time highscore, not just a top-10 finish. Fire-and-forget: a
    // notification hiccup must never turn a saved score into an error
    // response.
    if (rank === 1) {
      notifyAdminOfNewHighscore({
        gameId: session.gameId,
        gameType: session.type as GameType,
        displayName,
        score: session.score,
      }).catch((err) => {
        console.error("[minigames] failed to notify admin of new highscore", err);
      });
    }

    revalidatePath("/admin/settings/minigames");
    return NextResponse.json({ rank, entries }, { status: 201 });
  } catch (error) {
    console.error("[minigames] failed to save leaderboard entry", error);
    return NextResponse.json(
      { error: "Could not save your score." },
      { status: 500 }
    );
  }
}

// Reset one game's board. Admin only, and the confirmation lives in the UI —
// this route assumes the caller meant it.
export async function DELETE(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const type = request.nextUrl.searchParams.get("type");
    if (!isGameType(type)) {
      return NextResponse.json({ error: "Unknown game." }, { status: 400 });
    }

    const game = await getGame(type);
    if (!game) return NextResponse.json({ deleted: 0 });

    const { count } = await prisma.leaderboardEntry.deleteMany({
      where: { gameId: game.id },
    });

    revalidatePath("/admin/settings/minigames");
    return NextResponse.json({ deleted: count });
  } catch (error) {
    console.error("[minigames] failed to reset leaderboard", error);
    return NextResponse.json(
      { error: "Could not reset the leaderboard." },
      { status: 500 }
    );
  }
}
