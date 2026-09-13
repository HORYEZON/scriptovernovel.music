// app/api/stories/[id]/pages/[pageId]/route.ts
//
//   PATCH  — edit one page's caption
//   DELETE — remove one page for good, then re-normalize the remaining run
//
// Pages are hard-deleted (not soft): they only exist as part of their story,
// and the story itself is what the Trash module restores. Deleting the story
// cascades these rows away (see the relation in prisma/schema.prisma).
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { getErrorCode } from "@/lib/utils";
import { renumberStoryPages, storyInclude } from "@/lib/stories-server";

function revalidateStory() {
  revalidatePath("/", "layout");
  revalidatePath("/stories");
  revalidatePath("/admin/stories");
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; pageId: string }> }
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id, pageId } = await params;
    const body = await request.json();
    const { caption } = body;

    const page = await prisma.storyPage.findUnique({
      where: { id: pageId },
      select: { storyId: true },
    });
    if (!page || page.storyId !== id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.storyPage.update({
      where: { id: pageId },
      data: { ...(caption !== undefined && { caption: caption?.trim() || null }) },
    });

    const updated = await prisma.story.findUnique({ where: { id }, include: storyInclude });

    revalidateStory();

    return NextResponse.json(updated);
  } catch (error) {
    if (getErrorCode(error) === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to update page" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; pageId: string }> }
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id, pageId } = await params;

    const page = await prisma.storyPage.findUnique({
      where: { id: pageId },
      select: { storyId: true },
    });
    if (!page || page.storyId !== id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.storyPage.delete({ where: { id: pageId } });
    await renumberStoryPages(id);

    const updated = await prisma.story.findUnique({ where: { id }, include: storyInclude });

    revalidateStory();

    return NextResponse.json(updated);
  } catch (error) {
    if (getErrorCode(error) === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to delete page" }, { status: 500 });
  }
}
