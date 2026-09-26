// app/api/stock-notifications/route.ts
//
// "Tell me when this is back": the public request (POST) and the admin's list
// (GET).
//
// Written to the same rules as the mailing-list signup, for the same reason —
// it takes an email address from whoever calls it:
//
// - **One answer for every outcome.** New request, already waiting, already
//   alerted: the same sentence. Anything else tells a caller whether a given
//   address is on a given waiting list, which is not ours to tell.
// - **Rate limited per IP**, so it can't be used to queue a stranger up for the
//   whole shop.
// - **No email at signup.** Exactly one email is ever sent to a row, and
//   sending it retires the row, so there is nothing to confirm and no list to
//   leave. See the StockNotification model's comment.
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { logActivity } from "@/lib/activity-log-server";
import { acceptsStockAlerts } from "@/lib/store/availability";
import { LIVE_PRODUCT_WHERE } from "@/lib/store/queries";
import {
  NOTIFY_ACK,
  NOTIFY_RATE_LIMIT,
  NOTIFY_RATE_WINDOW_MS,
  isValidNotifyEmail,
  normalizeEmail,
} from "@/lib/store/notify";
import { recordStockRequest, revalidateStockAlertPaths } from "@/lib/store/notify-server";

export const dynamic = "force-dynamic";

// POST /api/stock-notifications — public
export async function POST(request: NextRequest) {
  const limit = rateLimit(`stock-alert:${clientIp(request)}`, NOTIFY_RATE_LIMIT, NOTIFY_RATE_WINDOW_MS);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSec);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { productId, variantId, email: rawEmail } = (body ?? {}) as Record<string, unknown>;

  const email = normalizeEmail(rawEmail);
  // A malformed address is the visitor's own typo — telling them is help, not
  // disclosure, and it's the only case with its own message.
  if (!isValidNotifyEmail(email)) {
    return NextResponse.json({ error: "That doesn't look like an email address." }, { status: 400 });
  }
  if (typeof productId !== "string" || !productId) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    // Only for a product a visitor can actually see, and only in a state where
    // an alert means something — otherwise this is a way to write rows against
    // any id at all.
    const product = await prisma.product.findFirst({
      where: { id: productId, ...LIVE_PRODUCT_WHERE },
      select: { id: true, stock: true, comingSoon: true, variants: { select: { id: true, stock: true } } },
    });
    if (!product || !acceptsStockAlerts(product)) {
      return NextResponse.json({ error: "That one isn't taking alerts right now." }, { status: 400 });
    }

    // A variant must belong to this product; anything else is dropped to "any".
    const variant =
      typeof variantId === "string" && product.variants.some((v) => v.id === variantId) ? variantId : null;

    const blocked = await prisma.blockedEmail.findUnique({ where: { email } }).catch(() => null);
    if (blocked) return NextResponse.json({ ok: true, message: NOTIFY_ACK });

    const result = await recordStockRequest(product.id, variant, email);
    if (result === "added") {
      revalidateStockAlertPaths();
      void logActivity({
        category: "VISITOR",
        action: "stock-alert.requested",
        summary: `${email} asked to be told when a product is back.`,
        actor: { label: email, email, type: "visitor" },
        metadata: { productId: product.id, variantId: variant ?? "any" },
        request,
      });
    }
    return NextResponse.json({ ok: true, message: NOTIFY_ACK });
  } catch {
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

// GET /api/stock-notifications — admin. `?productId=` narrows to one product.
export async function GET(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const productId = request.nextUrl.searchParams.get("productId");
    const rows = await prisma.stockNotification.findMany({
      where: productId ? { productId } : undefined,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        productId: true,
        variantId: true,
        notifiedAt: true,
        createdAt: true,
        variant: { select: { label: true } },
        product: { select: { title: true, slug: true, artwork: { select: { title: true } } } },
      },
    });
    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ error: "Failed to fetch stock alerts" }, { status: 500 });
  }
}
