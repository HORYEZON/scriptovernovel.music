// app/api/vinyls/[id]/route.ts — partial update and soft delete.
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { changedFields, logContentChange } from "@/lib/activity-log-server";
import { getErrorCode, getErrorMessage } from "@/lib/utils";
import { MAX_SIDE_LABEL } from "@/lib/vinyls";
import { VINYL_INCLUDE, isOurAudioUrl, revalidateVinylPaths, toAdminVinyl } from "@/lib/vinyls-server";

const EDITABLE = ["releaseId", "audioUrl", "sideLabel", "published", "sortOrder"];

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const { id } = await params;
    const body = await request.json();
    const { releaseId, audioUrl, sideLabel, published, sortOrder } = body;
    const data: Record<string, unknown> = {};

    if (releaseId !== undefined) {
      if (typeof releaseId !== "string" || !(await prisma.release.findFirst({ where: { id: releaseId, deletedAt: null }, select: { id: true } }))) {
        return NextResponse.json({ error: "That release doesn't exist." }, { status: 400 });
      }
      data.releaseId = releaseId;
    }
    if (audioUrl !== undefined) {
      if (!isOurAudioUrl(audioUrl)) return NextResponse.json({ error: "Upload an audio file first." }, { status: 400 });
      data.audioUrl = audioUrl;
    }
    if (sideLabel !== undefined) {
      if (sideLabel !== null && (typeof sideLabel !== "string" || sideLabel.length > MAX_SIDE_LABEL)) {
        return NextResponse.json({ error: `Side label is at most ${MAX_SIDE_LABEL} characters.` }, { status: 400 });
      }
      data.sideLabel = typeof sideLabel === "string" ? sideLabel.trim() || null : null;
    }
    if (published !== undefined) {
      if (typeof published !== "boolean") return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      data.published = published;
    }
    if (sortOrder !== undefined) {
      if (!Number.isInteger(sortOrder)) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      data.sortOrder = sortOrder;
    }
    if (Object.keys(data).length === 0) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

    const vinyl = await prisma.vinylRecord.update({ where: { id }, data, include: VINYL_INCLUDE });
    revalidateVinylPaths();
    logContentChange("updated", "vinyl", { id, name: vinyl.release.title }, { request, changed: changedFields(body, EDITABLE) });
    return NextResponse.json(toAdminVinyl(vinyl));
  } catch (error) {
    if (getErrorCode(error) === "P2025") return NextResponse.json({ error: "Vinyl not found" }, { status: 404 });
    return NextResponse.json({ error: getErrorMessage(error, "Failed to update vinyl") }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const { id } = await params;
    const deleted = await prisma.vinylRecord.update({
      where: { id },
      data: { deletedAt: new Date() },
      select: { release: { select: { title: true } } },
    });
    revalidateVinylPaths();
    revalidatePath("/admin/trash");
    logContentChange("deleted", "vinyl", { id, name: deleted.release.title }, { request });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (getErrorCode(error) === "P2025") return NextResponse.json({ success: true });
    return NextResponse.json({ error: "Failed to delete vinyl" }, { status: 500 });
  }
}
