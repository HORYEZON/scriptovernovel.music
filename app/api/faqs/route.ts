// app/api/faqs/route.ts
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { getErrorMessage } from "@/lib/utils";

// GET /api/faqs — list all (admin)
export async function GET() {
  try {
    const faqs = await prisma.faq.findMany({
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json(faqs);
  } catch {
    return NextResponse.json({ error: "Failed to fetch FAQs" }, { status: 500 });
  }
}

// POST /api/faqs — create (admin only)
export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await request.json();
    const { question, answer, isActive } = body;

    if (!question?.trim() || !answer?.trim()) {
      return NextResponse.json({ error: "Question and answer are required." }, { status: 400 });
    }

    const maxOrder = await prisma.faq.aggregate({
      _max: { displayOrder: true },
    });
    const displayOrder = (maxOrder._max.displayOrder ?? -1) + 1;

    const faq = await prisma.faq.create({
      data: {
        question: question.trim(),
        answer: answer.trim(),
        isActive: isActive ?? true,
        displayOrder,
      },
    });

    revalidatePath("/", "layout");
    revalidatePath("/admin/settings/faqs");

    return NextResponse.json(faq, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Failed to create FAQ") }, { status: 500 });
  }
}
