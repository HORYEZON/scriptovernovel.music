// scripts/backfill-image-variants.ts
//
// One-time re-encode of every image already in the bucket into the three
// compressed renditions new uploads get (lib/images/compress.ts), rewriting
// each row that points at the old object and then deleting it.
//
// Why: v6.31 only compresses *new* uploads. The 13 GB of September 2026
// egress came almost entirely from artworks that were already there — full
// originals served on every gallery card and museum wall — so without this
// pass the quota problem would only shrink as fast as the artist replaced
// her catalogue.
//
// What it touches: every String / String[] column in prisma/schema.prisma
// that holds a bucket URL and is rendered as an image (the COLUMNS table
// below is the authority; add to it if a new image column appears). A URL
// qualifies when it lives in our bucket, is not already under `img/`, and
// has an extension compress.ts knows how to read. GIFs, videos, audio,
// .glb models, external avatars and Unsplash seeds are all left alone by
// those three tests. `iconImage` (the favicon) is deliberately not listed —
// WebP favicons are not universally supported.
//
// Safety:
//   - Dry-run by default. Prints what it *would* do and exits; `--apply` is
//     the only way anything is written.
//   - Per URL, not per row: the same object can be referenced from several
//     rows (the artwork grid and a product, say). Each distinct URL is
//     downloaded, encoded and uploaded once, every row that carried it is
//     rewritten, and only then is the old object deleted. If anything fails
//     mid-URL the old object is left in place and the rows still point at
//     it — nothing is ever half-migrated.
//   - Old objects are deleted only with --apply and only after every
//     referencing row is rewritten. Pass --keep-originals to skip the delete
//     (storage cost, but a guaranteed way back).
//   - `--limit N` processes the first N URLs, for a trial run on the live
//     bucket before committing to the whole catalogue.
//
// Note: DATABASE_URL and the Supabase keys point at the hosted project, so
// --apply changes the live site. Storage must not be under an egress
// restriction (a 402 from the bucket) — the script checks and refuses.
//
// Usage:
//   npx tsx scripts/backfill-image-variants.ts                  # dry run
//   npx tsx scripts/backfill-image-variants.ts --apply --limit 3
//   npx tsx scripts/backfill-image-variants.ts --apply
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { compressImage } from "@/lib/images/compress";
import { IMAGE_PREFIX, variantPaths } from "@/lib/images/variants";
import { BUCKET } from "@/lib/supabase/bucket";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const KEEP_ORIGINALS = args.includes("--keep-originals");
const limitIdx = args.indexOf("--limit");
const LIMIT = limitIdx >= 0 ? Number(args[limitIdx + 1]) : Infinity;

// model → columns. `array: true` for String[] columns.
type Column = { model: string; field: string; array?: boolean };
const COLUMNS: Column[] = [
  { model: "artwork", field: "imageUrl" },
  { model: "artwork", field: "imageUrls", array: true },
  { model: "section", field: "coverImageUrl" },
  { model: "certificateAward", field: "imageUrl" },
  { model: "story", field: "coverImageUrl" },
  { model: "storyPage", field: "imageUrl" },
  { model: "cosplay", field: "standeeImageUrl" },
  { model: "cosplay", field: "backdropImageUrl" },
  { model: "announcement", field: "imageUrl" },
  { model: "eventMedia", field: "url" },
  { model: "profile", field: "profileImage" },
  { model: "profile", field: "backgroundImage" },
  { model: "profile", field: "profileImages", array: true },
  { model: "profile", field: "logoImage" },
  { model: "siteTheme", field: "adminBackgroundImage" },
  { model: "digitalMuseum", field: "aboutWallTexture" },
  { model: "digitalMuseum", field: "aboutFloorTexture" },
  { model: "digitalMuseum", field: "aboutCeilingTexture" },
  { model: "digitalMuseum", field: "chaseCompanionAssetUrl" },
  { model: "museumRoom", field: "wallTexture" },
  { model: "museumRoom", field: "floorTexture" },
  { model: "museumRoom", field: "ceilingTexture" },
  { model: "chaseCompanion", field: "assetUrl" },
];

