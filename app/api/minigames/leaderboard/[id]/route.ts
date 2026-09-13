// app/api/minigames/leaderboard/[id]/route.ts
//
// DELETE — remove a single leaderboard entry. Admin only.
//
// There is deliberately no PATCH here: nobody, admin included, edits a score
// in place. A bad entry is removed; a good one is what the server computed.
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id } = await params;
    await prisma.leaderboardEntry.delete({ where: { id } });
    revalidatePath("/admin/settings/minigames");
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Entry not found." }, { status: 404 });
  }
}
