// app/api/events/route.ts
//
// Timeline/Gigs Event module — admin list + create. Mirrors app/api/faqs
// (displayOrder auto-append on create) plus MuseumRoom's soft-delete
// convention (deletedAt, excluded here since this is the admin list).
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { sanitizeShowFields } from "@/lib/shows";
import { revalidateShowPaths } from "@/lib/shows-server";
import { getErrorMessage } from "@/lib/utils";

// GET /api/events — list all live (non-trashed) events, admin only
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const events = await prisma.event.findMany({
      where: { deletedAt: null },
      include: { media: { orderBy: { order: "asc" } } },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json(events);
  } catch {
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
  }
}

// POST /api/events — create (admin only)
export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await request.json();
    const { title, description, venueName, latitude, longitude, eventDate, enabled } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: "Title is required." }, { status: 400 });
    }
    if (typeof latitude !== "number" || typeof longitude !== "number") {
      return NextResponse.json({ error: "A map location (latitude/longitude) is required." }, { status: 400 });
    }

    // The gig-listing fields, through the same sanitizer the PATCH route and
    // the admin form use.
    const gig = sanitizeShowFields(body);
    if ("error" in gig) return NextResponse.json({ error: gig.error }, { status: 400 });

    const maxOrder = await prisma.event.aggregate({ _max: { displayOrder: true } });
    const displayOrder = (maxOrder._max.displayOrder ?? -1) + 1;

    const event = await prisma.event.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        venueName: venueName?.trim() || null,
        latitude,
        longitude,
        eventDate: eventDate ? new Date(eventDate) : null,
        enabled: enabled ?? true,
        displayOrder,
        ...gig.fields,
      },
      include: { media: true },
    });

    revalidateShowPaths();

    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Failed to create event") }, { status: 500 });
  }
}
