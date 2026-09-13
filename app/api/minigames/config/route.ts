// app/api/minigames/config/route.ts
//
// GET — every game type with its configuration and a usage summary
// PUT — save one game's configuration
//
// Both are admin-only. Nothing in this file is reachable from the public site;
// the visitor-facing projection lives in /api/minigames and deliberately omits
// everything here that isn't needed to play.
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import type { MiniGameDifficulty, MiniGameType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { GAME_REGISTRY, isGameType } from "@/lib/minigames/registry";
import { buildAdminGames } from "@/lib/minigames/server";
import {
  clampLeaderboardSize,
  clampRewardThreshold,
  clampScoreMultiplier,
  clampTimeLimit,
  sanitizeArtworkId,
  sanitizeDifficulty,
  sanitizeDifferenceRegions,
  sanitizeRewardDescription,
} from "@/lib/minigames/config";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    return NextResponse.json({ games: await buildAdminGames() });
  } catch (error) {
    console.error("[minigames] failed to load admin config", error);
    return NextResponse.json(
      { error: "Failed to load mini game settings." },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await request.json().catch(() => null);
    const type = (body as { type?: unknown } | null)?.type;
    if (!isGameType(type)) {
      return NextResponse.json({ error: "Unknown game." }, { status: 400 });
    }

    const raw = body as Record<string, unknown>;
    const definition = GAME_REGISTRY[type];

    const artworkId = sanitizeArtworkId(raw.artworkId);
    // Only Find the Difference has a second image; storing one against any
    // other game would be dead data that the next reader has to explain.
    const secondaryArtworkId = definition.needsSecondaryArtwork
      ? sanitizeArtworkId(raw.secondaryArtworkId)
      : null;

    // Both ids are checked against the table rather than trusted, so a saved
    // configuration can never point at an artwork that isn't there.
    const referenced = [artworkId, secondaryArtworkId].filter(
      (id): id is string => id !== null
    );
    if (referenced.length > 0) {
      const found = await prisma.artwork.findMany({
        where: { id: { in: referenced }, deletedAt: null },
        select: { id: true },
      });
      if (found.length !== new Set(referenced).size) {
        return NextResponse.json(
          { error: "That artwork no longer exists." },
          { status: 400 }
        );
      }
    }

    const data = {
      enabled: Boolean(raw.enabled),
      difficulty: sanitizeDifficulty(raw.difficulty) as MiniGameDifficulty,
      artworkId,
      secondaryArtworkId,
      timeLimitSec: clampTimeLimit(raw.timeLimitSec),
      scoreMultiplier: clampScoreMultiplier(raw.scoreMultiplier),
      leaderboardEnabled: Boolean(raw.leaderboardEnabled),
      leaderboardSize: clampLeaderboardSize(raw.leaderboardSize),
      rewardEnabled: Boolean(raw.rewardEnabled),
      rewardThreshold: clampRewardThreshold(raw.rewardThreshold),
      rewardDescription: sanitizeRewardDescription(raw.rewardDescription),
      rewardRequireEmail:
        raw.rewardRequireEmail === undefined
          ? true
          : Boolean(raw.rewardRequireEmail),
      // Cast because Prisma types a Json column as InputJsonValue, which an
      // interface array doesn't structurally satisfy — the value itself has
      // just been through sanitizeDifferenceRegions, so it is plain JSON.
      differences: (definition.needsSecondaryArtwork
        ? sanitizeDifferenceRegions(raw.differences)
        : []) as unknown as Prisma.InputJsonValue,
    };

    await prisma.miniGame.upsert({
      where: { type: type as MiniGameType },
      create: { type: type as MiniGameType, ...data },
      update: data,
    });

    revalidatePath("/admin/settings/minigames");
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[minigames] failed to save config", error);
    return NextResponse.json(
      { error: "Could not save these settings." },
      { status: 500 }
    );
  }
}
