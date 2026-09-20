// app/api/orders/lookup/route.ts
//
// Public order-status lookup — lets a customer check on their order with
// just the email they checked out with + their order reference number, no
// account needed. Deliberately unauthenticated (no requireAdmin), so the two
// values act as the credential: it must match the email on file, so knowing
// one alone isn't enough.
//
// Matches on `paymongoRef` (the "KAL-..." reference shown on the success
// page and in the confirmation email — lib/mail.ts) rather than the raw
// `Order.id`. The two used to be mismatched: this endpoint checked `id`, but
// no customer-facing surface ever shows the raw id, so the feature was
// unusable as built. paymongoRef is also the value actually designed to be
// a shareable reference — the DB primary key never was.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

/**
 * The reference is `KAL-<ms timestamp>-<8 hex>`, so guessing one outright
 * means guessing 32 bits of randomness *and* the millisecond the order was
 * created — not a realistic online attack. What the budget actually buys is
 * the two things an unauthenticated, database-touching endpoint always needs:
 * it stops someone walking a list of leaked emails against a known reference,
 * and it stops this route being used as a free way to make the database work.
 */
const LOOKUP_LIMIT = { limit: 10, windowMs: 60_000 };

export async function POST(request: NextRequest) {
  const limit = rateLimit(
    `order:lookup:${clientIp(request)}`,
    LOOKUP_LIMIT.limit,
    LOOKUP_LIMIT.windowMs
  );
  if (!limit.ok) return tooManyRequests(limit.retryAfterSec);

  try {
    const { email, reference } = await request.json();

    if (!email || !reference) {
      return NextResponse.json(
        { error: "Email and order reference are required" },
        { status: 400 }
      );
    }

    const order = await prisma.order.findFirst({
      where: {
        paymongoRef: { equals: reference.trim(), mode: "insensitive" },
        customerEmail: { equals: email.trim(), mode: "insensitive" },
      },
      // Curated shape — just what OrderLookupClient renders. Leaves out
      // internal fields (paymentId, checkoutUrl, customerEmail/Name) that
      // this endpoint has no reason to hand back to whoever's asking.
      select: {
        id: true,
        status: true,
        total: true,
        paymongoRef: true,
        shippingAddress: true,
        shippingPhone: true,
        deliveryNotes: true,
        createdAt: true,
        items: {
          select: {
            id: true,
            quantity: true,
            price: true,
            variantLabel: true,
            titleSnapshot: true,
            imageSnapshot: true,
            product: {
              select: { title: true, images: true, artwork: { select: { title: true, imageUrl: true } } },
            },
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: "No order found matching that email and reference number" },
        { status: 404 }
      );
    }

    return NextResponse.json(order);
  } catch {
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }
}
