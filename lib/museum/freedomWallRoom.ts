// lib/museum/freedomWallRoom.ts
//
// Same lazy-provision pattern as ensureAboutRoom — the Freedom Wall room is
// a real MuseumRoom row (roomType: "FREEDOM_WALL") so it appears in the
// corridor and can carry custom decorative objects via the Scene Editor.
// Its content (sticky notes) comes from FreedomWallNote rows, not from any
// field on this row itself.
//
// Always sorts just before the About capstone (displayOrder 999_998 vs the
// About room's 999_999) so walking the corridor ends:
//   … last curated room → Freedom Wall → About ScriptOverNovel
import { prisma } from "@/lib/prisma";
import {
  FREEDOM_WALL_BANNER_KIND,
  DEFAULT_BANNER_COLORS,
  freedomWallBannerDefaultPosition,
} from "./freedomWallBanner";

const FREEDOM_WALL_SLUG  = "freedom-wall-interactive";
const FREEDOM_WALL_ORDER = 999_998;

export async function ensureFreedomWallRoom() {
  const existing = await prisma.museumRoom.findFirst({
    where: { roomType: "FREEDOM_WALL" },
  });
  if (existing) return existing;
  return prisma.museumRoom.create({
    data: {
      name: "Freedom Wall",
      slug: FREEDOM_WALL_SLUG,
      roomType: "FREEDOM_WALL",
      enabled: false, // off by default — admin enables it in RoomsTab
      isEntryRoom: false,
      displayOrder: FREEDOM_WALL_ORDER,
    },
  });
}

// Lazily provisions the Freedom Wall room's single event-title plaque — a
// real MuseumSceneObject (kind: FREEDOM_WALL_BANNER_KIND, see
// lib/museum/freedomWallBanner.ts) so it's admin-movable/deletable in the
// Museum Scene Editor exactly like a decorative object. Called both from
// the public page (so the plaque exists — and shows the active event's
// name — even before an admin has ever opened the Scene Editor) and from
// the editor's own scene-objects route.
export async function ensureFreedomWallBanner(roomId: string, depth: number) {
  const existing = await prisma.museumSceneObject.findFirst({
    where: { roomId, kind: FREEDOM_WALL_BANNER_KIND, deletedAt: null },
  });
  if (existing) return existing;
  return prisma.museumSceneObject.create({
    data: {
      roomId,
      kind: FREEDOM_WALL_BANNER_KIND,
      modelUrl: JSON.stringify(DEFAULT_BANNER_COLORS),
      ...freedomWallBannerDefaultPosition(depth),
    },
  });
}
