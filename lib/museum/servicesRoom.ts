// lib/museum/servicesRoom.ts
//
// The "Services Room" — the shop wall inside the museum corridor. Same lazy-
// provision pattern as ensureAboutRoom/ensureFreedomWallRoom/ensureStairsRoom:
// a real MuseumRoom row (roomType: "SERVICES") so it has its own id, floor,
// enabled flag, wall/floor/ceiling colors + textures, and can carry Museum
// Scene Editor placements like any other room.
//
// Two things make it different from those three:
//
//  1. It stays *inside* RoomsTab.tsx's reorderable list rather than being
//     rendered as a card pinned below it. Its displayOrder is a real value in
//     the same 0..N range as every curated room, so the admin can move it up
//     and down the corridor with the same arrows. It's provisioned at the end
//     of that range (see ensureServicesRoom below).
//  2. Its contents aren't hand-picked. syncServicesRoomProducts keeps its
//     MuseumRoomArtwork rows mirroring every live Product — list an artwork in
//     the shop (ProductsClient.tsx's "Make Visible" / available: true) and it
//     is hung on this room's wall; hide or delete it and the frame goes away.
//     Going through real MuseumRoomArtwork rows (rather than synthesizing
//     frames at render time) is what lets those frames be dragged, re-walled
//     and resized in the Museum Scene Editor exactly like a curated room's,
//     since that editor reads and writes those same rows.
//
// The room is never admin-creatable, never retypeable (rooms/[id]'s PATCH
// validTypes excludes SERVICES) and never deletable (that same route's DELETE
// refuses it) — RoomsTab.tsx hides the Trash button for it to match.
import { prisma } from "@/lib/prisma";

// Distinctive enough that no admin-typed curated room name could ever slugify
// into a collision — same reasoning as ABOUT_ROOM_SLUG.
const SERVICES_ROOM_SLUG = "services-shop-room";

export async function ensureServicesRoom() {
  const existing = await prisma.museumRoom.findFirst({ where: { roomType: "SERVICES" } });
  if (existing) return existing;

  // Lands at the end of the curated 0..N range (rooms/route.ts's POST assigns
  // displayOrder by that same count) so a museum that already has rooms gets
  // the shop as its new last stop rather than silently jumping to the front.
  // The fixed 999_xxx orders ABOUT/FREEDOM_WALL/STAIRS use are excluded from
  // the count for exactly that reason.
  const curatedCount = await prisma.museumRoom.count({
    where: { deletedAt: null, roomType: { notIn: ["ABOUT", "FREEDOM_WALL", "STAIRS"] } },
  });

  return prisma.museumRoom.create({
    data: {
      name: "Services Room",
      slug: SERVICES_ROOM_SLUG,
      roomType: "SERVICES",
      description: "Original works and prints available to acquire.",
      enabled: false, // off by default — admin enables it in RoomsTab
      isEntryRoom: false,
      displayOrder: curatedCount,
    },
  });
}

/**
 * Reconciles the Services Room's hung frames with the live shop listing.
 *
 * "Live" is exactly what app/(public)/shop/page.tsx shows: a Product that is
 * `available`, not soft-deleted, whose Artwork isn't soft-deleted either.
 * Deliberately *not* filtered on `artwork.published` — the shop doesn't filter
 * on it, so a room mirroring the shop shouldn't either (which is why the
 * public museum page reads this room through its own select rather than the
 * shared, published-only ROOM_CONTENT_SELECT).
 *
 * Called from both the public museum page and the admin config GET, so the
 * wall is correct on the next load after any product change without needing
 * ProductsClient.tsx to know this room exists. Writes only when something
 * actually differs, so the common "nothing changed" case is two reads.
 *
 * Note: un-listing a product removes its row, and with it any Scene Editor
 * placement override that row was carrying. Re-listing it later brings the
 * frame back at its auto-computed perimeter position, not where it used to
 * hang. Keeping orphaned rows around to preserve that would mean carrying
 * frames the shop no longer has, which is the worse of the two.
 */
export async function syncServicesRoomProducts(roomId: string) {
  const [liveProducts, existing] = await Promise.all([
    // Only artwork-backed products can hang in a room — merch (no
    // artworkId, since the Store decoupling) is simply not mirrored here.
    prisma.product.findMany({
      where: { available: true, deletedAt: null, artworkId: { not: null }, artwork: { deletedAt: null } },
      orderBy: { createdAt: "desc" },
      select: { artworkId: true },
    }),
    prisma.museumRoomArtwork.findMany({
      where: { roomId },
      orderBy: { displayOrder: "asc" },
      select: { id: true, artworkId: true },
    }),
  ]);

  const liveArtworks = liveProducts.map((p) => ({ artworkId: p.artworkId as string }));
  const liveIds = new Set(liveArtworks.map((p) => p.artworkId));
  const hungIds = new Set(existing.map((e) => e.artworkId));

  const toAdd = liveArtworks.filter((p) => !hungIds.has(p.artworkId));
  const toRemove = existing.filter((e) => !liveIds.has(e.artworkId));

  if (toAdd.length > 0) {
    await prisma.museumRoomArtwork.createMany({
      data: toAdd.map((p, i) => ({
        roomId,
        artworkId: p.artworkId,
        displayOrder: existing.length + i,
      })),
      // Two concurrent requests can both decide to add the same product;
      // the [roomId, artworkId] unique constraint makes the loser a no-op
      // instead of a 500.
      skipDuplicates: true,
    });
  }

  if (toRemove.length > 0) {
    await prisma.museumRoomArtwork.deleteMany({
      where: { id: { in: toRemove.map((e) => e.id) } },
    });
  }
}
