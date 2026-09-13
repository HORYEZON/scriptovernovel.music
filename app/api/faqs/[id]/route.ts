// app/api/faqs/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { getErrorCode, getErrorMessage } from "@/lib/utils";

// PATCH /api/faqs/[id] — update (admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id } = await params;
    const body = await request.json();
    const { question, answer, isActive, displayOrder } = body;

    const data: Prisma.FaqUpdateInput = {};
    if (question !== undefined) {
      if (!question.trim()) {
        return NextResponse.json({ error: "Question cannot be empty." }, { status: 400 });
      }
      data.question = question.trim();
    }
    if (answer !== undefined) {
      if (!answer.trim()) {
        return NextResponse.json({ error: "Answer cannot be empty." }, { status: 400 });
      }
      data.answer = answer.trim();
    }
    if (isActive !== undefined) data.isActive = Boolean(isActive);
    if (displayOrder !== undefined) data.displayOrder = displayOrder;

    const faq = await prisma.faq.update({ where: { id }, data });

    revalidatePath("/", "layout");
    revalidatePath("/admin/settings/faqs");

    return NextResponse.json(faq);
  } catch (error) {
    if (getErrorCode(error) === "P2025") {
      return NextResponse.json({ error: "FAQ not found" }, { status: 404 });
    }
    return NextResponse.json({ error: getErrorMessage(error, "Failed to update FAQ") }, { status: 500 });
  }
}

// DELETE /api/faqs/[id] — delete (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id } = await params;
    await prisma.faq.delete({ where: { id } });

    revalidatePath("/", "layout");
    revalidatePath("/admin/settings/faqs");

    return NextResponse.json({ success: true });
  } catch (error) {
    if (getErrorCode(error) === "P2025") {
      return NextResponse.json({ error: "FAQ not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to delete FAQ" }, { status: 500 });
  }
}
