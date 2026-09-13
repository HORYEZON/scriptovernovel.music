// app/api/visitor-milestones/route.ts
//
// Admin CRUD for visitor-count reward milestones (Settings ▸ Visitor
// Milestones) — GET lists every milestone (achieved or not, with its full
// reward text) plus the live running count for context; POST creates a
// new one with an admin-chosen threshold and reward. Public visitors never
// hit this route — see app/api/visitor-count/route.ts for the
// cookie-gated ping and app/api/visitor-milestones/[id]/claim/route.ts for
// claiming an already-achieved one.
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { getErrorCode, getErrorMessage } from "@/lib/utils";

const COUNTER_ID = "singleton";
const MAX_REWARD_LENGTH = 300;

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const [counter, milestones] = await Promise.all([
      prisma.siteVisitCounter.findUnique({ where: { id: COUNTER_ID } }),
      prisma.visitorMilestone.findMany({
        orderBy: { threshold: "asc" },
        include: { _count: { select: { claims: true } } },
      }),
    ]);
    return NextResponse.json({ count: counter?.count ?? 0, milestones });
  } catch {
    return NextResponse.json({ error: "Failed to fetch visitor milestones" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await request.json();
    const threshold = Number(body.threshold);
    const reward = typeof body.reward === "string" ? body.reward.trim() : "";

    if (!Number.isInteger(threshold) || threshold <= 0) {
      return NextResponse.json({ error: "Threshold must be a positive whole number" }, { status: 400 });
    }
    if (!reward || reward.length > MAX_REWARD_LENGTH) {
      return NextResponse.json(
        { error: `Reward description is required (max ${MAX_REWARD_LENGTH} characters)` },
        { status: 400 }
      );
    }

    // A milestone added below the count the site has already reached is
    // achieved immediately, not left waiting for the count to reach it a
    // second time — same "if the visitor already qualifies, they qualify"
    // instinct as MiniGame's reward threshold.
    const counter = await prisma.siteVisitCounter.findUnique({ where: { id: COUNTER_ID } });
    const alreadyReached = (counter?.count ?? 0) >= threshold;

    const milestone = await prisma.visitorMilestone.create({
      data: { threshold, reward, achievedAt: alreadyReached ? new Date() : null },
    });

    revalidatePath("/admin/settings");
    return NextResponse.json(milestone, { status: 201 });
  } catch (error) {
    if (getErrorCode(error) === "P2002") {
      return NextResponse.json({ error: "A milestone already exists at that visitor count" }, { status: 409 });
    }
    return NextResponse.json({ error: getErrorMessage(error, "Failed to create milestone") }, { status: 500 });
  }
}
