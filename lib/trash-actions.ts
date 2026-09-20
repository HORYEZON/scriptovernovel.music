// lib/trash-actions.ts
//
// What "restore" and "permanently delete" actually mean for each trashable
// type — the cascades, the storage cleanup and the paths to revalidate.
//
// Extracted from app/api/trash/[type]/[id]/route.ts when the Trash module
// grew per-tab "Restore All" / "Empty" buttons. Those need exactly the same
// per-item behaviour as the single-item route, and this logic is not the kind
// worth having twice: purging a story hunts down its page images but spares a
// cover borrowed from an artwork, purging a section takes its artworks' files
// with it, restoring a section revives only the rows trashed in the same
// breath. A second copy of that would drift, and the drift would be silent
// and destructive.
//
// Both functions throw on a bad id (Prisma P2025) — callers decide whether
// that is a 404 or, in a bulk pass, a row to skip.
import { revalidatePath } from "next/cache";
import { productImage, productTitle } from "@/lib/store/product-display";
import { prisma } from "@/lib/prisma";
import { deleteArtworkImage } from "@/lib/storage/server";

export type TrashType =
  | "announcements"
  | "marquees"
  | "artworks"
  | "stories"
  | "cosplays"
  | "products"
  | "sections"
  | "notifications"
  | "rooms"
  | "events"
  | "freedom-wall-notes"
  | "freedom-wall-events"
  | "release-notes"
  | "releases"
  | "videos"
  | "band-members";

export const TRASH_TYPES: TrashType[] = [
  "announcements",
  "marquees",
  "artworks",
  "stories",
  "cosplays",
  "products",
  "sections",
  "notifications",
  "rooms",
  "events",
  "freedom-wall-notes",
  "freedom-wall-events",
  "release-notes",
  "releases",
  "videos",
  "band-members",
];

export function isTrashType(value: string): value is TrashType {
  return (TRASH_TYPES as string[]).includes(value);
}

/** Every trashed row's id for one type, oldest-deleted first — what the bulk
 *  routes iterate. Ordering only matters so a partially-failed pass is
 *  predictable rather than arbitrary. */
export async function listTrashedIds(type: TrashType): Promise<string[]> {
  const where = { deletedAt: { not: null } } as const;
  const opts = { where, orderBy: { deletedAt: "asc" }, select: { id: true } } as const;
  const rows = await (async () => {
    switch (type) {
      case "announcements": return prisma.announcement.findMany(opts);
      case "marquees": return prisma.marqueeAnnouncement.findMany(opts);
      case "artworks": return prisma.artwork.findMany(opts);
      case "stories": return prisma.story.findMany(opts);
      case "cosplays": return prisma.cosplay.findMany(opts);
      case "products": return prisma.product.findMany(opts);
      case "sections": return prisma.section.findMany(opts);
      case "notifications": return prisma.notification.findMany(opts);
      case "rooms": return prisma.museumRoom.findMany(opts);
      case "events": return prisma.event.findMany(opts);
      case "freedom-wall-notes": return prisma.freedomWallNote.findMany(opts);
      case "freedom-wall-events": return prisma.freedomWallEvent.findMany(opts);
      case "release-notes": return prisma.releaseNote.findMany(opts);
      case "releases": return prisma.release.findMany(opts);
      case "videos": return prisma.video.findMany(opts);
      case "band-members": return prisma.bandMember.findMany(opts);
    }
  })();
  return rows.map((r) => r.id);
}

/**
 * The pages each type's rows appear on.
 *
 * These used to be `revalidatePath` calls sprinkled through the two switches
 * below. Pulling them out is what lets the bulk routes revalidate **once** for
 * a whole pass instead of once per row — a fifty-row purge was otherwise fifty
 * identical cache invalidations — and it keeps the actions themselves free of
 * Next's request context, so they can be exercised outside a route.
 *
 * Callers must invoke this after their work; nothing here does it for them.
 */
const REVALIDATE_PATHS: Record<TrashType, string[]> = {
  announcements: ["/admin/announcement"],
  marquees: ["/admin/announcement"],
  artworks: ["/admin/artworks"],
  stories: ["/admin/stories", "/stories"],
  cosplays: ["/admin/cosplays", "/gallery/museum"],
  products: ["/admin/products"],
  sections: ["/admin/artworks", "/admin/products"],
  notifications: ["/admin/notifications"],
  rooms: ["/admin/artworks", "/gallery/museum"],
  events: ["/admin/events", "/about"],
  "freedom-wall-notes": ["/admin/freedom-wall", "/gallery/freedom-wall", "/gallery/museum"],
  "freedom-wall-events": ["/admin/freedom-wall", "/gallery/freedom-wall", "/gallery/museum"],
  "release-notes": ["/admin/settings/release-notes"],
  releases: ["/admin/releases", "/music"],
  videos: ["/admin/videos", "/videos"],
  "band-members": ["/admin/band-members", "/about"],
};

