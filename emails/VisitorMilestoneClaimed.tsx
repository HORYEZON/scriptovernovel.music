// emails/VisitorMilestoneClaimed.tsx
//
// Visitor-facing confirmation when someone claims a Visitor Milestone
// reward (Settings ▸ Visitor Milestones → the public claim form shown
// once a milestone's visitor-count threshold is reached). Fulfillment is
// manual (VisitorMilestoneClaim.status starts PENDING), so this sets
// expectations rather than promising an instant delivery.
//
// No displayName here — Visitor Milestone claims only collect an email
// address, no name (compare to MuseumAchievementClaimed, which has both,
// because the Museum claim dialog asks for a name too).
import { Heading, Section, Text } from "@react-email/components";
import type { CSSProperties } from "react";
import { BRAND, EmailLayout } from "./components/EmailLayout";
import { PREVIEW_LOGO_URL } from "./preview-data";

export interface VisitorMilestoneClaimedEmailProps {
  /** The visitor-count threshold this milestone celebrated (e.g. 1000). */
  threshold: number;
  reward: string;
  logoUrl?: string | null;
  siteUrl: string;
}

export default function VisitorMilestoneClaimedEmail({
  threshold = 1000,
  reward = "Exclusive digital wallpaper pack",
  logoUrl = PREVIEW_LOGO_URL,
  // See PasswordReset.tsx — the real deployed domain, preview-only default.
  siteUrl = "https://scriptovernovel-music.vercel.app",
}: VisitorMilestoneClaimedEmailProps) {
  const thresholdLabel = threshold.toLocaleString();

  return (
    <EmailLayout
      preview={`Your milestone reward claim is in — thank you for being visitor #${thresholdLabel}`}
      logoUrl={logoUrl}
      siteUrl={siteUrl}
    >
      <Heading style={styles.heading}>Milestone reward claimed 🎉</Heading>
      <Text style={styles.text}>
        Thank you for being part of ScriptOverNovel Music&apos; journey to{" "}
        <strong>{thresholdLabel} visitors</strong>. Your claim has been
        received.
      </Text>

      {/* Milestone badge — a compact stat block so the threshold reads
          like a real milestone, not just a number buried in prose. */}
      <Section style={styles.badge}>
        <Text style={styles.badgeNumber}>{thresholdLabel}</Text>
        <Text style={styles.badgeLabel}>visitors milestone</Text>
      </Section>

      <Text style={styles.rewardIntro}>Your reward</Text>
      <Text style={styles.rewardLine}>{reward}</Text>

      <Text style={styles.text}>
        We review claims by hand — hang tight and we&apos;ll follow up at
        this email address to get your reward to you.
      </Text>

      <Text style={styles.muted}>
        Didn&apos;t expect this? Someone may have entered your email at claim
        time — no action needed on your end.
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
  // Milestone number displayed large, centered, sepia-toned — the same
  // aesthetic as the score display in RewardClaimed.tsx / HighscoreAlert.tsx.
  badge: {
    margin: "20px 0",
    textAlign: "center",
    backgroundColor: BRAND.cream,
    borderRadius: 12,
    padding: "20px 24px",
    border: `1px solid ${BRAND.border}`,
  },
  badgeNumber: {
    margin: 0,
    fontSize: 40,
    fontWeight: 700,
    letterSpacing: "-0.02em",
    color: BRAND.sepiaDark,
    lineHeight: "1.1",
  },
  badgeLabel: {
    margin: "4px 0 0",
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    color: BRAND.muted,
  },
  rewardIntro: {
    margin: "0 0 4px",
    fontSize: 12,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    color: BRAND.muted,
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
