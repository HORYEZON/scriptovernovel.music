// app/(admin)/admin/trash/page.tsx
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { TrashClient } from "./TrashClient";

export const metadata: Metadata = { title: "Trash" };
export const dynamic = "force-dynamic";

export default async function AdminTrashPage() {
  const [
    announcements,
    marquees,
    artworks,
    stories,
    cosplays,
    products,
    sections,
    notifications,
    rooms,
    events,
    freedomWallNotes,
    freedomWallEvents,
    releaseNotes,
    releases,
    videos,
    vinyls,
    bandMembers,
  ] =
    await Promise.all([
      prisma.announcement.findMany({
        where: { deletedAt: { not: null } },
        orderBy: { deletedAt: "desc" },
      }),
      prisma.marqueeAnnouncement.findMany({
        where: { deletedAt: { not: null } },
        orderBy: { deletedAt: "desc" },
      }),
      prisma.artwork.findMany({
        where: { deletedAt: { not: null } },
        include: {
          section: { select: { id: true, name: true, slug: true } },
          product: true,
        },
        orderBy: { deletedAt: "desc" },
      }),
      prisma.story.findMany({
        where: { deletedAt: { not: null } },
        include: { _count: { select: { pages: true } } },
        orderBy: { deletedAt: "desc" },
      }),
      prisma.cosplay.findMany({
        where: { deletedAt: { not: null } },
        orderBy: { deletedAt: "desc" },
      }),
      prisma.product.findMany({
        where: { deletedAt: { not: null } },
        include: { artwork: true },
        orderBy: { deletedAt: "desc" },
      }),
      prisma.section.findMany({
        where: { deletedAt: { not: null } },
        include: {
          _count: { select: { artworks: true } },
        },
        orderBy: { deletedAt: "desc" },
      }),
      prisma.notification.findMany({
        where: { deletedAt: { not: null } },
        orderBy: { deletedAt: "desc" },
      }),
      prisma.museumRoom.findMany({
        where: { deletedAt: { not: null } },
        include: {
          _count: { select: { artworks: true } },
        },
        orderBy: { deletedAt: "desc" },
      }),
      prisma.event.findMany({
        where: { deletedAt: { not: null } },
        include: { media: { orderBy: { order: "asc" } } },
        orderBy: { deletedAt: "desc" },
      }),
      // Freedom Wall sticky notes — the only trashable row that isn't
      // admin-authored, so the event it belongs to travels with it; the
      // Trash view modal has no other way to say where a note came from.
      prisma.freedomWallNote.findMany({
        where: { deletedAt: { not: null } },
        include: { event: { select: { id: true, title: true } } },
        orderBy: { deletedAt: "desc" },
      }),
      // Freedom Wall events — soft-deleted note folders, restorable whole.
      prisma.freedomWallEvent.findMany({
        where: { deletedAt: { not: null } },
        include: { _count: { select: { notes: { where: { deletedAt: null } } } } },
        orderBy: { deletedAt: "desc" },
      }),
      prisma.releaseNote.findMany({
        where: { deletedAt: { not: null } },
        orderBy: { deletedAt: "desc" },
      }),
      prisma.release.findMany({
        where: { deletedAt: { not: null } },
        include: { _count: { select: { tracks: true } } },
        orderBy: { deletedAt: "desc" },
      }),
      prisma.video.findMany({
        where: { deletedAt: { not: null } },
        include: { release: { select: { id: true, title: true } } },
        orderBy: { deletedAt: "desc" },
      }),
      prisma.vinylRecord.findMany({
        where: { deletedAt: { not: null } },
        include: { release: { select: { id: true, title: true, coverImageUrl: true } } },
        orderBy: { deletedAt: "desc" },
      }),
      prisma.bandMember.findMany({ where: { deletedAt: { not: null } }, orderBy: { deletedAt: "desc" } }),
    ]);

  const total =
    announcements.length +
    marquees.length +
    artworks.length +
    stories.length +
    cosplays.length +
    products.length +
    sections.length +
    notifications.length +
    rooms.length +
    events.length +
    freedomWallNotes.length +
    freedomWallEvents.length +
    releaseNotes.length +
    releases.length +
    videos.length +
    vinyls.length +
    bandMembers.length;

  return (
    <div>
      <AdminPageHeader
        title="Trash"
        description={<><span className="font-bold tabular-nums">{total}</span> item{total !== 1 ? "s" : ""} in trash — restore or permanently delete</>}
      />
      <TrashClient
        initialAnnouncements={JSON.parse(JSON.stringify(announcements))}
        initialMarquees={JSON.parse(JSON.stringify(marquees))}
        initialArtworks={JSON.parse(JSON.stringify(artworks))}
        initialStories={JSON.parse(JSON.stringify(stories))}
        initialCosplays={JSON.parse(JSON.stringify(cosplays))}
        initialProducts={JSON.parse(JSON.stringify(products))}
        initialSections={JSON.parse(JSON.stringify(sections))}
        initialNotifications={JSON.parse(JSON.stringify(notifications))}
        initialRooms={JSON.parse(JSON.stringify(rooms))}
        initialEvents={JSON.parse(JSON.stringify(events))}
        initialFreedomWallNotes={JSON.parse(JSON.stringify(freedomWallNotes))}
        initialFreedomWallEvents={JSON.parse(JSON.stringify(freedomWallEvents))}
        initialReleaseNotes={JSON.parse(JSON.stringify(releaseNotes))}
        initialReleases={JSON.parse(JSON.stringify(releases))}
        initialVideos={JSON.parse(JSON.stringify(videos))}
        initialVinyls={JSON.parse(JSON.stringify(vinyls))}
        initialBandMembers={JSON.parse(JSON.stringify(bandMembers))}
      />
    </div>
  );
}
