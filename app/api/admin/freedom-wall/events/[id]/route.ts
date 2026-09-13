// app/api/admin/freedom-wall/events/[id]/route.ts
// PATCH  — rename an event, archive/unarchive it, OR set it as the active
//          event (body: { title: string } | { isArchived: boolean } |
//          { setActive: true }). Exactly one operation per request; the
//          branches below are checked in that order.
// DELETE — soft-delete the event (moves it to Trash → Freedom Wall → Events).
//          The permanent delete is DELETE /trash/freedom-wall-events/{id}.
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { getErrorCode } from "@/lib/utils";

const EVENT_SELECT = {
  id: true,
  title: true,
  isArchived: true,
  createdAt: true,
  updatedAt: true,
  // Matches GET /events — trashed notes never count toward an event's total.
  _count: { select: { notes: { where: { deletedAt: null } } } },
} as const;

// The active event's title is painted onto the museum's Freedom Wall
// (FreedomWallRoomContents.tsx) and shown on the standalone wall page, so any
// change to which event is active — or to its name — has to bust both.
function revalidateWallSurfaces() {
  revalidatePath("/gallery/freedom-wall");
  revalidatePath("/gallery/museum");
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;

  try {
    const body = await request.json().catch(() => ({}));

    // ── Rename ───────────────────────────────────────────────────────────────
    // Same validation as POST /events so a rename can't produce a title the
    // create endpoint would have rejected.
    if (typeof body.title === "string") {
      const title = body.title.trim();
      if (!title) {
        return NextResponse.json({ error: "Event title is required" }, { status: 400 });
      }
      if (title.length > 120) {
        return NextResponse.json({ error: "Title must be 120 characters or fewer" }, { status: 400 });
      }

      const event = await prisma.freedomWallEvent.update({
        where: { id },
        data: { title },
        select: EVENT_SELECT,
      });

      revalidateWallSurfaces();
      return NextResponse.json(event);
    }

    // ── Set as the active event ──────────────────────────────────────────────
    if (body.setActive === true) {
      const [event, settings] = await prisma.$transaction([
        prisma.freedomWallEvent.findUnique({ where: { id }, select: { id: true } }),
        prisma.freedomWallSettings.upsert({
          where: { id: "singleton" },
          create: { id: "singleton", activeEventId: id },
          update: { activeEventId: id },
          select: { activeEventId: true },
        }),
      ]);
      if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
      revalidateWallSurfaces();
      return NextResponse.json(settings);
    }

    // ── Archive / unarchive ──────────────────────────────────────────────────
    if (typeof body.isArchived === "boolean") {
      const event = await prisma.freedomWallEvent.update({
        where: { id },
        data: { isArchived: body.isArchived },
        select: EVENT_SELECT,
      });

      // If we're archiving the currently-active event, clear activeEventId.
      if (body.isArchived) {
        await prisma.freedomWallSettings.updateMany({
          where: { id: "singleton", activeEventId: id },
          data: { activeEventId: null },
        });
      }

      revalidateWallSurfaces();
      return NextResponse.json(event);
    }

    return NextResponse.json({ error: "No recognised operation in body" }, { status: 400 });
  } catch (err) {
    // prisma.update on a missing row throws P2025 — report that as a 404
    // rather than the blanket 500 every other failure gets.
    if ((err as { code?: string } | null)?.code === "P2025") {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to update event" }, { status: 500 });
  }
}

// DELETE — soft delete. The event drops out of the admin panel and off the
// public wall (its notes go with it, since the wall only ever renders the
// active event's notes); it stays recoverable under Trash until purged.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;

  try {
    await prisma.$transaction([
      prisma.freedomWallEvent.update({
        where: { id },
        data: { deletedAt: new Date() },
        select: { id: true },
      }),
      // A deleted event can't be the one new notes land on — clear it the same
      // way archiving does, so the wall doesn't keep pointing at a trashed row.
      prisma.freedomWallSettings.updateMany({
        where: { id: "singleton", activeEventId: id },
        data: { activeEventId: null },
      }),
    ]);

    revalidateWallSurfaces();
    revalidatePath("/admin/freedom-wall");
    revalidatePath("/admin/trash");
    return NextResponse.json({ success: true });
  } catch (err) {
    if (getErrorCode(err) === "P2025") {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to delete event" }, { status: 500 });
  }
}
