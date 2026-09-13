// app/api/digital-museum/rooms/[id]/artworks/route.ts
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { getErrorCode } from "@/lib/utils";

const ARTWORK_SELECT = {
  id: true,
  displayOrder: true,
  createdAt: true,
  artwork: {
    select: { id: true, title: true, imageUrl: true, published: true, slug: true },
  },
} as const;

function revalidateMuseumPaths() {
  revalidatePath("/", "layout");
  revalidatePath("/admin/artworks");
  revalidatePath("/gallery/museum");
}

// POST /api/digital-museum/rooms/[id]/artworks — add an existing artwork to this room
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id: roomId } = await params;
  let artworkId: string | undefined;
  try {
    const body = await request.json();
    artworkId = body.artworkId;

    if (!artworkId || typeof artworkId !== "string") {
      return NextResponse.json({ error: "Missing artworkId" }, { status: 400 });
    }

    const [room, artwork] = await Promise.all([
      prisma.museumRoom.findUnique({ where: { id: roomId }, select: { id: true } }),
      prisma.artwork.findFirst({ where: { id: artworkId, deletedAt: null }, select: { id: true } }),
    ]);
    if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });
    if (!artwork) return NextResponse.json({ error: "Artwork not found" }, { status: 404 });

    const count = await prisma.museumRoomArtwork.count({ where: { roomId } });

    const entry = await prisma.museumRoomArtwork.create({
      data: { roomId, artworkId, displayOrder: count },
      select: ARTWORK_SELECT,
    });

    revalidateMuseumPaths();

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    // Already selected — treat as a no-op success rather than an error,
    // since the admin UI's checkbox/button state can only ever request "on".
    if (getErrorCode(error) === "P2002" && artworkId) {
      const existing = await prisma.museumRoomArtwork.findUnique({
        where: { roomId_artworkId: { roomId, artworkId } },
        select: ARTWORK_SELECT,
      });
      return NextResponse.json(existing ?? { error: "Already in room" }, { status: 200 });
    }
    return NextResponse.json({ error: "Failed to add artwork" }, { status: 500 });
  }
}

// DELETE /api/digital-museum/rooms/[id]/artworks?artworkId=... — remove an artwork from this room
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id: roomId } = await params;
    const { searchParams } = new URL(request.url);
    const artworkId = searchParams.get("artworkId");

    if (!artworkId) {
      return NextResponse.json({ error: "Missing artworkId" }, { status: 400 });
    }

    await prisma.museumRoomArtwork.delete({
      where: { roomId_artworkId: { roomId, artworkId } },
    });

    revalidateMuseumPaths();

    return NextResponse.json({ success: true });
  } catch (error) {
    if (getErrorCode(error) === "P2025") {
      // Already gone — treat as success, nothing left to remove.
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: "Failed to remove artwork" }, { status: 500 });
  }
}
