import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { compressImage, isCompressibleImage } from "@/lib/images/compress";
import { siblingPathsFromUrl, variantPaths } from "@/lib/images/variants";
import { BUCKET } from "./bucket";

// Re-exported for the existing server-side importers; browser code must
// import from ./bucket directly (this module is Node-only now — see there).
export { BUCKET };

let _client: SupabaseClient | null = null;

// Lazy-init so the module can be imported at build time without env vars
function getClient() {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    }
    _client = createClient(url, key);
  }
  return _client;
}

/** Fresh, never-reused object id — the basename every upload helper below
 *  builds its path from. Timestamp + random so two admins uploading in the
 *  same millisecond can't collide, and no dots so the variant-URL regex in
 *  lib/images/variants.ts can find the id again. */
function newObjectId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * The image upload path every admin image should now take. Compresses the
 * upload into three WebP renditions (lib/images/compress.ts) and writes them
 * side by side under `img/` (lib/images/variants.ts has the naming), then
 * returns the **full-size** URL — the one to persist. Thumb/medium URLs are
 * derived from it at render time, never stored.
 *
 * Falls through to the raw uploader for anything compress.ts doesn't handle
 * (GIFs, and the non-images the backup-restore route funnels here), so a
 * caller can pass any file and always get a usable URL back.
 */
export async function uploadCompressedImage(file: File): Promise<string> {
  if (!isCompressibleImage(file.type)) return uploadArtworkImage(file);

  const supabase = getClient();
  const { variants } = await compressImage(Buffer.from(await file.arrayBuffer()));
  const paths = variantPaths(newObjectId());

  // All three or nothing: a full without its thumb would render a broken
  // card in every grid that derives the thumb URL. Any failure cleans up
  // whatever did land before surfacing the error.
  const results = await Promise.all(
    (Object.keys(paths) as (keyof typeof paths)[]).map((variant) =>
      supabase.storage.from(BUCKET).upload(paths[variant], variants[variant], {
        contentType: "image/webp",
        upsert: false,
        // Immutable path (see uploadArtworkImage) — cache for a year.
        cacheControl: "31536000",
      })
    )
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) {
    await supabase.storage.from(BUCKET).remove(Object.values(paths));
    throw new Error(`Upload failed: ${failed.error.message}`);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(paths.full);
  return data.publicUrl;
}

/** Raw, uncompressed upload. Kept for the GIF/non-image fall-through above
 *  and for restore; new admin image routes should call uploadCompressedImage. */
export async function uploadArtworkImage(file: File): Promise<string> {
  const supabase = getClient();
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${newObjectId()}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
    // Every path here is a fresh, never-reused timestamp+random filename
    // (upsert: false above enforces that), so the file at this URL can
    // never change — safe to cache for a full year instead of Supabase's
    // default, which was serving `Cache-Control: no-cache` and forcing a
    // revalidation round-trip to Supabase on *every* fetch, including a
    // visitor just walking back into a room they'd already loaded this
    // session. See the Digital Museum performance investigation.
    cacheControl: "31536000",
  });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadAudioFile(file: File): Promise<string> {
  const supabase = getClient();
  const ext = file.name.split(".").pop() ?? "mp3";
  // "music/" prefix just keeps the bucket organized — same bucket as
  // artwork images, no separate provisioning needed.
  const path = `music/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
    // Every path here is a fresh, never-reused timestamp+random filename
    // (upsert: false above enforces that), so the file at this URL can
    // never change — safe to cache for a full year instead of Supabase's
    // default, which was serving `Cache-Control: no-cache` and forcing a
    // revalidation round-trip to Supabase on *every* fetch, including a
    // visitor just walking back into a room they'd already loaded this
    // session. See the Digital Museum performance investigation.
    cacheControl: "31536000",
  });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadArtworkVideo(file: File): Promise<string> {
  const supabase = getClient();
  const ext = file.name.split(".").pop() ?? "mp4";
  // "videos/" prefix, same bucket as images/music — no separate provisioning.
  const path = `videos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
    // Every path here is a fresh, never-reused timestamp+random filename
    // (upsert: false above enforces that), so the file at this URL can
    // never change — safe to cache for a full year instead of Supabase's
    // default, which was serving `Cache-Control: no-cache` and forcing a
    // revalidation round-trip to Supabase on *every* fetch, including a
    // visitor just walking back into a room they'd already loaded this
    // session. See the Digital Museum performance investigation.
    cacheControl: "31536000",
  });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// Museum Scene Editor's custom decorative objects (Phase 2 —
