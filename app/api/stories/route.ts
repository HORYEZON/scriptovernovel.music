// app/api/stories/route.ts
//
// Stories = picture-based publications (books, novels, comics, manga, …).
// Shaped deliberately like app/api/artworks/route.ts — same requireAdmin gate
// on writes, same write-once slug rule, same soft delete + revalidatePath
// pattern — so the two modules stay predictable against each other.
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/api-auth";
import { logContentChange } from "@/lib/activity-log-server";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";
import { isStoryType, isValidContinueUrl } from "@/lib/stories";

// GET /api/stories - list all
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const published = searchParams.get("published");
    const featured = searchParams.get("featured");
    const type = searchParams.get("type");
    const genre = searchParams.get("genre");

    const stories = await prisma.story.findMany({
      where: {
        deletedAt: null,
        ...(published !== null && { published: published === "true" }),
        ...(featured === "true" && { featured: true }),
        ...(type && isStoryType(type) && { type }),
        ...(genre && { genre: { has: genre } }),
      },
      include: {
        pages: { orderBy: { pageNumber: "asc" } },
        _count: { select: { pages: true } },
      },
      orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
    });

    return NextResponse.json(stories);
  } catch {
    return NextResponse.json({ error: "Failed to fetch stories" }, { status: 500 });
  }
}

// POST /api/stories - create (admin only)
export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await request.json();
    const {
      title,
      description,
      type,
      coverImageUrl,
      author,
      genre,
      year,
      featured,
      published,
      displayOrder,
      continueEnabled,
      continueUrl,
      continueLabel,
      pages,
    } = body;

    if (!title || !description || !coverImageUrl) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // http(s) only — this becomes an href in a public modal. Rejected here
    // rather than silently dropped so a typo surfaces in the admin instead of
    // quietly producing a story whose hand-off never appears.
    if (continueUrl && !isValidContinueUrl(continueUrl)) {
      return NextResponse.json(
        { error: "Continue Reading link must be a valid http(s) URL" },
        { status: 400 }
      );
    }

    // Set once, here, and never touched again on later edits (see PATCH in
    // [id]/route.ts) — a shared/indexed link to a story should never break.
    let slug = slugify(title);
    const existingSlug = await prisma.story.findUnique({ where: { slug } });
    if (existingSlug) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    // Pages are optional on create — the admin normally uploads them from the
    // edit modal's page manager afterwards, but accepting them here means a
    // story staged in one sitting doesn't need a second round-trip.
    const incomingPages: { imageUrl: string; caption: string | null }[] = Array.isArray(pages)
      ? pages
          .map((page: unknown) =>
            typeof page === "string"
              ? { imageUrl: page, caption: null }
              : {
                  imageUrl: (page as { imageUrl?: string })?.imageUrl ?? "",
                  caption: (page as { caption?: string })?.caption?.trim() || null,
                }
          )
          .filter((page) => Boolean(page.imageUrl))
      : [];

    const story = await prisma.story.create({
      data: {
        title,
        description,
        type: isStoryType(type) ? type : "BOOK",
        coverImageUrl,
        author: author || null,
        genre: Array.isArray(genre) ? genre : [],
        year: year ? parseInt(year) : null,
        featured: featured ?? false,
        published: published ?? true,
        displayOrder: typeof displayOrder === "number" ? displayOrder : 0,
        continueEnabled: continueEnabled ?? false,
        continueUrl: continueUrl?.trim() || null,
        continueLabel: continueLabel?.trim() || null,
        slug,
        pages: {
          create: incomingPages.map((page, i) => ({
            imageUrl: page.imageUrl,
            caption: page.caption,
            pageNumber: i + 1,
          })),
        },
      },
      include: {
        pages: { orderBy: { pageNumber: "asc" } },
        _count: { select: { pages: true } },
      },
    });

    revalidatePath("/", "layout");
    revalidatePath("/stories");
    revalidatePath("/admin/stories");

    logContentChange("created", "story", { id: story.id, name: story.title }, { request });

    return NextResponse.json(story, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create story" }, { status: 500 });
  }
}
