// app/api/stock-notifications/[id]/route.ts
//
// Admin delete for one waiting-list row. A real delete, not a soft one: the row
// is somebody's email address, and the same reasoning as the mailing list
// applies — a Trash that kept it would be the opposite of removing it.
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { getErrorCode } from "@/lib/utils";
import { revalidateStockAlertPaths } from "@/lib/store/notify-server";

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id } = await params;
    await prisma.stockNotification.delete({ where: { id } });
    revalidateStockAlertPaths();
    return NextResponse.json({ success: true });
  } catch (error) {
    // Already gone is the outcome the caller wanted.
    if (getErrorCode(error) === "P2025") return NextResponse.json({ success: true });
    return NextResponse.json({ error: "Failed to remove" }, { status: 500 });
  }
}
