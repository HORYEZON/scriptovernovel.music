// app/api/digital-museum/achievements/[id]/claim/route.ts
//
// POST — a visitor claims an earned Digital Museum Achievement by name +
// email. Same shape as app/api/visitor-milestones/[id]/claim/route.ts
// (email-gated, one claim per email per achievement via a database
// unique constraint), but with a real difference worth being explicit
// about: Visitor Milestones' eligibility is a server-authoritative
// counter, and Mini Games' is a server-verified puzzle score — this
// route's eligibility (did the visitor actually spend that long / view
// that many pieces / walk that many steps) is entirely self-reported,
// because there's no login and the underlying activity (wishlisting,
// walking, viewing) happens client-side with no server session to check
// it against. `reportedValue` is recorded for the admin's own reference,
// not verified. The real guardrails here are the ones that *are* real:
// the achievement must actually be enabled, rate limiting blunts
// scripted abuse, and the unique constraint caps the damage of any
// single claim to "once per email" no matter how it was reached.
// Reasonable for a modest engagement reward; deliberately not treated as
// airtight. A successful claim also raises an admin Notification (see
// lib/notifications/museum-achievement.ts) — the one place among this
// app's several reward-claim flows that surfaces there, per the explicit
// spec for this feature.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sanitizeDisplayName, sanitizeEmail } from "@/lib/minigames/config";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/minigames/rate-limit";
import { notifyAdminOfMuseumAchievementClaim } from "@/lib/notifications/museum-achievement";
import { isMailConfigured, sendMuseumAchievementClaimedEmail } from "@/lib/mail";
import { getErrorCode, getErrorMessage } from "@/lib/utils";
import type { MuseumAchievementCategory } from "@/types";

const CLAIM_LIMIT = { limit: 10, windowMs: 60_000 };

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limit = rateLimit(`museum-achv-claim:${clientIp(request)}`, CLAIM_LIMIT.limit, CLAIM_LIMIT.windowMs);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSec);

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const displayName = sanitizeDisplayName(body?.name);
    const email = sanitizeEmail(body?.email);
    const reportedValue = Number(body?.reportedValue);

    if (!displayName) {
      return NextResponse.json({ error: "Please enter your name" }, { status: 400 });
    }
    if (!email) {
      return NextResponse.json({ error: "Please enter a valid email address" }, { status: 400 });
    }
    if (!Number.isFinite(reportedValue) || reportedValue < 0) {
      return NextResponse.json({ error: "Malformed request" }, { status: 400 });
    }

    const achievement = await prisma.museumAchievement.findUnique({ where: { id } });
    if (!achievement || !achievement.enabled) {
      return NextResponse.json({ error: "This achievement is no longer available" }, { status: 404 });
    }

    const claim = await prisma.museumAchievementClaim.create({
      data: { achievementId: id, displayName, email, reportedValue: Math.round(reportedValue) },
    });

    // Best-effort — a notification hiccup shouldn't fail a claim that's
    // already saved.
    await notifyAdminOfMuseumAchievementClaim({
      claimId: claim.id,
      achievementId: achievement.id,
      category: achievement.category as MuseumAchievementCategory,
      threshold: achievement.threshold,
      reward: achievement.reward,
      displayName,
      email,
    });

    // Best-effort — an email hiccup shouldn't fail a claim that's already
    // saved. Skipped silently when SMTP is not configured.
    if (isMailConfigured()) {
      sendMuseumAchievementClaimedEmail(email, {
        displayName,
        category: achievement.category as MuseumAchievementCategory,
        threshold: achievement.threshold,
        reward: achievement.reward,
      }).catch(() => {});
    }

    return NextResponse.json({ id: claim.id, reward: achievement.reward }, { status: 201 });
  } catch (error) {
    if (getErrorCode(error) === "P2002") {
      return NextResponse.json({ error: "This email has already claimed this reward" }, { status: 409 });
    }
    return NextResponse.json({ error: getErrorMessage(error, "Failed to claim reward") }, { status: 500 });
  }
}
