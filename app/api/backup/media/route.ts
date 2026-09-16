// app/api/backup/media/route.ts
//
// Puts one file from a backup archive back into storage and hands back its new
// public URL.
//
// Its own route rather than reusing /api/upload because a backup carries every
// kind of file the site holds — photos, audio, videos, uploaded .glb models —
// and that route is deliberately images-only at 10 MB. The type gate here is
// the archive itself: nothing reaches this endpoint that wasn't in a file this
// site's own export produced, and it is admin-gated like every other write.
//
// The URL changes, and that is the point: a restored file is a *new* object in
// the bucket, so the rows that referenced the old URL have to be rewritten to
// match. The browser does that rewrite before it sends the rows to
// /api/backup/import — see BackupClient.tsx's `remapMediaUrls`.
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { uploadCompressedImage } from "@/lib/storage/server";
import { getErrorMessage } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Matches the per-file ceiling every uploader on the site already enforces,
 *  so a restore can't put anything in the bucket the admin UI couldn't. */
const MAX_FILE_SIZE = 50 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large" }, { status: 400 });
    }

    // uploadCompressedImage is the generic path in practice: an image gets
    // its three WebP renditions regenerated (a backup only carries the
    // full-size file — the thumb/medium siblings are derived, never
    // exported, so a restored image must get fresh ones or every grid card
    // would 404), and anything else falls through to a raw write of the
    // file's own bytes and content type.
    const url = await uploadCompressedImage(file);
    return NextResponse.json({ url });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Failed to restore file") },
      { status: 500 }
    );
  }
}
