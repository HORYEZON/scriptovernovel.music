// app/api/subscribers/[id]/route.ts
//
// Admin delete for one subscriber row — a real delete, not the `deletedAt` soft
// delete the content modules use and not wired into Trash.
//
// Why: this row is somebody's email address. When the admin removes it they are
// acting on a "delete my data" request or clearing a junk signup, and a Trash
// that keeps the address for thirty days would be the opposite of what was
// asked. Unsubscribing (which keeps the row, so the address is never re-added
// by a later import) is the reversible option, and it is what the public link
// does.
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log-server";
import { getErrorCode } from "@/lib/utils";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id } = await params;
    const row = await prisma.subscriber.delete({ where: { id }, select: { email: true } });

    void logActivity({
      category: "CONTENT",
      action: "subscriber.deleted",
      summary: `Removed ${row.email} from the mailing list.`,
      request,
    });

    revalidatePath("/admin/subscribers");
    return NextResponse.json({ success: true });
  } catch (error) {
    // Already gone is the outcome the caller wanted.
    if (getErrorCode(error) === "P2025") return NextResponse.json({ success: true });
    return NextResponse.json({ error: "Failed to remove subscriber" }, { status: 500 });
  }
}
