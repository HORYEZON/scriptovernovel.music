// app/api/webhooks/paymongo/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyWebhookSignature } from "@/lib/paymongo";
import { sendOrderConfirmationEmail } from "@/lib/mail";
import { notifyAdminOfNewOrder } from "@/lib/notifications/order";

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("paymongo-signature") || "";
    const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET;

    // Verify webhook signature — mandatory, not best-effort. This endpoint
    // is what marks orders PAID and decrements stock, so without a
    // configured secret there'd be nothing stopping a forged POST from
    // "confirming" a payment that never happened. Misconfiguration should
    // fail loud (500) rather than silently accept unverified events.
    if (!webhookSecret) {
      console.error("PAYMONGO_WEBHOOK_SECRET is not set — refusing webhook");
      return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
    }
    const isValid = verifyWebhookSignature(body, signature, webhookSecret);
    if (!isValid) {
      console.warn("Invalid PayMongo webhook signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const event = JSON.parse(body);
    const { type, data } = event.data.attributes;

    console.log("PayMongo webhook event:", type);

    switch (type) {
      case "checkout_session.payment.paid": {
        const sessionId = data.id;
        const referenceNumber = data.attributes?.reference_number;

        // Find order by reference number or payment ID
        const order = await prisma.order.findFirst({
          where: {
            OR: [
              { paymentId: sessionId },
              { paymongoRef: referenceNumber },
            ],
          },
          include: { items: { include: { product: { include: { artwork: true } } } } },
        });

        if (order && order.status !== "PAID") {
          await prisma.order.update({
            where: { id: order.id },
            data: { status: "PAID" },
          });

          // Decrement stock for each item — at the variant level when the
          // line item was for a specific size, otherwise the product itself.
          // The `stock: { gte: quantity }` guard makes this an atomic
          // "decrement only if enough is left" update instead of a plain
          // decrement, so two concurrent buyers checking out the last unit
          // of a one-of-a-kind piece can't both succeed and drive stock
          // negative. If it does lose that race, payment has already gone
          // through (can't undo it here), so this at least surfaces loudly
          // rather than silently overselling.
          for (const item of order.items) {
            if (item.variantId) {
              const result = await prisma.productVariant.updateMany({
                where: { id: item.variantId, stock: { gte: item.quantity } },
                data: { stock: { decrement: item.quantity } },
              });
              if (result.count === 0) {
                console.error(
                  `⚠️ Oversold: variant ${item.variantId} had insufficient stock for paid order ${order.id}`
                );
              }
            } else {
              const result = await prisma.product.updateMany({
                where: { id: item.productId, stock: { gte: item.quantity } },
                data: { stock: { decrement: item.quantity } },
              });
              if (result.count === 0) {
                console.error(
                  `⚠️ Oversold: product ${item.productId} had insufficient stock for paid order ${order.id}`
                );
              }
            }
          }
          console.log(`✅ Order ${order.id} marked as PAID`);

          // Best-effort notifications — a mail hiccup here must never turn
          // into a webhook failure (PayMongo would just retry the event and
          // re-run the stock decrement above).
          const emailData = {
            id: order.id,
            customerName: order.customerName,
            customerEmail: order.customerEmail,
            total: order.total,
            paymongoRef: order.paymongoRef,
            shippingAddress: order.shippingAddress,
            shippingPhone: order.shippingPhone,
            deliveryNotes: order.deliveryNotes,
            items: order.items.map((item) => ({
              title: item.product.artwork.title,
              variantLabel: item.variantLabel,
              quantity: item.quantity,
              price: item.price,
            })),
          };
          try {
            await sendOrderConfirmationEmail(emailData);
          } catch (err) {
            console.error("Failed to send order confirmation email:", err);
          }
          // Writes the admin's in-app notification row and sends the
          // "new order paid" alert email — see lib/notifications/order.ts.
          await notifyAdminOfNewOrder(emailData);
        }
        break;
      }

      case "checkout_session.payment.failed": {
        const sessionId = data.id;
        await prisma.order.updateMany({
          where: { paymentId: sessionId },
          data: { status: "FAILED" },
        });
        console.log(`❌ Payment failed for session ${sessionId}`);
        break;
      }

      case "payment.paid": {
        // Handle direct payment intents
        const paymentIntentId = data.attributes?.payment_intent_id;
        if (paymentIntentId) {
          await prisma.order.updateMany({
            where: { paymentId: paymentIntentId },
            data: { status: "PAID" },
          });
        }
        break;
      }

      default:
        console.log("Unhandled webhook type:", type);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Webhook error" }, { status: 500 });
  }
}

