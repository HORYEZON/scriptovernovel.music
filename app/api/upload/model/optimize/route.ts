// app/api/upload/model/optimize/route.ts
//
// Second half of the .glb upload. The browser uploads the raw file straight to
// Supabase Storage with a signed URL (see ../sign/route.ts — a .glb is far past
// Vercel's ~4.5MB request-body cap, so the bytes can never be posted here), and
// then calls this with the path it wrote to. This fetches those bytes
// server-side, compresses them, writes the result to models/optimized/, drops
// the raw upload, and hands back the URL the caller should actually store.
//
// Why a second round trip rather than compressing in the browser: the Draco
// encoder and a WebP encoder in the client would be several MB of wasm on an
// admin page, and the work is CPU-heavy on whatever laptop or phone the admin
// happens to be using. Server-side it runs next to the bucket (both in sin1,
// see vercel.json) and the download is effectively free.
//
// Failure is deliberately NOT fatal. If compression throws — a malformed
// export, an extension gltf-transform can't round-trip, a timeout — this
// returns the raw file's own URL instead. An admin who just waited out a 40MB
// upload should get their prop, and a large prop is a much better outcome than
// a lost one. The response says which happened so the UI can tell them.
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import {
  BUCKET,
  OPTIMIZED_MODEL_PREFIX,
  downloadObject,
  uploadOptimizedModel,
  deleteObject,
} from "@/lib/supabase/storage";
import { optimizeGlb } from "@/lib/museum/optimizeGlb";
import { getErrorMessage } from "@/lib/utils";

export const dynamic = "force-dynamic";
// Compression is the long pole: a 47MB source with 36 textures takes a few
// seconds of CPU, plus a cold start and the WASM encoder's first-run init.
export const maxDuration = 60;

/** Only a freshly-signed upload under models/ is a valid target — never an
 *  arbitrary bucket path, and never something already optimized (which would
 *  re-encode an already-lossy file and delete the copy the museum is using). */
function isUploadedModelPath(path: string): boolean {
  return (
    path.startsWith("models/") &&
    !path.startsWith(`${OPTIMIZED_MODEL_PREFIX}/`) &&
    path.endsWith(".glb") &&
    !path.includes("..") &&
    path.split("/").length === 2
  );
}

export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  let path = "";
  try {
    const body = await request.json();
    path = typeof body.path === "string" ? body.path : "";
    if (!isUploadedModelPath(path)) {
      return NextResponse.json({ error: "Invalid model path" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const fileName = path.slice("models/".length);
  const rawUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;

  try {
    const source = await downloadObject(path);
    const { data, beforeBytes, afterBytes } = await optimizeGlb(source);

    // A "compressed" file that got bigger means the source was already
    // optimized (an admin re-uploading an export from this pipeline, say).
    // Keeping the original is both smaller and one less lossy generation.
    if (afterBytes >= beforeBytes) {
      return NextResponse.json({ url: rawUrl, optimized: false, beforeBytes, afterBytes });
    }

    const url = await uploadOptimizedModel(fileName, data);
    // Only once the optimized copy is safely written — otherwise a failure
    // here would leave the prop with no file at all.
    await deleteObject(path).catch(() => {});

    return NextResponse.json({ url, optimized: true, beforeBytes, afterBytes });
  } catch (error) {
    return NextResponse.json({
      url: rawUrl,
      optimized: false,
      warning: getErrorMessage(error, "Compression failed; keeping the original upload"),
    });
  }
}
