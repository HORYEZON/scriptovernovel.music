// lib/minigames/notify.ts
//
// Admin notification when a visitor clears a reward threshold.
//
// Two rules this file exists to enforce:
//   • the browser never sends this mail — it is triggered from the reward
//     route after the score has already been validated server-side
//   • a mail failure never fails the claim. The claim row is already saved by
//     the time this runs; the admin can always see it in the dashboard, so a
//     bounced notification is a logged annoyance, not lost data.

import { render } from "@react-email/render";
import { prisma } from "@/lib/prisma";
import { isMailConfigured, sendMail } from "@/lib/mail";
import { SITE_URL } from "@/lib/site-url";
import RewardAlertEmail from "@/emails/RewardAlert";
import RewardClaimedEmail from "@/emails/RewardClaimed";
import { getSiteLogoUrl } from "@/lib/site-logo";

const NOTIFY_TO =
  process.env.MINIGAME_NOTIFY_EMAIL || process.env.GMAIL_USER || "";

export interface RewardNotification {
  gameName: string;
  displayName: string;
  email: string;
  score: number;
  threshold: number;
  reward: string;
  artworkTitle: string | null;
  occurredAt: Date;
}

/** True when a notification actually went out. */
export async function notifyAdminOfReward(
  claim: RewardNotification
): Promise<boolean> {
  if (!NOTIFY_TO || !isMailConfigured()) return false;

  try {
    const profile = await prisma.profile.findFirst().catch(() => null);
    const element = RewardAlertEmail({
      gameName: claim.gameName,
      displayName: claim.displayName,
      score: claim.score.toLocaleString("en-US"),
      threshold: claim.threshold.toLocaleString("en-US"),
      email: claim.email,
      artworkTitle: claim.artworkTitle,
      reward: claim.reward,
      dateLabel: claim.occurredAt.toISOString().slice(0, 10),
      logoUrl: await getSiteLogoUrl(profile?.logoImage),
      siteUrl: SITE_URL,
    });
    const [html, text] = await Promise.all([
      render(element),
      render(element, { plainText: true }),
    ]);

    await sendMail({
      to: NOTIFY_TO,
      // Reply goes straight to the player, so fulfilling a reward is one tap
      // from the notification.
      replyTo: claim.email,
      subject: `New Mini-Game High Score — ${claim.gameName}`,
      text,
      html,
    });
    return true;
  } catch (error) {
    console.error("[minigames] reward notification failed", error);
    return false;
  }
}

export interface RewardClaimConfirmation {
  to: string;
  displayName: string;
  gameName: string;
  score: number;
  reward: string;
}

/**
 * Player-facing "we got your claim" receipt — sent alongside (not instead
 * of) notifyAdminOfReward. Best-effort like the admin alert: a mail outage
 * here never fails the claim, which is already saved by the time either
 * notification runs (see app/api/minigames/reward/route.ts).
 */
export async function notifyPlayerOfRewardClaim(
  claim: RewardClaimConfirmation
): Promise<void> {
  if (!isMailConfigured()) return;

  try {
    const profile = await prisma.profile.findFirst().catch(() => null);
    const element = RewardClaimedEmail({
      displayName: claim.displayName,
      gameName: claim.gameName,
      score: claim.score.toLocaleString("en-US"),
      reward: claim.reward,
      logoUrl: await getSiteLogoUrl(profile?.logoImage),
      siteUrl: SITE_URL,
    });
    const [html, text] = await Promise.all([
      render(element),
      render(element, { plainText: true }),
    ]);

    await sendMail({
      to: claim.to,
      subject: `Nice score! Your ${claim.gameName} reward claim is in`,
      text,
      html,
    });
  } catch (error) {
    console.error("[minigames] reward claim confirmation failed", error);
  }
}
