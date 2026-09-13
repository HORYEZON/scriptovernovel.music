// app/api/minigames/claims/route.ts
//
// GET — reward claims. Admin only, and deliberately its own endpoint: this is
// the only payload in the mini-game system that carries a visitor's email
// address, so it never rides along with a public response by accident.
import { NextRequest, NextResponse } from "next/server";
import type { Prisma, RewardClaimStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { GAME_REGISTRY, isGameType } from "@/lib/minigames/registry";
import type { AdminRewardClaim, GameType } from "@/lib/minigames/types";

export const dynamic = "force-dynamic";

const CLAIM_STATUSES: RewardClaimStatus[] = [
  "PENDING",
  "FULFILLED",
  "REJECTED",
];
const TAKE = 100;

export async function GET(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const params = request.nextUrl.searchParams;
    const status = params.get("status");
    const type = params.get("type");

    const where: Prisma.RewardClaimWhereInput = {
      ...(status && CLAIM_STATUSES.includes(status as RewardClaimStatus)
        ? { status: status as RewardClaimStatus }
        : {}),
      ...(isGameType(type) ? { game: { type } } : {}),
    };

    const rows = await prisma.rewardClaim.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: TAKE,
      select: {
        id: true,
        displayName: true,
        email: true,
        score: true,
        threshold: true,
        reward: true,
        artworkTitle: true,
        status: true,
        notifiedAt: true,
        createdAt: true,
        game: { select: { type: true } },
      },
    });

    const claims: AdminRewardClaim[] = rows.map((row) => ({
      id: row.id,
      displayName: row.displayName,
      email: row.email,
      score: row.score,
      threshold: row.threshold,
      reward: row.reward,
      artworkTitle: row.artworkTitle,
      status: row.status,
      notifiedAt: row.notifiedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      gameType: row.game.type as GameType,
      gameName: GAME_REGISTRY[row.game.type as GameType].name,
    }));

    return NextResponse.json({ claims });
  } catch (error) {
    console.error("[minigames] failed to load reward claims", error);
    return NextResponse.json(
      { error: "Failed to load reward claims." },
      { status: 500 }
    );
  }
}
