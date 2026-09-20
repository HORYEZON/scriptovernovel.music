// app/api/videos/route.ts — Videos module: admin list + create. Same shape
// as app/api/releases. Only YouTube links are accepted (lib/videos.ts).
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { logContentChange } from "@/lib/activity-log-server";
import { getErrorMessage } from "@/lib/utils";
import { MAX_VIDEO_DESCRIPTION, MAX_VIDEO_TITLE, isVideoKind, sanitizeYouTube } from "@/lib/videos";
import { VIDEO_INCLUDE, revalidateVideoPaths } from "@/lib/videos-server";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const videos = await prisma.video.findMany({
      where: { deletedAt: null },
      include: VIDEO_INCLUDE,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });
    return NextResponse.json(videos);
  } catch {
    return NextResponse.json({ error: "Failed to fetch videos" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const body = await request.json();
    const { title, youtubeUrl, kind, releaseId, description, published, featured } = body;

    if (typeof title !== "string" || !title.trim()) return NextResponse.json({ error: "Title is required." }, { status: 400 });
    if (title.trim().length > MAX_VIDEO_TITLE) return NextResponse.json({ error: `Title is at most ${MAX_VIDEO_TITLE} characters.` }, { status: 400 });
    const yt = sanitizeYouTube(youtubeUrl);
    if (!yt) return NextResponse.json({ error: "Paste a YouTube link (watch, youtu.be or shorts)." }, { status: 400 });
    if (kind !== undefined && !isVideoKind(kind)) return NextResponse.json({ error: "Unknown video kind." }, { status: 400 });
    if (description !== undefined && description !== null && (typeof description !== "string" || description.length > MAX_VIDEO_DESCRIPTION)) {
      return NextResponse.json({ error: `Description is at most ${MAX_VIDEO_DESCRIPTION} characters.` }, { status: 400 });
    }
    if (releaseId !== undefined && releaseId !== null) {
      if (typeof releaseId !== "string" || !(await prisma.release.findFirst({ where: { id: releaseId, deletedAt: null }, select: { id: true } }))) {
        return NextResponse.json({ error: "That release doesn't exist." }, { status: 400 });
      }
    }

    const maxOrder = await prisma.video.aggregate({ _max: { sortOrder: true } });
    const video = await prisma.video.create({
      data: {
        title: title.trim(),
        ...yt,
        kind: kind ?? "MUSIC_VIDEO",
        releaseId: releaseId ?? null,
        description: typeof description === "string" ? description.trim() || null : null,
        published: published !== false,
        featured: featured === true,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      },
      include: VIDEO_INCLUDE,
    });
    revalidateVideoPaths();
    logContentChange("created", "video", { id: video.id, name: video.title }, { request });
    return NextResponse.json(video, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Failed to create video") }, { status: 500 });
  }
}
