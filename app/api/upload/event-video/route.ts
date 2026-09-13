// app/api/upload/event-video/route.ts
//
// Video uploads for the Timeline/Gigs Event module. Reuses the same
// mime allowlist/size cap constants as the artwork "making of" video
// upload (lib/artwork-video.ts) rather than duplicating them.
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { uploadEventVideo } from "@/lib/supabase/storage";
import { ALLOWED_VIDEO_TYPES, MAX_VIDEO_UPLOAD_FILE_SIZE, MAX_VIDEO_UPLOAD_FILE_SIZE_MB } from "@/lib/artwork-video";
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

    if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: MP4, MOV, WebM" },
        { status: 400 }
      );
    }

    if (file.size > MAX_VIDEO_UPLOAD_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_VIDEO_UPLOAD_FILE_SIZE_MB} MB` },
        { status: 400 }
      );
    }

    const publicUrl = await uploadEventVideo(file);
    return NextResponse.json({ url: publicUrl });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Upload failed") },
      { status: 500 }
    );
  }
}
