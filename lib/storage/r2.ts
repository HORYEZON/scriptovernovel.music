// lib/storage/r2.ts
//
// The one module that knows media lives in Cloudflare R2. Everything above it
// (lib/storage/server.ts, the upload routes, system health) speaks in
// bucket-relative paths and public URLs; the S3 wire protocol stops here.
//
// Server-only: it holds the account's access key. The browser never talks to
// R2 with credentials — for the two uploads too large to proxy through a route
// handler (.glb props, audio) it is handed a short-lived presigned PUT minted
// by createPresignedPut below, which is scoped to one exact path and expires.
//
// Why R2 at all: Supabase Storage bills egress, and this site's media is
// heavy (a 3D museum). R2 bills none, and sits behind Cloudflare's edge cache.
// Supabase stays for Postgres only — see Docs/Media_Storage_R2.md for the
// migration and the URL shape.
//
// Node-only by convention (no `server-only` package in this repo): nothing
// under app/(public) or any "use client" file may import it. The browser half
// is lib/storage/browser.ts, which is dependency-free on purpose.
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { IMMUTABLE_CACHE } from "./cache";

let _client: S3Client | null = null;

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name} — see .env.example (Cloudflare R2)`);
  return v;
}

// Lazy so the module is importable at build time without env vars, the same
// contract the Supabase client used to honour.
function client(): S3Client {
  if (!_client) {
    _client = new S3Client({
      region: "auto",
      endpoint: `https://${env("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env("R2_ACCESS_KEY_ID"),
        secretAccessKey: env("R2_SECRET_ACCESS_KEY"),
      },
    });
  }
  return _client;
}

export function bucket(): string {
  return env("R2_BUCKET");
}

/** The origin every stored media URL starts with — a custom domain in front of
 *  the bucket. No trailing slash; `publicUrl` joins on it. Exported so the
 *  backup exporter and the DB migration script can recognise "our" URLs. */
export function publicOrigin(): string {
  return env("R2_PUBLIC_URL").replace(/\/+$/, "");
}

export function publicUrl(path: string): string {
  return `${publicOrigin()}/${path.replace(/^\/+/, "")}`;
}

/** Bucket-relative path for one of our own public URLs, or null for anything
 *  else (an Unsplash seed, a retired host). The inverse of publicUrl. */
export function pathFromPublicUrl(url: string): string | null {
  const origin = publicOrigin();
  if (!url.startsWith(origin + "/")) return null;
  const path = url.slice(origin.length + 1).split(/[?#]/)[0];
  return path ? decodeURIComponent(path) : null;
}

export { IMMUTABLE_CACHE };

export async function putObject(
  path: string,
  body: Uint8Array | Buffer | string,
  contentType: string,
  opts: { cacheControl?: string; overwrite?: boolean } = {}
): Promise<void> {
  await client().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: path,
      Body: body,
      ContentType: contentType,
      CacheControl: opts.cacheControl ?? IMMUTABLE_CACHE,
      // Refuse to clobber an existing object unless the caller opted in —
      // the equivalent of Supabase's `upsert: false`. Paths are unique by
      // construction so this is a guard, not a code path anyone expects.
      ...(opts.overwrite ? {} : { IfNoneMatch: "*" }),
    })
  );
}

export async function getObject(path: string): Promise<Uint8Array> {
  const res = await client().send(new GetObjectCommand({ Bucket: bucket(), Key: path }));
  if (!res.Body) throw new Error(`Empty object: ${path}`);
  return res.Body.transformToByteArray();
}

export async function deleteObjects(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  await client().send(
    new DeleteObjectsCommand({
      Bucket: bucket(),
      Delete: { Objects: paths.map((Key) => ({ Key })), Quiet: true },
    })
  );
}

/** A URL the browser can PUT one file to, and nothing else: one exact key,
 *  one content type, one Cache-Control, expiring in ten minutes. The browser
 *  must send the same Content-Type and Cache-Control headers it was signed
 *  with, or R2 rejects the request — lib/storage/browser.ts does that. */
export async function createPresignedPut(
  path: string,
  contentType: string,
  cacheControl: string = IMMUTABLE_CACHE
): Promise<string> {
  return getSignedUrl(
    client(),
    new PutObjectCommand({
      Bucket: bucket(),
      Key: path,
      ContentType: contentType,
      CacheControl: cacheControl,
    }),
    { expiresIn: 600 }
  );
}

export interface ListedObject {
  key: string;
  size: number;
}

/** Recursive listing under a prefix (S3 listing is flat, so a prefix walk is
 *  the whole tree). Pages until done or `maxKeys` objects — the caller says
 *  whether it hit the cap. */
export async function listObjects(
  prefix: string,
  maxKeys = 5000
): Promise<{ objects: ListedObject[]; truncated: boolean }> {
  const objects: ListedObject[] = [];
  let token: string | undefined;
  do {
    const res = await client().send(
      new ListObjectsV2Command({
        Bucket: bucket(),
        Prefix: prefix,
        ContinuationToken: token,
        MaxKeys: Math.min(1000, maxKeys - objects.length),
      })
    );
    for (const o of res.Contents ?? []) {
      if (o.Key) objects.push({ key: o.Key, size: o.Size ?? 0 });
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
    if (objects.length >= maxKeys) return { objects, truncated: Boolean(token) };
  } while (token);
  return { objects, truncated: false };
}
