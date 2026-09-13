// app/(admin)/admin/orders/page.tsx
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { OrdersClient } from "./OrdersClient";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

export const metadata: Metadata = { title: "Orders" };
export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  const orders = await prisma.order.findMany({
    include: {
      items: {
        include: {
          product: { include: { artwork: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <AdminPageHeader
        title="Orders"
        description="All customer orders — track status, view items, export, and manage fulfilment."
      />
      <OrdersClient initialOrders={orders} />
    </div>
  );
}
