"use client";

// lib/storage/browser.ts
//
// Client-side half of the two uploads too large to proxy through this app's
// own API routes (Vercel serverless functions cap request bodies at ~4.5MB):
// the Museum Scene Editor's .glb props (up to 100MB) and the Museum
// Soundtrack. The server mints a presigned PUT scoped to one exact object
// (lib/storage/server.ts's createModelUploadUrl / createAudioUploadUrl) and
// the browser PUTs the bytes straight to R2 with it. No credentials, no SDK,
// no public key of any kind lives in the client bundle — a presigned URL is
// the whole authorization, and it expires in ten minutes.
//
// Formerly lib/supabase/browser-storage.ts, which needed the Supabase anon
// key and supabase-js in the browser. Neither is required any more.
import { IMMUTABLE_CACHE } from "./cache";
import toast from "@/lib/toast";

/** The Content-Type and Cache-Control are part of the signature: R2 rejects
 *  a PUT whose headers don't match what the URL was signed for, so these
 *  must be exactly what the server passed to createPresignedPut. */
async function putWithPresignedUrl(uploadUrl: string, file: File, contentType: string): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": contentType, "Cache-Control": IMMUTABLE_CACHE },
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status} ${res.statusText}`);
}

/**
 * Uploads a .glb and returns **the URL to store** — which is not necessarily
 * the one the signing route handed out.
 *
 * Every raw upload is compressed server-side before it is used (Draco geometry
 * + WebP textures; see /api/upload/model/optimize and
 * Docs/Museum_AssetOptimization.md). A typical Sketchfab export shrinks ~10x,
 * and the compressed copy lives at a different path, so callers must persist
 * what this returns rather than the signing route's `publicUrl`.
 *
 * The optimize step is best-effort by design: if it fails or the request
 * doesn't complete, this falls back to the raw upload's URL. A prop that
 * couldn't be compressed is a much better outcome than an upload the admin
 * has to redo.
 */
export async function uploadModelViaSignedUrl(
  file: File,
  path: string,
  uploadUrl: string,
  publicUrl: string
): Promise<string> {
  // Signed as model/gltf-binary regardless of what the browser guessed — a
  // .glb picked from disk often arrives with an empty or generic type.
  await putWithPresignedUrl(uploadUrl, file, "model/gltf-binary");

  // A toast from a storage helper is unusual, and deliberate. The fallback
  // is designed to be non-fatal — the admin gets their prop either way — but
  // "non-fatal" turned into "invisible": nothing at any of the seven call
  // sites looked at `optimized`, and a 56 MB raw prop sat in the entry room
  // with no one told. Raising it here, once, covers every caller.
  const fellBack = (why: string) => {
    toast.error(`Uploaded, but not compressed — the prop is ${(file.size / 1048576).toFixed(0)} MB as-is. ${why}`, { duration: 9000 });
    return publicUrl;
  };
  try {
    const res = await fetch("/api/upload/model/optimize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    });
    if (!res.ok) return fellBack(`Optimizer returned ${res.status}.`);
    const data = await res.json();
    // `optimized: false` without a warning is the route declining on purpose
    // (the file was already smaller than its re-encode) — not a failure.
    if (data.optimized === false && data.warning) return fellBack(String(data.warning));
    return typeof data.url === "string" ? data.url : publicUrl;
  } catch (e) {
    return fellBack(e instanceof Error ? e.message : "Request failed.");
  }
}

/** Audio counterpart. `contentType` must be the same value the browser sent
 *  to /api/upload/audio/sign, since that is what the URL was signed for. */
export async function uploadAudioViaSignedUrl(
  file: File,
  uploadUrl: string,
  contentType: string
): Promise<void> {
  await putWithPresignedUrl(uploadUrl, file, contentType);
}
