// app/api/release-notes/route.ts
//
// Admin CRUD for the visitor-facing Release Notes panel (Settings ▸ Release
// Notes). GET lists every note including unpublished drafts; POST creates one.
//
// Visitors never reach this route — app/api/release-notes/active/route.ts is
// the public one, and it returns only the newest few published notes. Keeping
// them apart means an anonymous fetch can't enumerate drafts, the same split
// /api/marquees and /api/marquees/active already use.
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { getErrorMessage } from "@/lib/utils";
import {
  sanitizeReleaseNoteTitle,
  sanitizeReleaseNoteBody,
  sanitizeReleaseNoteCategory,
  sanitizeReleaseNoteVersion,
  sanitizeReleaseNoteDate,
  MAX_RELEASE_NOTE_TITLE,
  MAX_RELEASE_NOTE_BODY,
} from "@/lib/release-notes";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const notes = await prisma.releaseNote.findMany({
      // Trashed notes live in the Trash module until they're restored or
      // destroyed there — they must not come back in this list.
      where: { deletedAt: null },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    });
    return NextResponse.json({ notes });
  } catch {
    return NextResponse.json({ error: "Failed to fetch release notes" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await request.json();

    const title = sanitizeReleaseNoteTitle(body.title);
    const noteBody = sanitizeReleaseNoteBody(body.body);
    if (!title) {
      return NextResponse.json(
        { error: `Title is required (max ${MAX_RELEASE_NOTE_TITLE} characters)` },
        { status: 400 }
      );
    }
    if (!noteBody) {
      return NextResponse.json(
        { error: `Description is required (max ${MAX_RELEASE_NOTE_BODY} characters)` },
        { status: 400 }
      );
    }

    const note = await prisma.releaseNote.create({
      data: {
        title,
        body: noteBody,
        category: sanitizeReleaseNoteCategory(body.category),
        version: sanitizeReleaseNoteVersion(body.version),
        isPublished: body.isPublished === undefined ? true : Boolean(body.isPublished),
        // Unset means "now" — the common case, since a note is usually
        // written the day its change shipped.
        publishedAt: sanitizeReleaseNoteDate(body.publishedAt) ?? new Date(),
      },
    });

    revalidatePath("/admin/settings/release-notes");
    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Failed to create release note") },
      { status: 500 }
    );
  }
}
