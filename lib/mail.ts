// lib/mail.ts
import nodemailer from "nodemailer";
import { render } from "@react-email/render";
import { formatPrice } from "@/lib/utils";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/site-url";
import PasswordResetEmail from "@/emails/PasswordReset";
import OrderConfirmationEmail from "@/emails/OrderConfirmation";
import NewOrderAlertEmail from "@/emails/NewOrderAlert";
import VisitorMilestoneClaimedEmail from "@/emails/VisitorMilestoneClaimed";
import MuseumAchievementClaimedEmail from "@/emails/MuseumAchievementClaimed";
import type { MuseumAchievementCategory } from "@/types";
import { getSiteLogoUrl } from "@/lib/site-logo";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

// Notification address that gets a copy of every password-reset email sent,
// so account activity doesn't go unnoticed. Configurable via env, falling
// back to the site owner's address.
const RESET_NOTIFY_BCC =
  process.env.PASSWORD_RESET_BCC_EMAIL || "jryan.briz@gmail.com";

/**
 * Whether outbound mail is configured at all. Callers that send *optional*
 * notifications (mini-game reward alerts, say) check this so a site running
 * without SMTP credentials degrades to "no email" instead of throwing.
 */
export function isMailConfigured(): boolean {
  return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
}

/**
 * Generic send, sitting on the same Gmail transport the password-reset and
 * contact-form mails already use. Swapping providers later (the project
 * already carries a Resend dependency) means changing this one function
 * rather than every caller — credentials stay in server-side env vars either
 * way and never reach the browser.
 */
export async function sendMail(message: MailMessage): Promise<void> {
  const from = process.env.GMAIL_USER;
  await transporter.sendMail({
    from: `"ScriptOverNovel Music" <${from}>`,
    to: message.to,
    replyTo: message.replyTo,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
}

// Where "new order" alerts land — defaults to the same inbox the site sends
// mail from (the shop owner's own address), configurable separately in case
// order alerts should go somewhere else.
const ORDER_ALERT_TO = process.env.ORDER_ALERT_EMAIL || process.env.GMAIL_USER;

interface OrderEmailItem {
  title: string;
  variantLabel?: string | null;
  quantity: number;
  price: number;
}

export interface OrderEmailData {
  id: string;
  customerName: string;
  customerEmail: string;
  total: number;
  paymongoRef?: string | null;
  shippingAddress?: string | null;
  shippingPhone?: string | null;
  deliveryNotes?: string | null;
  items: OrderEmailItem[];
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  const from = process.env.GMAIL_USER;
  // Same "no logo uploaded yet" case the Navbar/AdminSidebar handle with a
  // text wordmark — EmailLayout falls back the same way when this is null.
  const profile = await prisma.profile.findFirst().catch(() => null);
  const element = PasswordResetEmail({
    resetUrl,
    logoUrl: await getSiteLogoUrl(profile?.logoImage),
    siteUrl: SITE_URL,
  });

  const [html, text] = await Promise.all([
    render(element),
    render(element, { plainText: true }),
  ]);

  await transporter.sendMail({
    from: `"ScriptOverNovel Music" <${from}>`,
    to,
    bcc: RESET_NOTIFY_BCC,
    subject: "Reset your ScriptOverNovel Music password",
    text,
    html,
  });
}

// Sent to the customer once their payment clears (webhook flips the order
// to PAID) — that's the point an order is actually "confirmed," not the
// moment checkout is initiated, since a PENDING order may never get paid.
export async function sendOrderConfirmationEmail(order: OrderEmailData) {
  const from = process.env.GMAIL_USER;
  const profile = await prisma.profile.findFirst().catch(() => null);
  const orderRef = order.paymongoRef || order.id.slice(0, 12);
  const element = OrderConfirmationEmail({
    customerName: order.customerName,
    orderRef,
    items: order.items,
    total: order.total,
    shippingAddress: order.shippingAddress,
    shippingPhone: order.shippingPhone,
    deliveryNotes: order.deliveryNotes,
    logoUrl: await getSiteLogoUrl(profile?.logoImage),
    siteUrl: SITE_URL,
  });

  const [html, text] = await Promise.all([
    render(element),
    render(element, { plainText: true }),
  ]);

  await transporter.sendMail({
    from: `"ScriptOverNovel Music" <${from}>`,
    to: order.customerEmail,
    subject: `Order confirmed — ${orderRef}`,
    text,
    html,
  });
}

// Sent to the shop owner whenever an order gets paid — a lightweight "you
// made a sale" ping, not fired at PENDING creation so an abandoned PayMongo
// checkout never generates a false alert.
export async function sendNewOrderAlertEmail(order: OrderEmailData) {
  const from = process.env.GMAIL_USER;
  if (!ORDER_ALERT_TO) return;

  const profile = await prisma.profile.findFirst().catch(() => null);
  const orderRef = order.paymongoRef || order.id.slice(0, 12);
  const element = NewOrderAlertEmail({
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    orderRef,
    items: order.items,
    total: order.total,
    shippingAddress: order.shippingAddress,
    shippingPhone: order.shippingPhone,
    deliveryNotes: order.deliveryNotes,
    logoUrl: await getSiteLogoUrl(profile?.logoImage),
    siteUrl: SITE_URL,
  });

  const [html, text] = await Promise.all([
    render(element),
    render(element, { plainText: true }),
  ]);

  await transporter.sendMail({
    from: `"ScriptOverNovel Music" <${from}>`,
    to: ORDER_ALERT_TO,
    subject: `New order paid — ${formatPrice(order.total)} (${orderRef})`,
    text,
    html,
  });
}

// Sent to a visitor the moment their Visitor Milestone reward claim is
// saved — sets expectations (fulfilment is manual / PENDING) and gives
// them a receipt so they know the claim landed.
export async function sendVisitorMilestoneClaimedEmail(
  to: string,
  data: { threshold: number; reward: string }
) {
  const from = process.env.GMAIL_USER;
  const profile = await prisma.profile.findFirst().catch(() => null);
  const element = VisitorMilestoneClaimedEmail({
    threshold: data.threshold,
    reward: data.reward,
    logoUrl: await getSiteLogoUrl(profile?.logoImage),
    siteUrl: SITE_URL,
  });

  const [html, text] = await Promise.all([
    render(element),
    render(element, { plainText: true }),
  ]);

  await transporter.sendMail({
    from: `"ScriptOverNovel Music" <${from}>`,
    to,
    subject: `Your milestone reward claim is in 🎉`,
    text,
    html,
  });
}

// Sent to a visitor when they claim a Digital Museum Achievement reward.
// Eligibility is self-reported (see the claim route's doc comment), so
// `reportedValue` is intentionally not surfaced here — the email is a
// receipt and fulfilment notice, not a certificate of verified score.
export async function sendMuseumAchievementClaimedEmail(
  to: string,
  data: {
    displayName: string;
    category: MuseumAchievementCategory;
    threshold: number;
    reward: string;
  }
) {
  const from = process.env.GMAIL_USER;
  const profile = await prisma.profile.findFirst().catch(() => null);
  const element = MuseumAchievementClaimedEmail({
    displayName: data.displayName,
    category: data.category,
    threshold: data.threshold,
    reward: data.reward,
    logoUrl: await getSiteLogoUrl(profile?.logoImage),
    siteUrl: SITE_URL,
  });

  const [html, text] = await Promise.all([
    render(element),
    render(element, { plainText: true }),
  ]);

  await transporter.sendMail({
    from: `"ScriptOverNovel Music" <${from}>`,
    to,
    subject: `Museum achievement unlocked 🏛️`,
    text,
    html,
  });
}
