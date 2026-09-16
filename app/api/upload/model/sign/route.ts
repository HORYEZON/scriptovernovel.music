// app/api/upload/model/sign/route.ts
//
// Mints a short-lived signed upload URL/token for the Museum Scene
// Editor's decorative-object (.glb) upload — see
// lib/storage/server.ts's createModelUploadUrl doc comment for why this
// is a two-step "sign, then the browser uploads directly to R2"
// flow instead of a single POST-the-file-here endpoint like every other
// upload in this codebase: a .glb can be up to 100MB, well past Vercel's
// ~4.5MB serverless function request-body cap.
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createModelUploadUrl } from "@/lib/storage/server";
import { getErrorMessage } from "@/lib/utils";

const ALLOWED_EXTENSIONS = [".glb"];

export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await request.json();
    const filename = typeof body.filename === "string" ? body.filename : "";

    const name = filename.toLowerCase();
    if (!name || !ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext))) {
      return NextResponse.json(
        { error: "Only self-contained .glb files are supported (not .gltf, which needs separate texture/bin files)" },
        { status: 400 }
      );
    }

    const { path, uploadUrl, publicUrl } = await createModelUploadUrl(filename);
    return NextResponse.json({ path, uploadUrl, publicUrl });
  } catch (error) {
    return NextResponse.json({ error: getErrorMessage(error, "Failed to prepare upload") }, { status: 500 });
  }
}
