// app/api/minigames/route.ts
//
// GET /api/minigames — what the public gallery's mini-game selector renders.
// Fetched when the selector opens, not polled: see the caching notes in
// components/public/minigames/MiniGamesLauncher.tsx.
import { NextResponse } from "next/server";
import { buildPublicGames } from "@/lib/minigames/server";
import { readPlayerId } from "@/lib/minigames/player";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Read-only: a visitor who has never played gets null here and simply
    // sees no personal bests, rather than being issued a tracking cookie for
    // merely opening the menu.
    const playerId = await readPlayerId();
    const games = await buildPublicGames(playerId);
    return NextResponse.json({ games });
  } catch (error) {
    console.error("[minigames] failed to load public games", error);
    return NextResponse.json(
      { error: "Failed to load mini games." },
      { status: 500 }
    );
  }
}
