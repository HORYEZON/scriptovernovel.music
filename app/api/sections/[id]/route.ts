// app/api/sections/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { getErrorCode, slugify } from "@/lib/utils";

// GET /api/sections/:id — fetch one section with artworks
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const section = await prisma.section.findUnique({
      where: { id },
      include: {
        artworks: {
          include: { product: true },
          orderBy: { createdAt: "desc" },
        },
        _count: { select: { artworks: true } },
      },
    });
    if (!section) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(section);
  } catch {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

// PATCH /api/sections/:id — update section
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id } = await params;
    const body = await request.json();
    const { name, coverImageUrl, isPublished, displayOrder } = body;

    const data: Prisma.SectionUpdateInput = {};
    if (name !== undefined) {
      data.name = name.trim();
      // Regenerate slug if name changed
      let slug = slugify(name);
      const existing = await prisma.section.findFirst({
        where: { slug, NOT: { id } },
      });
      if (existing) {
        slug = `${slug}-${Date.now().toString(36)}`;
      }
      data.slug = slug;
    }
    if (coverImageUrl !== undefined) data.coverImageUrl = coverImageUrl || null;
    if (isPublished !== undefined) data.isPublished = isPublished;
    if (displayOrder !== undefined) data.displayOrder = displayOrder;

    const section = await prisma.section.update({
      where: { id },
      data,
      include: {
        _count: { select: { artworks: true } },
      },
    });

    revalidatePath("/", "layout");
    revalidatePath("/admin/artworks");

    return NextResponse.json(section);
  } catch (error) {
    if (getErrorCode(error) === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

// DELETE /api/sections/:id — soft delete (moves to trash)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id } = await params;
    const deletedAt = new Date();

    // Cascade: trash the section along with its linked artworks (and their
    // product listings), all stamped with the same deletedAt so restoring
    // the section later can restore exactly this batch — not artworks that
    // were independently trashed before or after.
    await prisma.$transaction([
      prisma.product.updateMany({
        where: { artwork: { sectionId: id }, deletedAt: null },
        data: { deletedAt },
      }),
      prisma.artwork.updateMany({
        where: { sectionId: id, deletedAt: null },
        data: { deletedAt },
      }),
      prisma.section.update({
        where: { id },
        data: { deletedAt },
      }),
    ]);

    revalidatePath("/", "layout");
    revalidatePath("/admin/artworks");
    revalidatePath("/admin/products");
    revalidatePath("/admin/trash");

    return NextResponse.json({ success: true });
  } catch (error) {
    if (getErrorCode(error) === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
