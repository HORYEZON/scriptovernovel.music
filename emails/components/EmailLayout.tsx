// emails/components/EmailLayout.tsx
//
// Shared wrapper for every transactional email — header (site logo, falling
// back to a text wordmark when Profile.logoImage isn't set), a white content
// card, and a quiet footer. One place to keep brand colors/fonts consistent
// instead of every template repeating its own `<div style="...">` (the old
// lib/mail.ts / lib/notifications/* pattern this replaces).
import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { CSSProperties, ReactNode } from "react";

// Mirrors the site's Tailwind tokens (tailwind.config.ts) — email clients
// can't read CSS variables, so these are copied as plain hex values.
export const BRAND = {
  ink: "#0D0D0D",
  cream: "#FAF8F3",
  sepia: "#C8A96E",
  sepiaLight: "#E8D5A8",
  sepiaDark: "#8B6E3A",
  vermillion: "#D94F38",
  muted: "#6B6B6B",
  border: "#E8E4DC",
} as const;

// Same four hues squidCycle (tailwind.config.ts) cycles the Footer's
// --squid-glow through — reused directly rather than through a CSS custom
// property, since var()/color-mix() (what the site version reads) has
// far weaker email-client support than a keyframe animating plain color
// values. Clients that run animated @keyframes (Apple/iOS Mail, several
// webmail clients) get the real cycling glow; clients that strip
// @keyframes (Outlook desktop, the Gmail apps) just see it parked on the
// first color — never a broken or missing icon.
const SQUID_HUES = [
  { hex: "#FFE135", rgba: "rgba(255, 225, 53, 0.85)" },
  { hex: "#44D700", rgba: "rgba(68, 215, 0, 0.85)" },
  { hex: "#5BC8F5", rgba: "rgba(91, 200, 245, 0.85)" },
  { hex: "#FF6B9D", rgba: "rgba(255, 107, 157, 0.85)" },
] as const;

// Web-safe stack that echoes the site's DM Sans body font without depending
// on a webfont most email clients strip anyway.
const FONT_STACK =
  "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

interface EmailLayoutProps {
  /** Inbox preview snippet — shown next to the subject, never in the body. */
  preview: string;
  logoUrl?: string | null;
  siteUrl: string;
  children: ReactNode;
}

