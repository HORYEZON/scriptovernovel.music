// lib/notifications/order.ts
//
// Admin notification when an order gets paid. Two rules this file exists to
// enforce, same shape as lib/minigames/notify.ts:
//   • triggered only from the PayMongo webhook once payment is confirmed —
//     a PENDING order never alerts anyone
//   • a notification failure (DB write or mail) never fails the webhook.
//     Stock has already been decremented and the order is already PAID by
//     the time this runs, so a dropped alert is a logged annoyance, not
//     lost data. The DB write and the email are independent best-effort
//     attempts — one failing must not skip the other.
import { prisma } from "@/lib/prisma";
import { sendNewOrderAlertEmail, type OrderEmailData } from "@/lib/mail";
import { formatPrice } from "@/lib/utils";

export async function notifyAdminOfNewOrder(
  order: OrderEmailData
): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        type: "ORDER",
        title: `New order paid — ${formatPrice(order.total)}`,
        body: `${order.customerName} (${order.customerEmail}) just paid for order ${order.paymongoRef || order.id}.`,
        metadata: {
          orderId: order.id,
          paymongoRef: order.paymongoRef ?? null,
          total: order.total,
        },
      },
    });
  } catch (error) {
    console.error(
      "[notifications] failed to record new-order notification",
      error
    );
  }

  try {
    await sendNewOrderAlertEmail(order);
  } catch (error) {
    console.error("[notifications] failed to send new-order alert email", error);
  }
}
