// app/api/marquees/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { sanitizeMarquee } from "@/lib/marquee";
import { getErrorCode, getErrorMessage } from "@/lib/utils";

// GET /api/marquees/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const marquee = await prisma.marqueeAnnouncement.findUnique({ where: { id } });

    if (!marquee || marquee.deletedAt) {
      return NextResponse.json({ error: "Marquee not found" }, { status: 404 });
    }

    return NextResponse.json(marquee);
  } catch {
    return NextResponse.json({ error: "Failed to fetch marquee" }, { status: 500 });
  }
}

// PATCH /api/marquees/[id] - update (admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.marqueeAnnouncement.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      return NextResponse.json({ error: "Marquee not found" }, { status: 404 });
    }

    // Merge onto the stored row first so partial payloads — the quick
    // isActive toggle sends only that one key — still validate as a whole.
    const merged = {
      ...existing,
      startDate: existing.startDate?.toISOString() ?? null,
      endDate: existing.endDate?.toISOString() ?? null,
      ...body,
    };

    const result = sanitizeMarquee(merged);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

    const updated = await prisma.marqueeAnnouncement.update({
      where: { id },
      data: result.data,
    });

    revalidatePath("/", "layout");
    revalidatePath("/admin/announcement");

    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json(
      { error: getErrorMessage(err, "Failed to update marquee") },
      { status: 500 }
    );
  }
}

// DELETE /api/marquees/[id] - soft delete (moves to trash)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id } = await params;

    await prisma.marqueeAnnouncement.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    revalidatePath("/", "layout");
    revalidatePath("/admin/announcement");
    revalidatePath("/admin/trash");

    return NextResponse.json({ success: true });
  } catch (error) {
    if (getErrorCode(error) === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to delete marquee" }, { status: 500 });
  }
}
