// emails/HighscoreAlert.tsx
//
// Admin-only "someone just topped the board" ping — replaces the raw HTML
// template in lib/notifications/highscore.ts's notifyAdminOfNewHighscore.
// Fires only on rank-1 all-time highscores, not every leaderboard entry.
import { Heading, Text } from "@react-email/components";
import type { CSSProperties } from "react";
import { BRAND, EmailLayout } from "./components/EmailLayout";
import { PREVIEW_LOGO_URL } from "./preview-data";

export interface HighscoreAlertEmailProps {
  gameName: string;
  displayName: string;
  /** Pre-formatted (toLocaleString), matching the old template's `score` string. */
  score: string;
  logoUrl?: string | null;
  siteUrl: string;
}

export default function HighscoreAlertEmail({
  gameName = "Squid Match",
  displayName = "Player123",
  score = "12,345",
  logoUrl = PREVIEW_LOGO_URL,
  // See PasswordReset.tsx — the real deployed domain, preview-only default.
  siteUrl = "https://scriptovernovel-music.vercel.app",
}: HighscoreAlertEmailProps) {
  return (
    <EmailLayout preview={`New Highscore — ${gameName}`} logoUrl={logoUrl} siteUrl={siteUrl}>
      <Heading style={styles.heading}>New Highscore 🏆</Heading>
      <Text style={styles.text}>
        {displayName} just topped the {gameName} leaderboard.
      </Text>
      <Text style={styles.score}>{score} pts</Text>
      <Text style={styles.muted}>
        See the full board in Admin → Settings → Mini Games.
      </Text>
    </EmailLayout>
  );
}

const styles: Record<string, CSSProperties> = {
  heading: {
    margin: "0 0 4px",
    fontSize: 22,
    fontWeight: 600,
    color: BRAND.ink,
  },
  text: {
    margin: 0,
    fontSize: 15,
    lineHeight: "24px",
    color: "#333333",
  },
  score: {
    margin: "16px 0",
    fontSize: 30,
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
