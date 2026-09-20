// app/api/videos/[id]/route.ts — partial update and soft delete.
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { changedFields, logContentChange } from "@/lib/activity-log-server";
import { getErrorCode, getErrorMessage } from "@/lib/utils";
import { MAX_VIDEO_DESCRIPTION, MAX_VIDEO_TITLE, isVideoKind, sanitizeYouTube } from "@/lib/videos";
import { VIDEO_INCLUDE, revalidateVideoPaths } from "@/lib/videos-server";

const EDITABLE = ["title", "youtubeUrl", "kind", "releaseId", "description", "published", "featured", "sortOrder"];

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const { id } = await params;
    const body = await request.json();
    const { title, youtubeUrl, kind, releaseId, description, published, featured, sortOrder } = body;
    const data: Record<string, unknown> = {};

    if (title !== undefined) {
      if (typeof title !== "string" || !title.trim()) return NextResponse.json({ error: "Title cannot be empty." }, { status: 400 });
      if (title.trim().length > MAX_VIDEO_TITLE) return NextResponse.json({ error: `Title is at most ${MAX_VIDEO_TITLE} characters.` }, { status: 400 });
      data.title = title.trim();
    }
    if (youtubeUrl !== undefined) {
      const yt = sanitizeYouTube(youtubeUrl);
      if (!yt) return NextResponse.json({ error: "Paste a YouTube link (watch, youtu.be or shorts)." }, { status: 400 });
      Object.assign(data, yt);
    }
    if (kind !== undefined) {
      if (!isVideoKind(kind)) return NextResponse.json({ error: "Unknown video kind." }, { status: 400 });
      data.kind = kind;
    }
    if (releaseId !== undefined) {
      if (releaseId === null || releaseId === "") data.releaseId = null;
      else if (typeof releaseId === "string" && (await prisma.release.findFirst({ where: { id: releaseId, deletedAt: null }, select: { id: true } }))) data.releaseId = releaseId;
      else return NextResponse.json({ error: "That release doesn't exist." }, { status: 400 });
    }
    if (description !== undefined) {
      if (description !== null && (typeof description !== "string" || description.length > MAX_VIDEO_DESCRIPTION)) {
        return NextResponse.json({ error: `Description is at most ${MAX_VIDEO_DESCRIPTION} characters.` }, { status: 400 });
      }
      data.description = typeof description === "string" ? description.trim() || null : null;
    }
    for (const [key, val] of [["published", published], ["featured", featured]] as const) {
      if (val !== undefined) {
        if (typeof val !== "boolean") return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
        data[key] = val;
      }
    }
    if (sortOrder !== undefined) {
      if (!Number.isInteger(sortOrder)) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      data.sortOrder = sortOrder;
    }
    if (Object.keys(data).length === 0) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

    const video = await prisma.video.update({ where: { id }, data, include: VIDEO_INCLUDE });
    revalidateVideoPaths();
    logContentChange("updated", "video", { id, name: video.title }, { request, changed: changedFields(body, EDITABLE) });
    return NextResponse.json(video);
  } catch (error) {
    if (getErrorCode(error) === "P2025") return NextResponse.json({ error: "Video not found" }, { status: 404 });
    return NextResponse.json({ error: getErrorMessage(error, "Failed to update video") }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const { id } = await params;
    const deleted = await prisma.video.update({ where: { id }, data: { deletedAt: new Date() }, select: { title: true } });
    revalidateVideoPaths();
    revalidatePath("/admin/trash");
    logContentChange("deleted", "video", { id, name: deleted.title }, { request });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (getErrorCode(error) === "P2025") return NextResponse.json({ success: true });
    return NextResponse.json({ error: "Failed to delete video" }, { status: 500 });
  }
}
