// app/api/artworks/route.ts
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/api-auth";
import { logContentChange } from "@/lib/activity-log-server";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

// GET /api/artworks - list all
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const published = searchParams.get("published");
    const tag = searchParams.get("tag");
    const featured = searchParams.get("featured");
    const newRelease = searchParams.get("newRelease");

    const artworks = await prisma.artwork.findMany({
      where: {
        deletedAt: null,
        ...(published !== null && { published: published === "true" }),
        ...(featured === "true" && { featured: true }),
        ...(newRelease === "true" && { isNewRelease: true }),
        ...(tag && { tags: { has: tag } }),
      },
      include: { product: true, section: { select: { id: true, name: true, slug: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(artworks);
  } catch {
    return NextResponse.json({ error: "Failed to fetch artworks" }, { status: 500 });
  }
}

// POST /api/artworks - create (admin only)
export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await request.json();
    const { title, description, imageUrl, imageUrls, videoUrl, videoUrls, tags, medium, dimensions, year, featured, isNewRelease, published, status, sectionId } = body;

    if (!title || !description || !imageUrl) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Set once, here, and never touched again on later edits (see PATCH
    // below) — a shared/indexed link to /artwork/[slug] should never break.
    let slug = slugify(title);
    const existingSlug = await prisma.artwork.findUnique({ where: { slug } });
    if (existingSlug) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    const artwork = await prisma.artwork.create({
      data: {
        title,
        description,
        imageUrl,
        imageUrls: Array.isArray(imageUrls) ? imageUrls : [],
        videoUrl: videoUrl || null,
        videoUrls: Array.isArray(videoUrls) ? videoUrls : [],
        tags: tags || [],
        medium,
        dimensions,
        year: year ? parseInt(year) : null,
        featured: featured ?? false,
        isNewRelease: isNewRelease ?? false,
        published: published ?? true,
        status: status ?? "AVAILABLE",
        sectionId: sectionId || null,
        slug,
      },
      include: { product: true, section: { select: { id: true, name: true, slug: true } } },
    });

    revalidatePath("/", "layout");
    revalidatePath("/admin/artworks");

    logContentChange("created", "artwork", { id: artwork.id, name: artwork.title }, { request });

    return NextResponse.json(artwork, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create artwork" }, { status: 500 });
  }
}
