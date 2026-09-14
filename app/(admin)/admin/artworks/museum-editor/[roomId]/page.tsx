// app/(admin)/admin/artworks/museum-editor/[roomId]/page.tsx
//
// Museum Scene Editor — Docs/MuseumSceneEditor_Spec.md (move/remove
// placed objects and hung artwork frames). Reached via the "Edit Scene"
// button on a room's row in RoomsTab.tsx. Auth is already handled by
// middleware.ts for the whole /admin/* tree, same as every other admin
// page — no separate requireAdmin() check needed here (that's only for
// API routes, which middleware doesn't cover).
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminGoToMenu } from "@/components/admin/AdminGoToMenu";
import { getMuseumRoomDirectory, museumEditorRoomLinkGroups } from "@/lib/museum/roomStatus";
import { DoorOpen } from "lucide-react";
import { computeRoomLayouts } from "@/app/(public)/gallery/museum/components/roomLayout";
import { getAboutData } from "@/lib/museum/getAboutData";
import type { FreedomWallNotePublic, MuseumRoomPublic } from "@/types";
import { MuseumEditorClient } from "./MuseumEditorClient";

export const metadata: Metadata = { title: "Museum Scene Editor" };
export const dynamic = "force-dynamic";

export default async function MuseumEditorPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;

  const [room, corridorRooms, museumFlags, roomDirectory] = await Promise.all([
    prisma.museumRoom.findUnique({
      where: { id: roomId },
      select: {
        id: true,
        name: true,
        // The toolbar's Share 360° needs the public deep link
        // (/gallery/museum?room=<slug>) to copy alongside the photo.
        slug: true,
        roomType: true,
        // Only the wall clock reads this — it is provisioned for the respawn
        // room as well as the About room, so whether "Remove" resets it or
        // really removes it depends on which room this is. See
        // lib/museum/wallClock.ts.
        isEntryRoom: true,
        wallColor: true,
        floorColor: true,
        ceilingColor: true,
        wallTexture: true,
        floorTexture: true,
        ceilingTexture: true,
        artworks: {
          orderBy: { displayOrder: "asc" },
          select: {
            id: true,
            positionX: true,
            positionY: true,
            positionZ: true,
            rotationY: true,
            scale: true,
            artwork: { select: { id: true, title: true, imageUrl: true } },
          },
        },
        // Only ever non-empty on the Stories Room — its podiums, which the
        // editor drags on the floor rather than snapping to a wall. Membership
        // is mirrored from the published library (lib/museum/storiesRoom.ts),
        // so this is placement-only: nothing here adds or removes a podium.
        stories: {
          orderBy: { displayOrder: "asc" },
          select: {
            id: true,
            positionX: true,
            positionY: true,
            positionZ: true,
            rotationY: true,
            scale: true,
            story: { select: { id: true, title: true, type: true, coverImageUrl: true } },
          },
        },
        // Only ever non-empty on the Arcade Room — its cabinets, dragged on
        // the floor like Stories podiums. Membership is mirrored from the
        // playable mini games (lib/museum/arcadeRoom.ts), so this is
        // placement + display-mode only.
        miniGames: {
          orderBy: { displayOrder: "asc" },
          select: {
            id: true,
            positionX: true,
            positionY: true,
            positionZ: true,
            rotationY: true,
            scale: true,
            displayMode: true,
            game: {
              select: {
                type: true,
                difficulty: true,
                artwork: { select: { title: true, imageUrl: true } },
              },
            },
          },
        },
        // Only ever non-empty on the Cosplay Room — its standees, dragged on the
        // floor like Stories podiums. Membership is mirrored from the published
        // Cosplays (lib/museum/cosplayRoom.ts), so this is placement-only.
        // Both photos come along: the editor draws the real standee *and* the
        // panel behind it, since one placement moves the pair.
        cosplays: {
          orderBy: { displayOrder: "asc" },
          select: {
            id: true,
            positionX: true,
            positionY: true,
            positionZ: true,
            rotationY: true,
            scale: true,
            lightsEnabled: true,
            cosplay: {
              select: {
                id: true,
                title: true,
                character: true,
                series: true,
                standeeImageUrl: true,
                backdropImageUrl: true,
                // Plaque lines — the editor draws the real CosplayStandee, so
                // it needs everything that standee's label reads.
                year: true,
                event: true,
                cosplayer: true,
                photographer: true,
              },
            },
          },
        },
      },
    }),
    // Only enough to reconstruct which of this room's north/south walls
    // (if any) is actually an open doorway in the real corridor — same
    // enabled-room query + displayOrder as the public page.tsx, so the
    // editor's wall picker never offers a "wall" that's really a doorway
    // gap live. computeRoomLayouts only ever reads `.roomType` off each
    // entry, so a minimal {id, roomType} stand-in is enough here — plus
    // `floor`, which decides where in the chain each room actually lands
    // (see the floor split below).
    prisma.museumRoom.findMany({
      where: { enabled: true, deletedAt: null },
      orderBy: { displayOrder: "asc" },
      select: { id: true, roomType: true, floor: true },
    }),
    // Museum-wide settings this editor can't read off the room row:
    //  • aboutEnabled — the About room's own on/off switch (not the row's
    //    `enabled` column). The public corridor omits the room entirely when
    //    it's off, which shifts every index after it.
    //  • about{Wall,Floor,Ceiling}{Color,Texture} — where the About room's
    //    surfaces actually live. Its MuseumRoom row keeps those columns at
    //    their unused defaults (see page.tsx's aboutRoom), so reading the row
    //    here showed that one room untextured in the Scene Editor while the
    //    real museum and the Digital Museum preview both showed the uploads.
    prisma.digitalMuseum
      .findFirst({
        select: {
          aboutEnabled: true,
          aboutWallColor: true,
          aboutFloorColor: true,
          aboutCeilingColor: true,
          aboutWallTexture: true,
          aboutFloorTexture: true,
          aboutCeilingTexture: true,
        },
      })
      .catch(() => null),
    // Every room in the museum, for the header's "Go to" menu — a separate
    // query from corridorRooms above because that one is deliberately
    // enabled-only (it reconstructs the corridor's doorway geometry, where a
    // switched-off room simply isn't). The menu wants the switched-off ones
    // too, greyed rather than missing: this editor opens them perfectly well,
    // which is how a room gets laid out before it goes live.
    getMuseumRoomDirectory(),
  ]);

  if (!room) notFound();

  // Real content (bio/photos/skills/certificates), only fetched for the
  // About room — an admin repositioning its 3 movable blocks
  // (lib/museum/aboutRoomBlocks.ts) needs to see what's actually there,
  // the same reasoning that made a plain placeholder box feel like a bug
  // ("wala yung mga naka display na nasa About Page"). Every other room
  // has no use for this at all.
  const aboutData = room.roomType === "ABOUT" ? await getAboutData() : null;

  // Freedom Wall notes — shown in the editor so the admin can see the
  // current notes while repositioning decorative objects. Same logic as the
  // public museum's FreedomWallRoomContents: pull the active event's
  // non-archived notes, or an empty list if no active event exists.
  // Also resolves the banner's fallback text (see freedomWallBanner.ts) so
  // the editor's preview shows the real active-event name, not a blank.
  let freedomWallNotes: FreedomWallNotePublic[] = [];
  let freedomWallEventTitle: string | null = null;
  if (room.roomType === "FREEDOM_WALL") {
    const settings = await prisma.freedomWallSettings.findUnique({
      where: { id: "singleton" },
      select: {
        isActive: true,
        activeEventId: true,
        activeEvent: { select: { title: true, isArchived: true } },
      },
    }).catch(() => null);
    if (settings?.isActive && settings.activeEvent && !settings.activeEvent.isArchived) {
      freedomWallEventTitle = settings.activeEvent.title;
    }
    if (settings?.isActive && settings.activeEventId) {
      freedomWallNotes = await prisma.freedomWallNote.findMany({
        where: { eventId: settings.activeEventId, isArchived: false, deletedAt: null },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          nickname: true,
          content: true,
          positionX: true,
          positionY: true,
          color: true,
          rotation: true,
          scale: true,
          wall: true,
          createdAt: true,
        },
      }).then((rows) =>
        rows.map((r) => ({
          ...r,
          createdAt: r.createdAt.toISOString(),
        }))
      ).catch(() => []);
    }
  }

  // The corridor has to be chained here *exactly* the way the public museum
  // chains it (page.tsx's floor0Rooms/stairsRoom/floor1Rooms), because
  // roomLayout.ts derives each room's doorway openings purely from its index
  // in that chain — and those openings decide whether a wall is one span or
  // the two flanks of a doorway, which is what a sticky note's/frame's
  // 0-100 % positionX is measured against (see freedomWallNotePlacement.ts's
  // resolveNoteWallSegment). Ordering these rooms by displayOrder alone —
  // what this used to do — silently placed the Stairs room in the wrong slot
  // and ignored the floor split entirely, so as soon as any room sat on
  // floor 1 the editor could resolve a *different* wall geometry than the
  // live room: the admin dragged a note into place here and the museum drew
  // it somewhere else.
  const stairsRoom = corridorRooms.find((r) => r.roomType === "STAIRS") ?? null;
  const eligibleRooms = corridorRooms.filter(
    (r) =>
      r.roomType !== "STAIRS" &&
      // aboutEnabled defaults true — omit the About room only when explicitly disabled.
      (r.roomType !== "ABOUT" || museumFlags?.aboutEnabled !== false)
  );
  const floor0Rooms = eligibleRooms.filter((r) => r.floor !== 1);
  const floor1Rooms = eligibleRooms.filter((r) => r.floor === 1);
  const corridorChain = [
    ...floor0Rooms,
    // The Stairs connector only exists in the chain when there's an upstairs
    // to reach — same condition page.tsx splices it in under.
    ...(floor1Rooms.length > 0 && stairsRoom ? [stairsRoom] : []),
    ...floor1Rooms,
  ];

  const corridorLayouts = computeRoomLayouts(corridorChain as unknown as MuseumRoomPublic[]);
  const thisLayout = corridorLayouts.find((l) => l.room.id === roomId) as
    | { hasNorthOpening: boolean; hasSouthOpening: boolean }
    | undefined;
  // A disabled room isn't part of the live corridor at all — falls back to
  // an isolated room (both walls solid).
  const hasNorthOpening = thisLayout?.hasNorthOpening ?? false;
  const hasSouthOpening = thisLayout?.hasSouthOpening ?? false;

  // The About room's shell is admin-set through the museum-wide
  // DigitalMuseum.about* fields (RoomsTab.tsx's "About ScriptOverNovel" card), not
  // through its own row's colour/texture columns — those stay at their
  // defaults and go unused. Substitute them here so this editor previews the
  // same surfaces the public corridor and the Digital Museum preview draw;
  // every other room type keeps its own row's values untouched.
  const editorRoom =
    room.roomType === "ABOUT" && museumFlags
      ? {
          ...room,
          wallColor: museumFlags.aboutWallColor ?? room.wallColor,
          floorColor: museumFlags.aboutFloorColor ?? room.floorColor,
          ceilingColor: museumFlags.aboutCeilingColor ?? room.ceilingColor,
          wallTexture: museumFlags.aboutWallTexture,
          floorTexture: museumFlags.aboutFloorTexture,
          ceilingTexture: museumFlags.aboutCeilingTexture,
        }
      : room;

  return (
    <div>
      <AdminPageHeader
        breadcrumbs={[
          { label: "Digital Museum", href: "/admin/museum" },
          { label: "Rooms", href: "/admin/museum?museumTab=rooms" },
          { label: "Edit Scene" },
        ]}
        title={`Edit Scene · ${room.name}`}
        description="Drag artwork frames, podiums, standees and decorative objects into place, then Save."
        action={
          <AdminGoToMenu
            icon={<DoorOpen size={16} />}
            groups={museumEditorRoomLinkGroups(roomDirectory, room.id)}
          />
        }
      />
      <MuseumEditorClient
        room={editorRoom}
        hasNorthOpening={hasNorthOpening}
        hasSouthOpening={hasSouthOpening}
        aboutData={aboutData}
        freedomWallNotes={freedomWallNotes}
        freedomWallEventTitle={freedomWallEventTitle}
      />
    </div>
  );
}
