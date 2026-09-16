// scripts/migrate-media-to-r2.ts
//
// HISTORICAL — the source bucket this reads from was deleted on 2026-09-16,
// after the copy below was verified and the database rewritten. Kept as the
// record of exactly what ran (Docs/Media_Storage_R2.md); it cannot be re-run.
//
// Copies every object in the Supabase Storage bucket into R2 at the *same
// key*, so the later database rewrite is a pure origin swap:
//
//   https://<ref>.supabase.co/storage/v1/object/public/<bucket>/img/abc.webp
//   https://<R2_PUBLIC_URL>/img/abc.webp
//
// Additive and idempotent: Supabase is only read; an object already in R2
// at the same size is skipped, so an interrupted run can simply be started
// again. Content-Type is carried over from Supabase's metadata, and every
// object gets the immutable one-year Cache-Control (lib/storage/cache.ts)
// — paths are never reused, so this is safe for everything, including files
// uploaded before that header was set on the Supabase side.
//
// Usage:
//   npx tsx --env-file=.env scripts/migrate-media-to-r2.ts            # copy
//   npx tsx --env-file=.env scripts/migrate-media-to-r2.ts --verify   # HEAD every key on R2 public URL
//
// Needs the old NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY still in
// .env for the read side, and the R2_* variables for the write side.
import { createClient } from "@supabase/supabase-js";
import { S3Client, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { IMMUTABLE_CACHE } from "@/lib/storage/cache";

const SUPABASE_BUCKET = "scriptovernovel.music-artworks";
const VERIFY = process.argv.includes("--verify");
const CONCURRENCY = 6;

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID!, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY! },
});
const R2_BUCKET = process.env.R2_BUCKET!;
const R2_PUBLIC = process.env.R2_PUBLIC_URL!.replace(/\/+$/, "");

interface Obj { key: string; size: number; mime: string }

async function listSupabase(prefix = ""): Promise<Obj[]> {
  const out: Obj[] = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await supabase.storage.from(SUPABASE_BUCKET).list(prefix, { limit: 1000, offset });
    if (error) throw new Error(`list(${prefix}): ${error.message}`);
    if (!data?.length) break;
    for (const e of data) {
      const key = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.id === null) out.push(...(await listSupabase(key)));
      else out.push({ key, size: (e.metadata?.size as number) ?? 0, mime: (e.metadata?.mimetype as string) ?? "application/octet-stream" });
    }
    if (data.length < 1000) break;
    offset += 1000;
  }
  return out;
}

async function r2Size(key: string): Promise<number | null> {
  try {
    const h = await r2.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    return h.ContentLength ?? 0;
  } catch {
    return null;
  }
}

async function copyOne(o: Obj): Promise<"copied" | "skipped"> {
  if ((await r2Size(o.key)) === o.size) return "skipped";
  const { data, error } = await supabase.storage.from(SUPABASE_BUCKET).download(o.key);
  if (error || !data) throw new Error(`download ${o.key}: ${error?.message ?? "no data"}`);
  const body = new Uint8Array(await data.arrayBuffer());
  await r2.send(new PutObjectCommand({ Bucket: R2_BUCKET, Key: o.key, Body: body, ContentType: o.mime, CacheControl: IMMUTABLE_CACHE }));
  return "copied";
}

async function pool<T>(items: T[], n: number, fn: (t: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) await fn(items[i++]); }));
}

const MB = (b: number) => (b / 1048576).toFixed(1);

async function main() {
  console.log("Listing Supabase bucket…");
  const objects = await listSupabase();
  const total = objects.reduce((a, o) => a + o.size, 0);
  console.log(`  ${objects.length} objects, ${MB(total)} MB`);

  if (VERIFY) {
    let ok = 0; const bad: string[] = [];
    await pool(objects, 12, async (o) => {
      const res = await fetch(`${R2_PUBLIC}/${o.key}`, { method: "HEAD" });
      const len = Number(res.headers.get("content-length") ?? -1);
      if (res.ok && len === o.size) ok++; else bad.push(`${res.status} len=${len} want=${o.size}  ${o.key}`);
    });
    console.log(`\nVERIFY: ${ok}/${objects.length} reachable on ${R2_PUBLIC} with matching size`);
    if (bad.length) { console.log("PROBLEMS:"); bad.slice(0, 30).forEach((b) => console.log("  " + b)); process.exitCode = 1; }
    return;
  }

  let copied = 0, skipped = 0, bytes = 0; const failed: string[] = [];
  const t0 = Date.now();
  await pool(objects, CONCURRENCY, async (o) => {
    try {
      const r = await copyOne(o);
      if (r === "copied") { copied++; bytes += o.size; } else skipped++;
      const done = copied + skipped + failed.length;
      if (done % 50 === 0) console.log(`  ${done}/${objects.length}  copied ${copied} (${MB(bytes)} MB)  skipped ${skipped}`);
    } catch (e) {
      failed.push(`${o.key}: ${e instanceof Error ? e.message : String(e)}`);
    }
  });
  console.log(`\nDONE in ${((Date.now() - t0) / 1000).toFixed(0)}s — copied ${copied} (${MB(bytes)} MB), skipped ${skipped} (already in R2), failed ${failed.length}`);
  if (failed.length) { failed.slice(0, 30).forEach((f) => console.log("  ✗ " + f)); process.exitCode = 1; }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
