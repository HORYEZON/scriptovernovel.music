// app/api/products/reorder/route.ts — batch update sortOrder (admin only)
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { PRODUCT_ARTWORK_SELECT } from "@/lib/store/queries";
import { revalidateStorePaths } from "@/lib/store/revalidate";

export async function PUT(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const { order } = await request.json();
    if (!Array.isArray(order) || order.some((o) => typeof o?.id !== "string" || !Number.isInteger(o?.sortOrder))) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    await prisma.$transaction(
      order.map((item: { id: string; sortOrder: number }) => prisma.product.update({ where: { id: item.id }, data: { sortOrder: item.sortOrder } }))
    );
    revalidateStorePaths();
    return NextResponse.json(
      await prisma.product.findMany({
        where: { deletedAt: null },
        include: { artwork: PRODUCT_ARTWORK_SELECT, variants: { orderBy: { sortOrder: "asc" } } },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      })
    );
  } catch {
    return NextResponse.json({ error: "Failed to reorder" }, { status: 500 });
  }
}
