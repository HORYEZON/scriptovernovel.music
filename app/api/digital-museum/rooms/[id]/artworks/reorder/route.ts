// app/api/digital-museum/rooms/[id]/artworks/reorder/route.ts
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

// PUT /api/digital-museum/rooms/[id]/artworks/reorder — batch update display order
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id: roomId } = await params;
    const body = await request.json();
    const { order } = body; // Array of { id, displayOrder } (id = MuseumRoomArtwork row id)

    if (!Array.isArray(order)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    await prisma.$transaction(
      order.map((item: { id: string; displayOrder: number }) =>
        prisma.museumRoomArtwork.update({
          where: { id: item.id },
          data: { displayOrder: item.displayOrder },
        })
      )
    );

    const artworks = await prisma.museumRoomArtwork.findMany({
      where: { roomId },
      orderBy: { displayOrder: "asc" },
      select: {
        id: true,
        displayOrder: true,
        createdAt: true,
        artwork: {
          select: { id: true, title: true, imageUrl: true, published: true, slug: true },
        },
      },
    });

    revalidatePath("/", "layout");
    revalidatePath("/admin/artworks");
    revalidatePath("/gallery/museum");

    return NextResponse.json(artworks);
  } catch {
    return NextResponse.json({ error: "Failed to reorder" }, { status: 500 });
  }
}
