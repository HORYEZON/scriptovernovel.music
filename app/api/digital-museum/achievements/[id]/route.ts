// app/api/digital-museum/achievements/[id]/route.ts
//
// PATCH — edit an achievement's threshold/reward/enabled (admin only).
// DELETE — remove one entirely (admin only, hard delete — same as
// Visitor Milestones, not every content type here goes through Trash).
// Cascades its claims (see schema's onDelete: Cascade). Category is
// intentionally not editable here — changing what an already-created
// achievement measures would silently invalidate anyone mid-session
// tracking toward it; delete and recreate instead.
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { getErrorCode, getErrorMessage } from "@/lib/utils";

const MAX_REWARD_LENGTH = 300;

function revalidateAchievementPaths() {
  revalidatePath("/admin/artworks");
  revalidatePath("/gallery/museum");
}

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

    const achievement = await prisma.museumAchievement.update({ where: { id }, data });
    revalidateAchievementPaths();
    return NextResponse.json(achievement);
  } catch (error) {
    if (getErrorCode(error) === "P2025") {
      return NextResponse.json({ error: "Achievement not found" }, { status: 404 });
    }
    if (getErrorCode(error) === "P2002") {
      return NextResponse.json({ error: "An achievement already exists at that category + threshold" }, { status: 409 });
    }
    return NextResponse.json({ error: getErrorMessage(error, "Failed to update achievement") }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id } = await params;
    await prisma.museumAchievement.delete({ where: { id } });
    revalidateAchievementPaths();
    return NextResponse.json({ success: true });
  } catch (error) {
    if (getErrorCode(error) === "P2025") {
      return NextResponse.json({ error: "Achievement not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to delete achievement" }, { status: 500 });
  }
}
