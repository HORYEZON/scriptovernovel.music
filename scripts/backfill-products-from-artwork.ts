// scripts/backfill-products-from-artwork.ts
//
// One-off after the Store decoupling (migration 20260920190000_merch_products):
// every product that still stands on an artwork and has no title of its own
// gets the artwork's title / description / image copied in, plus a slug, so
// it becomes a first-class merch item with its own /shop/[slug] page. The
// artwork link is kept (the Museum's Services Room reads it). Idempotent —
// a product with a title is left alone. Run: npx tsx --env-file=.env scripts/backfill-products-from-artwork.ts
import { prisma } from "../lib/prisma";
import { slugify } from "../lib/utils";

async function main() {
  const rows = await prisma.product.findMany({
    where: { artworkId: { not: null }, OR: [{ title: null }, { title: "" }] },
    include: { artwork: { select: { title: true, description: true, imageUrl: true, imageUrls: true } } },
  });
  let done = 0;
  for (const p of rows) {
    if (!p.artwork) continue;
    let slug = p.slug ?? (slugify(p.artwork.title) || "item");
    if (!p.slug && (await prisma.product.findUnique({ where: { slug } }))) slug = `${slug}-${Date.now().toString(36)}`;
    const images = p.images.length ? p.images : [p.artwork.imageUrl, ...(p.artwork.imageUrls ?? [])].filter(Boolean);
    await prisma.product.update({
      where: { id: p.id },
      data: {
        title: p.artwork.title,
        description: p.description ?? p.artwork.description ?? null,
        images,
        slug,
      },
    });
    done += 1;
  }
  console.log(`backfilled ${done} of ${rows.length} artwork-backed products`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
