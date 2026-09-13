// app/api/minigames/reward/route.ts
//
// POST /api/minigames/reward — claim a reward the player has already earned.
//
// Eligibility is recomputed here from the score stored on the session row.
// The submit response told the browser it qualified, but that response is not
// evidence — a caller who posts straight to this route with a session that
// never cleared the threshold is turned away just the same.
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { readPlayerId } from "@/lib/minigames/player";
import {
  clientIp,
  LIMITS,
  rateLimit,
  tooManyRequests,
} from "@/lib/minigames/rate-limit";
import { sanitizeDisplayName, sanitizeEmail } from "@/lib/minigames/config";
import { notifyAdminOfReward, notifyPlayerOfRewardClaim } from "@/lib/minigames/notify";
import { GAME_REGISTRY } from "@/lib/minigames/registry";
import type { GameType } from "@/lib/minigames/types";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const limit = rateLimit(
    `mg:reward:${clientIp(request)}`,
    LIMITS.claimReward.limit,
    LIMITS.claimReward.windowMs
  );
  if (!limit.ok) return tooManyRequests(limit.retryAfterSec);

  try {
    const body = (await request.json().catch(() => null)) as {
      sessionId?: unknown;
      displayName?: unknown;
      email?: unknown;
    } | null;

    const sessionId =
      typeof body?.sessionId === "string" ? body.sessionId : null;
    if (!sessionId) {
      return NextResponse.json(
        { error: "Malformed request." },
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
      include: {
        game: { include: { artwork: { select: { title: true } } } },
        claim: true,
        entry: true,
      },
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
    // One claim per session — the unique index enforces it, this makes the
    // second attempt a clear message rather than a database error.
    if (session.claim) {
      return NextResponse.json(
        { error: "A reward has already been claimed for this round." },
        { status: 409 }
      );
    }

    const game = session.game;
    if (!game.rewardEnabled) {
      return NextResponse.json(
        { error: "There is no reward on this game right now." },
        { status: 409 }
      );
    }
    if (session.score < game.rewardThreshold) {
      return NextResponse.json(
        { error: "That score did not reach the reward target." },
        { status: 409 }
      );
    }

    const email = sanitizeEmail(body?.email);
    if (game.rewardRequireEmail && !email) {
      return NextResponse.json(
        { error: "Please enter a valid email address to claim your reward." },
        { status: 400 }
      );
    }
    if (!email) {
      return NextResponse.json(
        { error: "An email address is needed so the reward can reach you." },
        { status: 400 }
      );
    }

    const displayName =
      session.entry?.displayName ??
      sanitizeDisplayName(body?.displayName) ??
      "Anonymous";
    const reward = game.rewardDescription ?? "Reward";

    const claim = await prisma.rewardClaim.create({
      data: {
        gameId: game.id,
        sessionId: session.id,
        playerId,
        displayName,
        email,
        score: session.score,
        threshold: game.rewardThreshold,
        reward,
        artworkTitle: game.artwork?.title ?? null,
      },
      select: { id: true, createdAt: true },
    });

    // The claim is saved before either notification is attempted, so a mail
    // outage costs an alert/receipt, never the player's reward. Sent
    // concurrently — the admin alert and the player's receipt don't depend
    // on each other.
    const [notified] = await Promise.all([
      notifyAdminOfReward({
        gameName: GAME_REGISTRY[game.type as GameType].name,
        displayName,
        email,
        score: session.score,
        threshold: game.rewardThreshold,
        reward,
        artworkTitle: game.artwork?.title ?? null,
        occurredAt: claim.createdAt,
      }),
      notifyPlayerOfRewardClaim({
        to: email,
        displayName,
        gameName: GAME_REGISTRY[game.type as GameType].name,
        score: session.score,
        reward,
      }),
    ]);

    if (notified) {
      await prisma.rewardClaim.update({
        where: { id: claim.id },
        data: { notifiedAt: new Date() },
      });
    }

    revalidatePath("/admin/settings/minigames");
    return NextResponse.json({ claimed: true, reward }, { status: 201 });
  } catch (error) {
    console.error("[minigames] failed to record reward claim", error);
    return NextResponse.json(
      { error: "Could not record your reward claim." },
      { status: 500 }
    );
  }
}
