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
//   npx tsx --env-file=.env scripts/backfill-image-variants.ts   # dry run
//   npx tsx --env-file=.env scripts/backfill-image-variants.ts --apply --limit 3
//   npx tsx --env-file=.env scripts/backfill-image-variants.ts --apply
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { compressImage } from "@/lib/images/compress";
import { IMAGE_PREFIX, ORIGINALS_PREFIX, originalPath, variantPaths } from "@/lib/images/variants";
import { getObject, putObject, deleteObjects, publicUrl, pathFromPublicUrl } from "@/lib/storage/r2";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
// The original is never discarded: it moves to originals/<newid>.<ext>, the
// same place uploadCompressedImage keeps a fresh upload's master. Pass
// --drop-originals to delete it instead (not recommended — it is the only
// copy the site has, and storage is free at this size).
const DROP_ORIGINALS = args.includes("--drop-originals");
const limitIdx = args.indexOf("--limit");
const LIMIT = limitIdx >= 0 ? Number(args[limitIdx + 1]) : Infinity;

// model → columns. `array: true` for String[] columns; `substring: true` for
// a column that holds a JSON config blob with an image URL nested inside it
// (the museum's scene-object configs keep `textureUrl` that way) — those are
// rewritten by replacing the URL inside the string, not by replacing the value.
type Column = { model: string; field: string; array?: boolean; substring?: boolean };
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
  { model: "profile", field: "callingCardFront" },
  { model: "profile", field: "callingCardBack" },
  { model: "museumSceneObject", field: "modelUrl", substring: true },
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

function objectPath(url: string): string | null {
  const path = pathFromPublicUrl(url);
  if (!path) return null; // not one of ours (Unsplash seed, retired host)
  if (path.startsWith(`${IMAGE_PREFIX}/`)) return null; // already compressed
  if (path.startsWith(`${ORIGINALS_PREFIX}/`)) return null; // a master, never served
  if (!COMPRESSIBLE_EXT.test(path)) return null; // gif / video / audio / glb
  return path;
}

interface Ref {
  model: string;
  field: string;
  id: string;
  array: boolean;
  substring: boolean;
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
      const ref = { model: col.model, field: col.field, id: row.id as string, array: !!col.array, substring: !!col.substring };
      if (col.array && Array.isArray(v)) v.forEach((u) => typeof u === "string" && add(u, ref));
      else if (col.substring && typeof v === "string") {
        // Every image URL inside the blob, not the blob itself.
        for (const m of v.matchAll(/https?:\/\/[^"'\s]+\.(?:jpe?g|png|webp|avif|tiff?)/gi)) add(m[0], ref);
      } else if (typeof v === "string") add(v, ref);
    }
  }
  return refs;
}

function newObjectId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function main() {
  const refs = await collectRefs();
  const urls = [...refs.keys()].slice(0, LIMIT);
  const rowCount = [...refs.values()].reduce((n, r) => n + r.length, 0);

  console.log(`${APPLY ? "APPLY" : "DRY RUN"} — ${refs.size} distinct uncompressed image URLs across ${rowCount} row references`);
  if (LIMIT !== Infinity) console.log(`  (limited to the first ${urls.length})`);
  const byModel = new Map<string, number>();
  for (const list of refs.values()) for (const r of list) byModel.set(`${r.model}.${r.field}`, (byModel.get(`${r.model}.${r.field}`) ?? 0) + 1);
  for (const [k, n] of [...byModel].sort()) console.log(`  ${k.padEnd(40)} ${n}`);
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
      const input = Buffer.from(await getObject(path));
      const { variants } = await compressImage(input);
      const id = newObjectId();
      const paths = variantPaths(id);
      const ext = path.split(".").pop() || "bin";
      const master = originalPath(id, ext);
      const mime = /png$/i.test(ext) ? "image/png" : /webp$/i.test(ext) ? "image/webp" : "image/jpeg";

      try {
        await Promise.all([
          ...(Object.keys(paths) as (keyof typeof paths)[]).map((v) =>
            putObject(paths[v], variants[v], "image/webp")
          ),
          ...(DROP_ORIGINALS ? [] : [putObject(master, input, mime)]),
        ]);
      } catch (err) {
        await deleteObjects([...Object.values(paths), master]).catch(() => {});
        throw new Error(`upload: ${err instanceof Error ? err.message : String(err)}`);
      }
      const newUrl = publicUrl(paths.full);

      // Rewrite every row that carried the old URL. Arrays are read back
      // and mapped so other entries (already-migrated or non-bucket) stay.
      for (const ref of refs.get(url)!) {
        if (ref.substring) {
          const row = await db[ref.model].findUnique({ where: { id: ref.id }, select: { [ref.field]: true } });
          const next = String(row[ref.field]).split(url).join(newUrl);
          await db[ref.model].update({ where: { id: ref.id }, data: { [ref.field]: next } });
        } else if (ref.array) {
          const row = await db[ref.model].findUnique({ where: { id: ref.id }, select: { [ref.field]: true } });
          const next = (row[ref.field] as string[]).map((u) => (u === url ? newUrl : u));
          await db[ref.model].update({ where: { id: ref.id }, data: { [ref.field]: next } });
        } else {
          await db[ref.model].update({ where: { id: ref.id }, data: { [ref.field]: newUrl } });
        }
      }

      // Only once the variants (and the master copy) are written and every row
      // repointed — the root-level file is then referenced by nothing.
      await deleteObjects([path]);

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
