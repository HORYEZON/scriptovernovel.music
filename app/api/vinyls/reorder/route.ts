// app/api/vinyls/reorder/route.ts — batch update sortOrder (admin only)
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { VINYL_INCLUDE, revalidateVinylPaths, toAdminVinyl } from "@/lib/vinyls-server";

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
        prisma.vinylRecord.update({ where: { id: item.id }, data: { sortOrder: item.sortOrder } })
      )
    );
    const vinyls = await prisma.vinylRecord.findMany({
      where: { deletedAt: null },
      include: VINYL_INCLUDE,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });
    revalidateVinylPaths();
    return NextResponse.json(vinyls.map(toAdminVinyl));
  } catch {
    return NextResponse.json({ error: "Failed to reorder vinyls" }, { status: 500 });
  }
}
