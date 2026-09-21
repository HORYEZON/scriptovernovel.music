// lib/museum/vinylRoom.ts
//
// The "Vinyl Room" — the band's records inside the museum corridor. Same
// lazy-provision pattern as ensureArcadeRoom (read lib/museum/arcadeRoom.ts
// first): a real MuseumRoom row (roomType "VINYL") with its own id, enabled
// flag, colours, and Scene Editor placements. Its contents mirror Music →
// Vinyls (syncVinylRoomRecords): publish a record and a sleeve appears on
// the wall; unpublish it and the sleeve goes. Never creatable, retypeable
// or deletable from the admin — RoomsTab hides those controls for it.
import { prisma } from "@/lib/prisma";
import { DEFAULT_VINYL_CONFIG, VINYL_CONFIG_KIND, serializeVinylConfig } from "@/lib/museum/vinylConfig";

const VINYL_ROOM_SLUG = "vinyl-room";

export async function ensureVinylRoom() {
  const existing = await prisma.museumRoom.findFirst({ where: { roomType: "VINYL" } });
  if (existing) return existing;
  const curatedCount = await prisma.museumRoom.count({
    where: { deletedAt: null, roomType: { notIn: ["ABOUT", "FREEDOM_WALL", "STAIRS"] } },
  });
  return prisma.museumRoom.create({
    data: {
      name: "Vinyl Room",
      slug: VINYL_ROOM_SLUG,
      roomType: "VINYL",
      description: "Take a record off the wall, put it on the deck, and play with the sound.",
      enabled: false, // off by default — admin enables it in RoomsTab
      isEntryRoom: false,
      displayOrder: curatedCount,
    },
  });
}

/**
 * Keeps the room's MuseumRoomVinyl rows mirroring every published record
 * whose release is itself published: add what's missing, remove what's
 * gone. A removed row loses its Scene Editor placement (same trade-off as
 * the Arcade sync).
 */
export async function syncVinylRoomRecords(roomId: string) {
  const [live, existing] = await Promise.all([
    prisma.vinylRecord.findMany({
      where: { published: true, deletedAt: null, release: { published: true, deletedAt: null } },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    }),
    prisma.museumRoomVinyl.findMany({ where: { roomId }, orderBy: { displayOrder: "asc" }, select: { id: true, vinylId: true } }),
  ]);
  const liveIds = new Set(live.map((v) => v.id));
  const hungIds = new Set(existing.map((e) => e.vinylId));
  const toAdd = live.filter((v) => !hungIds.has(v.id));
  const toRemove = existing.filter((e) => !liveIds.has(e.vinylId));
  if (toAdd.length > 0) {
    await prisma.museumRoomVinyl.createMany({
      data: toAdd.map((v, i) => ({ roomId, vinylId: v.id, displayOrder: existing.length + i })),
      skipDuplicates: true,
    });
  }
  if (toRemove.length > 0) {
    await prisma.museumRoomVinyl.deleteMany({ where: { id: { in: toRemove.map((e) => e.id) } } });
  }
}

/** The room's single config row (see vinylConfig.ts), provisioned with the
 *  defaults so the Scene Editor always has a row to save into. */
export async function ensureVinylConfig(roomId: string) {
  const existing = await prisma.museumSceneObject.findFirst({
    where: { roomId, kind: VINYL_CONFIG_KIND, deletedAt: null },
  });
  if (existing) return existing;
  return prisma.museumSceneObject.create({
    data: {
      roomId,
      kind: VINYL_CONFIG_KIND,
      modelUrl: serializeVinylConfig(DEFAULT_VINYL_CONFIG),
      positionX: 0,
      positionY: 0,
      positionZ: 0,
      rotationY: 0,
    },
  });
}
