// app/api/orders/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import type { OrderStatus } from "@prisma/client";
import { requireAdmin } from "@/lib/api-auth";
import { logActivity } from "@/lib/activity-log-server";
import { prisma } from "@/lib/prisma";
import { getErrorCode } from "@/lib/utils";

const VALID_STATUSES: OrderStatus[] = [
  "PENDING",
  "PAID",
  "FAILED",
  "CANCELLED",
  "SHIPPED",
  "DELIVERED",
];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id } = await params;
    const body = await request.json();
    const { status, archived } = body as { status?: unknown; archived?: unknown };

    const data: { status?: OrderStatus; archivedAt?: Date | null } = {};

    if (status !== undefined) {
      if (typeof status !== "string" || !VALID_STATUSES.includes(status as OrderStatus)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      data.status = status as OrderStatus;
    }

    // Archive is a timestamp, not a boolean, so the Orders list can sort and
    // say *when* something was filed away — but the caller only ever has to
    // think in terms of "archived: true/false".
    if (archived !== undefined) {
      if (typeof archived !== "boolean") {
        return NextResponse.json({ error: "Invalid archived flag" }, { status: 400 });
      }
      data.archivedAt = archived ? new Date() : null;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "Nothing to update — send `status` and/or `archived`" },
        { status: 400 }
      );
    }

    const order = await prisma.order.update({
      where: { id },
      data,
      include: {
        items: {
          include: {
            product: { include: { artwork: true } },
          },
        },
      },
    });

    void logActivity({
      category: "COMMERCE",
      action: data.status !== undefined ? "order.status-changed" : "order.updated",
      summary:
        data.status !== undefined
          ? `Order for ${order.customerName} marked ${data.status}.`
          : `Order for ${order.customerName} ${archived ? "archived" : "unarchived"}.`,
      entityType: "order",
      entityId: order.id,
      metadata: {
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(archived !== undefined ? { archived } : {}),
      },
      request,
    });

    return NextResponse.json(order);
  } catch (error) {
    if (getErrorCode(error) === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}
