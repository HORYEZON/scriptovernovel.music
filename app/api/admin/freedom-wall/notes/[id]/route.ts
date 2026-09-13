// app/api/admin/freedom-wall/notes/[id]/route.ts
// PATCH  — archive/unarchive a note, and/or save its position/size/wall from
//          the Museum Scene Editor (body: { isArchived? } and/or
//          { positionX?, positionY?, scale?, wall? } — see
//          MuseumEditorClient.tsx's EditableStickyNote, the same
//          drag-then-Save model artwork frames use).
// DELETE — soft-delete a single note (admin only) so it lands in
//          /admin/trash, where it can be viewed, restored or purged. The
//          permanent delete lives there, in /api/trash/[type]/[id].
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

function revalidateWallSurfaces() {
  revalidatePath("/gallery/freedom-wall");
  revalidatePath("/gallery/museum");
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;

  try {
    const body = await request.json().catch(() => ({}));
    const data: Record<string, boolean | number | string> = {};

    if (body.isArchived !== undefined) {
      if (typeof body.isArchived !== "boolean") {
        return NextResponse.json({ error: "isArchived must be a boolean" }, { status: 400 });
      }
      data.isArchived = body.isArchived;
    }

    // Position/size from the Museum Scene Editor's drag + Size slider —
    // same [0, 100] / [0.5, 2.5] ranges the client already clamps to
    // (noteFreeValueToPercentX/noteWorldYToPercentY, NOTE_SCALE_MIN/MAX),
    // re-validated here since this is a public-facing write path.
    for (const [key, range] of [
      ["positionX", [0, 100]],
      ["positionY", [0, 100]],
      ["scale", [0.5, 2.5]],
    ] as const) {
      const value = body[key];
      if (value === undefined) continue;
      if (typeof value !== "number" || !Number.isFinite(value) || value < range[0] || value > range[1]) {
        return NextResponse.json({ error: `${key} must be a number between ${range[0]} and ${range[1]}` }, { status: 400 });
      }
      data[key] = value;
    }

    // Which of the room's 4 walls — set via the Museum Scene Editor's wall
    // picker (same "N/S/E/W buttons" concept as an artwork frame's own).
    if (body.wall !== undefined) {
      if (typeof body.wall !== "string" || !["north", "south", "east", "west"].includes(body.wall)) {
        return NextResponse.json({ error: "wall must be one of north, south, east, west" }, { status: 400 });
      }
      data.wall = body.wall;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No recognised fields in body" }, { status: 400 });
    }

    const note = await prisma.freedomWallNote.update({
      where: { id },
      data,
      select: { id: true, isArchived: true, positionX: true, positionY: true, scale: true, wall: true },
    });

    revalidateWallSurfaces();
    return NextResponse.json(note);
  } catch {
    return NextResponse.json({ error: "Failed to update note" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;

  try {
    // Already-trashed notes are left alone rather than having their deletedAt
    // pushed forward — the original delete time is what Trash sorts on.
    const { count } = await prisma.freedomWallNote.updateMany({
      where: { id, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (count === 0) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }
    revalidateWallSurfaces();
    revalidatePath("/admin/trash");
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Failed to delete note" }, { status: 500 });
  }
}
