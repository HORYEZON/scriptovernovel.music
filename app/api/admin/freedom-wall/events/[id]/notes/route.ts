// app/api/admin/freedom-wall/events/[id]/notes/route.ts
// GET    — list an event's notes (admin only; includes archived ones, but
//          never trashed ones — those are managed from /admin/trash).
// DELETE — bulk soft-delete every note under an event, sending them all to
//          /admin/trash in one go.
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;

  try {
    const notes = await prisma.freedomWallNote.findMany({
      where: { eventId: id, deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        nickname: true,
        content: true,
        color: true,
        isArchived: true,
        createdAt: true,
      },
    });
    return NextResponse.json(notes);
  } catch {
    return NextResponse.json({ error: "Failed to fetch notes" }, { status: 500 });
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
    const { count } = await prisma.freedomWallNote.updateMany({
      where: { eventId: id, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    revalidatePath("/gallery/freedom-wall");
    revalidatePath("/gallery/museum");
    revalidatePath("/admin/trash");
    return NextResponse.json({ deleted: count });
  } catch {
    return NextResponse.json({ error: "Failed to delete notes" }, { status: 500 });
  }
}
