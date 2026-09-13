"use client";

// lib/supabase/browser-storage.ts
//
// Client-side half of the Museum Scene Editor's large (.glb, up to 100MB)
// decorative-object upload — see lib/supabase/storage.ts's
// createModelUploadUrl for why this exists at all (Vercel serverless
// functions cap request bodies at ~4.5MB, so a big file can never be
// proxied through this app's own API routes the way every other upload
// in this codebase works). This talks to Supabase Storage directly from
// the browser using a short-lived signed upload URL/token minted
// server-side — the *only* place in the app that needs the public anon
// key (NEXT_PUBLIC_SUPABASE_ANON_KEY), since this is the one upload that
// can't go through a server-side, service-role-authenticated route.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { BUCKET } from "./bucket";

let _client: SupabaseClient | null = null;

function getBrowserClient() {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
    }
    _client = createClient(url, key);
  }
  return _client;
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
  token: string,
  publicUrl: string
): Promise<string> {
  const supabase = getBrowserClient();
  const { error } = await supabase.storage.from(BUCKET).uploadToSignedUrl(path, token, file, {
    contentType: file.type || "model/gltf-binary",
    upsert: false,
    cacheControl: "31536000",
  });
  if (error) throw new Error(`Upload failed: ${error.message}`);

  try {
    const res = await fetch("/api/upload/model/optimize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    });
    if (!res.ok) return publicUrl;
    const data = await res.json();
    return typeof data.url === "string" ? data.url : publicUrl;
  } catch {
    return publicUrl;
  }
}

// Audio counterpart — browser uploads directly to Supabase using a signed
// URL minted by /api/upload/audio/sign, bypassing the ~4.5MB Vercel body cap.
export async function uploadAudioViaSignedUrl(file: File, path: string, token: string): Promise<void> {
  const supabase = getBrowserClient();
  const { error } = await supabase.storage.from(BUCKET).uploadToSignedUrl(path, token, file, {
    contentType: file.type || "audio/mpeg",
    upsert: false,
    cacheControl: "31536000",
  });
  if (error) throw new Error(`Upload failed: ${error.message}`);
}
