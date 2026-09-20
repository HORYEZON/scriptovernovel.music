// app/api/releases/reorder/route.ts — batch update sortOrder (admin only)
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { RELEASE_INCLUDE, revalidateReleasePaths } from "@/lib/releases-server";

export async function PUT(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const { order } = await request.json(); // [{ id, sortOrder }]
    if (!Array.isArray(order) || order.some((o) => typeof o?.id !== "string" || !Number.isInteger(o?.sortOrder))) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    await prisma.$transaction(
      order.map((item: { id: string; sortOrder: number }) =>
        prisma.release.update({ where: { id: item.id }, data: { sortOrder: item.sortOrder } })
      )
    );
    const releases = await prisma.release.findMany({
      where: { deletedAt: null },
      include: RELEASE_INCLUDE,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });
    revalidateReleasePaths();
    return NextResponse.json(releases);
  } catch {
    return NextResponse.json({ error: "Failed to reorder releases" }, { status: 500 });
  }
}
