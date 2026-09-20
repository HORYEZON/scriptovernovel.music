// app/(admin)/admin/minigames/page.tsx
//
// Standalone Minigames module. Was a tab on /admin/artworks until the
// Artworks page was trimmed down to just Artworks / Sections.
import type { Metadata } from "next";
import { Gamepad2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminGoToMenu } from "@/components/admin/AdminGoToMenu";
import { buildAdminGames } from "@/lib/minigames/server";
import {
  getMuseumRoomStatus,
  museumEditorLink,
  museumRoomLink,
} from "@/lib/museum/roomStatus";
import { MiniGamesClient } from "../artworks/minigames/MiniGamesClient";

export const metadata: Metadata = { title: "Minigames" };
export const dynamic = "force-dynamic";

export default async function AdminMinigamesPage() {
  const [games, gameArtworks, museumRooms] = await Promise.all([
    buildAdminGames().catch(() => []),
    prisma.artwork
      .findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        select: { id: true, title: true, imageUrl: true, published: true },
      })
      .catch(() => []),
    getMuseumRoomStatus(),
  ]);

  return (
    <div>
      <AdminPageHeader
        title="Minigames"
        description="Puzzle games, leaderboards and reward claims for the public site."
        action={
          <AdminGoToMenu
            links={[
              {
                label: "Minigames Page",
                href: "/?minigames=open",
              },
              museumRoomLink(museumRooms, "arcade", "Digital Museum / Arcade Room"),
              museumEditorLink(museumRooms, "arcade", "Scene Editor / Arcade Room"),
            ]}
            icon={<Gamepad2 size={16} />}
          />
        }
      />
      <MiniGamesClient initialGames={games} artworks={gameArtworks} />
    </div>
  );
}
