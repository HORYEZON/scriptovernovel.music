// app/api/events/public/route.ts — no auth, public Timeline/Gigs map data.
// Only enabled, non-trashed events, ordered so the "next event" pin (if any)
// sorts first, then soonest-upcoming/most-recent first.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const events = await prisma.event.findMany({
      where: { enabled: true, deletedAt: null },
      select: {
        id: true,
        title: true,
        description: true,
        venueName: true,
        latitude: true,
        longitude: true,
        eventDate: true,
        isNextEvent: true,
        createdAt: true,
        media: {
          orderBy: { order: "asc" },
          select: { id: true, url: true, type: true, order: true },
        },
      },
      orderBy: [{ isNextEvent: "desc" }, { eventDate: "desc" }, { displayOrder: "asc" }],
    });
    return NextResponse.json(events);
  } catch {
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
  }
}
