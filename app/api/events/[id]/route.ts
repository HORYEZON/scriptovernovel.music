// app/api/events/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { sanitizeShowFields } from "@/lib/shows";
import { revalidateShowPaths } from "@/lib/shows-server";
import { getErrorCode, getErrorMessage } from "@/lib/utils";

// PATCH /api/events/[id] — update (admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id } = await params;
    const body = await request.json();
    const { title, description, venueName, latitude, longitude, eventDate, isNextEvent, enabled, displayOrder } = body;

    const data: Record<string, unknown> = {};

    if (title !== undefined) {
      if (!title?.trim()) return NextResponse.json({ error: "Title cannot be empty." }, { status: 400 });
      data.title = title.trim();
    }
    if (description !== undefined) data.description = description?.trim() || null;
    if (venueName !== undefined) data.venueName = venueName?.trim() || null;
    if (latitude !== undefined) {
      if (typeof latitude !== "number") return NextResponse.json({ error: "Invalid latitude" }, { status: 400 });
      data.latitude = latitude;
    }
    if (longitude !== undefined) {
      if (typeof longitude !== "number") return NextResponse.json({ error: "Invalid longitude" }, { status: 400 });
      data.longitude = longitude;
    }
    if (eventDate !== undefined) data.eventDate = eventDate ? new Date(eventDate) : null;

    // The gig-listing fields (city, lineup, ticket link/price/note, status),
    // validated by the same sanitizer the create route and the admin form use.
    // Only the keys actually sent are touched, so this stays a partial PATCH.
    const gig = sanitizeShowFields(body);
    if ("error" in gig) return NextResponse.json({ error: gig.error }, { status: 400 });
    Object.assign(data, gig.fields);

    if (enabled !== undefined) {
      if (typeof enabled !== "boolean") return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      data.enabled = enabled;
    }
    if (displayOrder !== undefined) data.displayOrder = displayOrder;
    if (isNextEvent !== undefined && typeof isNextEvent !== "boolean") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    if (Object.keys(data).length === 0 && isNextEvent === undefined) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    // Exactly one event is ever "next" — flipping this one on means unsetting
    // it everywhere else, in the same transaction, same convention as
    // MuseumRoom.isEntryRoom (see app/api/digital-museum/rooms/[id]/route.ts).
    const event = isNextEvent
      ? (
          await prisma.$transaction([
            prisma.event.updateMany({
              where: { NOT: { id } },
              data: { isNextEvent: false },
            }),
            prisma.event.update({
              where: { id },
              data: { ...data, isNextEvent: true },
              include: { media: { orderBy: { order: "asc" } } },
            }),
          ])
        )[1]
      : await prisma.event.update({
          where: { id },
          data: isNextEvent === false ? { ...data, isNextEvent: false } : data,
          include: { media: { orderBy: { order: "asc" } } },
        });

    revalidateShowPaths();

    return NextResponse.json(event);
  } catch (error) {
    if (getErrorCode(error) === "P2025") {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    return NextResponse.json({ error: getErrorMessage(error, "Failed to update event") }, { status: 500 });
  }
}

// DELETE /api/events/[id] — soft delete (moves to Trash)
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id } = await params;
    await prisma.event.update({ where: { id }, data: { deletedAt: new Date() } });

    revalidateShowPaths();
    revalidatePath("/admin/trash");

    return NextResponse.json({ success: true });
  } catch (error) {
    if (getErrorCode(error) === "P2025") {
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: "Failed to delete event" }, { status: 500 });
  }
}
