// lib/museum/cosplayRoom.ts
//
// The "Cosplay Room" — costume photography inside the museum corridor. Same
// lazy-provision pattern as ensureStoriesRoom/ensureArcadeRoom/
// ensureServicesRoom: a real MuseumRoom row (roomType "COSPLAY") so it has its
// own id, floor, enabled flag, wall/floor/ceiling colors + textures, and can
// carry Museum Scene Editor placements like any other room.
//
// It is modelled on the Stories Room specifically (lib/museum/storiesRoom.ts —
// read that first), and shares its two defining traits:
//
//  1. It stays *inside* RoomsTab.tsx's reorderable list rather than being
//     pinned below it. Its displayOrder is a real value in the same 0..N range
//     as every curated room, so the admin moves it up and down the corridor
//     with the same arrows.
//  2. Its contents aren't hand-picked. syncCosplayRoomEntries keeps its
//     MuseumRoomCosplay rows mirroring every published Cosplay — publish one in
//     the Cosplays module and a standee appears here; unpublish or delete it and
//     the standee goes away.
//
// Where it differs from the Stories Room: each entry is a *pair* rather than a
// single object. A life-size standee stands on the floor and that cosplay's
// second photo hangs on a backdrop panel right behind it — one MuseumRoomCosplay
// placement moves both, because a standee and the photo it stands in front of
// only make sense together. The auto layout stands each pair against a wall
// (standeePlacement.ts) rather than out in floor bays the way podiums sit,
// since a hung photo wants a wall behind it.
//
// The room is never admin-creatable, never retypeable (rooms/[id]'s PATCH
// validTypes excludes COSPLAY) and never deletable (that same route's DELETE
// refuses it) — RoomsTab.tsx hides the Trash button for it to match.
import { prisma } from "@/lib/prisma";
import {
  COSPLAY_STANDEE_MODEL_KIND,
  DEFAULT_COSPLAY_STANDEE_CONFIG,
  serializeCosplayStandeeConfig,
} from "@/lib/museum/cosplayStandee";

// Distinctive enough that no admin-typed curated room name could ever slugify
// into a collision — same reasoning as STORIES_ROOM_SLUG / ARCADE_ROOM_SLUG.
const COSPLAY_ROOM_SLUG = "cosplay-standee-room";

export async function ensureCosplayRoom() {
  const existing = await prisma.museumRoom.findFirst({ where: { roomType: "COSPLAY" } });
  if (existing) return existing;

  // Lands at the end of the curated 0..N range (rooms/route.ts's POST assigns
  // displayOrder by that same count) so a museum that already has rooms gets
  // the cosplay room as its new last stop rather than silently jumping to the
  // front. The fixed 999_xxx orders ABOUT/FREEDOM_WALL/STAIRS use are excluded
  // from the count for exactly that reason.
  const curatedCount = await prisma.museumRoom.count({
    where: { deletedAt: null, roomType: { notIn: ["ABOUT", "FREEDOM_WALL", "STAIRS"] } },
  });

  return prisma.museumRoom.create({
    data: {
      name: "Cosplay Room",
      slug: COSPLAY_ROOM_SLUG,
      roomType: "COSPLAY",
      description: "Costumes brought to life — walk up to a standee for the story behind the shot.",
      enabled: false, // off by default — admin enables it in RoomsTab
      isEntryRoom: false,
      displayOrder: curatedCount,
    },
  });
}

/**
 * Reconciles the Cosplay Room's standees with the published Cosplays module.
 *
 * "Published" means exactly what the admin's Published toggle says: a Cosplay
 * that is `published` and not soft-deleted. Nothing else — the room is a mirror
 * of that list, so any extra filtering here would make the two disagree.
 *
 * Called from both the public museum page and the admin config GET, so the
 * floor is correct on the next load after any cosplay change without needing
 * CosplaysClient.tsx to know this room exists. Writes only when something
 * actually differs, so the common "nothing changed" case is two reads.
 *
 * Note: unpublishing a cosplay removes its row, and with it any Scene Editor
 * placement that row was carrying. Re-publishing it later brings the standee
 * back at its auto-computed wall slot, not where it used to stand. Keeping
 * orphaned rows around to preserve that would mean carrying standees the module
 * no longer has, which is the worse of the two — same trade-off, and for the
 * same reason, as syncStoriesRoomStories.
 */