// Docs/MuseumSceneEditor_Spec.md). Unlike every other upload in this file,
// the actual file bytes never pass through this server at all: a .glb can
// be up to 100MB, and Vercel's serverless functions cap request bodies at
// ~4.5MB regardless of what a route handler's own code allows. Instead,
// this mints a short-lived *signed upload URL* (service-role-authorized,
// scoped to one exact path) that the admin's browser then uploads straight
// to Supabase Storage with — see lib/supabase/browser-storage.ts for that
// half, and app/api/upload/model/sign/route.ts for the endpoint that calls
// this. The extension/size are only ever validated client-side (this app
// has no way to inspect a file it never receives) — acceptable here since
// this endpoint is requireAdmin()-gated the same as every other upload,
// not public.
export async function createModelUploadUrl(fileName: string): Promise<{ path: string; token: string; publicUrl: string }> {
  const supabase = getClient();
  const ext = fileName.split(".").pop() ?? "glb";
  const path = `models/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw new Error(`Failed to create upload URL: ${error?.message ?? "unknown error"}`);

  const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { path, token: data.token, publicUrl: publicUrlData.publicUrl };
}

// Same signed-URL pattern as createModelUploadUrl above, applied to audio
// files so the browser can upload directly to Supabase Storage without
// proxying through a Next.js route handler (which caps request bodies at
// ~4.5MB on Vercel's free tier). Called by /api/upload/audio/sign/route.ts.
export async function createAudioUploadUrl(fileName: string): Promise<{ path: string; token: string; publicUrl: string }> {
  const supabase = getClient();
  const ext = fileName.split(".").pop() ?? "mp3";
  const path = `music/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw new Error(`Failed to create upload URL: ${error?.message ?? "unknown error"}`);

  const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { path, token: data.token, publicUrl: publicUrlData.publicUrl };
}

// Event Timeline/Gigs map (Docs/... none yet — see app/api/events/*) video
// uploads. Same bucket, same "own prefix per media kind" pattern as the
// artwork/audio/video helpers above — no separate bucket provisioning
// needed. (Event *images* go through uploadCompressedImage like every other
// image now, so they share the `img/` prefix rather than `events/`.)
export async function uploadEventVideo(file: File): Promise<string> {
  const supabase = getClient();
  const ext = file.name.split(".").pop() ?? "mp4";
  const path = `events/videos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
    cacheControl: "31536000",
  });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// Where a compressed .glb lands. Same basename under a new prefix, so the
// relationship to whatever it was made from stays 1:1 and obvious — see
// Docs/Museum_AssetOptimization.md.
export const OPTIMIZED_MODEL_PREFIX = "models/optimized";

/** Reads one object back out of the bucket as bytes. Used by the post-upload
 *  optimizer, which has to fetch what the browser just uploaded directly to
 *  Storage — those bytes never passed through this server (see
 *  createModelUploadUrl above for why). */
export async function downloadObject(path: string): Promise<Uint8Array> {
  const supabase = getClient();
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data) throw new Error(`Download failed: ${error?.message ?? "no data"}`);
  return new Uint8Array(await data.arrayBuffer());
}

/** Writes a compressed .glb to the optimized prefix and hands back its public
 *  URL. `upsert` is on because re-optimizing the same source path (a retry
 *  after a failed run) should overwrite rather than error — unlike the upload
 *  helpers above, this path is derived, not freshly minted. */
export async function uploadOptimizedModel(fileName: string, bytes: Uint8Array): Promise<string> {
  const supabase = getClient();
  const path = `${OPTIMIZED_MODEL_PREFIX}/${fileName}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: "model/gltf-binary",
    upsert: true,
    cacheControl: "31536000",
  });
  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/** Removes one object by its in-bucket path. Distinct from
 *  deleteArtworkImage below, which takes a full public URL. */
export async function deleteObject(path: string): Promise<void> {
  const supabase = getClient();
  await supabase.storage.from(BUCKET).remove([path]);
}

// Despite the name, this just removes a file at its stored path within the
// bucket — content-agnostic, so it's reused for audio uploads too instead
// of duplicating the same URL-parsing logic. A compressed image URL takes
// its two resized siblings with it, since nothing else references them.
export async function deleteArtworkImage(imageUrl: string): Promise<void> {
  const supabase = getClient();
  const url = new URL(imageUrl);
  const pathSegments = url.pathname.split(`/storage/v1/object/public/${BUCKET}/`);
  if (pathSegments.length < 2) return;

  const filePath = pathSegments[1];
  await supabase.storage.from(BUCKET).remove(siblingPathsFromUrl(imageUrl) ?? [filePath]);
}
