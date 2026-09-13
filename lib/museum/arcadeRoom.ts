// lib/museum/arcadeRoom.ts
//
// The "Arcade Room" — the Mini Games inside the museum corridor. Same lazy-
// provision pattern as ensureServicesRoom / ensureStoriesRoom (read
// lib/museum/storiesRoom.ts first): a real MuseumRoom row (roomType "ARCADE")
// so it has its own id, floor, enabled flag, wall/floor/ceiling colors +
// textures, and can carry Museum Scene Editor placements like any other room.
//
// It is modelled on the Stories Room specifically, and shares its two
// defining traits:
//
//  1. It stays *inside* RoomsTab.tsx's reorderable list rather than being
//     pinned below it. Its displayOrder is a real value in the same 0..N
//     range as every curated room.
//  2. Its contents aren't hand-picked. syncArcadeRoomGames keeps its
//     MuseumRoomMiniGame rows mirroring every enabled + playable MiniGame —
//     turn a game on (with a valid artwork) in the Minigames module and a
//     cabinet appears here; turn it off and the cabinet goes away.
//
// Like the Stories Room, each game stands on the *floor* on its own arcade
// cabinet (cabinetPlacement.ts computes the grid) rather than hanging on the
// wall — though an admin can flip any one game to a framed wall poster in the
// Scene Editor (see lib/museum/arcadeConfig.ts).
//
// The room is never admin-creatable, never retypeable (rooms/[id]'s PATCH
// validTypes excludes ARCADE) and never deletable (that same route's DELETE
// refuses it) — RoomsTab.tsx hides the Trash button for it to match.
import { prisma } from "@/lib/prisma";
import { loadAllGames, unavailableReason } from "@/lib/minigames/server";
import {
  ARCADE_CONFIG_KIND,
  DEFAULT_ARCADE_CONFIG,
  serializeArcadeConfig,
} from "@/lib/museum/arcadeConfig";

// Distinctive enough that no admin-typed curated room name could ever slugify
// into a collision — same reasoning as SERVICES_ROOM_SLUG / STORIES_ROOM_SLUG.
const ARCADE_ROOM_SLUG = "arcade-games-room";

export async function ensureArcadeRoom() {
  const existing = await prisma.museumRoom.findFirst({ where: { roomType: "ARCADE" } });
  if (existing) return existing;

  // Lands at the end of the curated 0..N range (rooms/route.ts's POST assigns
  // displayOrder by that same count) so a museum that already has rooms gets
  // the arcade as its new last stop rather than silently jumping to the front.
  // The fixed 999_xxx orders ABOUT/FREEDOM_WALL/STAIRS use are excluded from
  // the count for exactly that reason.
  const curatedCount = await prisma.museumRoom.count({
    where: { deletedAt: null, roomType: { notIn: ["ABOUT", "FREEDOM_WALL", "STAIRS"] } },
  });

  return prisma.museumRoom.create({
    data: {
      name: "Arcade Room",
      slug: ARCADE_ROOM_SLUG,
      roomType: "ARCADE",
      description: "Play the mini games — step up to a cabinet to start a round.",
      enabled: false, // off by default — admin enables it in RoomsTab
      isEntryRoom: false,
      displayOrder: curatedCount,
    },
  });
}

/**
 * Reconciles the Arcade Room's cabinets with the playable mini games.
 *
 * "Playable" is exactly what the gallery's Mini Games launcher shows: a
 * MiniGame that is `enabled` and whose `unavailableReason` is null (a valid,
 * published primary artwork, plus a secondary artwork + marked differences for
 * Find-the-Difference). Nothing else — the room is a mirror of that selector,
 * so any extra filtering here would make the two disagree.
 *
 * Called from both the public museum page and the admin config GET, so the
 * floor is correct on the next load after any game change without the Minigames
 * module having to know this room exists. Writes only when something actually
 * differs, so the common "nothing changed" case is two reads.
 *
 * Note: turning a game off removes its row, and with it any Scene Editor
 * placement/display-mode override that row was carrying. Turning it back on
 * later brings the cabinet back at its auto-computed grid slot, not where it
 * used to stand — same trade-off, and for the same reason, as
 * syncStoriesRoomStories.
 */
export async function syncArcadeRoomGames(roomId: string) {
  const [allGames, existing] = await Promise.all([
    loadAllGames(),
    prisma.museumRoomMiniGame.findMany({
      where: { roomId },
      orderBy: { displayOrder: "asc" },
      select: { id: true, gameId: true },
    }),
  ]);

  // loadAllGames() returns every game type in launcher order, including
  // never-saved placeholder rows (id ""), so filter those out too.
  const playable = allGames.filter((g) => g.id && unavailableReason(g) === null);

  const playableIds = new Set(playable.map((g) => g.id));
  const standingIds = new Set(existing.map((e) => e.gameId));

  const toAdd = playable.filter((g) => !standingIds.has(g.id));
  const toRemove = existing.filter((e) => !playableIds.has(e.gameId));

  if (toAdd.length > 0) {
    await prisma.museumRoomMiniGame.createMany({
      data: toAdd.map((g, i) => ({
        roomId,
        gameId: g.id,
        displayOrder: existing.length + i,
      })),
      // Two concurrent requests can both decide to add the same game; the
      // [roomId, gameId] unique constraint makes the loser a no-op instead
      // of a 500.
      skipDuplicates: true,
    });
  }

  if (toRemove.length > 0) {
    await prisma.museumRoomMiniGame.deleteMany({
      where: { id: { in: toRemove.map((e) => e.id) } },
    });
  }
}

/**
 * Provisions the room's single display-mode config row (see arcadeConfig.ts)
 * so the Museum Scene Editor always has a row to attach its "Cabinets vs
 * Posters" default toggle to, rather than needing a "create it first" step.
 *
 * Provisioned holding the *default* config (CABINET) — nothing renders
 * differently until an admin actually changes it, so this is free to call on
 * every load.
 */
export async function ensureArcadeConfig(roomId: string) {
  const existing = await prisma.museumSceneObject.findFirst({
    where: { roomId, kind: ARCADE_CONFIG_KIND, deletedAt: null },
  });
  if (existing) return existing;
  return prisma.museumSceneObject.create({
    data: {
      roomId,
      kind: ARCADE_CONFIG_KIND,
      modelUrl: serializeArcadeConfig(DEFAULT_ARCADE_CONFIG),
      // Position columns are unused for this row — it's configuration, not a
      // placement (see arcadeConfig.ts's header).
      positionX: 0,
      positionY: 0,
      positionZ: 0,
      rotationY: 0,
    },
  });
}
