// app/api/releases/route.ts
//
// Release module — admin list + create. Same conventions as app/api/events
// and app/api/stories: requireAdmin, write-once slug (a /music/<slug> link
// must not break on a retitle), soft delete elsewhere, revalidate every
// page the row shows on. Platform links go through lib/embeds.ts so
// nothing that can't be parsed is ever stored.
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { logContentChange } from "@/lib/activity-log-server";
import { getErrorMessage, slugify } from "@/lib/utils";
import {
  MAX_RELEASE_DESCRIPTION,
  MAX_RELEASE_TITLE,
  isReleaseType,
  sanitizeReleaseLinks,
  sanitizeTracks,
} from "@/lib/releases";
import { RELEASE_INCLUDE, revalidateReleasePaths, trackCreateRows } from "@/lib/releases-server";

// GET /api/releases — every live release, admin order (admin only)
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const releases = await prisma.release.findMany({
      where: { deletedAt: null },
      include: RELEASE_INCLUDE,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    });
    return NextResponse.json(releases);
  } catch {
    return NextResponse.json({ error: "Failed to fetch releases" }, { status: 500 });
  }
}

// POST /api/releases — create (admin only)
export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await request.json();
    const { title, type, coverImageUrl, releaseDate, description, featured, published, tracks } = body;

    if (typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "Title is required." }, { status: 400 });
    }
    if (title.trim().length > MAX_RELEASE_TITLE) {
      return NextResponse.json({ error: `Title is at most ${MAX_RELEASE_TITLE} characters.` }, { status: 400 });
    }
    if (typeof coverImageUrl !== "string" || !coverImageUrl.trim()) {
      return NextResponse.json({ error: "A cover image is required." }, { status: 400 });
    }
    if (type !== undefined && !isReleaseType(type)) {
      return NextResponse.json({ error: "Unknown release type." }, { status: 400 });
    }
    if (description !== undefined && description !== null && (typeof description !== "string" || description.length > MAX_RELEASE_DESCRIPTION)) {
      return NextResponse.json({ error: `Description is at most ${MAX_RELEASE_DESCRIPTION} characters.` }, { status: 400 });
    }
    const links = sanitizeReleaseLinks(body);
    if ("error" in links) return NextResponse.json({ error: links.error }, { status: 400 });
    const trackList = sanitizeTracks(tracks);
    if ("error" in trackList) return NextResponse.json({ error: trackList.error }, { status: 400 });

    let slug = slugify(title) || "release";
    if (await prisma.release.findUnique({ where: { slug } })) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }
    const maxOrder = await prisma.release.aggregate({ _max: { sortOrder: true } });

    const release = await prisma.release.create({
      data: {
        title: title.trim(),
        slug,
        type: type ?? "SINGLE",
        coverImageUrl: coverImageUrl.trim(),
        releaseDate: releaseDate ? new Date(releaseDate) : null,
        description: typeof description === "string" ? description.trim() || null : null,
        featured: featured === true,
        published: published !== false,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
        ...links.links,
        tracks: {
          create: trackCreateRows(trackList.tracks),
        },
      },
      include: RELEASE_INCLUDE,
    });

    revalidateReleasePaths();
    logContentChange("created", "release", { id: release.id, name: release.title }, { request });
    return NextResponse.json(release, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Failed to create release") }, { status: 500 });
  }
}
