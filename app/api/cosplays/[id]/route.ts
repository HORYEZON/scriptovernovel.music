// app/api/cosplays/[id]/route.ts
//
// Mirrors app/api/stories/[id]/route.ts: GET is public, PATCH/DELETE are
// admin-gated, DELETE is a soft delete (deletedAt) so the row lands in the Trash
// module rather than disappearing.
//
// Unpublishing or deleting a cosplay is what takes its standee out of the museum
// — syncCosplayRoomEntries (lib/museum/cosplayRoom.ts) reconciles on the next
// load, so nothing here has to know that room exists.
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { getErrorCode } from "@/lib/utils";

function revalidateCosplayPaths() {
  revalidatePath("/", "layout");
  revalidatePath("/admin/cosplays");
  revalidatePath("/gallery/museum");
}

function trimmed(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parsedYear(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const year = typeof value === "number" ? value : parseInt(String(value), 10);
  return Number.isFinite(year) ? year : null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cosplay = await prisma.cosplay.findUnique({ where: { id } });
    if (!cosplay) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(cosplay);
  } catch {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id } = await params;
    const body = await request.json();
    const {
      title,
      description,
      character,
      series,
      standeeImageUrl,
      backdropImageUrl,
      cosplayer,
      photographer,
      year,
      event,
      published,
      displayOrder,
    } = body;

    const cosplay = await prisma.cosplay.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description: trimmed(description) }),
        ...(character !== undefined && { character: trimmed(character) }),
        ...(series !== undefined && { series: trimmed(series) }),
        // slug is deliberately never updated here, even if the title changes —
        // see the comment on POST in ../route.ts.
        ...(standeeImageUrl !== undefined && standeeImageUrl && { standeeImageUrl }),
        ...(backdropImageUrl !== undefined && { backdropImageUrl: trimmed(backdropImageUrl) }),
        ...(cosplayer !== undefined && { cosplayer: trimmed(cosplayer) }),
        ...(photographer !== undefined && { photographer: trimmed(photographer) }),
        ...(year !== undefined && { year: parsedYear(year) }),
        ...(event !== undefined && { event: trimmed(event) }),
        ...(published !== undefined && { published }),
        ...(displayOrder !== undefined && { displayOrder }),
      },
    });

    revalidateCosplayPaths();

    return NextResponse.json(cosplay);
  } catch (error) {
    if (getErrorCode(error) === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id } = await params;

    await prisma.cosplay.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    revalidateCosplayPaths();

    return NextResponse.json({ success: true });
  } catch (error) {
    if (getErrorCode(error) === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