export async function syncCosplayRoomEntries(roomId: string) {
  const [publishedCosplays, existing] = await Promise.all([
    prisma.cosplay.findMany({
      where: { published: true, deletedAt: null },
      // Matches the admin list's own ordering so standee displayOrder (and with
      // it the auto-computed wall slots) walks the room in the same sequence
      // the admin arranged them in.
      orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
      select: { id: true },
    }),
    prisma.museumRoomCosplay.findMany({
      where: { roomId },
      orderBy: { displayOrder: "asc" },
      select: { id: true, cosplayId: true },
    }),
  ]);

  const publishedIds = new Set(publishedCosplays.map((c) => c.id));
  const standingIds = new Set(existing.map((e) => e.cosplayId));

  const toAdd = publishedCosplays.filter((c) => !standingIds.has(c.id));
  const toRemove = existing.filter((e) => !publishedIds.has(e.cosplayId));

  if (toAdd.length > 0) {
    await prisma.museumRoomCosplay.createMany({
      data: toAdd.map((c, i) => ({
        roomId,
        cosplayId: c.id,
        displayOrder: existing.length + i,
      })),
      // Two concurrent requests can both decide to add the same cosplay; the
      // [roomId, cosplayId] unique constraint makes the loser a no-op instead
      // of a 500.
      skipDuplicates: true,
    });
  }

  if (toRemove.length > 0) {
    await prisma.museumRoomCosplay.deleteMany({
      where: { id: { in: toRemove.map((e) => e.id) } },
    });
  }

  // Membership isn't the only thing mirrored — the *order* is too. The admin
  // grid's reorder arrows move a Cosplay's own displayOrder and say, in as many
  // words, that this moves its standee along the room's walls; without this
  // pass they didn't, because an entry row's displayOrder was assigned once
  // when it was created and never revisited, and that row's order is what both
  // the museum payload sorts by and standeePlacement.ts's wall slots are
  // computed from. Only rows that actually differ are written, so the common
  // "nothing was reordered" case stays a read.
  //
  // A standee the Scene Editor has been given a custom position keeps standing
  // exactly where it was dragged — this only renumbers, and an explicit
  // placement always wins over the auto slot its number would pick.
  const order = new Map(publishedCosplays.map((c, i) => [c.id, i]));
  const current = await prisma.museumRoomCosplay.findMany({
    where: { roomId },
    select: { id: true, cosplayId: true, displayOrder: true },
  });
  const misordered = current.filter(
    (e) => order.has(e.cosplayId) && order.get(e.cosplayId) !== e.displayOrder
  );
  if (misordered.length > 0) {
    await Promise.all(
      misordered.map((e) =>
        prisma.museumRoomCosplay.update({
          where: { id: e.id },
          data: { displayOrder: order.get(e.cosplayId)! },
        })
      )
    );
  }
}

/**
 * Provisions the room's single standee-config row (see cosplayStandee.ts) so
 * the Museum Scene Editor always has something to show its Upload + backdrop
 * controls on, rather than needing a "create it first" step.
 *
 * Provisioned holding the *default* config — no URL — which means "use the
 * built-in standee". Nothing renders differently until an admin actually
 * changes something, so this is free to call on every load.
 */
export async function ensureCosplayStandeeModel(roomId: string) {
  const existing = await prisma.museumSceneObject.findFirst({
    where: { roomId, kind: COSPLAY_STANDEE_MODEL_KIND, deletedAt: null },
  });
  if (existing) return existing;
  return prisma.museumSceneObject.create({
    data: {
      roomId,
      kind: COSPLAY_STANDEE_MODEL_KIND,
      modelUrl: serializeCosplayStandeeConfig(DEFAULT_COSPLAY_STANDEE_CONFIG),
      // Position columns are unused for this row — it's configuration, not a
      // placement (see cosplayStandee.ts's header).
      positionX: 0,
      positionY: 0,
      positionZ: 0,
      rotationY: 0,
    },
  });
}
