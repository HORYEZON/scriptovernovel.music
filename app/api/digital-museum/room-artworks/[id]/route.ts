// app/api/digital-museum/room-artworks/[id]/route.ts
//
// Backs the Museum Scene Editor's artwork-frame placement controls — [id]
// is the MuseumRoomArtwork join row's own id (the same one PickerEntry.id
// already uses in ArtworkPicker.tsx/RoomsTab.tsx), not the artworkId.
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { getErrorCode } from "@/lib/utils";

function revalidateMuseumPaths() {
  revalidatePath("/", "layout");
  revalidatePath("/admin/artworks");
  revalidatePath("/gallery/museum");
}

// PATCH /api/digital-museum/room-artworks/[id] — set (or clear, via null)
// a frame's custom position and/or resize scale.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id } = await params;
    const body = await request.json();
    const { positionX, positionY, positionZ, rotationY, scale } = body;

    const data: Record<string, number | null> = {};

    // Position is all-or-nothing — either every one of the four is a
    // finite number (a custom placement), or every one is explicitly null
    // (reset back to framePlacement.ts's auto layout, including its fixed
    // FRAME_CENTER_Y height). A request that only sends some of them is
    // rejected rather than guessed at.
    const positionFields = { positionX, positionY, positionZ, rotationY };
    const providedPositionKeys = Object.keys(positionFields).filter(
      (k) => positionFields[k as keyof typeof positionFields] !== undefined
    );
    if (providedPositionKeys.length > 0) {
      if (providedPositionKeys.length !== 4) {
        return NextResponse.json(
          { error: "positionX, positionY, positionZ, and rotationY must be set (or cleared) together" },
          { status: 400 }
        );
      }
      const allNull = positionX === null && positionY === null && positionZ === null && rotationY === null;
      const allNumbers =
        typeof positionX === "number" &&
        Number.isFinite(positionX) &&
        typeof positionY === "number" &&
        Number.isFinite(positionY) &&
        typeof positionZ === "number" &&
        Number.isFinite(positionZ) &&
        typeof rotationY === "number" &&
        Number.isFinite(rotationY);
      if (!allNull && !allNumbers) {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }
      data.positionX = positionX;
      data.positionY = positionY;
      data.positionZ = positionZ;
      data.rotationY = rotationY;
    }

    if (scale !== undefined) {
      if (scale !== null && (typeof scale !== "number" || !Number.isFinite(scale) || scale <= 0)) {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }
      data.scale = scale;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const entry = await prisma.museumRoomArtwork.update({
      where: { id },
      data,
      select: { id: true, positionX: true, positionY: true, positionZ: true, rotationY: true, scale: true },
    });

    revalidateMuseumPaths();

    return NextResponse.json(entry);
  } catch (error) {
    if (getErrorCode(error) === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to update placement" }, { status: 500 });
  }
}
