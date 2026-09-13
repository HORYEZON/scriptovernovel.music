// app/api/upload/audio/route.ts
//
// Separate from /api/upload (images only, 10 MB cap) since background music
// needs a larger cap and audio mime types — kept in its own route rather
// than overloading the image one with a "type" switch.
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { uploadAudioFile } from "@/lib/supabase/storage";
import { ALLOWED_AUDIO_TYPES, MAX_AUDIO_FILE_SIZE, MAX_AUDIO_FILE_SIZE_MB } from "@/lib/background-music";
import { getErrorMessage } from "@/lib/utils";

export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!ALLOWED_AUDIO_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: MP3, WAV, OGG, AAC, M4A" },
        { status: 400 }
      );
    }

    if (file.size > MAX_AUDIO_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_AUDIO_FILE_SIZE_MB} MB` },
        { status: 400 }
      );
    }

    const publicUrl = await uploadAudioFile(file);
    return NextResponse.json({ url: publicUrl });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Upload failed") },
      { status: 500 }
    );
  }
}
