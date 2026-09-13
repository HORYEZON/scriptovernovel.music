// emails/MuseumAchievementClaimed.tsx
//
// Visitor-facing confirmation when someone claims a Digital Museum
// Achievement reward (Artworks ▸ Digital Museum ▸ Achievements — see
// app/api/digital-museum/achievements/[id]/claim/route.ts). Four category
// types: time (minutes in museum), views (artworks viewed), wishlist
// (artworks wishlisted), steps (steps walked). Fulfillment is manual
// (MuseumAchievementClaim status stays PENDING after creation), so this
// sets expectations rather than promising instant delivery.
//
// Eligibility for this reward is self-reported (the museum has no server
// session to verify against), so the email deliberately doesn't call out
// the `reportedValue` as a "your score was X" fact — it's stored for the
// admin's reference only, not surfaced to the visitor.
import { Heading, Section, Text } from "@react-email/components";
import type { CSSProperties } from "react";
import { BRAND, EmailLayout } from "./components/EmailLayout";
import { PREVIEW_LOGO_URL } from "./preview-data";
import type { MuseumAchievementCategory } from "@/types";

// Mirrors CATEGORY_META in AchievementsTab.tsx and CATEGORY_LABEL in
// lib/notifications/museum-achievement.ts — duplicated here to keep email
// templates self-contained (they can't safely import from app/* or lib/*
// since `email dev` renders them in isolation without the Next.js runtime).
const CATEGORY_COPY: Record<
  MuseumAchievementCategory,
  { label: string; unit: string; verb: string }
> = {
  time:     { label: "Time in Museum",      unit: "minutes",       verb: "spent in the museum" },
  views:    { label: "Artworks Viewed",     unit: "artworks",      verb: "artworks explored" },
  wishlist: { label: "Artworks Wishlisted", unit: "wishlist adds", verb: "artworks wishlisted" },
  steps:    { label: "Steps Walked",        unit: "steps",         verb: "steps through the museum" },
};

export interface MuseumAchievementClaimedEmailProps {
  displayName: string;
  category: MuseumAchievementCategory;
  /** The activity threshold this badge was awarded at (e.g. 1000). */
  threshold: number;
  reward: string;
  logoUrl?: string | null;
  siteUrl: string;
}

export default function MuseumAchievementClaimedEmail({
  displayName = "Explorer",
  category = "steps",
  threshold = 1000,
  reward = "Exclusive museum print",
  logoUrl = PREVIEW_LOGO_URL,
  // See PasswordReset.tsx — the real deployed domain, preview-only default.
  siteUrl = "https://scriptovernovel-music.vercel.app",
}: MuseumAchievementClaimedEmailProps) {
  const meta = CATEGORY_COPY[category] ?? CATEGORY_COPY.steps;
  const thresholdLabel = threshold.toLocaleString();

  return (
    <EmailLayout
      preview={`Museum achievement claimed — ${thresholdLabel} ${meta.unit}`}
      logoUrl={logoUrl}
      siteUrl={siteUrl}
    >
      <Heading style={styles.heading}>
        Museum achievement unlocked 🏛️
      </Heading>
      <Text style={styles.text}>
        Well done, <strong>{displayName}</strong>! You earned the{" "}
        <strong>
          {thresholdLabel} {meta.unit}
        </strong>{" "}
        badge for {meta.verb} in the ScriptOverNovel Music Digital Museum.
      </Text>

      {/* Achievement badge block — category label + threshold as the hero
          number, same visual language as VisitorMilestoneClaimed's badge. */}
      <Section style={styles.badge}>
        <Text style={styles.badgeCategory}>{meta.label}</Text>
        <Text style={styles.badgeNumber}>{thresholdLabel}</Text>
        <Text style={styles.badgeUnit}>{meta.unit}</Text>
      </Section>

      <Text style={styles.rewardIntro}>Your reward</Text>
      <Text style={styles.rewardLine}>{reward}</Text>

      <Text style={styles.text}>
        Your claim has been received. We review these by hand — hang tight and
        we&apos;ll follow up at this email address to get your reward to you.
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
  // Achievement badge block — cream background + sepia accent, matching the
  // milestone badge in VisitorMilestoneClaimed so both emails share the same
  // visual rhythm.
  badge: {
    margin: "20px 0",
    textAlign: "center",
    backgroundColor: BRAND.cream,
    borderRadius: 12,
    padding: "20px 24px",
    border: `1px solid ${BRAND.border}`,
  },
  badgeCategory: {
    margin: "0 0 8px",
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    color: BRAND.sepiaDark,
  },
  badgeNumber: {
    margin: 0,
    fontSize: 40,
    fontWeight: 700,
    letterSpacing: "-0.02em",
    color: BRAND.ink,
    lineHeight: "1.1",
  },
  badgeUnit: {
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
