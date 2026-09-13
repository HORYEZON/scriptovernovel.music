// app/api/admin/freedom-wall/events/route.ts
// GET  — list all events (admin only).
// POST — create a new event folder (admin only).
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const events = await prisma.freedomWallEvent.findMany({
      // Trashed events live under Trash → Freedom Wall → Events, never here.
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        isArchived: true,
        createdAt: true,
        updatedAt: true,
        // Trashed notes are excluded everywhere the count is shown, so the
        // number on an event folder always matches the list inside it.
        _count: { select: { notes: { where: { deletedAt: null } } } },
      },
    });

    // Also fetch current activeEventId so the panel can highlight it.
    const settings = await prisma.freedomWallSettings.findUnique({
      where: { id: "singleton" },
      select: { isActive: true, activeEventId: true },
    });

    return NextResponse.json({ events, settings: settings ?? { isActive: false, activeEventId: null } });
  } catch {
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await request.json().catch(() => ({}));
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) {
      return NextResponse.json({ error: "Event title is required" }, { status: 400 });
    }
    if (title.length > 120) {
      return NextResponse.json({ error: "Title must be 120 characters or fewer" }, { status: 400 });
    }

    const event = await prisma.freedomWallEvent.create({
      data: { title },
      select: {
        id: true,
        title: true,
        isArchived: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { notes: { where: { deletedAt: null } } } },
      },
    });

    return NextResponse.json(event, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create event" }, { status: 500 });
  }
}
