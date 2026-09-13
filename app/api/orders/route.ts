// app/api/orders/route.ts
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const orders = await prisma.order.findMany({
      include: {
        items: {
          include: {
            product: {
              include: { artwork: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(orders);
  } catch {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
