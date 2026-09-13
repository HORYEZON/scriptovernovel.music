// emails/NewOrderAlert.tsx
//
// "You made a sale" ping to the shop owner — replaces the raw HTML template
// in lib/mail.ts's sendNewOrderAlertEmail. Fires alongside
// OrderConfirmation.tsx whenever the PayMongo webhook marks an order PAID,
// never at PENDING creation.
import { Heading, Text } from "@react-email/components";
import type { CSSProperties } from "react";
import { formatPrice } from "@/lib/utils";
import { BRAND, EmailLayout } from "./components/EmailLayout";
import { OrderItemsTable, type OrderEmailItem } from "./components/OrderItemsTable";
import { PREVIEW_LOGO_URL } from "./preview-data";

export interface NewOrderAlertEmailProps {
  customerName: string;
  customerEmail: string;
  orderRef: string;
  items: OrderEmailItem[];
  total: number;
  shippingAddress?: string | null;
  shippingPhone?: string | null;
  deliveryNotes?: string | null;
  logoUrl?: string | null;
  siteUrl: string;
}

export default function NewOrderAlertEmail({
  customerName = "Jane Dela Cruz",
  customerEmail = "jane@example.com",
  orderRef = "PREVIEW-REF",
  items = [{ title: "Tentacle Study No. 3", variantLabel: "A3 print", quantity: 1, price: 1800 }],
  total = 1800,
  shippingAddress = "123 Mabini St., Makati City, Metro Manila",
  shippingPhone = "+63 900 000 0000",
  deliveryNotes = null,
  logoUrl = PREVIEW_LOGO_URL,
  // See PasswordReset.tsx — the real deployed domain, preview-only default.
  siteUrl = "https://scriptovernovel-music.vercel.app",
}: NewOrderAlertEmailProps) {
  return (
    <EmailLayout
      preview={`New order paid — ${formatPrice(total)} (${orderRef})`}
      logoUrl={logoUrl}
      siteUrl={siteUrl}
    >
      <Heading style={styles.heading}>New order paid 🎉</Heading>
      <Text style={styles.text}>
        {customerName} ({customerEmail}) just paid for an order.
      </Text>
      <Text style={styles.ref}>Ref: {orderRef}</Text>

      <OrderItemsTable items={items} total={total} />

      <Text style={styles.shipLabel}>Ship to</Text>
      <Text style={styles.shipLine}>{shippingAddress || "—"}</Text>
      {shippingPhone ? <Text style={styles.shipLine}>{shippingPhone}</Text> : null}
      {deliveryNotes ? (
        <Text style={{ ...styles.shipLine, marginTop: 8 }}>Notes: {deliveryNotes}</Text>
      ) : null}
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
  shipLabel: {
    margin: "8px 0 4px",
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
};
