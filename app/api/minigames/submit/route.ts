// app/api/minigames/submit/route.ts
//
// POST /api/minigames/submit — finish a round.
//
// The request body carries what the player *did* (their move log), never what
// they scored. The server replays those moves against the challenge it stored
// when the session was created, measures the elapsed time from its own clock,
// and computes the score itself. There is no code path here that reads a
// score, a duration or a move count out of the request.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySolution } from "@/lib/minigames/verify";
import { computeScore } from "@/lib/minigames/scoring";
import { readPlayerId } from "@/lib/minigames/player";
import {
  clientIp,
  LIMITS,
  rateLimit,
  tooManyRequests,
} from "@/lib/minigames/rate-limit";
import { getLeaderboard, rankForScore } from "@/lib/minigames/server";
import type {
  Difficulty,
  GameChallenge,
  GameMoves,
  GameType,
  SubmitResultResponse,
} from "@/lib/minigames/types";

export const dynamic = "force-dynamic";

/** Matches the grace the session route builds into expiresAt. */
const SUBMIT_GRACE_MS = 15 * 1000;

export async function POST(request: NextRequest) {
  const limit = rateLimit(
    `mg:submit:${clientIp(request)}`,
    LIMITS.submitScore.limit,
    LIMITS.submitScore.windowMs
  );
  if (!limit.ok) return tooManyRequests(limit.retryAfterSec);

  try {
    const body = (await request.json().catch(() => null)) as {
      sessionId?: unknown;
      moves?: unknown;
    } | null;

    const sessionId =
      typeof body?.sessionId === "string" ? body.sessionId : null;
    const moves = body?.moves as GameMoves | undefined;
    if (
      !sessionId ||
      !moves ||
      typeof moves !== "object" ||
      !("kind" in moves)
    ) {
      return NextResponse.json({ error: "Malformed result." }, { status: 400 });
    }

    const playerId = await readPlayerId();
    if (!playerId) {
      return NextResponse.json(
        { error: "This round has expired. Please start a new game." },
        { status: 400 }
      );
    }

    const session = await prisma.miniGameSession.findUnique({
      where: { id: sessionId },
      include: { game: true },
    });

    if (!session) {
      return NextResponse.json(
        { error: "This round no longer exists." },
        { status: 404 }
      );
    }
    // A session belongs to the browser that started it. Without this, a
    // sessionId scraped from someone else's traffic would be replayable.
    if (session.playerId !== playerId) {
      return NextResponse.json(
        { error: "This round belongs to another player." },
        { status: 403 }
      );
    }

    if (session.status === "COMPLETED") {
      return NextResponse.json(
        { error: "This round has already been submitted." },
        { status: 409 }
      );
    }
    if (session.status === "REJECTED" || session.status === "EXPIRED") {
      return NextResponse.json(
        { error: "This round is no longer playable. Please start a new game." },
        { status: 409 }
      );
    }

    const now = Date.now();
    const startedAt = session.startedAt.getTime();
    const elapsedMs = now - startedAt;

    const overTimeLimit =
      session.game.timeLimitSec > 0 &&
      elapsedMs > session.game.timeLimitSec * 1000 + SUBMIT_GRACE_MS;

    if (now > session.expiresAt.getTime() || overTimeLimit) {
      await prisma.miniGameSession.update({
        where: { id: session.id },
        data: { status: "EXPIRED" },
      });
      return NextResponse.json(
        { error: "Time ran out on this round. Please start a new game." },
        { status: 410 }
      );
    }

    // ── The actual check: do these moves solve the puzzle we issued? ──
    const challenge = session.challenge as unknown as GameChallenge;
    const verification = verifySolution(challenge, moves);

    if (!verification.ok) {
      // Burn the session rather than letting a caller retry the same round
      // with a different move log until something is accepted.
      await prisma.miniGameSession.update({
        where: { id: session.id },
        data: { status: "REJECTED" },
      });
      return NextResponse.json(
        { error: verification.reason ?? "That result could not be verified." },
        { status: 422 }
      );
    }

    const scoring = computeScore({
      type: session.type as GameType,
      difficulty: session.difficulty as Difficulty,
      scoreMultiplier: session.game.scoreMultiplier,
      elapsedMs,
      moves: verification.moves,
      stats: verification.stats,
    });

    // A valid solution submitted faster than a human could physically make
    // the moves is a script, not a player — move replay alone cannot tell
    // those apart, but the clock can.
    if (elapsedMs < scoring.minPlausibleMs) {
      await prisma.miniGameSession.update({
        where: { id: session.id },
        data: { status: "REJECTED" },
      });
      return NextResponse.json(
        {
          error:
            "That round was completed impossibly fast and could not be recorded.",
        },
        { status: 422 }
      );
    }

    await prisma.miniGameSession.update({
      where: { id: session.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(now),
        score: scoring.score,
        moves: verification.moves,
        durationMs: elapsedMs,
      },
    });

    const [rank, leaderboard] = await Promise.all([
      session.game.leaderboardEnabled
        ? rankForScore(session.gameId, scoring.score, elapsedMs)
        : Promise.resolve(null),
      session.game.leaderboardEnabled
        ? getLeaderboard({
            gameId: session.gameId,
            limit: session.game.leaderboardSize,
            playerId,
          })
        : Promise.resolve([]),
    ]);

    const payload: SubmitResultResponse = {
      accepted: true,
      score: scoring.score,
      maxScore: scoring.maxScore,
      moves: verification.moves,
      durationMs: elapsedMs,
      rank,
      leaderboard,
      leaderboardEnabled: session.game.leaderboardEnabled,
      reward: {
        // Eligibility is decided here, from the server's own score — the
        // reward route recomputes it rather than trusting this response.
        eligible:
          session.game.rewardEnabled &&
          scoring.score >= session.game.rewardThreshold,
        threshold: session.game.rewardThreshold,
        description: session.game.rewardDescription,
        requireEmail: session.game.rewardRequireEmail,
        claimed: false,
      },
    };

    return NextResponse.json(payload);
  } catch (error) {
    console.error("[minigames] failed to submit result", error);
    return NextResponse.json(
      { error: "Could not save that result." },
      { status: 500 }
    );
  }
}
