// emails/RewardClaimed.tsx
//
// NEW — there was no player-facing mini-game email before this (the
// highscore/reward alerts in lib/notifications/highscore.ts and
// lib/minigames/notify.ts both only ever emailed the admin). A general
// "you got a new highscore!" email turned out not to be feasible: plain
// leaderboard entries carry no player email, only an anonymous cookie id
// (see LeaderboardEntry/MiniGameSession in prisma/schema.prisma). The one
// place a player's email genuinely exists is RewardClaim.email, captured
// when they claim a reward after clearing a game's threshold — so this
// confirms *that* moment instead. Fulfillment is manual (RewardClaim.status
// starts PENDING), so this sets expectations rather than promising an
// instant code.
import { Heading, Text } from "@react-email/components";
import type { CSSProperties } from "react";
import { BRAND, EmailLayout } from "./components/EmailLayout";
import { PREVIEW_LOGO_URL } from "./preview-data";

export interface RewardClaimedEmailProps {
  displayName: string;
  gameName: string;
  score: string;
  reward: string;
  logoUrl?: string | null;
  siteUrl: string;
}

export default function RewardClaimedEmail({
  displayName = "Player123",
  gameName = "Squid Match",
  score = "12,345",
  reward = "10% off code",
  logoUrl = PREVIEW_LOGO_URL,
  // See PasswordReset.tsx — the real deployed domain, preview-only default.
  siteUrl = "https://scriptovernovel-music.vercel.app",
}: RewardClaimedEmailProps) {
  return (
    <EmailLayout
      preview={`Your ${gameName} reward claim is in`}
      logoUrl={logoUrl}
      siteUrl={siteUrl}
    >
      <Heading style={styles.heading}>Nice score, {displayName} 🎉</Heading>
      <Text style={styles.text}>
        You cleared the reward threshold on <strong>{gameName}</strong> with a
        score of <strong>{score}</strong> — nicely played.
      </Text>
      <Text style={styles.rewardLine}>{reward}</Text>
      <Text style={styles.text}>
        Your claim has been received. We review these by hand, so hang
        tight — we&apos;ll follow up at this email address to get your reward
        to you.
      </Text>
      <Text style={styles.muted}>
        Didn&apos;t expect this? Someone may have played from this browser
        and entered your email at claim time — no action needed on your end.
      </Text>
    </EmailLayout>
  );
}

const styles: Record<string, CSSProperties> = {
  heading: {
    margin: "0 0 12px",
    fontSize: 22,
    fontWeight: 600,
    color: BRAND.ink,
  },
  text: {
    margin: "0 0 12px",
    fontSize: 15,
    lineHeight: "24px",
    color: "#333333",
  },
  rewardLine: {
    margin: "0 0 16px",
    fontSize: 17,
    fontWeight: 700,
    color: BRAND.sepiaDark,
  },
  muted: {
    margin: "24px 0 0",
    fontSize: 13,
    lineHeight: "20px",
    color: BRAND.muted,
  },
};
