// app/api/checkout/route.ts
import { NextRequest, NextResponse } from "next/server";
import { LIVE_PRODUCT_WHERE, PRODUCT_ARTWORK_SELECT } from "@/lib/store/queries";
import { productImage, productTitle } from "@/lib/store/product-display";
import { prisma } from "@/lib/prisma";
import { createCheckoutSession, tocentavos } from "@/lib/paymongo";
import { randomUUID } from "crypto";
import { getErrorMessage } from "@/lib/utils";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      customerName,
      customerEmail,
      shippingAddress,
      shippingPhone,
      deliveryNotes,
      items,
    } = body;

    if (!customerName || !customerEmail || !items?.length) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }
    if (!shippingAddress || !shippingPhone) {
      return NextResponse.json(
        { error: "Shipping address and phone number are required" },
        { status: 400 }
      );
    }

    // Validate products/stock and build the authoritative line items in one
    // pass. Price, title, and image are always taken from the DB — never
    // from the request body — so a tampered `item.price` in the request
    // can't change what the customer is actually charged or what gets
    // recorded on the order.
    // LIVE_PRODUCT_WHERE — the exact filter the Shop listing itself uses — so a
    // product an admin has deleted or paused can't be bought just because a
    // visitor's cart is a localStorage snapshot from before that happened.
    // Without this, the query below found the row regardless (Prisma has no
    // implicit soft-delete filtering), stock still passed, and a deleted
    // merch item could be paid for.
    const productIds = items.map((i: { productId: string }) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, ...LIVE_PRODUCT_WHERE },
      include: { artwork: PRODUCT_ARTWORK_SELECT, variants: true },
    });

    const lineItems: {
      productId: string;
      variantId: string | null;
      variantLabel: string | null;
      quantity: number;
      title: string;
      imageUrl: string;
      unitPrice: number;
    }[] = [];

    for (const item of items) {
      const quantity = Number(item.quantity);
      if (!Number.isInteger(quantity) || quantity < 1) {
        return NextResponse.json({ error: "Invalid quantity" }, { status: 400 });
      }

      const product = products.find((p) => p.id === item.productId);
      const title = productTitle(product) ?? "this item";
      const imageUrl = productImage(product) ?? "";
      if (!product) {
        // Covers a genuinely unknown id and a deleted/paused one alike —
        // the filtered query above can't tell them apart, and a visitor
        // doesn't need it to; either way, this item can't be bought.
        return NextResponse.json(
          { error: "One of the items in your cart is no longer available. Please remove it and try again." },
          { status: 400 }
        );
      }

      if (item.variantId) {
        const variant = product.variants.find((v) => v.id === item.variantId);
        if (!variant) {
          return NextResponse.json(
            { error: `Variant not found for "${title}"` },
            { status: 400 }
          );
        }
        if (variant.stock < quantity) {
          return NextResponse.json(
            { error: `Insufficient stock for "${title}" (${variant.label})` },
            { status: 400 }
          );
        }
        lineItems.push({
          productId: product.id,
          variantId: variant.id,
          variantLabel: variant.label,
          quantity,
          title,
          imageUrl,
          unitPrice: variant.price,
        });
      } else {
        if (product.stock < quantity) {
          return NextResponse.json(
            { error: `Insufficient stock for "${title}"` },
            { status: 400 }
          );
        }
        lineItems.push({
          productId: product.id,
          variantId: null,
          variantLabel: null,
          quantity,
          title,
          imageUrl,
          unitPrice: product.price,
        });
      }
    }

    const total = lineItems.reduce((sum, li) => sum + li.unitPrice * li.quantity, 0);

    const referenceNumber = `SON-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    // Create PayMongo checkout session
    const checkoutSession = await createCheckoutSession({
      lineItems: lineItems.map((li) => ({
        name: li.variantLabel ? `${li.title} (${li.variantLabel})` : li.title,
        quantity: li.quantity,
        amount: tocentavos(li.unitPrice),
        currency: "PHP",
        images: li.imageUrl ? [li.imageUrl] : undefined,
      })),
      successUrl: `${baseUrl}/order/success?session_id=${referenceNumber}`,
      cancelUrl: `${baseUrl}/order/cancel`,
      referenceNumber,
      description: `ScriptOverNovel Merch Order - ${referenceNumber}`,
      customerEmail,
      customerName,
    });

    const { id: paymongoSessionId, attributes } = checkoutSession.data;
    const checkoutUrl = attributes.checkout_url;

    // Create order in DB
    const order = await prisma.order.create({
      data: {
        customerName,
        customerEmail,
        total,
        status: "PENDING",
        paymentId: paymongoSessionId,
        paymongoRef: referenceNumber,
        checkoutUrl,
        shippingAddress,
        shippingPhone,
        deliveryNotes: deliveryNotes || null,
        items: {
          create: lineItems.map((li) => ({
            productId: li.productId,
            variantId: li.variantId,
            variantLabel: li.variantLabel,
            quantity: li.quantity,
            price: li.unitPrice,
          })),
        },
      },
    });

    return NextResponse.json({
      orderId: order.id,
      checkoutUrl,
      referenceNumber,
    });
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json(
      { error: getErrorMessage(error, "Checkout failed") },
      { status: 500 }
    );
  }
}
