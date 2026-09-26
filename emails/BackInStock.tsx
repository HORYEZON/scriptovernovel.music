// emails/BackInStock.tsx
//
// The one email a stock alert ever sends: the thing you asked about is on sale.
//
// It says what was asked for and that this is the only message, because the
// request took no confirmation step — so this email has to carry its own
// explanation of why it arrived.
import { Button, Heading, Img, Section, Text } from "@react-email/components";
import type { CSSProperties } from "react";
import { BRAND, EmailLayout } from "./components/EmailLayout";
import { PREVIEW_LOGO_URL } from "./preview-data";

export interface BackInStockEmailProps {
  productTitle: string;
  productUrl: string;
  imageUrl?: string | null;
  /** Formatted, e.g. "₱1,200" — the caller formats so this template has no
   *  opinion about currency. */
  price?: string | null;
  /** The size/format they asked about, when they asked about one. */
  variantLabel?: string | null;
  logoUrl?: string | null;
  siteUrl: string;
}

export default function BackInStockEmail({
  productTitle = "Paralysismo — 7\" pressing",
  productUrl = "https://scriptovernovel-music.vercel.app/shop/paralysismo-7",
  imageUrl = null,
  price = "₱1,200",
  variantLabel = null,
  logoUrl = PREVIEW_LOGO_URL,
  siteUrl = "https://scriptovernovel-music.vercel.app",
}: BackInStockEmailProps) {
  return (
    <EmailLayout preview={`${productTitle} is available`} logoUrl={logoUrl} siteUrl={siteUrl}>
      <Heading style={styles.heading}>It&apos;s available</Heading>
      <Text style={styles.text}>
        You asked to hear when <strong>{productTitle}</strong>
        {variantLabel ? ` (${variantLabel})` : ""} was on sale. It is.
      </Text>

      {imageUrl && (
        <Section style={{ textAlign: "center", margin: "24px 0 8px" }}>
          <Img src={imageUrl} alt={productTitle} width="260" style={styles.image} />
        </Section>
      )}

      {price && <Text style={styles.price}>{price}</Text>}

      <Section style={{ textAlign: "center", margin: "24px 0" }}>
        <Button href={productUrl} style={styles.button}>
          <span style={styles.buttonLabel}>See it in the store</span>
        </Button>
      </Section>

      <Text style={styles.muted}>
        Stock is usually small, so it may not last. This is the only email you&apos;ll get about it — we
        don&apos;t add you to anything, and there&apos;s nothing to unsubscribe from.
      </Text>
    </EmailLayout>
  );
}

const styles: Record<string, CSSProperties> = {
  heading: { margin: "0 0 12px", fontSize: 22, fontWeight: 600, color: BRAND.ink },
  text: { margin: 0, fontSize: 15, lineHeight: "24px", color: "#333333" },
  image: { borderRadius: 12, border: `1px solid ${BRAND.border}`, maxWidth: "100%", height: "auto" },
  price: {
    margin: "12px 0 0",
    textAlign: "center",
    fontSize: 18,
    fontWeight: 600,
    color: BRAND.ink,
  },
  button: {
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
  muted: { margin: "24px 0 0", fontSize: 13, lineHeight: "20px", color: BRAND.muted },
};
