// lib/museum/roomBannerProvision.ts
//
// The DB half of lib/museum/roomBanner.ts — creating the one Room Banner
// config row a room's plaques read their style from.
//
// Split out for the same reason cosplayRoom.ts is split from cosplayStandee.ts:
// the config module has to stay importable from the browser (the Museum Scene
// Editor edits these values live), and this half imports prisma.
//
// Called from the public museum page, the digital-museum API and the Scene
// Editor's scene-objects route — the same three places every other ensure*
// runs from, so the row exists by the time either an admin or a visitor needs
// it, and creating it is a no-op on every load after the first.
import { prisma } from "@/lib/prisma";
import {
  ROOM_BANNER_KIND,
  defaultRoomBannerStyle,
  serializeRoomBannerStyle,
  type BannerRoomType,
  type RoomBannerStyle,
} from "@/lib/museum/roomBanner";
import {
  COSPLAY_STANDEE_MODEL_KIND,
  parseCosplayStandeeConfig,
} from "@/lib/museum/cosplayStandee";
import type { MuseumRoomType } from "@prisma/client";

/**
 * The room types that draw a plaque this styles. A room not on this list has
 * no label to theme, so it never gets a row — an empty config object sitting
 * in a gallery room's scene would just be one more thing for an admin to
 * wonder about in the object list.
 */
export const ROOM_BANNER_ROOM_TYPES: MuseumRoomType[] = [
  "STORIES",
  "ARCADE",
  "SERVICES",
  "ABOUT",
  "COSPLAY",
];

export function roomTypeHasBanner(roomType: MuseumRoomType): boolean {
  return ROOM_BANNER_ROOM_TYPES.includes(roomType);
}

/**
 * The style a *new* row starts at.
 *
 * Everywhere except the Cosplay Room this is that room's own historical look
 * (see defaultRoomBannerStyle) — the values its plaques were hardcoded to — so
 * provisioning changes nothing on screen.
 *
 * The Cosplay Room is the exception, and the reason this function does a read
 * at all: its plaque has been admin-editable for a while through five flat
 * `plaque*` keys on its own standee config, and an admin who themed it there
 * must not have that thrown away the moment the unified row appears. So a
 * Cosplay row is seeded from whatever those keys currently hold. After this
 * one-way carry-over the banner row is the only thing the plaque reads; the old
 * keys stay parsed by cosplayStandee.ts purely so this seed keeps working for
 * rooms that haven't been provisioned yet.
 */
async function seedStyleFor(
  roomId: string,
  roomType: BannerRoomType
): Promise<RoomBannerStyle> {
  const base = defaultRoomBannerStyle(roomType);
  if (roomType !== "COSPLAY") return base;

  const standeeRow = await prisma.museumSceneObject
    .findFirst({
      where: { roomId, kind: COSPLAY_STANDEE_MODEL_KIND, deletedAt: null },
      select: { modelUrl: true },
    })
    .catch(() => null);
  if (!standeeRow) return base;

  const legacy = parseCosplayStandeeConfig(standeeRow.modelUrl);
  return {
    ...base,
    panelColor: legacy.plaquePanelColor,
    edgeColor: legacy.plaqueEdgeColor,
    textColor: legacy.plaqueTextColor,
    fontFamily: legacy.plaqueFontFamily,
    fontScale: legacy.plaqueFontScale,
  };
}

/**
 * Provisions the room's single banner-style row so the Museum Scene Editor
 * always has something to show its controls on, rather than needing a
 * "create it first" step.
 *
 * Safe to call on every load: it is a read when the row already exists, and a
 * no-op for a room type that has no plaque.
 */
export async function ensureRoomBanner(roomId: string, roomType: MuseumRoomType) {
  if (!roomTypeHasBanner(roomType)) return null;

  const existing = await prisma.museumSceneObject.findFirst({
    where: { roomId, kind: ROOM_BANNER_KIND, deletedAt: null },
  });
  if (existing) return existing;

  const style = await seedStyleFor(roomId, roomType as BannerRoomType);
  return prisma.museumSceneObject.create({
    data: {
      roomId,
      kind: ROOM_BANNER_KIND,
      modelUrl: serializeRoomBannerStyle(style),
      // Position columns are unused for this row — it is configuration, not a
      // placement (see roomBanner.ts's header).
      positionX: 0,
      positionY: 0,
      positionZ: 0,
      rotationY: 0,
    },
  });
}
