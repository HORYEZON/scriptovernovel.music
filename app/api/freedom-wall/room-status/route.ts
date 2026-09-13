// app/api/freedom-wall/room-status/route.ts
// Public — no auth required. Returns whether the Freedom Wall room is active
// and which event is currently accepting notes, so the public page can gate
// the submission form and display the right room state.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const settings = await prisma.freedomWallSettings.findUnique({
      where: { id: "singleton" },
      select: {
        isActive: true,
        activeEvent: {
          select: { id: true, title: true, isArchived: true },
        },
      },
    });

    // No row yet → treat as inactive.
    if (!settings) {
      return NextResponse.json({ isActive: false, activeEvent: null });
    }

    return NextResponse.json({
      isActive: settings.isActive,
      activeEvent: settings.activeEvent ?? null,
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch room status" }, { status: 500 });
  }
}
