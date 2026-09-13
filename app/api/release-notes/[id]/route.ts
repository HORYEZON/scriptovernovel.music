// app/api/release-notes/[id]/route.ts
//
// PATCH — edit a note's title/body/category/version/date, or flip it between
// published and draft (admin only).
//
// DELETE — soft delete (admin only). Sets `deletedAt` so the note lands in the
// Trash module and can be restored, the same contract as artworks, stories,
// products and the rest; Trash's own DELETE is what finally destroys it.
// It used to be a hard delete on the reasoning that a release note references
// nothing and so had nothing to orphan — true, but orphaning was never the
// point of Trash. Deleting the wrong note meant retyping it from memory.
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { getErrorCode, getErrorMessage } from "@/lib/utils";
import {
  sanitizeReleaseNoteTitle,
  sanitizeReleaseNoteBody,
  sanitizeReleaseNoteCategory,
  sanitizeReleaseNoteVersion,
  sanitizeReleaseNoteDate,
  MAX_RELEASE_NOTE_TITLE,
  MAX_RELEASE_NOTE_BODY,
} from "@/lib/release-notes";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id } = await params;
    const body = await request.json();
    const data: {
      title?: string;
      body?: string;
      category?: string;
      version?: string | null;
      isPublished?: boolean;
      publishedAt?: Date;
    } = {};

    if (body.title !== undefined) {
      const title = sanitizeReleaseNoteTitle(body.title);
      if (!title) {
        return NextResponse.json(
          { error: `Title is required (max ${MAX_RELEASE_NOTE_TITLE} characters)` },
          { status: 400 }
        );
      }
      data.title = title;
    }
    if (body.body !== undefined) {
      const noteBody = sanitizeReleaseNoteBody(body.body);
      if (!noteBody) {
        return NextResponse.json(
          { error: `Description is required (max ${MAX_RELEASE_NOTE_BODY} characters)` },
          { status: 400 }
        );
      }
      data.body = noteBody;
    }
    if (body.category !== undefined) data.category = sanitizeReleaseNoteCategory(body.category);
    if (body.version !== undefined) data.version = sanitizeReleaseNoteVersion(body.version);
    if (body.isPublished !== undefined) {
      if (typeof body.isPublished !== "boolean") {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }
      data.isPublished = body.isPublished;
    }
    if (body.publishedAt !== undefined) {
      const when = sanitizeReleaseNoteDate(body.publishedAt);
      if (!when) {
        return NextResponse.json({ error: "Publish date is not a valid date" }, { status: 400 });
      }
      data.publishedAt = when;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const note = await prisma.releaseNote.update({ where: { id }, data });
    revalidatePath("/admin/settings/release-notes");
    return NextResponse.json(note);
  } catch (error) {
    if (getErrorCode(error) === "P2025") {
      return NextResponse.json({ error: "Release note not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: getErrorMessage(error, "Failed to update release note") },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id } = await params;
    await prisma.releaseNote.update({ where: { id }, data: { deletedAt: new Date() } });
    revalidatePath("/admin/settings/release-notes");
    return NextResponse.json({ success: true });
  } catch (error) {
    if (getErrorCode(error) === "P2025") {
      return NextResponse.json({ error: "Release note not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to delete release note" }, { status: 500 });
  }
}
