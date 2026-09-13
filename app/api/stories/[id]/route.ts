// app/api/stories/[id]/route.ts
//
// Mirrors app/api/artworks/[id]/route.ts: GET is public, PATCH/DELETE are
// admin-gated, DELETE is a soft delete (deletedAt) so the row lands in the
// Trash module rather than disappearing.
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/api-auth";
import { logContentChange, changedFields } from "@/lib/activity-log-server";
import { prisma } from "@/lib/prisma";
import { getErrorCode } from "@/lib/utils";
import { isStoryType, isValidContinueUrl } from "@/lib/stories";

const storyInclude = {
  pages: { orderBy: { pageNumber: "asc" } },
  _count: { select: { pages: true } },
} as const;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const story = await prisma.story.findUnique({
      where: { id },
      include: storyInclude,
    });
    if (!story) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(story);
  } catch {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id } = await params;
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
    } = body;

    // Same http(s) guard as POST — see ../route.ts.
    if (continueUrl && !isValidContinueUrl(continueUrl)) {
      return NextResponse.json(
        { error: "Continue Reading link must be a valid http(s) URL" },
        { status: 400 }
      );
    }

    const story = await prisma.story.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        // slug is deliberately never updated here, even if the title
        // changes — see the comment on POST in ../route.ts.
        ...(type !== undefined && isStoryType(type) && { type }),
        ...(coverImageUrl !== undefined && { coverImageUrl }),
        ...(author !== undefined && { author: author || null }),
        ...(genre !== undefined && { genre: Array.isArray(genre) ? genre : [] }),
        ...(year !== undefined && { year: year ? parseInt(year) : null }),
        ...(featured !== undefined && { featured }),
        ...(published !== undefined && { published }),
        ...(displayOrder !== undefined && { displayOrder }),
        ...(continueEnabled !== undefined && { continueEnabled }),
        ...(continueUrl !== undefined && { continueUrl: continueUrl?.trim() || null }),
        ...(continueLabel !== undefined && { continueLabel: continueLabel?.trim() || null }),
      },
      include: storyInclude,
    });

    revalidatePath("/", "layout");
    revalidatePath("/stories");
    revalidatePath("/admin/stories");

    logContentChange("updated", "story", { id: story.id, name: story.title }, {
      request,
      changed: changedFields(body, ["title", "description", "coverImage", "type", "published", "featured"]),
    });

    return NextResponse.json(story);
  } catch (error) {
    if (getErrorCode(error) === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id } = await params;

    const deleted = await prisma.story.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    revalidatePath("/", "layout");
    revalidatePath("/stories");
    revalidatePath("/admin/stories");

    logContentChange("deleted", "story", { id, name: deleted.title }, { request });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (getErrorCode(error) === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
