// app/api/faqs/active/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/faqs/active — list active FAQs for the public chatbox
export async function GET() {
  try {
    const faqs = await prisma.faq
      .findMany({
        where: { isActive: true },
        orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
        select: { id: true, question: true, answer: true },
      })
      .catch(() => []);

    return NextResponse.json(faqs);
  } catch {
    return NextResponse.json({ error: "Failed to fetch FAQs" }, { status: 500 });
  }
}
