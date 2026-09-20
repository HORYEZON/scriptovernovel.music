// app/api/trash/route.ts
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

// GET /api/trash — fetch all soft-deleted items across every trashable module
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
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
        // Cosplays — costume photography, whose standees leave the museum's
        // Cosplay Room the moment a row lands here (lib/museum/cosplayRoom.ts's
        // sync mirrors published, non-deleted rows only).
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
        // Freedom Wall events — the whole note folder, soft-deleted from the
        // admin panel. The live note count travels with it so the Trash row
        // can say how much comes back on restore.
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
      ]);

    return NextResponse.json({
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
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch trash" }, { status: 500 });
  }
}
