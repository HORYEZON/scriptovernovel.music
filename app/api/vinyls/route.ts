// app/api/vinyls/route.ts — Vinyls module: admin list + create. Same shape
// as app/api/videos. A vinyl is one Release + one audio file already uploaded
// to R2 through /api/upload/audio/sign (lib/vinyls-server.ts checks the host).
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { logContentChange } from "@/lib/activity-log-server";
import { getErrorMessage } from "@/lib/utils";
import { MAX_SIDE_LABEL } from "@/lib/vinyls";
import { VINYL_INCLUDE, isOurAudioUrl, revalidateVinylPaths, toAdminVinyl } from "@/lib/vinyls-server";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const vinyls = await prisma.vinylRecord.findMany({
      where: { deletedAt: null },
      include: VINYL_INCLUDE,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });
    return NextResponse.json(vinyls.map(toAdminVinyl));
  } catch {
    return NextResponse.json({ error: "Failed to fetch vinyls" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const body = await request.json();
    const { releaseId, audioUrl, sideLabel, published } = body;

    if (typeof releaseId !== "string" || !(await prisma.release.findFirst({ where: { id: releaseId, deletedAt: null }, select: { id: true } }))) {
      return NextResponse.json({ error: "Pick a release." }, { status: 400 });
    }
    if (!isOurAudioUrl(audioUrl)) return NextResponse.json({ error: "Upload an audio file first." }, { status: 400 });
    if (sideLabel !== undefined && sideLabel !== null && (typeof sideLabel !== "string" || sideLabel.length > MAX_SIDE_LABEL)) {
      return NextResponse.json({ error: `Side label is at most ${MAX_SIDE_LABEL} characters.` }, { status: 400 });
    }

    const maxOrder = await prisma.vinylRecord.aggregate({ _max: { sortOrder: true } });
    const vinyl = await prisma.vinylRecord.create({
      data: {
        releaseId,
        audioUrl,
        sideLabel: typeof sideLabel === "string" ? sideLabel.trim() || null : null,
        published: published !== false,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      },
      include: VINYL_INCLUDE,
    });
    revalidateVinylPaths();
    logContentChange("created", "vinyl", { id: vinyl.id, name: vinyl.release.title }, { request });
    return NextResponse.json(toAdminVinyl(vinyl), { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Failed to create vinyl") }, { status: 500 });
  }
}
