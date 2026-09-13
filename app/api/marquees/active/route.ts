// app/api/marquees/active/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/marquees/active - every marquee currently inside its schedule
// window, highest priority first. Null start/end mean "unbounded".
export async function GET() {
  try {
    const now = new Date();

    const marquees = await prisma.marqueeAnnouncement
      .findMany({
        where: {
          deletedAt: null,
          isActive: true,
          AND: [
            { OR: [{ startDate: null }, { startDate: { lte: now } }] },
            { OR: [{ endDate: null }, { endDate: { gte: now } }] },
          ],
        },
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      })
      .catch(() => []);

    return NextResponse.json(marquees);
  } catch {
    return NextResponse.json({ error: "Failed to fetch active marquees" }, { status: 500 });
  }
}