/** Invalidate everything one type's rows show up on, plus the shell and the
 *  Trash page itself. Call once per request, after the work is done. */
export function revalidateForTrashType(type: TrashType): void {
  for (const path of REVALIDATE_PATHS[type]) revalidatePath(path);
  revalidatePath("/", "layout");
  revalidatePath("/admin/trash");
}

/** Undo the soft delete (deletedAt -> null) for one row. */
export async function restoreTrashItem(type: TrashType, id: string): Promise<void> {
  switch (type) {
      case "announcements":
        await prisma.announcement.update({ where: { id }, data: { deletedAt: null } });
        break;
      case "marquees":
        await prisma.marqueeAnnouncement.update({ where: { id }, data: { deletedAt: null } });
        break;
      case "artworks":
        await prisma.artwork.update({ where: { id }, data: { deletedAt: null } });
        break;
      case "stories":
        await prisma.story.update({ where: { id }, data: { deletedAt: null } });
        break;
      case "cosplays":
        // Restoring a published cosplay puts its standee straight back in the
        // Cosplay Room on the museum's next load — its `published` flag is
        // untouched, so one trashed as a draft comes back a draft.
        await prisma.cosplay.update({ where: { id }, data: { deletedAt: null } });
        break;
      case "products":
        await prisma.product.update({ where: { id }, data: { deletedAt: null } });
        break;
      case "sections": {
        const section = await prisma.section.findUnique({
          where: { id },
          select: { deletedAt: true },
        });

        // Restore the section plus only the artworks/products that were
        // trashed alongside it (same deletedAt timestamp) — leaves any
        // artwork that was independently trashed still in the trash.
        await prisma.$transaction([
          prisma.product.updateMany({
            where: { artwork: { sectionId: id }, deletedAt: section?.deletedAt ?? undefined },
            data: { deletedAt: null },
          }),
          prisma.artwork.updateMany({
            where: { sectionId: id, deletedAt: section?.deletedAt ?? undefined },
            data: { deletedAt: null },
          }),
          prisma.section.update({ where: { id }, data: { deletedAt: null } }),
        ]);
        break;
      }
      case "notifications":
        await prisma.notification.update({ where: { id }, data: { deletedAt: null } });
        break;
      case "rooms":
        await prisma.museumRoom.update({ where: { id }, data: { deletedAt: null } });
        break;
      case "events":
        await prisma.event.update({ where: { id }, data: { deletedAt: null } });
        break;
      case "freedom-wall-notes":
        // Restoring puts the note straight back on the wall — its isArchived
        // flag is untouched, so a note that was archived before it was
        // trashed comes back archived.
        await prisma.freedomWallNote.update({ where: { id }, data: { deletedAt: null } });
        break;
      case "freedom-wall-events":
        // The event reappears in the admin panel with its notes intact. Its
        // isArchived flag is left as it was, and it is NOT auto-reactivated —
        // an admin picks it back up from the list like any other event.
        await prisma.freedomWallEvent.update({ where: { id }, data: { deletedAt: null } });
        break;
      case "release-notes":
        // Comes back exactly as it left — including its isPublished flag, so a
        // note that was live before it was trashed is live again the moment it
        // is restored. Forcing it back to draft would be a second, silent
        // decision on top of the one the admin actually made.
        await prisma.releaseNote.update({ where: { id }, data: { deletedAt: null } });
        break;
      case "releases":
        // Back with its published/featured flags as they were.
        await prisma.release.update({ where: { id }, data: { deletedAt: null } });
        break;
      case "videos":
        await prisma.video.update({ where: { id }, data: { deletedAt: null } });
        break;
      case "band-members":
        await prisma.bandMember.update({ where: { id }, data: { deletedAt: null } });
        break;
  }
}

/** Destroy one row for good, along with whatever it owns in storage. */
/**
 * Before a product disappears, write what it was onto every order line that
 * bought it, so the order still reads right afterwards (lib/orders/
 * item-display.ts). Only lines with no snapshot yet — a line stamped once
 * keeps the name it was sold under. Called for a product being purged and
 * for an artwork being purged (its product cascades away with it).
 */
async function snapshotOrderLinesForProduct(productId: string): Promise<void> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { title: true, images: true, artwork: { select: { title: true, imageUrl: true } } },
  });
  if (!product) return;
  const title = productTitle(product);
  if (!title) return;
  await prisma.orderItem.updateMany({
    where: { productId, titleSnapshot: null },
    data: { titleSnapshot: title, imageSnapshot: productImage(product) },
  });
}

