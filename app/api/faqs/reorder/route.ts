// app/api/faqs/reorder/route.ts
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

// PUT /api/faqs/reorder — batch update display order (admin only)
export async function PUT(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await request.json();
    const { order } = body; // Array of { id, displayOrder }

    if (!Array.isArray(order)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    await prisma.$transaction(
      order.map((item: { id: string; displayOrder: number }) =>
        prisma.faq.update({
          where: { id: item.id },
          data: { displayOrder: item.displayOrder },
        })
      )
    );

    const faqs = await prisma.faq.findMany({
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    });

    revalidatePath("/", "layout");
    revalidatePath("/admin/settings/faqs");

    return NextResponse.json(faqs);
  } catch {
    return NextResponse.json({ error: "Failed to reorder FAQs" }, { status: 500 });
  }
}
