// app/api/admin/blocked-emails/[id]/route.ts
//
// DELETE — unblock: removes the row outright (not a soft delete — a block
// list has no "trash" concept, and there's nothing worth recovering here).
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { getErrorCode } from "@/lib/utils";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id } = await params;
    await prisma.blockedEmail.delete({ where: { id } });
    revalidatePath("/admin/settings/blocked-emails");
    return NextResponse.json({ success: true });
  } catch (error) {
    if (getErrorCode(error) === "P2025") {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    console.error("[blocked-emails] failed to unblock", error);
    return NextResponse.json({ error: "Could not unblock that email." }, { status: 500 });
  }
}
