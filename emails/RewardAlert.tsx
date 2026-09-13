// emails/RewardAlert.tsx
//
// Admin-only "a visitor reached a reward threshold" ping — replaces the raw
// HTML template in lib/minigames/notify.ts's notifyAdminOfReward. Reply-to
// on the send is set to the player's email so fulfilling is one tap away.
import { Heading, Text } from "@react-email/components";
import type { CSSProperties } from "react";
import { BRAND, EmailLayout } from "./components/EmailLayout";
import { DetailsTable } from "./components/DetailsTable";
import { PREVIEW_LOGO_URL } from "./preview-data";

export interface RewardAlertEmailProps {
  gameName: string;
  displayName: string;
  score: string;
  threshold: string;
  email: string;
  artworkTitle: string | null;
  reward: string;
  dateLabel: string;
  logoUrl?: string | null;
  siteUrl: string;
}

export default function RewardAlertEmail({
  gameName = "Squid Match",
  displayName = "Player123",
  score = "12,345",
  threshold = "10,000",
  email = "player@example.com",
  artworkTitle = "Deep Sea Bloom",
  reward = "10% off code",
  dateLabel = "2026-08-18",
  logoUrl = PREVIEW_LOGO_URL,
  // See PasswordReset.tsx — the real deployed domain, preview-only default.
  siteUrl = "https://scriptovernovel-music.vercel.app",
}: RewardAlertEmailProps) {
  return (
    <EmailLayout
      preview={`New Mini-Game High Score — ${gameName}`}
      logoUrl={logoUrl}
      siteUrl={siteUrl}
    >
      <Heading style={styles.heading}>New Mini-Game High Score</Heading>
      <Text style={styles.text}>A visitor reached a reward threshold.</Text>

      <DetailsTable
        rows={[
          { label: "Game", value: gameName },
          { label: "Player", value: displayName },
          { label: "Score", value: score },
          { label: "Target", value: threshold },
          { label: "Email", value: email },
          { label: "Artwork", value: artworkTitle ?? "—" },
          { label: "Reward", value: reward },
          { label: "Date", value: dateLabel },
        ]}
      />

      <Text style={styles.muted}>
        Manage claims in Admin → Settings → Mini Games.
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
  muted: {
    margin: "24px 0 0",
    fontSize: 13,
    lineHeight: "20px",
    color: BRAND.muted,
  },
};
