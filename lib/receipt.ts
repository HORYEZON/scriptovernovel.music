// lib/receipt.ts
//
// Renders one order as a self-contained, printable HTML receipt, served by
// GET /api/orders/[id]/receipt and opened in a new tab by the admin's
// "Download Receipt" button.
//
// Why HTML-and-print rather than a generated PDF: a real PDF means pulling in
// a renderer (pdfkit/puppeteer) and shipping fonts, for a document the admin
// prints or "Saves as PDF" from the browser dialog anyway. The page carries
// its own @media print rules and calls window.print() on load, so the flow is
// one click → Save as PDF, with no new dependency and no serverless
// cold-start cost.

import { formatPrice } from "@/lib/utils";

export interface ReceiptItem {
  title: string;
  variantLabel?: string | null;
  quantity: number;
  price: number;
}

export interface ReceiptOrder {
  id: string;
  customerName: string;
  customerEmail: string;
  status: string;
  total: number;
  paymentId?: string | null;
  paymongoRef?: string | null;
  shippingAddress?: string | null;
  shippingPhone?: string | null;
  deliveryNotes?: string | null;
  createdAt: Date | string;
  items: ReceiptItem[];
}

export interface ReceiptBusiness {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  logoUrl?: string | null;
  siteUrl?: string | null;
}

/** HTML-escapes a value for interpolation into the template below. */
function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatReceiptDate(date: Date | string): string {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(new Date(date));
}