export function EmailLayout({ preview, logoUrl, siteUrl, children }: EmailLayoutProps) {
  return (
    <Html>
      <Head>
        {/* Hand-rolled instead of @react-email/components' <Font> — that
            component injects a global `* { font-family: ... }` rule, which
            bled BadaBoomBB into every heading/body/button in the email. This
            @font-face declares the face without forcing it anywhere; the
            wordmark below is the only element that opts in via its own
            inline `fontFamily`. Best-effort even there — Apple/iOS Mail and
            some webmail render it, everything else falls back to `cursive`.
            See https://www.caniemail.com/features/css-at-font-face/ */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
              @font-face {
                font-family: 'BadaBoomBB';
                font-style: normal;
                font-weight: 400;
                mso-font-alt: 'cursive';
                src: url(${siteUrl}/fonts/BadaBoomBB.ttf) format('truetype');
              }

              /* Color-cycle glow for the squid in the wordmark — same four
                 hues and roughly the same pacing as squidCycle/squidGlow/
                 squidBob in tailwind.config.ts. Ignored outright by clients
                 that don't run @keyframes, which just render the first
                 stop's color, statically lit. */
              @keyframes squidGlowCycle {
                0%, 100% { stroke: ${SQUID_HUES[0].hex}; filter: drop-shadow(0 0 5px ${SQUID_HUES[0].rgba}); }
                25% { stroke: ${SQUID_HUES[1].hex}; filter: drop-shadow(0 0 5px ${SQUID_HUES[1].rgba}); }
                50% { stroke: ${SQUID_HUES[2].hex}; filter: drop-shadow(0 0 5px ${SQUID_HUES[2].rgba}); }
                75% { stroke: ${SQUID_HUES[3].hex}; filter: drop-shadow(0 0 5px ${SQUID_HUES[3].rgba}); }
              }
              @keyframes squidBob {
                0%, 100% { transform: translateY(0) rotate(0deg); }
                50% { transform: translateY(-1.5px) rotate(-3deg); }
              }
              .squid-drift { animation: squidBob 4s ease-in-out infinite; }
              .squid-icon { animation: squidGlowCycle 16s linear infinite; }

              /* Per-segment hover colors, same four stops FooterWordmark.tsx
                 uses on hover. Only fires where :hover exists at all — webmail
                 with a mouse (Gmail web, Outlook web) and desktop mail apps —
                 so this is pure bonus, never load-bearing. !important is
                 needed to beat each span's inline color. */
              .wm-seg { transition: color 0.2s ease; }
              .wm-seg:hover { color: ${SQUID_HUES[0].hex} !important; }
              .wm-seg-2:hover { color: ${SQUID_HUES[1].hex} !important; }
              .wm-seg-3:hover { color: ${SQUID_HUES[3].hex} !important; }
              .wm-seg-4:hover { color: ${SQUID_HUES[2].hex} !important; }
            `,
          }}
        />
      </Head>
      <Preview>{preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.header}>
            {logoUrl ? (
              <Img src={logoUrl} alt="ScriptOverNovel Music" height={220} style={styles.logoImg} />
            ) : (
              // The KALAM(squid)RI lockup from FooterWordmark.tsx — same
              // per-segment hover colors (only live where :hover exists at
              // all: webmail-with-a-mouse and desktop mail apps).
              <Text style={styles.wordmark}>
                <span style={{ color: BRAND.ink }} className="wm-seg">
                  KA
                </span>
                <span style={{ color: BRAND.ink }} className="wm-seg-2">
                  LA
                </span>
                <span style={{ color: BRAND.ink }} className="wm-seg-3">
                  M
                </span>
                <span style={styles.squidWrap} className="squid-drift">
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={SQUID_HUES[0].hex}
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="squid-icon"
                    style={{
                      verticalAlign: "middle",
                      filter: `drop-shadow(0 0 5px ${SQUID_HUES[0].rgba})`,
                    }}
                  >
                    <title>ScriptOverNovel Music</title>
                    <path d="M7.5 17.25v3a3.01 3.01 0 0 1-3 3a3.01 3.01 0 0 1-3-3m15-3v3a3.01 3.01 0 0 0 3 3a3.01 3.01 0 0 0 3-3m-7.647-13.5h4.823a.75.75 0 0 0 .372-1.4l-7.3-4.4a1.5 1.5 0 0 0-1.488 0l-7.3 4.4a.75.75 0 0 0 .372 1.4h4.815" />
                    <path d="M10.128 5.058A15.64 15.64 0 0 0 7.5 13.737v3.513h9v-3.513c0-3.089-.914-6.109-2.628-8.679a2.25 2.25 0 0 0-3.744 0M10.5 17.25v4.5m3-4.5v4.5" />
                  </svg>
                </span>
                <span style={{ color: BRAND.ink }} className="wm-seg-4">
                  RI
                </span>
              </Text>
            )}
          </Section>

          <Section style={styles.content}>{children}</Section>

          <Hr style={styles.hr} />

          <Section style={styles.footer}>
            <Text style={styles.footerText}>
              ScriptOverNovel Music ·{" "}
              <Link href={siteUrl} style={styles.footerLink}>
                {siteUrl.replace(/^https?:\/\//, "")}
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const styles: Record<string, CSSProperties> = {
  body: {
    backgroundColor: BRAND.cream,
    fontFamily: FONT_STACK,
    margin: 0,
    padding: "32px 16px",
  },
  container: {
    maxWidth: 520,
    margin: "0 auto",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    overflow: "hidden",
    border: `1px solid ${BRAND.border}`,
  },
  header: {
    // Cream, not black — matches the site's actual light-mode Navbar
    // (bg-white/50 in Navbar.tsx), which is what most recipients see day to
    // day; black is only the Footer/dark-mode treatment there. The logo's
    // wordmark is multi-hue (yellow/green/red/blue/pink), so a soft neutral
    // reads cleaner than a dark panel and sidesteps the rgba-transparency/
    // backdrop-filter cross-client inconsistency the black version had —
    // flat hex colors have full support everywhere, no fallback needed.
    backgroundColor: BRAND.cream,
    borderBottom: `1px solid ${BRAND.border}`,
    padding: "18px 32px",
    textAlign: "center",
  },
  logoImg: {
    margin: "0 auto",
    maxWidth: 440,
  },
  wordmark: {
    margin: 0,
    fontFamily: "'BadaBoomBB', cursive",
    fontSize: 26,
    fontWeight: 400,
    letterSpacing: "0.06em",
    textAlign: "center",
  },
  squidWrap: {
    display: "inline-block",
    margin: "0 2px",
  },
  content: {
    padding: "36px 32px 12px",
  },
  hr: {
    borderColor: BRAND.border,
    margin: "8px 32px",
  },
  footer: {
    padding: "16px 32px 28px",
  },
  footerText: {
    margin: 0,
    fontSize: 12,
    color: BRAND.muted,
    textAlign: "center",
  },
  footerLink: {
    color: BRAND.sepiaDark,
    textDecoration: "none",
  },
};
