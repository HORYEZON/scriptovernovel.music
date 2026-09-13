// app/api/upload/audio/sign/route.ts
//
// Mints a short-lived signed upload URL for the Museum Soundtrack uploader.
// Same pattern as /api/upload/model/sign — the browser then uploads directly
// to Supabase Storage, bypassing Vercel's ~4.5MB serverless function body cap.
// Validation (MIME type, extension) is done here on the filename; actual
// byte-level inspection isn't possible since the file never hits this server.
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createAudioUploadUrl } from "@/lib/supabase/storage";
import { ALLOWED_AUDIO_TYPES } from "@/lib/background-music";
import { getErrorMessage } from "@/lib/utils";

const ALLOWED_EXTENSIONS = [".mp3", ".wav", ".ogg", ".aac", ".m4a"];

export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await request.json();
    const filename = typeof body.filename === "string" ? body.filename : "";
    const mimeType = typeof body.mimeType === "string" ? body.mimeType : "";

    const name = filename.toLowerCase();
    if (!name || !ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext))) {
      return NextResponse.json(
        { error: `Unsupported format. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}` },
        { status: 400 }
      );
    }

    if (mimeType && !ALLOWED_AUDIO_TYPES.includes(mimeType)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: MP3, WAV, OGG, AAC, M4A" },
        { status: 400 }
      );
    }

    const { path, token, publicUrl } = await createAudioUploadUrl(filename);
    return NextResponse.json({ path, token, publicUrl });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Failed to prepare upload") }, { status: 500 });
  }
}
