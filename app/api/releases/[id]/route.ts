// app/api/releases/[id]/route.ts — update (partial) and soft delete.
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { changedFields, logContentChange } from "@/lib/activity-log-server";
import { getErrorCode, getErrorMessage } from "@/lib/utils";
import {
  MAX_RELEASE_DESCRIPTION,
  MAX_RELEASE_TITLE,
  isReleaseType,
  sanitizeReleaseLinks,
  sanitizeTracks,
} from "@/lib/releases";
import { RELEASE_INCLUDE, revalidateReleasePaths } from "@/lib/releases-server";

const EDITABLE = [
  "title", "type", "coverImageUrl", "releaseDate", "description", "featured", "published", "sortOrder",
  "spotifyUrl", "bandcampUrl", "youtubeUrl", "soundcloudUrl", "appleMusicUrl", "primaryPlayer", "tracks",
];

// PATCH /api/releases/[id] — partial update (admin only). `tracks`, when
// present, replaces the whole tracklist (same as product variants).
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id } = await params;
    const body = await request.json();
    const { title, type, coverImageUrl, releaseDate, description, featured, published, sortOrder, tracks } = body;
    const data: Record<string, unknown> = {};

    if (title !== undefined) {
      if (typeof title !== "string" || !title.trim()) return NextResponse.json({ error: "Title cannot be empty." }, { status: 400 });
      if (title.trim().length > MAX_RELEASE_TITLE) return NextResponse.json({ error: `Title is at most ${MAX_RELEASE_TITLE} characters.` }, { status: 400 });
      data.title = title.trim();
    }
    if (type !== undefined) {
      if (!isReleaseType(type)) return NextResponse.json({ error: "Unknown release type." }, { status: 400 });
      data.type = type;
    }
    if (coverImageUrl !== undefined) {
      if (typeof coverImageUrl !== "string" || !coverImageUrl.trim()) return NextResponse.json({ error: "A cover image is required." }, { status: 400 });
      data.coverImageUrl = coverImageUrl.trim();
    }
    if (releaseDate !== undefined) data.releaseDate = releaseDate ? new Date(releaseDate) : null;
    if (description !== undefined) {
      if (description !== null && (typeof description !== "string" || description.length > MAX_RELEASE_DESCRIPTION)) {
        return NextResponse.json({ error: `Description is at most ${MAX_RELEASE_DESCRIPTION} characters.` }, { status: 400 });
      }
      data.description = typeof description === "string" ? description.trim() || null : null;
    }
    if (featured !== undefined) {
      if (typeof featured !== "boolean") return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      data.featured = featured;
    }
    if (published !== undefined) {
      if (typeof published !== "boolean") return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      data.published = published;
    }
    if (sortOrder !== undefined) {
      if (!Number.isInteger(sortOrder)) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      data.sortOrder = sortOrder;
    }
    const links = sanitizeReleaseLinks(body);
    if ("error" in links) return NextResponse.json({ error: links.error }, { status: 400 });
    Object.assign(data, links.links);

    let trackRows: { title: string; durationSec: number | null; url: string | null; lyrics: string | null }[] | null = null;
    if (tracks !== undefined) {
      const clean = sanitizeTracks(tracks);
      if ("error" in clean) return NextResponse.json({ error: clean.error }, { status: 400 });
      trackRows = clean.tracks;
    }

    if (Object.keys(data).length === 0 && trackRows === null) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const release = await prisma.$transaction(async (tx) => {
      if (trackRows) {
        await tx.releaseTrack.deleteMany({ where: { releaseId: id } });
        await tx.releaseTrack.createMany({
          data: trackRows.map((t, i) => ({ ...t, releaseId: id, trackNumber: i + 1 })),
        });
      }
      return tx.release.update({ where: { id }, data, include: RELEASE_INCLUDE });
    });

    revalidateReleasePaths();
    logContentChange("updated", "release", { id, name: release.title }, { request, changed: changedFields(body, EDITABLE) });
    return NextResponse.json(release);
  } catch (error) {
    if (getErrorCode(error) === "P2025") return NextResponse.json({ error: "Release not found" }, { status: 404 });
    return NextResponse.json({ error: getErrorMessage(error, "Failed to update release") }, { status: 500 });
  }
}

// DELETE /api/releases/[id] — soft delete (moves to Trash)
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const { id } = await params;
    const deleted = await prisma.release.update({ where: { id }, data: { deletedAt: new Date() }, select: { title: true } });
    revalidateReleasePaths();
    revalidatePath("/admin/trash");
    logContentChange("deleted", "release", { id, name: deleted.title }, { request });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (getErrorCode(error) === "P2025") return NextResponse.json({ success: true });
    return NextResponse.json({ error: "Failed to delete release" }, { status: 500 });
  }
}