export function renderReceiptHtml(
  order: ReceiptOrder,
  business: ReceiptBusiness,
  options: { autoPrint?: boolean } = {}
): string {
  const reference = order.paymongoRef || order.id;
  const subtotal = order.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  // The Order.total is the source of truth (it is what PayMongo charged);
  // anything it holds beyond the line items is shipping/adjustment, so show
  // it as its own line rather than silently letting the two disagree.
  const adjustment = Math.round((order.total - subtotal) * 100) / 100;

  const rows = order.items
    .map(
      (item) => `
        <tr>
          <td>
            <span class="item-title">${esc(item.title)}</span>
            ${item.variantLabel ? `<span class="item-variant">${esc(item.variantLabel)}</span>` : ""}
          </td>
          <td class="num">${esc(item.quantity)}</td>
          <td class="num">${esc(formatPrice(item.price))}</td>
          <td class="num strong">${esc(formatPrice(item.price * item.quantity))}</td>
        </tr>`
    )
    .join("");

  const metaRow = (label: string, value?: string | null) =>
    value ? `<div class="meta-row"><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>` : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Receipt ${esc(reference)}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 32px 20px 60px;
    background: #f4f2ee;
    color: #1c1917;
    font: 14px/1.5 ui-sans-serif, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .sheet {
    max-width: 720px;
    margin: 0 auto;
    background: #fff;
    border: 1px solid #e7e5e4;
    border-radius: 14px;
    padding: 40px;
  }
  header { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; }
  .brand h1 { margin: 0; font-size: 20px; letter-spacing: .02em; }
  .brand p { margin: 2px 0 0; font-size: 12px; color: #78716c; }
  .brand img { max-height: 52px; max-width: 200px; margin-bottom: 8px; display: block; }
  .doc { text-align: right; }
  .doc h2 { margin: 0; font-size: 12px; letter-spacing: .18em; text-transform: uppercase; color: #78716c; }
  .doc .ref { margin: 4px 0 0; font-size: 13px; font-variant-numeric: tabular-nums; font-weight: 600; }
  .status {
    display: inline-block; margin-top: 8px; padding: 3px 10px; border-radius: 999px;
    font-size: 10px; letter-spacing: .16em; text-transform: uppercase; font-weight: 700;
    background: #f5f5f4; color: #57534e; border: 1px solid #e7e5e4;
  }
  .status.paid, .status.delivered { background: #ecfdf5; color: #047857; border-color: #a7f3d0; }
  .status.shipped { background: #eff6ff; color: #1d4ed8; border-color: #bfdbfe; }
  .status.pending { background: #fffbeb; color: #b45309; border-color: #fde68a; }
  .status.failed, .status.cancelled { background: #fef2f2; color: #b91c1c; border-color: #fecaca; }
  hr { border: 0; border-top: 1px solid #e7e5e4; margin: 28px 0; }
  .panels { display: flex; gap: 32px; flex-wrap: wrap; }
  .panel { flex: 1 1 220px; min-width: 200px; }
  .panel h3 { margin: 0 0 8px; font-size: 10px; letter-spacing: .18em; text-transform: uppercase; color: #a8a29e; }
  .panel p { margin: 0 0 2px; font-size: 13px; white-space: pre-line; }
  .panel .muted { color: #78716c; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th {
    text-align: left; font-size: 10px; letter-spacing: .16em; text-transform: uppercase;
    color: #a8a29e; font-weight: 600; padding: 0 0 8px; border-bottom: 1px solid #e7e5e4;
  }
  td { padding: 12px 0; border-bottom: 1px solid #f5f5f4; vertical-align: top; font-size: 13px; }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .strong { font-weight: 600; }
  .item-title { display: block; font-weight: 600; }
  .item-variant { display: block; font-size: 12px; color: #78716c; margin-top: 2px; }
  .totals { margin-left: auto; width: 260px; margin-top: 16px; }
  .totals div { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
  .totals .grand {
    border-top: 2px solid #1c1917; margin-top: 6px; padding-top: 10px;
    font-size: 17px; font-weight: 700;
  }
  .meta { margin: 0; display: grid; gap: 4px; }
  .meta-row { display: flex; gap: 8px; font-size: 12px; }
  .meta-row dt { color: #a8a29e; min-width: 110px; }
  .meta-row dd { margin: 0; font-variant-numeric: tabular-nums; word-break: break-all; }
  footer { margin-top: 32px; text-align: center; font-size: 11px; color: #a8a29e; line-height: 1.7; }
  .actions { max-width: 720px; margin: 0 auto 16px; text-align: right; }
  .actions button {
    font: inherit; font-size: 13px; padding: 8px 18px; border-radius: 10px; cursor: pointer;
    border: 1px solid #1c1917; background: #1c1917; color: #fff;
  }
  @media print {
    body { background: #fff; padding: 0; }
    .sheet { border: 0; border-radius: 0; padding: 0; max-width: none; }
    .actions { display: none; }
    @page { margin: 16mm; }
  }
</style>
</head>
<body>
  <div class="actions">
    <button type="button" onclick="window.print()">Print / Save as PDF</button>
  </div>

  <main class="sheet">
    <header>
      <div class="brand">
        ${business.logoUrl ? `<img src="${esc(business.logoUrl)}" alt="${esc(business.name)}" />` : ""}
        <h1>${esc(business.name)}</h1>
        ${business.address ? `<p>${esc(business.address)}</p>` : ""}
        ${business.email ? `<p>${esc(business.email)}</p>` : ""}
        ${business.phone ? `<p>${esc(business.phone)}</p>` : ""}
      </div>
      <div class="doc">
        <h2>Receipt</h2>
        <p class="ref">${esc(reference)}</p>
        <span class="status ${esc(order.status.toLowerCase())}">${esc(order.status)}</span>
      </div>
    </header>

    <hr />

    <div class="panels">
      <div class="panel">
        <h3>Billed to</h3>
        <p class="strong">${esc(order.customerName)}</p>
        <p class="muted">${esc(order.customerEmail)}</p>
        ${order.shippingPhone ? `<p class="muted">${esc(order.shippingPhone)}</p>` : ""}
      </div>
      ${
        order.shippingAddress
          ? `<div class="panel">
               <h3>Ship to</h3>
               <p>${esc(order.shippingAddress)}</p>
               ${order.deliveryNotes ? `<p class="muted">Notes: ${esc(order.deliveryNotes)}</p>` : ""}
             </div>`
          : ""
      }
      <div class="panel">
        <h3>Details</h3>
        <dl class="meta">
          ${metaRow("Date issued", formatReceiptDate(order.createdAt))}
          ${metaRow("Order ID", order.id)}
          ${metaRow("Payment ID", order.paymentId)}
        </dl>
      </div>
    </div>

    <hr />

    <table>
      <thead>
        <tr>
          <th>Item</th>
          <th class="num">Qty</th>
          <th class="num">Unit price</th>
          <th class="num">Amount</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="totals">
      <div><span>Subtotal</span><span>${esc(formatPrice(subtotal))}</span></div>
      ${adjustment !== 0 ? `<div><span>Shipping &amp; adjustments</span><span>${esc(formatPrice(adjustment))}</span></div>` : ""}
      <div class="grand"><span>Total</span><span>${esc(formatPrice(order.total))}</span></div>
    </div>

    <footer>
      Thank you for supporting ${esc(business.name)}.<br />
      ${business.siteUrl ? esc(business.siteUrl) : ""}
    </footer>
  </main>

  ${
    options.autoPrint === false
      ? ""
      : `<script>
          // Wait for the logo (if any) so it isn't missing from the print
          // preview — load fires after images, unlike DOMContentLoaded.
          window.addEventListener("load", function () { window.print(); });
        </script>`
  }
</body>
</html>`;
}