export async function purgeTrashItem(type: TrashType, id: string): Promise<void> {
  switch (type) {
      case "announcements":
        await prisma.announcement.delete({ where: { id } });
        break;
      case "marquees":
        await prisma.marqueeAnnouncement.delete({ where: { id } });
        break;
      case "artworks": {
        const artwork = await prisma.artwork.findUnique({
          where: { id },
          select: { imageUrl: true, product: { select: { id: true } } },
        });
        // Its product (if any) cascades away with it — stamp the order lines
        // first, same as purging the product directly.
        if (artwork?.product) await snapshotOrderLinesForProduct(artwork.product.id);
        await prisma.artwork.delete({ where: { id } });
        if (artwork?.imageUrl) {
          deleteArtworkImage(artwork.imageUrl).catch(() => {});
        }
        break;
      }
      case "stories": {
        // Cover + page images are cleaned up alongside the row — the pages
        // themselves cascade away with the story (see prisma/schema.prisma).
        // A cover lifted from an existing artwork is left alone: that file
        // still belongs to the artwork it came from.
        const story = await prisma.story.findUnique({
          where: { id },
          select: {
            coverImageUrl: true,
            pages: { select: { imageUrl: true } },
          },
        });
        const coverIsArtworkImage = story?.coverImageUrl
          ? Boolean(
              await prisma.artwork.findFirst({
                where: { imageUrl: story.coverImageUrl },
                select: { id: true },
              })
            )
          : false;

        await prisma.story.delete({ where: { id } });

        if (story?.coverImageUrl && !coverIsArtworkImage) {
          deleteArtworkImage(story.coverImageUrl).catch(() => {});
        }
        story?.pages.forEach((page) => deleteArtworkImage(page.imageUrl).catch(() => {}));
        break;
      }
      case "cosplays": {
        // Both photos are cleaned up alongside the row. Nothing else can be
        // holding them: unlike a Story cover (which may have been lifted from an
        // existing Artwork), a cosplay's two images are only ever uploaded
        // through this module's own form.
        const cosplay = await prisma.cosplay.findUnique({
          where: { id },
          select: { standeeImageUrl: true, backdropImageUrl: true },
        });

        // Cascades its MuseumRoomCosplay rows (see prisma/schema.prisma).
        await prisma.cosplay.delete({ where: { id } });

        if (cosplay?.standeeImageUrl) {
          deleteArtworkImage(cosplay.standeeImageUrl).catch(() => {});
        }
        if (cosplay?.backdropImageUrl) {
          deleteArtworkImage(cosplay.backdropImageUrl).catch(() => {});
        }
        break;
      }
      case "products":
        // A product that has been ordered can go: the lines that bought it
        // keep its name and picture (above) and release the reference
        // (OrderItem.productId is SetNull). This used to throw on the
        // foreign key, and the bulk purge reported the row as "already
        // gone" while it sat in Trash for good.
        await snapshotOrderLinesForProduct(id);
        const merch = await prisma.product.findUnique({ where: { id }, select: { images: true } });
        await prisma.product.delete({ where: { id } });
        // A merch product's own uploads go with it; a legacy product's
        // picture belongs to its artwork and stays.
        merch?.images.forEach((url) => deleteArtworkImage(url).catch(() => {}));
        break;
      case "sections": {
        const artworks = await prisma.artwork.findMany({
          where: { sectionId: id },
          select: { imageUrl: true },
        });
        await prisma.section.delete({ where: { id } });
        artworks.forEach((a) => deleteArtworkImage(a.imageUrl).catch(() => {}));
        break;
      }
      case "notifications":
        await prisma.notification.delete({ where: { id } });
        break;
      case "rooms":
        await prisma.museumRoom.delete({ where: { id } });
        break;
      case "events": {
        const event = await prisma.event.findUnique({
          where: { id },
          select: { media: { select: { url: true } } },
        });
        await prisma.event.delete({ where: { id } }); // cascades EventMedia rows
        event?.media.forEach((m) => deleteArtworkImage(m.url).catch(() => {}));
        break;
      }
      case "freedom-wall-notes":
        // Text-only row — nothing in storage to clean up.
        await prisma.freedomWallNote.delete({ where: { id } });
        break;
      case "freedom-wall-events":
        // Cascades every FreedomWallNote in the event (see prisma/schema.prisma)
        // — including any that were sitting in Trash under "Sticky Notes".
        // All text rows, nothing in storage to clean up.
        await prisma.freedomWallEvent.delete({ where: { id } });
        break;
      case "release-notes":
        // Nothing else points at a release note, so this is a plain delete —
        // no cascade to think about and no uploaded file to clean up.
        await prisma.releaseNote.delete({ where: { id } });
        break;
      case "releases": {
        // Tracks cascade; the cover is the one uploaded file to clean up.
        const release = await prisma.release.findUnique({ where: { id }, select: { coverImageUrl: true } });
        await prisma.release.delete({ where: { id } });
        if (release) deleteArtworkImage(release.coverImageUrl).catch(() => {});
        break;
      }
      case "videos":
        // A YouTube link — nothing of ours in storage.
        await prisma.video.delete({ where: { id } });
        break;
      case "band-members": {
        const member = await prisma.bandMember.findUnique({ where: { id }, select: { photoUrl: true } });
        await prisma.bandMember.delete({ where: { id } });
        if (member?.photoUrl) deleteArtworkImage(member.photoUrl).catch(() => {});
        break;
      }
  }
}
