// app/api/events/media/route.ts — attach/remove one EventMedia row after an
// upload via /api/upload/event-image or /api/upload/event-video already
// returned its public URL. Separate from the Event PATCH route since media
// is a one-to-many child list, not a flat field on the event itself.
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { deleteArtworkImage } from "@/lib/storage/server";
import { getErrorCode, getErrorMessage } from "@/lib/utils";

function revalidateEventPaths() {
  revalidatePath("/", "layout");
  revalidatePath("/about");
  revalidatePath("/admin/events");
}

// POST /api/events/media — attach a new media item to an event
export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await request.json();
    const { eventId, url, type } = body;

    if (!eventId || !url || (type !== "IMAGE" && type !== "VIDEO")) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const maxOrder = await prisma.eventMedia.aggregate({
      where: { eventId },
      _max: { order: true },
    });

    const media = await prisma.eventMedia.create({
      data: { eventId, url, type, order: (maxOrder._max.order ?? -1) + 1 },
    });

    revalidateEventPaths();

    return NextResponse.json(media, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Failed to attach media") }, { status: 500 });
  }
}

// PUT /api/events/media — batch update media display order (drag-to-reorder
// in the admin's Create/Edit Event modal). Same shape as /api/events/reorder
// and /api/faqs/reorder — { order: [{ id, order }] }.
export async function PUT(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await request.json();
    const { order } = body;

    if (!Array.isArray(order)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    await prisma.$transaction(
      order.map((item: { id: string; order: number }) =>
        prisma.eventMedia.update({ where: { id: item.id }, data: { order: item.order } })
      )
    );

    revalidateEventPaths();

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to reorder media" }, { status: 500 });
  }
}

// DELETE /api/events/media?id=... — remove one media item (and its stored file)
export async function DELETE(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const id = request.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const media = await prisma.eventMedia.delete({ where: { id } });
    deleteArtworkImage(media.url).catch(() => {});

    revalidateEventPaths();

    return NextResponse.json({ success: true });
  } catch (error) {
    if (getErrorCode(error) === "P2025") {
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: "Failed to remove media" }, { status: 500 });
  }
}
