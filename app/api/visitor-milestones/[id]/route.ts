// app/api/visitor-milestones/[id]/route.ts
//
// PATCH — edit a milestone's threshold/reward/enabled (admin only).
// Re-checks the live count against the (possibly new) threshold the same
// way creating one does, so lowering a threshold below the current count
// achieves it immediately rather than waiting for the count to move
// again. Never clears an already-set achievedAt — see
// app/api/visitor-count/route.ts's markNewlyAchieved doc comment.
//
// DELETE — remove a milestone entirely (admin only). Hard delete, same as
// FAQs/marquees elsewhere in this admin — not every content type here
// goes through Trash. Cascades its claims (see schema's onDelete: Cascade).
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { getErrorCode, getErrorMessage } from "@/lib/utils";

const COUNTER_ID = "singleton";
const MAX_REWARD_LENGTH = 300;

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id } = await params;
    const body = await request.json();
    const data: { threshold?: number; reward?: string; enabled?: boolean } = {};

    if (body.threshold !== undefined) {
      const threshold = Number(body.threshold);
      if (!Number.isInteger(threshold) || threshold <= 0) {
        return NextResponse.json({ error: "Threshold must be a positive whole number" }, { status: 400 });
      }
      data.threshold = threshold;
    }
    if (body.reward !== undefined) {
      const reward = typeof body.reward === "string" ? body.reward.trim() : "";
      if (!reward || reward.length > MAX_REWARD_LENGTH) {
        return NextResponse.json(
          { error: `Reward description is required (max ${MAX_REWARD_LENGTH} characters)` },
          { status: 400 }
        );
      }
      data.reward = reward;
    }
    if (body.enabled !== undefined) {
      if (typeof body.enabled !== "boolean") {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }
      data.enabled = body.enabled;
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const [counter, milestone] = await Promise.all([
      prisma.siteVisitCounter.findUnique({ where: { id: COUNTER_ID } }),
      prisma.visitorMilestone.update({ where: { id }, data }),
    ]);

    if (!milestone.achievedAt && (counter?.count ?? 0) >= milestone.threshold) {
      await prisma.visitorMilestone.update({ where: { id }, data: { achievedAt: new Date() } });
    }

    const updated = await prisma.visitorMilestone.findUnique({ where: { id } });
    revalidatePath("/admin/settings");
    return NextResponse.json(updated);
  } catch (error) {
    if (getErrorCode(error) === "P2025") {
      return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
    }
    if (getErrorCode(error) === "P2002") {
      return NextResponse.json({ error: "A milestone already exists at that visitor count" }, { status: 409 });
    }
    return NextResponse.json({ error: getErrorMessage(error, "Failed to update milestone") }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id } = await params;
    await prisma.visitorMilestone.delete({ where: { id } });
    revalidatePath("/admin/settings");
    return NextResponse.json({ success: true });
  } catch (error) {
    if (getErrorCode(error) === "P2025") {
      return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to delete milestone" }, { status: 500 });
  }
}
