// app/api/admin/notifications/[id]/route.ts
//
// PATCH  — { isSpam: boolean } or { isArchived: boolean } (exactly one) —
//          Gmail-only spam toggle, or the archive toggle (every type).
//          Marking either also marks the row read (an admin triaging it
//          doesn't need it nagging the unread badge afterward).
// DELETE — soft delete (deletedAt = now), same convention as every other
//          trashable resource (e.g. app/api/artworks/[id]/route.ts) —
//          surfaces in /admin/trash for restore or permanent deletion via
//          app/api/trash/[type]/[id]/route.ts.
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { getErrorCode } from "@/lib/utils";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id } = await params;
    const body = (await request.json().catch(() => null)) as
      | { isSpam?: unknown; isArchived?: unknown }
      | null;

    const hasSpam = typeof body?.isSpam === "boolean";
    const hasArchived = typeof body?.isArchived === "boolean";
    if (!hasSpam && !hasArchived) {
      return NextResponse.json({ error: "Malformed request." }, { status: 400 });
    }

    const flaggedOn = (hasSpam && body!.isSpam) || (hasArchived && body!.isArchived);

    await prisma.notification.update({
      where: { id },
      data: {
        ...(hasSpam ? { isSpam: body!.isSpam as boolean } : {}),
        ...(hasArchived ? { isArchived: body!.isArchived as boolean } : {}),
        ...(flaggedOn ? { readAt: new Date() } : {}),
      },
    });

    revalidatePath("/admin/notifications");

    return NextResponse.json({ success: true });
  } catch (error) {
    if (getErrorCode(error) === "P2025") {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    console.error("[notifications] failed to update notification flags", error);
    return NextResponse.json({ error: "Could not update that notification." }, { status: 500 });
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

    await prisma.notification.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    revalidatePath("/admin/notifications");
    revalidatePath("/admin/trash");

    return NextResponse.json({ success: true });
  } catch (error) {
    if (getErrorCode(error) === "P2025") {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    console.error("[notifications] failed to delete notification", error);
    return NextResponse.json({ error: "Could not delete that notification." }, { status: 500 });
  }
}
