// app/api/announcements/active/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/announcements/active - get the top active announcement
export async function GET() {
  try {
    const now = new Date();

    const activeAnnouncement = await prisma.announcement
      .findFirst({
        where: {
          deletedAt: null,
          isHidden: false,
          startDate: { lte: now },
          endDate: { gte: now },
        },
        orderBy: [
          { priority: "desc" },
          { createdAt: "desc" },
        ],
      })
      .catch(() => null);

    return NextResponse.json(activeAnnouncement || null);
  } catch {
    return NextResponse.json({ error: "Failed to fetch active announcement" }, { status: 500 });
  }
}
