// app/api/digital-museum/rooms/reorder/route.ts
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

// PUT /api/digital-museum/rooms/reorder — batch update room display order
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
        prisma.museumRoom.update({
          where: { id: item.id },
          data: { displayOrder: item.displayOrder },
        })
      )
    );

    // ABOUT excluded, same as rooms/route.ts's GET — never part of this
    // admin-CRUD/reorderable list.
    const rooms = await prisma.museumRoom.findMany({
      where: { deletedAt: null, roomType: { not: "ABOUT" } },
      orderBy: { displayOrder: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        roomType: true,
        displayOrder: true,
        enabled: true,
        isEntryRoom: true,
        wallColor: true,
        floorColor: true,
        ceilingColor: true,
        wallTexture: true,
        floorTexture: true,
        ceilingTexture: true,
        splashIcon: true,
        splashTitle: true,
        _count: { select: { artworks: true } },
      },
    });

    revalidatePath("/", "layout");
    revalidatePath("/admin/artworks");
    revalidatePath("/gallery/museum");

    return NextResponse.json(rooms);
  } catch {
    return NextResponse.json({ error: "Failed to reorder rooms" }, { status: 500 });
  }
}
