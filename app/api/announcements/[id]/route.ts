// app/api/announcements/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { getErrorMessage } from "@/lib/utils";

// GET /api/announcements/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const announcement = await prisma.announcement.findUnique({
      where: { id },
    });

    if (!announcement) {
      return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
    }

    return NextResponse.json(announcement);
  } catch {
    return NextResponse.json({ error: "Failed to fetch announcement" }, { status: 500 });
  }
}

// PATCH /api/announcements/[id] - update (admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id } = await params;
    const body = await request.json();
    const { title, message, imageUrl, linkUrl, linkLabel, startDate, endDate, isHidden, priority } = body;

    const existing = await prisma.announcement.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
    }

    const start = startDate ? new Date(startDate) : existing.startDate;
    const end = endDate ? new Date(endDate) : existing.endDate;

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json({ error: "Invalid start or end date format." }, { status: 400 });
    }

    if (end <= start) {
      return NextResponse.json({ error: "End date and time must be after start date and time." }, { status: 400 });
    }

    const updated = await prisma.announcement.update({
      where: { id },
      data: {
        ...(title !== undefined && { title: title.trim() }),
        ...(message !== undefined && { message: message ? message.trim() : null }),
        ...(imageUrl !== undefined && { imageUrl: imageUrl || null }),
        ...(linkUrl !== undefined && { linkUrl: linkUrl ? linkUrl.trim() : null }),
        ...(linkLabel !== undefined && { linkLabel: linkLabel ? linkLabel.trim() : "Click here to check more info" }),
        ...(startDate !== undefined && { startDate: start }),
        ...(endDate !== undefined && { endDate: end }),
        ...(isHidden !== undefined && { isHidden: Boolean(isHidden) }),
        ...(priority !== undefined && { priority: typeof priority === "number" ? priority : parseInt(priority) || 0 }),
      },
    });

    revalidatePath("/", "layout");
    revalidatePath("/admin/announcement");

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Failed to update announcement") }, { status: 500 });
  }
}

// DELETE /api/announcements/[id] - soft delete (moves to trash)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id } = await params;

    await prisma.announcement.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    revalidatePath("/", "layout");
    revalidatePath("/admin/announcement");

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete announcement" }, { status: 500 });
  }
}
