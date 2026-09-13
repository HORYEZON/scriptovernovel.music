// lib/museum/aboutRoom.ts
//
// The "About ScriptOverNovel" room is a real MuseumRoom row (roomType: "ABOUT" —
// see prisma/schema.prisma's enum comment) so the Museum Scene Editor can
// place decorative objects in it exactly like any curated room. It is
// lazily created on first access (same pattern as a room's scene objects —
// see app/api/digital-museum/rooms/[id]/scene-objects/route.ts) rather
// than a migration seed step, so it exists the moment anything asks for
// it without a manual provisioning pass.
//
// Nothing about how this room *displays* changes: its bio/photos/skills/
// certificates/socials still come from Profile/CertificateAward/
// ArtistSkill/SocialLink (see app/(public)/gallery/museum/page.tsx), and
// its wall/floor/ceiling still come from DigitalMuseum.about* (edited via
// RoomsTab.tsx's fixed "About ScriptOverNovel" card) — this row exists solely to
// give MuseumSceneObject rows (custom .glb props, its movable content
// blocks) a roomId to attach to, and to let the Museum Scene Editor page
// load it like any other room.
import { prisma } from "@/lib/prisma";
import {
  ABOUT_CONTACT_KIND,
  DEFAULT_CONTACT_DESK_CONFIG,
  defaultContactDeskPlacement,
  serializeContactDeskConfig,
} from "./aboutRoomBlocks";

// Distinctive enough that no admin-typed curated room name could ever
// slugify into a collision (see rooms/route.ts's slugify + de-dupe).
const ABOUT_ROOM_SLUG = "about-scriptovernovel-capstone";

// Always sorts after every curated room (whose displayOrder starts at 0
// and increments by 1 per room — see rooms/route.ts's POST) regardless of
// admin reordering. Never surfaced or made editable anywhere — RoomsTab.tsx
// renders this room as its own fixed "Fixed · Last Room" card instead of
// in the reorderable list.
const ABOUT_ROOM_DISPLAY_ORDER = 999_999;

export async function ensureAboutRoom() {
  const existing = await prisma.museumRoom.findFirst({ where: { roomType: "ABOUT" } });
  if (existing) return existing;
  return prisma.museumRoom.create({
    data: {
      name: "About ScriptOverNovel",
      slug: ABOUT_ROOM_SLUG,
      roomType: "ABOUT",
      enabled: true,
      isEntryRoom: false,
      displayOrder: ABOUT_ROOM_DISPLAY_ORDER,
    },
  });
}

/**
 * The About room's Contact Desk row — the one prop in this room a visitor can
 * interact with (walk up, press [E], the Send an Email panel opens).
 *
 * Lazily provisioned like the Freedom Wall's plaque, and for the same reason:
 * the editor needs a row to hang its controls on the first time that room's
 * scene is opened. Unlike the About *blocks* (aboutRoomBlocks.ts) this one is
 * a real absolute placement — it stands on the floor and is dragged and turned
 * freely, the way a Stories podium or an Arcade cabinet is — so it is seeded
 * at a sensible spot against the east wall rather than at the origin, where it
 * would otherwise appear stranded in the middle of the room.
 */
export async function ensureAboutContactDesk(roomId: string) {
  // Deliberately looks past `deletedAt` first. The desk is a fixture, not a
  // prop an admin uploaded, so the Scene Editor's Remove is documented as
  // "reset to default position" (see that editor's isResetOnlyKind) and is
  // implemented as a soft delete that this function is expected to undo on
  // the next load.
  //
  // Provisioning a *fresh* row to do that was wrong twice over. The desk's
  // entire configuration — the uploaded .glb, its surface image, the wording
  // on the panel and the walk-up prompt, its size — lives in the row's
  // modelUrl, so a new row silently threw all of it away and handed back the
  // built-in desk. Worse, the removed row stayed behind holding that config,
  // and an editor tab opened before the removal could still PATCH its Save
  // onto it: the admin swapped the model, saved, was told it saved, and the
  // museum went on rendering the other row's built-in desk with nothing
  // anywhere reporting a problem. Reviving the row keeps the config, keeps
  // exactly one desk per room, and makes Remove mean what the editor says it
  // means — back to where it started.
  const rows = await prisma.museumSceneObject.findMany({
    where: { roomId, kind: ABOUT_CONTACT_KIND },
    orderBy: { createdAt: "asc" },
  });
  const live = rows.find((row) => row.deletedAt === null);
  if (live) return live;
  // Most recently removed, not the oldest: if a room somehow accumulated
  // more than one row before this fix, the last one an admin actually worked
  // on is the one carrying their configuration.
  const removed = rows[rows.length - 1];
  if (removed) {
    return prisma.museumSceneObject.update({
      where: { id: removed.id },
      data: { deletedAt: null, ...defaultContactDeskPlacement(), scale: 1 },
    });
  }
  return prisma.museumSceneObject.create({
    data: {
      roomId,
      kind: ABOUT_CONTACT_KIND,
      ...defaultContactDeskPlacement(),
      scale: 1,
      modelUrl: serializeContactDeskConfig(DEFAULT_CONTACT_DESK_CONFIG),
    },
  });
}

// The About room's digital wall clock lives in lib/museum/wallClock.ts —
// it is no longer an About-only fixture (the visitor's respawn room gets one
// too), so its provisioning moved out of this file rather than growing a
// roomId parameter that pretended otherwise. Call ensureWallClock(id,
// "ABOUT") for this room's copy.
