// app/api/artworks/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/api-auth";
import { logContentChange, changedFields } from "@/lib/activity-log-server";
import { prisma } from "@/lib/prisma";
import { getErrorCode } from "@/lib/utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const artwork = await prisma.artwork.findUnique({
      where: { id },
      include: { product: true, section: { select: { id: true, name: true, slug: true } } },
    });
    if (!artwork) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(artwork);
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
    const { title, description, imageUrl, imageUrls, videoUrl, videoUrls, tags, medium, dimensions, year, featured, isNewRelease, published, status, sectionId } = body;

    const artwork = await prisma.artwork.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(imageUrl !== undefined && { imageUrl }),
        // slug is deliberately never updated here, even if the title
        // changes — see the comment on POST above.
        ...(imageUrls !== undefined && { imageUrls: Array.isArray(imageUrls) ? imageUrls : [] }),
        ...(videoUrl !== undefined && { videoUrl: videoUrl || null }),
        ...(videoUrls !== undefined && { videoUrls: Array.isArray(videoUrls) ? videoUrls : [] }),
        ...(tags !== undefined && { tags }),
        ...(medium !== undefined && { medium }),
        ...(dimensions !== undefined && { dimensions }),
        ...(year !== undefined && { year: year ? parseInt(year) : null }),
        ...(featured !== undefined && { featured }),
        ...(isNewRelease !== undefined && { isNewRelease }),
        ...(published !== undefined && { published }),
        ...(status !== undefined && { status }),
        ...(sectionId !== undefined && { sectionId: sectionId || null }),
      },
      include: { product: true, section: { select: { id: true, name: true, slug: true } } },
    });

    revalidatePath("/", "layout");
    revalidatePath("/admin/artworks");

    logContentChange("updated", "artwork", { id: artwork.id, name: artwork.title }, {
      request,
      changed: changedFields(body, [
        "title", "description", "imageUrl", "imageUrls", "videoUrl", "videoUrls", "tags",
        "medium", "dimensions", "year", "featured", "isNewRelease", "published", "status", "sectionId",
      ]),
    });

    return NextResponse.json(artwork);
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

    const deleted = await prisma.artwork.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    revalidatePath("/", "layout");
    revalidatePath("/admin/artworks");

    logContentChange("deleted", "artwork", { id, name: deleted.title }, { request });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (getErrorCode(error) === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
