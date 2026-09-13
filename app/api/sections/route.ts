// app/api/sections/route.ts
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

// GET /api/sections — list all sections
export async function GET() {
  try {
    const sections = await prisma.section.findMany({
      orderBy: { displayOrder: "asc" },
      include: {
        _count: { select: { artworks: true } },
      },
    });
    return NextResponse.json(sections);
  } catch {
    return NextResponse.json({ error: "Failed to fetch sections" }, { status: 500 });
  }
}

// POST /api/sections — create a new section (admin only)
export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await request.json();
    const { name, coverImageUrl, isPublished } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // Generate slug, ensure uniqueness
    let slug = slugify(name);
    const existing = await prisma.section.findUnique({ where: { slug } });
    if (existing) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    // Get next display order
    const maxOrder = await prisma.section.aggregate({ _max: { displayOrder: true } });
    const displayOrder = (maxOrder._max.displayOrder ?? -1) + 1;

    const section = await prisma.section.create({
      data: {
        name: name.trim(),
        slug,
        displayOrder,
        coverImageUrl: coverImageUrl || null,
        isPublished: isPublished ?? true,
      },
      include: {
        _count: { select: { artworks: true } },
      },
    });

    revalidatePath("/", "layout");
    revalidatePath("/admin/artworks");

    return NextResponse.json(section, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create section" }, { status: 500 });
  }
}
