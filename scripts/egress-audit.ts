// scripts/egress-audit.ts
//
// Answers the only question that matters while the Supabase egress grace
// period runs (see Docs/Museum_AssetOptimization.md): **how many bytes does one
// fresh visitor actually pull down**, and therefore how many visits fit inside
// the Free plan's 5 GB/month before the bucket has to move to R2.
//
// Read-only. It lists the storage bucket and reads a few columns; it writes
// nothing, anywhere.
//
// Two things it deliberately does NOT do:
//
//  - It cannot read the egress meter itself. That lives behind Supabase's
//    Management API (a personal access token from `supabase login`), not the
//    service-role key this repo has. What it measures instead is the input to
//    that meter — bytes per visit — which is the number you can act on, and
//    which the dashboard cannot tell you.
//  - It does not size the whole bucket and call that the answer. Egress is a
//    flow, not a stock: the uncompressed originals still parked in `models/`
//    cost storage but zero egress, because nothing points at them. Only the
//    files a real page actually references count, which is why this walks the
//    database rather than the bucket listing.
//
// Usage:
//   npx tsx scripts/egress-audit.ts
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { BUCKET } from "@/lib/supabase/storage";

/** Supabase Free plan's monthly cached-egress allowance. */
const FREE_EGRESS_GB = 5;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const mb = (bytes: number) => bytes / 1024 / 1024;
const fmt = (bytes: number) =>
  bytes >= 1024 * 1024 * 1024
    ? `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
    : `${mb(bytes).toFixed(2)} MB`;

/** Every object in the bucket, keyed by full path, with its byte size.
 *  Recursive because `list()` returns one directory level at a time and the
 *  models live two deep (`models/optimized/…`). */
async function listAll(prefix = ""): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  let offset = 0;
  for (;;) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(prefix, { limit: 100, offset });
    if (error) throw new Error(`list(${prefix}): ${error.message}`);
    if (!data?.length) break;
    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      // A folder comes back with no `id`; a file carries size in metadata.
      if (!entry.id) {
        for (const [k, v] of await listAll(path)) out.set(k, v);
      } else {
        out.set(path, (entry.metadata?.size as number | undefined) ?? 0);
      }
    }
    offset += data.length;
    if (data.length < 100) break;
  }
  return out;
}

/** The bucket-relative path a stored public URL points at, or null if the URL
 *  is external (an unsplash placeholder, say) and so costs us no egress.
 *
 *  Stops at the first quote, backslash or space rather than running to the end
 *  of the string: some rows carry a whole JSON config in the column rather than
 *  a bare URL (a photo panel's `{"url":"…","mirrored":false}`), and slicing to
 *  the end swallowed the rest of the object into the "path" — which then
 *  matched nothing in the bucket and was miscounted as a missing file. */
function toPath(url: string | null | undefined): string | null {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const i = url.indexOf(marker);
  if (i === -1) return null;
  const rest = url.slice(i + marker.length);
  const end = rest.search(/["'\\\s]/);
  return decodeURIComponent(end === -1 ? rest : rest.slice(0, end));
}

async function main() {
  console.log(`Bucket: ${BUCKET}\nListing…`);
  const sizes = await listAll();
  const bucketTotal = [...sizes.values()].reduce((a, b) => a + b, 0);
  console.log(`  ${sizes.size} objects, ${fmt(bucketTotal)} stored\n`);

  // --- What is stored, by folder -----------------------------------------
  const byFolder = new Map<string, { n: number; bytes: number }>();
  for (const [path, size] of sizes) {
    const folder = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "(root)";
    const cur = byFolder.get(folder) ?? { n: 0, bytes: 0 };
    byFolder.set(folder, { n: cur.n + 1, bytes: cur.bytes + size });
  }
  console.log("STORED, BY FOLDER");
  for (const [folder, { n, bytes }] of [...byFolder].sort((a, b) => b[1].bytes - a[1].bytes)) {
    console.log(`  ${fmt(bytes).padStart(10)}  ${String(n).padStart(4)} files  ${folder}`);
  }

  // --- What the museum actually serves ------------------------------------
  // Props are placed per room, and the same model can be placed many times.
  // Egress is per *distinct file per visitor* (the browser caches within a
  // visit), so a model placed 5 times in one room is downloaded once.
  const objects = await prisma.museumSceneObject.findMany({
    where: { modelUrl: { not: null } },
    select: { modelUrl: true, roomId: true },
  });

  const perRoom = new Map<string, Set<string>>();
  for (const o of objects) {
    const p = toPath(o.modelUrl);
    if (!p) continue;
    if (!perRoom.has(o.roomId)) perRoom.set(o.roomId, new Set());
    perRoom.get(o.roomId)!.add(p);
  }

  const rooms = await prisma.museumRoom.findMany({ select: { id: true, name: true } });
  const roomName = new Map(rooms.map((r) => [r.id, r.name]));

  console.log("\nMODEL BYTES PER ROOM  (distinct files — a prop placed twice downloads once)");
  const roomTotals: { name: string; bytes: number; n: number; missing: number }[] = [];
  for (const [roomId, paths] of perRoom) {
    let bytes = 0;
    let missing = 0;
    for (const p of paths) {
      const s = sizes.get(p);
      if (s === undefined) missing++;
      else bytes += s;
    }
    roomTotals.push({ name: roomName.get(roomId) ?? roomId, bytes, n: paths.size, missing });
  }
  roomTotals.sort((a, b) => b.bytes - a.bytes);
  for (const r of roomTotals) {
    const warn = r.missing ? `  ⚠ ${r.missing} referenced file(s) not in bucket` : "";
    console.log(`  ${fmt(r.bytes).padStart(10)}  ${String(r.n).padStart(3)} models  ${r.name}${warn}`);
  }

  // --- Did the compression actually land? ---------------------------------
  // Docs/Museum_AssetOptimization.md put the compressed set at models/optimized/.
  // A live URL still pointing at raw models/ is a prop that never got remapped,
  // and would be serving its full uncompressed size on every visit.
  const livePaths = new Set([...perRoom.values()].flatMap((s) => [...s]));
  const unoptimized = [...livePaths].filter((p) => !p.startsWith("models/optimized/"));
  console.log("\nCOMPRESSION CHECK");
  console.log(`  ${livePaths.size} distinct models referenced by rooms`);
  if (unoptimized.length === 0) {
    console.log("  ✓ every referenced model is under models/optimized/");
  } else {
    console.log(`  ⚠ ${unoptimized.length} still pointing outside models/optimized/:`);
    for (const p of unoptimized.slice(0, 10)) {
      console.log(`      ${fmt(sizes.get(p) ?? 0).padStart(9)}  ${p}`);
    }
  }

  // --- The projection -----------------------------------------------------
  // The entry room is what every visitor pays for; deeper rooms only cost
  // egress if the visitor walks that far, which most do not.
  const entry = roomTotals[0];
  const allRooms = roomTotals.reduce((a, r) => a + r.bytes, 0);
  const budget = FREE_EGRESS_GB * 1024 * 1024 * 1024;

  console.log("\nPROJECTION  (fresh visitors only — a return visit re-downloads nothing,");
  console.log("             these files carry a one-year immutable Cache-Control)");
  console.log(`  Heaviest room (${entry?.name ?? "n/a"}): ${fmt(entry?.bytes ?? 0)} of models`);
  console.log(`  Every room walked end to end:  ${fmt(allRooms)} of models`);
  if (entry?.bytes) {
    console.log(
      `\n  At ${fmt(entry.bytes)}/visit, ${FREE_EGRESS_GB} GB/month covers ` +
        `~${Math.floor(budget / entry.bytes).toLocaleString()} fresh museum visits`
    );
  }
  if (allRooms) {
    console.log(
      `  Worst case (every room), ${FREE_EGRESS_GB} GB covers ` +
        `~${Math.floor(budget / allRooms).toLocaleString()} fresh visits`
    );
  }
  console.log("\n  Models only. Artwork images, the JS bundle and fonts are extra —");
  console.log("  treat these counts as a ceiling, not a promise.");

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
