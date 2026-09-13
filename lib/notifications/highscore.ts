// lib/notifications/highscore.ts
//
// Admin notification when a submission sets a new all-time highscore on a
// mini-game's leaderboard (rank 1 — not just "made the top 10", or every
// leaderboard-enabled game would spam an alert per entry). Deliberately
// separate from lib/minigames/notify.ts, which covers reward-threshold
// *claims* — a fulfillment queue with its own status/email field. This is a
// lighter "someone just topped the board" ping with nothing to fulfill.
import { render } from "@react-email/render";
import { prisma } from "@/lib/prisma";
import { isMailConfigured, sendMail } from "@/lib/mail";
import { SITE_URL } from "@/lib/site-url";
import { GAME_REGISTRY } from "@/lib/minigames/registry";
import type { GameType } from "@/lib/minigames/types";
import HighscoreAlertEmail from "@/emails/HighscoreAlert";

const NOTIFY_TO =
  process.env.MINIGAME_NOTIFY_EMAIL || process.env.GMAIL_USER || "";

export interface HighscoreNotification {
  gameId: string;
  gameType: GameType;
  displayName: string;
  score: number;
}

export async function notifyAdminOfNewHighscore(
  entry: HighscoreNotification
): Promise<void> {
  const gameName = GAME_REGISTRY[entry.gameType]?.name ?? entry.gameType;
  const score = entry.score.toLocaleString("en-US");

  try {
    await prisma.notification.create({
      data: {
        type: "HIGHSCORE",
        title: `New highscore — ${gameName}`,
        body: `${entry.displayName} set a new all-time highscore of ${score} on ${gameName}.`,
        metadata: {
          gameId: entry.gameId,
          gameType: entry.gameType,
          score: entry.score,
        },
      },
    });
  } catch (error) {
    console.error(
      "[notifications] failed to record new-highscore notification",
      error
    );
  }

  if (!NOTIFY_TO || !isMailConfigured()) return;

  try {
    const profile = await prisma.profile.findFirst().catch(() => null);
    const element = HighscoreAlertEmail({
      gameName,
      displayName: entry.displayName,
      score,
      logoUrl: profile?.logoImage ?? null,
      siteUrl: SITE_URL,
    });
    const [html, text] = await Promise.all([
      render(element),
      render(element, { plainText: true }),
    ]);

    await sendMail({
      to: NOTIFY_TO,
      subject: `New Highscore — ${gameName}`,
      text,
      html,
    });
  } catch (error) {
    console.error(
      "[notifications] failed to send new-highscore alert email",
      error
    );
  }
}
