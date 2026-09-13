// app/api/minigames/entries/route.ts
//
// GET — leaderboard rows for the admin's moderation table, with the filters
// that table offers (game, artwork, player name). Admin only.
//
// Reward claims are joined in so the admin can see, on one row, that a score
// also produced a claim — but the email itself only travels with the claim,
// never with a leaderboard row.
import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { GAME_REGISTRY, isGameType } from "@/lib/minigames/registry";
import { sanitizeArtworkId } from "@/lib/minigames/config";
import type {
  AdminLeaderboardRow,
  Difficulty,
  GameType,
} from "@/lib/minigames/types";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;
const MAX_SEARCH_LENGTH = 40;

export async function GET(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const params = request.nextUrl.searchParams;
    const type = params.get("type");
    const artworkId = sanitizeArtworkId(params.get("artworkId"));
    const search = (params.get("q") ?? "").trim().slice(0, MAX_SEARCH_LENGTH);
    const page = Math.max(0, parseInt(params.get("page") ?? "0", 10) || 0);

    const where: Prisma.LeaderboardEntryWhereInput = {
      ...(isGameType(type) ? { type } : {}),
      ...(artworkId ? { artworkId } : {}),
      ...(search
        ? { displayName: { contains: search, mode: "insensitive" } }
        : {}),
    };

    const [total, rows] = await Promise.all([
      prisma.leaderboardEntry.count({ where }),
      prisma.leaderboardEntry.findMany({
        where,
        orderBy: [{ createdAt: "desc" }],
        skip: page * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          type: true,
          displayName: true,
          score: true,
          completionTime: true,
          moves: true,
          difficulty: true,
          createdAt: true,
          artwork: { select: { id: true, title: true } },
          session: {
            select: {
              claim: {
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
              },
            },
          },
        },
      }),
    ]);

    const entries: AdminLeaderboardRow[] = rows.map((row) => {
      const claim = row.session?.claim ?? null;
      return {
        id: row.id,
        type: row.type as GameType,
        gameName: GAME_REGISTRY[row.type as GameType].name,
        displayName: row.displayName,
        score: row.score,
        completionTime: row.completionTime,
        moves: row.moves,
        difficulty: row.difficulty as Difficulty,
        createdAt: row.createdAt.toISOString(),
        artwork: row.artwork,
        claim: claim
          ? {
              id: claim.id,
              displayName: claim.displayName,
              email: claim.email,
              score: claim.score,
              threshold: claim.threshold,
              reward: claim.reward,
              artworkTitle: claim.artworkTitle,
              status: claim.status,
              notifiedAt: claim.notifiedAt?.toISOString() ?? null,
              createdAt: claim.createdAt.toISOString(),
              gameType: claim.game.type as GameType,
              gameName: GAME_REGISTRY[claim.game.type as GameType].name,
            }
          : null,
      };
    });

    return NextResponse.json({
      entries,
      total,
      page,
      pageSize: PAGE_SIZE,
      hasMore: (page + 1) * PAGE_SIZE < total,
    });
  } catch (error) {
    console.error("[minigames] failed to load admin entries", error);
    return NextResponse.json(
      { error: "Failed to load leaderboard entries." },
      { status: 500 }
    );
  }
}
