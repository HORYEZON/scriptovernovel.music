// app/api/band-members/reorder/route.ts — batch update sortOrder (admin only)
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { revalidateMemberPaths } from "@/lib/band-members-server";

export async function PUT(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const { order } = await request.json();
    if (!Array.isArray(order) || order.some((o) => typeof o?.id !== "string" || !Number.isInteger(o?.sortOrder))) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    await prisma.$transaction(
      order.map((item: { id: string; sortOrder: number }) => prisma.bandMember.update({ where: { id: item.id }, data: { sortOrder: item.sortOrder } }))
    );
    revalidateMemberPaths();
    return NextResponse.json(await prisma.bandMember.findMany({ where: { deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }));
  } catch {
    return NextResponse.json({ error: "Failed to reorder band members" }, { status: 500 });
  }
}
