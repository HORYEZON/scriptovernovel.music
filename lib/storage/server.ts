// lib/storage/server.ts
//
// Server-side media uploads. Every admin upload route ends up here, and this
// is the only file (besides lib/storage/r2.ts underneath it) that knows where
// the bytes go. Formerly lib/supabase/storage.ts — the exports are unchanged,
// the backend is Cloudflare R2 (see r2.ts for why, and
// Docs/Media_Storage_R2.md for the migration).
//
// Node-only: imports sharp via lib/images/compress. Client code that needs to
// upload directly (the .glb and audio uploads that are too large to proxy)
// uses lib/storage/browser.ts with a presigned URL minted by
// createModelUploadUrl / createAudioUploadUrl below.
import { compressImage, isCompressibleImage } from "@/lib/images/compress";
import { siblingPathsFromUrl, variantPaths, originalPath, uploadIdFromUrl, ORIGINALS_PREFIX } from "@/lib/images/variants";
import {
  putObject,
  getObject,
  deleteObjects,
  listObjects,
  createPresignedPut,
  publicUrl,
  pathFromPublicUrl,
  IMMUTABLE_CACHE,
} from "./r2";

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

  const original = Buffer.from(await file.arrayBuffer());
  const { variants } = await compressImage(original);
  const id = newObjectId();
  const paths = variantPaths(id);
  // The untouched upload, kept alongside — see ORIGINALS_PREFIX. The display
  // files are lossy (WebP q82, max 2400px), which is right for a screen and
  // wrong for a print; this is the copy that isn't.
  const master = originalPath(id, file.name.split(".").pop() || "bin");

  // All of them or nothing: a full without its thumb would render a broken
  // card in every grid that derives the thumb URL. Any failure cleans up
  // whatever did land before surfacing the error.
  try {
    await Promise.all([
      ...(Object.keys(paths) as (keyof typeof paths)[]).map((variant) =>
        putObject(paths[variant], variants[variant], "image/webp")
      ),
      putObject(master, original, file.type || "application/octet-stream"),
    ]);
  } catch (error) {
    await deleteObjects([...Object.values(paths), master]).catch(() => {});
    throw new Error(`Upload failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  return publicUrl(paths.full);
}

/** Raw, uncompressed upload. Kept for the GIF/non-image fall-through above
 *  and for restore; new admin image routes should call uploadCompressedImage. */
export async function uploadArtworkImage(file: File): Promise<string> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${newObjectId()}.${ext}`;
  await putObject(path, new Uint8Array(await file.arrayBuffer()), file.type || "application/octet-stream");
  return publicUrl(path);
}

export async function uploadAudioFile(file: File): Promise<string> {
  const ext = file.name.split(".").pop() ?? "mp3";
  // "music/" prefix just keeps the bucket organized.
  const path = `music/${newObjectId()}.${ext}`;
  await putObject(path, new Uint8Array(await file.arrayBuffer()), file.type || "audio/mpeg");
  return publicUrl(path);
}

export async function uploadArtworkVideo(file: File): Promise<string> {
  const ext = file.name.split(".").pop() ?? "mp4";
  const path = `videos/${newObjectId()}.${ext}`;
  await putObject(path, new Uint8Array(await file.arrayBuffer()), file.type || "video/mp4");
  return publicUrl(path);
}

/** What the two signing routes hand the browser. `uploadUrl` is a presigned
 *  PUT good for one object and ten minutes; `publicUrl` is where that object
 *  will be readable once the PUT lands. */
export interface SignedUpload {
  path: string;
  uploadUrl: string;
  publicUrl: string;
}

// Museum Scene Editor's custom decorative objects (Phase 2 —
// Docs/MuseumSceneEditor_Spec.md). Unlike every other upload in this file,
// the actual file bytes never pass through this server at all: a .glb can
// be up to 100MB, and Vercel's serverless functions cap request bodies at
// ~4.5MB regardless of what a route handler's own code allows. Instead,
// this mints a short-lived *presigned PUT* scoped to one exact path that the
// admin's browser then uploads straight to R2 with — see
// lib/storage/browser.ts for that half, and app/api/upload/model/sign/route.ts
// for the endpoint that calls this. The extension/size are only ever
// validated client-side (this app has no way to inspect a file it never
// receives) — acceptable here since this endpoint is requireAdmin()-gated the
// same as every other upload, not public.
export async function createModelUploadUrl(fileName: string): Promise<SignedUpload> {
  const ext = fileName.split(".").pop() ?? "glb";
  const path = `models/${newObjectId()}.${ext}`;
  const uploadUrl = await createPresignedPut(path, "model/gltf-binary");
  return { path, uploadUrl, publicUrl: publicUrl(path) };
}

// Same presigned pattern as createModelUploadUrl above, applied to audio
// files so the browser can upload directly without proxying through a
// Next.js route handler. Called by /api/upload/audio/sign/route.ts. The
// content type is signed into the URL, so the browser has to send exactly
// this one back — hence the caller passing what it validated.
export async function createAudioUploadUrl(fileName: string, contentType: string): Promise<SignedUpload> {
  const ext = fileName.split(".").pop() ?? "mp3";
  const path = `music/${newObjectId()}.${ext}`;
  const uploadUrl = await createPresignedPut(path, contentType);
  return { path, uploadUrl, publicUrl: publicUrl(path) };
}

// Event Timeline/Gigs map video uploads. Same "own prefix per media kind"
// pattern as the helpers above. (Event *images* go through
// uploadCompressedImage like every other image now, so they share the `img/`
// prefix rather than `events/`.)
export async function uploadEventVideo(file: File): Promise<string> {
  const ext = file.name.split(".").pop() ?? "mp4";
  const path = `events/videos/${newObjectId()}.${ext}`;
  await putObject(path, new Uint8Array(await file.arrayBuffer()), file.type || "video/mp4");
  return publicUrl(path);
}

// Where a compressed .glb lands. Same basename under a new prefix, so the
// relationship to whatever it was made from stays 1:1 and obvious — see
// Docs/Museum_AssetOptimization.md.
export const OPTIMIZED_MODEL_PREFIX = "models/optimized";

/** Reads one object back out of the bucket as bytes. Used by the post-upload
 *  optimizer, which has to fetch what the browser just uploaded directly —
 *  those bytes never passed through this server (see createModelUploadUrl
 *  above for why). */
export async function downloadObject(path: string): Promise<Uint8Array> {
  return getObject(path);
}

/** Writes a compressed .glb to the optimized prefix and hands back its public
 *  URL. Overwrite is allowed because re-optimizing the same source path (a
 *  retry after a failed run) should replace rather than error — unlike the
 *  upload helpers above, this path is derived, not freshly minted. */
export async function uploadOptimizedModel(fileName: string, bytes: Uint8Array): Promise<string> {
  const path = `${OPTIMIZED_MODEL_PREFIX}/${fileName}`;
  await putObject(path, bytes, "model/gltf-binary", { cacheControl: IMMUTABLE_CACHE, overwrite: true });
  return publicUrl(path);
}

/** The public URL an in-bucket path is served at. The optimize route uses it
 *  to report the raw upload's URL when it decides not to replace it. */
export { publicUrl };

/** Removes one object by its in-bucket path. Distinct from
 *  deleteArtworkImage below, which takes a full public URL. */
export async function deleteObject(path: string): Promise<void> {
  await deleteObjects([path]);
}

// Despite the name, this just removes a file at its stored public URL —
// content-agnostic, so it's reused for audio uploads too instead of
// duplicating the same URL-parsing logic. A compressed image URL takes its
// two resized siblings with it, since nothing else references them. A URL
// that isn't ours (an Unsplash seed, a retired host) is left alone.
export async function deleteArtworkImage(imageUrl: string): Promise<void> {
  const path = pathFromPublicUrl(imageUrl);
  if (!path) return;
  const paths = siblingPathsFromUrl(imageUrl) ?? [path];
  // The master's extension isn't knowable from the .webp URL, so find it by
  // prefix. One cheap listing; an upload from before masters were kept just
  // matches nothing.
  const id = uploadIdFromUrl(imageUrl);
  if (id) {
    const { objects } = await listObjects(`${ORIGINALS_PREFIX}/${id}.`, 10);
    paths.push(...objects.map((o) => o.key));
  }
  await deleteObjects(paths);
}
