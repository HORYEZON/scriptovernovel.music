// app/api/minigames/claims/[id]/route.ts
//
// PATCH — move a reward claim through PENDING → FULFILLED / REJECTED so the
// admin can track which rewards have actually been handed out. Admin only.
//
// The score, email and reward text are immutable: this endpoint changes the
// status field and nothing else.
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import type { RewardClaimStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const CLAIM_STATUSES: RewardClaimStatus[] = [
  "PENDING",
  "FULFILLED",
  "REJECTED",
];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id } = await params;
    const body = await request.json().catch(() => null);
    const status = (body as { status?: unknown } | null)?.status;

    if (
      typeof status !== "string" ||
      !CLAIM_STATUSES.includes(status as RewardClaimStatus)
    ) {
      return NextResponse.json({ error: "Unknown status." }, { status: 400 });
    }

    await prisma.rewardClaim.update({
      where: { id },
      data: { status: status as RewardClaimStatus },
    });

    revalidatePath("/admin/settings/minigames");
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Claim not found." }, { status: 404 });
  }
}
