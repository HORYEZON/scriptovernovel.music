// app/api/events/reorder/route.ts — batch update display order (admin only)
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function PUT(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await request.json();
    const { order } = body; // Array of { id, displayOrder }

    if (!Array.isArray(order)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    await prisma.$transaction(
      order.map((item: { id: string; displayOrder: number }) =>
        prisma.event.update({
          where: { id: item.id },
          data: { displayOrder: item.displayOrder },
        })
      )
    );

    const events = await prisma.event.findMany({
      where: { deletedAt: null },
      include: { media: { orderBy: { order: "asc" } } },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    });

    revalidatePath("/", "layout");
    revalidatePath("/about");
    revalidatePath("/admin/events");

    return NextResponse.json(events);
  } catch {
    return NextResponse.json({ error: "Failed to reorder events" }, { status: 500 });
  }
}
