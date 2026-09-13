// lib/notifications/museum-achievement.ts
//
// Admin notification when a visitor claims a Digital Museum Achievement
// (Artworks ▸ Digital Museum ▸ Achievements — see prisma/schema.prisma's
// MuseumAchievement/MuseumAchievementClaim comments). Same "create the
// Notification row, log rather than throw if that somehow fails" shape
// as lib/notifications/highscore.ts — deliberately no email send here
// (unlike that file), since this feature's own spec only asked for it to
// show up in the Notifications module, not to alert by mail too.
import { prisma } from "@/lib/prisma";
import type { MuseumAchievementCategory } from "@/types";

const CATEGORY_LABEL: Record<MuseumAchievementCategory, string> = {
  steps: "Steps Walked",
  views: "Artworks Viewed",
  wishlist: "Artworks Wishlisted",
  time: "Time in Museum",
};

export interface MuseumAchievementNotification {
  claimId: string;
  achievementId: string;
  category: MuseumAchievementCategory;
  threshold: number;
  reward: string;
  displayName: string;
  email: string;
}

export async function notifyAdminOfMuseumAchievementClaim(claim: MuseumAchievementNotification): Promise<void> {
  const label = CATEGORY_LABEL[claim.category] ?? claim.category;
  try {
    await prisma.notification.create({
      data: {
        type: "MUSEUM",
        title: `Achievement claimed — ${label}`,
        body: `${claim.displayName} (${claim.email}) reached the ${claim.threshold.toLocaleString()}-${label} badge and claimed: ${claim.reward}`,
        metadata: {
          claimId: claim.claimId,
          achievementId: claim.achievementId,
          category: claim.category,
          threshold: claim.threshold,
          reward: claim.reward,
          // Keyed `name` (not `displayName`) deliberately — matches
          // ContactMetadata's field name, so NotificationsClient.tsx's
          // existing generic "Name"/"Email" detail-view rows pick this up
          // for free instead of needing a Museum-specific rendering path.
          name: claim.displayName,
          email: claim.email,
        },
      },
    });
  } catch (error) {
    console.error("[notifications] failed to record museum achievement claim", error);
  }
}
