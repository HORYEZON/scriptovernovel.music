// components/public/home/MuseumBlock.tsx
//
// The homepage's door into the Digital Museum, with the Mini Games launcher
// beside it — the two things the old gallery header carried. Each half
// renders only when it has something behind it (an enabled museum with
// published artworks; at least one playable game), and the whole block
// disappears when neither does.
import { prisma } from "@/lib/prisma";
import { buildPublicGames } from "@/lib/minigames/server";
import { readPlayerId } from "@/lib/minigames/player";
import { SectionHeading } from "@/components/public/system/SectionHeading";
import { GlassPanel } from "@/components/public/system/GlassPanel";
import { Reveal } from "@/components/public/system/Reveal";
import { GoToMuseumButton } from "@/components/public/GoToMuseumButton";
import { MiniGamesLauncher } from "@/components/public/minigames/MiniGamesLauncher";

async function museumOpen(): Promise<boolean> {
  try {
    const [museum, count] = await Promise.all([
      prisma.digitalMuseum.findUnique({ where: { id: "singleton" }, select: { enabled: true } }),
      // Artworks live under enabled rooms — count across them so a museum
      // whose rooms are all disabled or empty keeps the door shut.
      prisma.museumRoomArtwork.count({
        where: { room: { enabled: true, deletedAt: null }, artwork: { published: true, deletedAt: null } },
      }),
    ]);
    return Boolean(museum?.enabled) && count > 0;
  } catch {
    return false;
  }
}

export async function MuseumBlock() {
  const [open, games] = await Promise.all([
    museumOpen(),
    readPlayerId()
      .then((playerId) => buildPublicGames(playerId))
      .catch(() => []),
  ]);
  const hasGames = games.length > 0;
  if (!open && !hasGames) return null;

  return (
    <Reveal as="section" className="section-padding">
      <div className={`grid grid-cols-1 gap-6 ${open && hasGames ? "md:grid-cols-2" : ""}`}>
        {open && (
          <GlassPanel padding="page" className="flex flex-col justify-between overflow-hidden">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-emerald-400/10 blur-3xl"
            />
            <SectionHeading
              eyebrow="Digital Museum"
              title="Walk the rooms"
              description="A first-person gallery of our art, artwork and ephemera — wander it, find the arcade, sign the wall."
              className="mb-6"
            />
            <div>
              <GoToMuseumButton />
            </div>
          </GlassPanel>
        )}
        {hasGames && (
          <GlassPanel padding="page" className="flex flex-col justify-between overflow-hidden">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -left-24 -bottom-24 h-72 w-72 rounded-full bg-vermillion/10 blur-3xl"
            />
            <SectionHeading
              eyebrow="Arcade"
              title="Mini games"
              description="Quick rounds built from the band's own covers and art. Leaderboards, and the odd reward."
              className="mb-6"
            />
            <div>
              <MiniGamesLauncher initialGames={games} />
            </div>
          </GlassPanel>
        )}
      </div>
    </Reveal>
  );
}
