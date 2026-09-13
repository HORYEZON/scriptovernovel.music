// app/api/sections/reorder/route.ts
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

// PUT /api/sections/reorder — batch update display order
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
        prisma.section.update({
          where: { id: item.id },
          data: { displayOrder: item.displayOrder },
        })
      )
    );

    const sections = await prisma.section.findMany({
      orderBy: { displayOrder: "asc" },
      include: { _count: { select: { artworks: true } } },
    });

    revalidatePath("/", "layout");
    revalidatePath("/admin/artworks");

    return NextResponse.json(sections);
  } catch {
    return NextResponse.json({ error: "Failed to reorder" }, { status: 500 });
  }
}
