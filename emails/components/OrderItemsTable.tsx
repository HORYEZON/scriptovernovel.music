// emails/components/OrderItemsTable.tsx
//
// Shared receipt table for OrderConfirmation (customer) and NewOrderAlert
// (shop owner) — same line items, same total. React escapes all this text
// content automatically, so the manual escapeHtml() the old lib/mail.ts
// string templates needed for customer-supplied fields (name, address,
// notes) is gone; that was only ever needed because raw template-literal
// HTML has no auto-escaping.
import type { CSSProperties } from "react";
import { formatPrice } from "@/lib/utils";
import { BRAND } from "./EmailLayout";

export interface OrderEmailItem {
  title: string;
  variantLabel?: string | null;
  quantity: number;
  price: number;
}

export function OrderItemsTable({
  items,
  total,
}: {
  items: OrderEmailItem[];
  total: number;
}) {
  return (
    <table
      role="presentation"
      width="100%"
      cellPadding={0}
      cellSpacing={0}
      style={styles.table}
    >
      <tbody>
        {items.map((item, i) => (
          <tr key={`${item.title}-${item.variantLabel ?? ""}-${i}`}>
            <td style={styles.itemCell}>
              {item.title}
              {item.variantLabel ? ` (${item.variantLabel})` : ""} × {item.quantity}
            </td>
            <td style={styles.priceCell}>{formatPrice(item.price * item.quantity)}</td>
          </tr>
        ))}
        <tr>
          <td style={styles.totalLabel}>Total</td>
          <td style={styles.totalPrice}>{formatPrice(total)}</td>
        </tr>
      </tbody>
    </table>
  );
}

const styles: Record<string, CSSProperties> = {
  table: {
    width: "100%",
    borderCollapse: "collapse",
    margin: "20px 0",
    fontSize: 14,
  },
  itemCell: {
    padding: "10px 0",
    borderBottom: `1px solid ${BRAND.border}`,
    color: "#333333",
  },
  priceCell: {
    padding: "10px 0",
    borderBottom: `1px solid ${BRAND.border}`,
    textAlign: "right",
    whiteSpace: "nowrap",
    color: "#333333",
  },
  totalLabel: {
    padding: "14px 0 0",
    fontWeight: 700,
    color: BRAND.ink,
  },
  totalPrice: {
    padding: "14px 0 0",
    fontWeight: 700,
    textAlign: "right",
    color: BRAND.sepiaDark,
  },
};
