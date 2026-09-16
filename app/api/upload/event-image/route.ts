// app/api/upload/event-image/route.ts
//
// Image uploads for the Timeline/Gigs Event module — same shape as
// /api/upload (artwork images), just its own route/allowlist per the
// "own route per media kind" convention (see /api/upload/video's header).
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { uploadCompressedImage } from "@/lib/storage/server";
import { getErrorMessage } from "@/lib/utils";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// See /api/upload — compression plus three bucket writes per upload.
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Allowed: JPEG, PNG, WebP, GIF" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10 MB" },
        { status: 400 }
      );
    }

    const publicUrl = await uploadCompressedImage(file);
    return NextResponse.json({ url: publicUrl });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Upload failed") },
      { status: 500 }
    );
  }
}
