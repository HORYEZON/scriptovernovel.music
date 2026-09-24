// app/api/orders/[id]/receipt/route.ts
//
// GET /api/orders/{id}/receipt — a printable HTML receipt for one order.
// Admin-only; the Orders module opens it in a new tab, where it prints
// itself (Save as PDF). See lib/receipt.ts for why this is HTML and not a
// server-generated PDF.
import { orderItemTitle } from "@/lib/orders/item-display";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { renderReceiptHtml } from "@/lib/receipt";
import { SITE_URL } from "@/lib/site-url";
import { getSiteLogoUrl } from "@/lib/site-logo";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id } = await params;

    const [order, profile] = await Promise.all([
      prisma.order.findUnique({
        where: { id },
        include: {
          items: { include: { product: { include: { artwork: true } } } },
        },
      }),
      prisma.profile.findFirst(),
    ]);

    if (!order) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const html = renderReceiptHtml(
      {
        ...order,
        items: order.items.map((item) => ({
          title: orderItemTitle(item),
          variantLabel: item.variantLabel,
          quantity: item.quantity,
          price: item.price,
        })),
      },
      {
        name: profile?.displayName || "ScriptOverNovel Music",
        email: profile?.email,
        phone: profile?.phone,
        address: profile?.address,
        logoUrl: await getSiteLogoUrl(profile?.logoImage),
        siteUrl: SITE_URL,
      }
    );

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        // inline, not attachment: the tab has to actually render so it can
        // print itself. A downloaded .html file would never run its script.
        "Content-Disposition": `inline; filename="receipt-${order.paymongoRef || order.id}.html"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to render receipt" }, { status: 500 });
  }
}
