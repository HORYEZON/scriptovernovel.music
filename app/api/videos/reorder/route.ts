// app/api/videos/reorder/route.ts — batch update sortOrder (admin only)
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { VIDEO_INCLUDE, revalidateVideoPaths } from "@/lib/videos-server";

export async function PUT(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const { order } = await request.json();
    if (!Array.isArray(order) || order.some((o) => typeof o?.id !== "string" || !Number.isInteger(o?.sortOrder))) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    await prisma.$transaction(
      order.map((item: { id: string; sortOrder: number }) =>
        prisma.video.update({ where: { id: item.id }, data: { sortOrder: item.sortOrder } })
      )
    );
    const videos = await prisma.video.findMany({
      where: { deletedAt: null },
      include: VIDEO_INCLUDE,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });
    revalidateVideoPaths();
    return NextResponse.json(videos);
  } catch {
    return NextResponse.json({ error: "Failed to reorder videos" }, { status: 500 });
  }
}
