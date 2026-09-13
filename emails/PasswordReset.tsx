// emails/PasswordReset.tsx
//
// Replaces the raw HTML template literal in lib/mail.ts's
// sendPasswordResetEmail. Same copy and 1-hour expiry note as before, just
// rendered through the shared EmailLayout instead of a one-off <div>.
import { Button, Heading, Section, Text } from "@react-email/components";
import type { CSSProperties } from "react";
import { BRAND, EmailLayout } from "./components/EmailLayout";
import { PREVIEW_LOGO_URL } from "./preview-data";

export interface PasswordResetEmailProps {
  resetUrl: string;
  logoUrl?: string | null;
  siteUrl: string;
}

// Defaults here (rather than a `.PreviewProps` static — the CLI doesn't
// read one) are what the `email dev`/`email export` preview renders when
// this file is opened directly with no caller-supplied props.
export default function PasswordResetEmail({
  resetUrl = "https://scriptovernovel-music.vercel.app/reset-password?token=preview-token",
  logoUrl = PREVIEW_LOGO_URL,
  // The real deployed domain (not the aspirational "scriptovernovel.music", which
  // doesn't resolve to anything yet) — Vercel serves /public assets with a
  // permissive CORS header automatically, so the preview server can
  // actually fetch /fonts/BadaBoomBB.ttf from here. Real sends always pass
  // the real SITE_URL from lib/site-url.ts, so production is unaffected —
  // this default is preview-only.
  siteUrl = "https://scriptovernovel-music.vercel.app",
}: PasswordResetEmailProps) {
  return (
    <EmailLayout
      preview="Reset your ScriptOverNovel Music password"
      logoUrl={logoUrl}
      siteUrl={siteUrl}
    >
      <Heading style={styles.heading}>Reset your password</Heading>
      <Text style={styles.text}>
        We received a request to reset the password for your ScriptOverNovel Music
        admin account.
      </Text>

      <Section style={{ textAlign: "center", margin: "28px 0" }}>
        {/* Same gradient/glow/uppercase-label treatment as the gallery's
            "Featured" pill (components/public/ArtworkBadge.tsx) — no shimmer
            sweep here, since that relies on a looping CSS animation email
            clients don't reliably run. */}
        <Button href={resetUrl} style={styles.button}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#ffffff"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={styles.buttonIcon}
          >
            <path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4" />
            <path d="m21 2-9.6 9.6" />
            <circle cx="7.5" cy="15.5" r="5.5" />
          </svg>
          <span style={styles.buttonLabel}>Reset Password</span>
        </Button>
      </Section>

      <Text style={styles.muted}>
        This link expires in 1 hour. If the button above doesn&apos;t work,
        copy and paste this URL into your browser:
      </Text>
      <Text style={{ ...styles.muted, wordBreak: "break-all" }}>{resetUrl}</Text>

      <Text style={{ ...styles.muted, marginTop: 24 }}>
        Didn&apos;t request this? You can safely ignore this email — your
        password will stay unchanged.
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
    margin: 0,
    fontSize: 15,
    lineHeight: "24px",
    color: "#333333",
  },
  button: {
    // Solid backgroundColor is the real background for clients that ignore
    // backgroundImage (Outlook's Word engine, notably) — the gradient on
    // top is a progressive enhancement, not the only color source.
    backgroundColor: BRAND.sepia,
    backgroundImage: `linear-gradient(135deg, ${BRAND.sepiaDark}, ${BRAND.sepia} 55%, ${BRAND.sepiaLight})`,
    boxShadow: "0 6px 22px -4px rgba(200, 169, 110, 0.65)",
    border: `1px solid ${BRAND.sepiaLight}`,
    padding: "14px 30px",
    borderRadius: 999,
    textDecoration: "none",
    display: "inline-block",
  },
  buttonIcon: {
    display: "inline-block",
    verticalAlign: "middle",
    marginRight: 8,
    filter: "drop-shadow(0 0 4px rgba(255,255,255,0.65))",
  },
  buttonLabel: {
    display: "inline-block",
    verticalAlign: "middle",
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    color: "#ffffff",
  },
  muted: {
    margin: "0 0 4px",
    fontSize: 13,
    lineHeight: "20px",
    color: BRAND.muted,
  },
};
