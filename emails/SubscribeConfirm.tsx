// emails/SubscribeConfirm.tsx
//
// The one and only email the mailing list sends: "confirm that this is you".
// Nothing in the app sends campaigns — the owner exports the confirmed rows
// and sends from a mail provider — so this template is the whole outbound side
// of the list.
//
// It carries the unsubscribe link even though the address isn't on the list
// yet: if someone else typed this address in, the person who receives this
// should be able to shut it down without confirming anything first.
import { Button, Heading, Link, Section, Text } from "@react-email/components";
import type { CSSProperties } from "react";
import { BRAND, EmailLayout } from "./components/EmailLayout";
import { PREVIEW_LOGO_URL } from "./preview-data";

export interface SubscribeConfirmEmailProps {
  confirmUrl: string;
  unsubscribeUrl: string;
  logoUrl?: string | null;
  siteUrl: string;
}

// Defaults are what `yarn email` renders when this file is opened directly
// with no caller-supplied props — see PasswordReset.tsx's note.
export default function SubscribeConfirmEmail({
  confirmUrl = "https://scriptovernovel-music.vercel.app/api/subscribers/confirm?token=preview-token",
  unsubscribeUrl = "https://scriptovernovel-music.vercel.app/subscribe/unsubscribe?token=preview-token",
  logoUrl = PREVIEW_LOGO_URL,
  siteUrl = "https://scriptovernovel-music.vercel.app",
}: SubscribeConfirmEmailProps) {
  return (
    <EmailLayout preview="One tap to confirm — then you'll hear it first" logoUrl={logoUrl} siteUrl={siteUrl}>
      <Heading style={styles.heading}>One tap and you&apos;re on the list</Heading>
      <Text style={styles.text}>
        Someone — hopefully you — asked to hear from ScriptOverNovel when there&apos;s a new release or a
        new show. Confirm below and that&apos;s it; we&apos;ll only write when there&apos;s something to say.
      </Text>

      <Section style={{ textAlign: "center", margin: "28px 0" }}>
        <Button href={confirmUrl} style={styles.button}>
          <span style={styles.buttonLabel}>Confirm subscription</span>
        </Button>
      </Section>

      <Text style={styles.muted}>
        If the button above doesn&apos;t work, copy and paste this URL into your browser:
      </Text>
      <Text style={{ ...styles.muted, wordBreak: "break-all" }}>{confirmUrl}</Text>

      <Text style={{ ...styles.muted, marginTop: 24 }}>
        Didn&apos;t sign up? Don&apos;t confirm and nothing happens — we never write to an address that
        hasn&apos;t confirmed. If you&apos;d rather make sure,{" "}
        <Link href={unsubscribeUrl} style={styles.link}>
          take this address off the list
        </Link>
        .
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
    // Solid colour first for clients that drop backgroundImage (Outlook's
    // Word engine) — the gradient is the enhancement, not the only source.
    backgroundColor: BRAND.sepia,
    backgroundImage: `linear-gradient(135deg, ${BRAND.sepiaDark}, ${BRAND.sepia} 55%, ${BRAND.sepiaLight})`,
    boxShadow: "0 6px 22px -4px rgba(200, 169, 110, 0.65)",
    border: `1px solid ${BRAND.sepiaLight}`,
    padding: "14px 30px",
    borderRadius: 999,
    textDecoration: "none",
    display: "inline-block",
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
  link: {
    color: BRAND.sepiaDark,
    textDecoration: "underline",
  },
};
