// app/api/visitor-milestones/[id]/claim/route.ts
//
// POST /api/visitor-milestones/[id]/claim — a visitor claims an already-
// achieved milestone's reward by email. No account/session needed (unlike
// Mini Games' reward claim, which ties back to a specific game session) —
// eligibility here is "this milestone has been reached," which is true
// for every visitor once it happens, not something tied to one person's
// play. The real gate is the one-claim-per-email @@unique constraint on
// VisitorMilestoneClaim: reachable eligibility plus a database constraint
// instead of any client-trusted state, same "server re-verifies, the
// client's word is never evidence" principle as
// app/api/minigames/reward/route.ts.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sanitizeEmail } from "@/lib/minigames/config";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/minigames/rate-limit";
import { isMailConfigured, sendVisitorMilestoneClaimedEmail } from "@/lib/mail";
import { getErrorCode, getErrorMessage } from "@/lib/utils";

const CLAIM_LIMIT = { limit: 10, windowMs: 60_000 };

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limit = rateLimit(`visit-claim:${clientIp(request)}`, CLAIM_LIMIT.limit, CLAIM_LIMIT.windowMs);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSec);

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const email = sanitizeEmail(body?.email);
    if (!email) {
      return NextResponse.json({ error: "Please enter a valid email address" }, { status: 400 });
    }

    const milestone = await prisma.visitorMilestone.findUnique({ where: { id } });
    // Recomputed from the row itself, not trusted from whatever the client
    // last fetched — a milestone that isn't enabled or hasn't actually been
    // reached yet is turned away just the same as a fabricated id.
    if (!milestone || !milestone.enabled || !milestone.achievedAt) {
      return NextResponse.json({ error: "This milestone hasn't been reached yet" }, { status: 404 });
    }

    const claim = await prisma.visitorMilestoneClaim.create({
      data: { milestoneId: id, email },
    });

    // Best-effort — an email hiccup shouldn't fail a claim that's already
    // saved. Skipped silently when SMTP is not configured.
    if (isMailConfigured()) {
      sendVisitorMilestoneClaimedEmail(email, {
        threshold: milestone.threshold,
        reward: milestone.reward,
      }).catch(() => {});
    }

    return NextResponse.json({ id: claim.id, reward: milestone.reward }, { status: 201 });
  } catch (error) {
    if (getErrorCode(error) === "P2002") {
      return NextResponse.json({ error: "This email has already claimed this reward" }, { status: 409 });
    }
    return NextResponse.json({ error: getErrorMessage(error, "Failed to claim reward") }, { status: 500 });
  }
}
