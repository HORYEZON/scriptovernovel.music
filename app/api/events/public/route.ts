// app/api/events/public/route.ts — no auth, public gig/map data. Only
// enabled, non-trashed events, ordered so the "next event" pin (if any) sorts
// first, then soonest-upcoming/most-recent first.
//
// Selects through lib/shows-server's SHOW_SELECT, so this endpoint carries the
// same fields /shows renders (city, lineup, ticket link/price/note, status) and
// cannot drift from the page.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PUBLIC_SHOW_WHERE, SHOW_SELECT, toPublicShow } from "@/lib/shows-server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const events = await prisma.event.findMany({
      where: PUBLIC_SHOW_WHERE,
      select: SHOW_SELECT,
      orderBy: [{ isNextEvent: "desc" }, { eventDate: "desc" }, { displayOrder: "asc" }],
    });
    return NextResponse.json(events.map(toPublicShow));
  } catch {
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
  }
}
