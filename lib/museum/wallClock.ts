// lib/museum/wallClock.ts
//
// Provisioning for the Digital Wall Clock — the one fixture that hangs in
// more than one room.
//
// It started as an About-room fixture (see aboutRoomBlocks.ts's
// ABOUT_CLOCK_KIND, which keeps its original name so no stored row has to be
// migrated), and it still hangs there. It now also hangs in whichever room is
// set as the visitor's respawn point (MuseumRoom.isEntryRoom — RoomsTab.tsx's
// "Visitor spawns here"): that room is the first thing anyone sees on
// arrival, which is exactly where a clock earns its place. Same fixture, same
// scene-object row shape, same Scene Editor controls — the only difference is
// which room it is attached to.
//
// Lazily created on first access, the same pattern the About room itself uses
// (see aboutRoom.ts), so nothing needs a migration or a manual provisioning
// pass: the row appears the moment either the public museum or the Scene
// Editor asks for that room.
import type { MuseumRoomType } from "@/types";
import { prisma } from "@/lib/prisma";
import { getRoomSize } from "@/app/(public)/gallery/museum/components/roomConstants";
import {
  ABOUT_CLOCK_KIND,
  DEFAULT_WALL_CLOCK_CONFIG,
  defaultWallClockPlacement,
  serializeWallClockConfig,
} from "./aboutRoomBlocks";

/**
 * The wall clock row for one room — a real working clock, reading the current
 * time for as long as a visitor is in that room.
 *
 * Placed the free way (an absolute position, dragged/turned/resized in the
 * Scene Editor) rather than as a wall-anchored block: where a clock hangs is
 * the artist's call, not a designed slot. Seeded high on the north wall so it
 * reads as a clock from the moment the room is opened, instead of appearing
 * at the origin in the middle of the floor. Every room type shares one width
 * (roomConstants.ts's ROOM_WIDTH) and hangs it above artwork-frame height, so
 * the same default spot is clear in a gallery room as it is in the About room.
 */
export async function ensureWallClock(roomId: string, roomType: MuseumRoomType) {
  // Revives a removed clock rather than provisioning a second one, for the
  // reason ensureAboutContactDesk documents at length: this row carries the
  // clock's whole configuration (its caption, time zone, 12/24-hour format
  // and colours) in modelUrl, and a fresh row drops all of it while leaving
  // the old one behind for a stale editor tab to save into. Only reached in
  // a room the clock is provisioned for at all — the About room and the
  // respawn room — which are exactly the rooms where the editor calls its
  // Remove a reset.
  const rows = await prisma.museumSceneObject.findMany({
    where: { roomId, kind: ABOUT_CLOCK_KIND },
    orderBy: { createdAt: "asc" },
  });
  const live = rows.find((row) => row.deletedAt === null);
  if (live) return live;
  const removed = rows[rows.length - 1];
  if (removed) {
    return prisma.museumSceneObject.update({
      where: { id: removed.id },
      data: {
        deletedAt: null,
        ...defaultWallClockPlacement(getRoomSize(roomType).depth),
        scale: 1,
      },
    });
  }
  return prisma.museumSceneObject.create({
    data: {
      roomId,
      kind: ABOUT_CLOCK_KIND,
      ...defaultWallClockPlacement(getRoomSize(roomType).depth),
      scale: 1,
      modelUrl: serializeWallClockConfig(DEFAULT_WALL_CLOCK_CONFIG),
    },
  });
}

/**
 * The clock in the room a visitor respawns into, provisioned wherever that
 * happens to be right now.
 *
 * Exactly one room carries `isEntryRoom` at a time (the rooms API unsets
 * every other room's flag in the same transaction — see
 * app/api/digital-museum/rooms/[id]/route.ts), so this resolves to a single
 * room or, on a museum with no rooms at all, to nothing.
 *
 * A room that *used* to be the respawn point keeps the clock it was given:
 * its placement and colours are the admin's work, and silently deleting them
 * because the spawn point moved would throw that away — and throw it away
 * again on every toggle back and forth. The Scene Editor removes an unwanted
 * one for real (it is only re-provisioned while the room is still the
 * respawn point), which keeps the decision where it belongs.
 */
export async function ensureRespawnRoomWallClock() {
  const entryRoom = await prisma.museumRoom.findFirst({
    where: { isEntryRoom: true, deletedAt: null },
    select: { id: true, roomType: true },
  });
  if (!entryRoom) return null;
  return ensureWallClock(entryRoom.id, entryRoom.roomType);
}
