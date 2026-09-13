// lib/museum/stairsRoom.ts
//
// Same lazy-provision pattern as ensureAboutRoom/ensureFreedomWallRoom — the
// Stairs connector room is a real MuseumRoom row (roomType: "STAIRS") so it
// has its own id/floor/wall/ceiling colors and can carry decorative scene
// objects like any other room. Unlike those two, it never has content of
// its own (no artworks, no special block kinds) — it's purely a corridor
// segment whose floor climbs from ground level to the second floor (see
// roomConstants.ts's RISE and roomLayout.ts). page.tsx only includes it in
// the corridor when at least one enabled room has `floor: 1`; see
// docs/SecondFloorStairs_Spec.md for the full splice logic.
import { prisma } from "@/lib/prisma";

const STAIRS_SLUG = "stairs-connector";
// Never sorted by directly (page.tsx splices this room in between the
// floor-0 and floor-1 blocks explicitly, not by displayOrder), but kept
// out of the ordinary 0..N curated range just so it never accidentally
// collides with a real room's value.
const STAIRS_DISPLAY_ORDER = 999_000;

export async function ensureStairsRoom() {
  const existing = await prisma.museumRoom.findFirst({ where: { roomType: "STAIRS" } });
  if (existing) return existing;
  return prisma.museumRoom.create({
    data: {
      name: "Stairs",
      slug: STAIRS_SLUG,
      roomType: "STAIRS",
      enabled: true,
      isEntryRoom: false,
      displayOrder: STAIRS_DISPLAY_ORDER,
    },
  });
}
