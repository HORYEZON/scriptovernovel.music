// emails/OrderConfirmation.tsx
//
// Customer-facing "your order is confirmed" email — replaces the raw HTML
// template in lib/mail.ts's sendOrderConfirmationEmail. Sent only once the
// PayMongo webhook flips an order to PAID (see app/api/webhooks/paymongo),
// never at checkout/PENDING, since an abandoned checkout should never look
// like a confirmed order.
import { Heading, Section, Text } from "@react-email/components";
import type { CSSProperties } from "react";
import { BRAND, EmailLayout } from "./components/EmailLayout";
import { OrderItemsTable, type OrderEmailItem } from "./components/OrderItemsTable";
import { PREVIEW_LOGO_URL } from "./preview-data";

export interface OrderConfirmationEmailProps {
  customerName: string;
  orderRef: string;
  items: OrderEmailItem[];
  total: number;
  shippingAddress?: string | null;
  shippingPhone?: string | null;
  deliveryNotes?: string | null;
  logoUrl?: string | null;
  siteUrl: string;
}

export default function OrderConfirmationEmail({
  customerName = "there",
  orderRef = "PREVIEW-REF",
  items = [
    { title: "Tentacle Study No. 3", variantLabel: "A3 print", quantity: 1, price: 1800 },
    { title: "Deep Sea Bloom", quantity: 2, price: 950 },
  ],
  total = 3700,
  shippingAddress = "123 Mabini St., Makati City, Metro Manila",
  shippingPhone = "+63 900 000 0000",
  deliveryNotes = null,
  logoUrl = PREVIEW_LOGO_URL,
  // The real deployed domain — see PasswordReset.tsx for why this isn't
  // "scriptovernovel.music" (doesn't resolve) or localhost (real sends always pass
  // the real SITE_URL; this default is preview-only).
  siteUrl = "https://scriptovernovel-music.vercel.app",
}: OrderConfirmationEmailProps) {
  return (
    <EmailLayout
      preview={`Order confirmed — ${orderRef}`}
      logoUrl={logoUrl}
      siteUrl={siteUrl}
    >
      <Heading style={styles.heading}>Order confirmed</Heading>
      <Text style={styles.text}>
        Thank you, {customerName}! Your payment went through and your order
        is confirmed.
      </Text>
      <Text style={styles.ref}>Ref: {orderRef}</Text>

      <OrderItemsTable items={items} total={total} />

      <Section style={styles.shipBlock}>
        <Text style={styles.shipLabel}>Shipping to</Text>
        <Text style={styles.shipLine}>{shippingAddress || "—"}</Text>
        {shippingPhone ? <Text style={styles.shipLine}>{shippingPhone}</Text> : null}
        {deliveryNotes ? (
          <Text style={{ ...styles.shipLine, marginTop: 8 }}>Notes: {deliveryNotes}</Text>
        ) : null}
      </Section>

      <Text style={styles.muted}>
        Your artwork will be carefully packaged and shipped within 5–7
        business days.
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
  ref: {
    margin: "6px 0 0",
    fontSize: 13,
    color: BRAND.muted,
  },
  shipBlock: {
    margin: "8px 0 0",
  },
  shipLabel: {
    margin: "0 0 4px",
    fontSize: 13,
    fontWeight: 700,
    color: BRAND.ink,
  },
  shipLine: {
    margin: 0,
    fontSize: 13,
    lineHeight: "20px",
    color: BRAND.muted,
  },
  muted: {
    margin: "24px 0 0",
    fontSize: 13,
    lineHeight: "20px",
    color: BRAND.muted,
  },
};
