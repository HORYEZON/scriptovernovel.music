// emails/components/DetailsTable.tsx
//
// Generic label/value table for admin alert emails — the reward-claim and
// (future) similar notifications that are just "here are the facts", not a
// receipt (see OrderItemsTable for that).
import type { CSSProperties } from "react";
import { BRAND } from "./EmailLayout";

export interface DetailRow {
  label: string;
  value: string;
}

export function DetailsTable({ rows }: { rows: DetailRow[] }) {
  return (
    <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={styles.table}>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <td style={styles.label}>{row.label}</td>
            <td style={styles.value}>{row.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const styles: Record<string, CSSProperties> = {
  table: {
    width: "100%",
    borderCollapse: "collapse",
    margin: "16px 0",
    fontSize: 14,
  },
  label: {
    padding: "6px 12px 6px 0",
    borderBottom: `1px solid ${BRAND.border}`,
    color: BRAND.muted,
    whiteSpace: "nowrap",
  },
  value: {
    padding: "6px 0",
    borderBottom: `1px solid ${BRAND.border}`,
    fontWeight: 600,
    color: "#333333",
  },
};
