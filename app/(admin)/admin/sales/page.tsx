// app/(admin)/admin/sales/page.tsx
//
// Sales Dashboard — the money view of the shop, sitting alongside Products and
// Orders in the sidebar's Sales group. The main /admin/dashboard answers "what
// is happening today"; this answers "how are we selling, and what sells".
import { orderItemTitle, orderItemImage } from "@/lib/orders/item-display";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { SalesClient } from "./SalesClient";
import {
  REVENUE_STATUSES,
  SALES_WINDOW_DAYS,
  dayKey,
  startOfDaysAgo,
  type SalesLine,
} from "@/lib/sales";

export const metadata: Metadata = { title: "Sales Dashboard" };
export const dynamic = "force-dynamic";

export default async function AdminSalesPage() {
  const windowStart = startOfDaysAgo(SALES_WINDOW_DAYS);

  // One query for the whole window, flattened to line items below. The range
  // picker, the trend chart and both top-seller lists then recompute
  // client-side, so switching 7d → 12mo is instant instead of a round trip.
  // Archived orders are deliberately included: archiving files an order out of
  // the working list, it does not un-earn the money (see Order.archivedAt).
  const [orders, lifetimeAgg] = await Promise.all([
    prisma.order.findMany({
      where: {
        status: { in: REVENUE_STATUSES },
        createdAt: { gte: windowStart },
      },
      select: {
        id: true,
        createdAt: true,
        items: {
          select: {
            quantity: true,
            price: true,
            product: {
              select: {
                artwork: {
                  select: {
                    id: true,
                    title: true,
                    imageUrl: true,
                    section: { select: { name: true } },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.order.aggregate({
      where: { status: { in: REVENUE_STATUSES } },
      _sum: { total: true },
      _count: true,
    }),
  ]);

  const lines: SalesLine[] = orders.flatMap((order) =>
    order.items.map((item) => ({
      o: order.id,
      d: dayKey(order.createdAt),
      // A product purged from Trash leaves the line with its snapshot only
      // (lib/orders/item-display.ts): grouped under that title, no section.
      a: item.product?.artwork.id ?? `removed:${orderItemTitle(item)}`,
      t: orderItemTitle(item),
      s: item.product?.artwork.section?.name ?? null,
      q: item.quantity,
      r: item.price * item.quantity,
      p: orderItemImage(item) ?? "",
    }))
  );

  return (
    <div className="px-3 sm:px-0">
      <AdminPageHeader
        breadcrumbs={[{ label: "Sales" }, { label: "Sales Dashboard" }]}
        title="Sales Dashboard"
        description="Revenue over time and what's actually selling. Counts paid, shipped and delivered orders."
      />
      <SalesClient
        lines={lines}
        lifetimeRevenue={lifetimeAgg._sum.total ?? 0}
        lifetimeOrders={lifetimeAgg._count}
      />
    </div>
  );
}
