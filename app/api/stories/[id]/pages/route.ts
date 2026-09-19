// app/api/stories/[id]/pages/route.ts
//
// The page images of one story. Images themselves are uploaded through the
// shared POST /api/upload first (same as artwork images) — this route only
// ever stores the resulting URLs, so there is exactly one uploader in the app.
//
//   POST — append one or more pages to the end of the run
//   PUT  — reorder: takes the full ordered list of page ids and re-numbers
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { getErrorCode } from "@/lib/utils";
import { storyInclude } from "@/lib/stories-server";

function revalidateStory() {
  revalidatePath("/", "layout");
  revalidatePath("/stories");
  revalidatePath("/admin/stories");
}

// POST /api/stories/[id]/pages — add page(s)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id } = await params;
    const body = await request.json();

    // Accepts a single { imageUrl, caption } or { pages: [...] } — the admin's
    // multi-file picker uploads in parallel and posts them as one batch.
    const rawPages: unknown[] = Array.isArray(body?.pages) ? body.pages : [body];
    const incoming = rawPages
      .map((page) =>
        typeof page === "string"
          ? { imageUrl: page, caption: null as string | null }
          : {
              imageUrl: (page as { imageUrl?: string })?.imageUrl ?? "",
              caption: (page as { caption?: string })?.caption?.trim() || null,
            }
      )
      .filter((page) => Boolean(page.imageUrl));

    if (incoming.length === 0) {
      return NextResponse.json({ error: "No page images provided" }, { status: 400 });
    }

    const story = await prisma.story.findUnique({ where: { id }, select: { id: true } });
    if (!story) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const last = await prisma.storyPage.findFirst({
      where: { storyId: id },
      orderBy: { pageNumber: "desc" },
      select: { pageNumber: true },
    });
    const startAt = (last?.pageNumber ?? 0) + 1;

    await prisma.storyPage.createMany({
      data: incoming.map((page, i) => ({
        storyId: id,
        imageUrl: page.imageUrl,
        caption: page.caption,
        pageNumber: startAt + i,
      })),
    });

    const updated = await prisma.story.findUnique({ where: { id }, include: storyInclude });

    revalidateStory();

    return NextResponse.json(updated, { status: 201 });
  } catch (error) {
    if (getErrorCode(error) === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to add pages" }, { status: 500 });
  }
}

// PUT /api/stories/[id]/pages — reorder (body: { pageIds: string[] })
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id } = await params;
    const body = await request.json();
    const pageIds: unknown = body?.pageIds;

    if (!Array.isArray(pageIds) || pageIds.some((pageId) => typeof pageId !== "string")) {
      return NextResponse.json({ error: "pageIds must be an array of ids" }, { status: 400 });
    }

    const existing = await prisma.storyPage.findMany({
      where: { storyId: id },
      select: { id: true },
    });

    // The client always sends the complete run — reject a partial list rather
    // than half-applying it and leaving the numbering inconsistent.
    const existingIds = new Set(existing.map((page) => page.id));
    if (
      pageIds.length !== existing.length ||
      (pageIds as string[]).some((pageId) => !existingIds.has(pageId))
    ) {
      return NextResponse.json(
        { error: "pageIds must contain every page of this tale exactly once" },
        { status: 400 }
      );
    }

    await prisma.$transaction(
      (pageIds as string[]).map((pageId, i) =>
        prisma.storyPage.update({ where: { id: pageId }, data: { pageNumber: i + 1 } })
      )
    );

    const updated = await prisma.story.findUnique({ where: { id }, include: storyInclude });
    if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });

    revalidateStory();

    return NextResponse.json(updated);
  } catch (error) {
    if (getErrorCode(error) === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to reorder pages" }, { status: 500 });
  }
}