const COMPRESSIBLE_EXT = /\.(jpe?g|png|webp|avif|tiff?)$/i;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const PUBLIC_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`;

function objectPath(url: string): string | null {
  if (!url.startsWith(PUBLIC_PREFIX)) return null;
  const path = url.slice(PUBLIC_PREFIX.length);
  if (path.startsWith(`${IMAGE_PREFIX}/`)) return null; // already compressed
  if (!COMPRESSIBLE_EXT.test(path)) return null; // gif / video / audio / glb
  return path;
}

interface Ref {
  model: string;
  field: string;
  id: string;
  array: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

async function collectRefs(): Promise<Map<string, Ref[]>> {
  const refs = new Map<string, Ref[]>();
  const add = (url: string, ref: Ref) => {
    if (!objectPath(url)) return;
    const list = refs.get(url) ?? [];
    list.push(ref);
    refs.set(url, list);
  };
  for (const col of COLUMNS) {
    const rows: Record<string, unknown>[] = await db[col.model].findMany({
      select: { id: true, [col.field]: true },
    });
    for (const row of rows) {
      const v = row[col.field];
      const ref = { model: col.model, field: col.field, id: row.id as string, array: !!col.array };
      if (col.array && Array.isArray(v)) v.forEach((u) => typeof u === "string" && add(u, ref));
      else if (typeof v === "string") add(v, ref);
    }
  }
  return refs;
}

function newObjectId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function main() {
  const supabase = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // Refuse to start against a throttled bucket: every download would fail
  // and the run would just be noise.
  const probe = await fetch(`${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`);
  const storageOk = probe.status !== 402;

  const refs = await collectRefs();
  const urls = [...refs.keys()].slice(0, LIMIT);
  const rowCount = [...refs.values()].reduce((n, r) => n + r.length, 0);

  console.log(`${APPLY ? "APPLY" : "DRY RUN"} — ${refs.size} distinct uncompressed image URLs across ${rowCount} row references`);
  if (LIMIT !== Infinity) console.log(`  (limited to the first ${urls.length})`);
  const byModel = new Map<string, number>();
  for (const list of refs.values()) for (const r of list) byModel.set(`${r.model}.${r.field}`, (byModel.get(`${r.model}.${r.field}`) ?? 0) + 1);
  for (const [k, n] of [...byModel].sort()) console.log(`  ${k.padEnd(40)} ${n}`);
  if (!storageOk) {
    console.log("\nStorage is under an egress restriction (402) — nothing can be downloaded yet. Re-run once the quota has refilled.");
    return;
  }
  if (!APPLY) {
    console.log("\nDry run only. Pass --apply to migrate.");
    return;
  }

  let done = 0;
  let before = 0;
  let after = 0;
  const failures: string[] = [];

  for (const url of urls) {
    const path = objectPath(url)!;
    const label = `${done + 1}/${urls.length} ${path}`;
    try {
      const { data, error } = await supabase.storage.from(BUCKET).download(path);
      if (error || !data) throw new Error(error?.message ?? "download returned nothing");
      const input = Buffer.from(await data.arrayBuffer());
      const { variants } = await compressImage(input);
      const paths = variantPaths(newObjectId());

      const results = await Promise.all(
        (Object.keys(paths) as (keyof typeof paths)[]).map((v) =>
          supabase.storage.from(BUCKET).upload(paths[v], variants[v], {
            contentType: "image/webp",
            upsert: false,
            cacheControl: "31536000",
          })
        )
      );
      const failed = results.find((r) => r.error);
      if (failed?.error) {
        await supabase.storage.from(BUCKET).remove(Object.values(paths));
        throw new Error(`upload: ${failed.error.message}`);
      }
      const newUrl = supabase.storage.from(BUCKET).getPublicUrl(paths.full).data.publicUrl;

      // Rewrite every row that carried the old URL. Arrays are read back
      // and mapped so other entries (already-migrated or non-bucket) stay.
      for (const ref of refs.get(url)!) {
        if (ref.array) {
          const row = await db[ref.model].findUnique({ where: { id: ref.id }, select: { [ref.field]: true } });
          const next = (row[ref.field] as string[]).map((u) => (u === url ? newUrl : u));
          await db[ref.model].update({ where: { id: ref.id }, data: { [ref.field]: next } });
        } else {
          await db[ref.model].update({ where: { id: ref.id }, data: { [ref.field]: newUrl } });
        }
      }

      if (!KEEP_ORIGINALS) await supabase.storage.from(BUCKET).remove([path]);

      const total = Object.values(variants).reduce((n, b) => n + b.byteLength, 0);
      before += input.byteLength;
      after += variants.full.byteLength;
      done += 1;
      console.log(`✓ ${label}  ${kb(input.byteLength)} → full ${kb(variants.full.byteLength)} (all 3: ${kb(total)})  ${refs.get(url)!.length} row(s)`);
    } catch (err) {
      failures.push(`${path}: ${err instanceof Error ? err.message : String(err)}`);
      console.log(`✗ ${label}  ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log(`\nMigrated ${done}/${urls.length}. Full-size bytes served per view: ${kb(before)} → ${kb(after)} (${(before / Math.max(after, 1)).toFixed(1)}x smaller).`);
  if (failures.length) {
    console.log(`\n${failures.length} failed (left untouched — safe to re-run):`);
    failures.forEach((f) => console.log(`  ${f}`));
    process.exitCode = 1;
  }
}

function kb(n: number) {
  return n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
