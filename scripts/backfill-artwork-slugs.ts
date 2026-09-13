// scripts/backfill-artwork-slugs.ts
//
// One-time backfill: Artwork.slug was added as an optional column (see
// prisma/schema.prisma) specifically so existing rows wouldn't block the
// migration — they all start out NULL. This fills every NULL slug from the
// artwork's title, same slugify() + collision-suffix logic
// app/api/artworks/route.ts uses for new artworks, so old and new rows end
// up with slugs in exactly the same format.
//
// Run once via: npx tsx scripts/backfill-artwork-slugs.ts
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

async function main() {
  const artworks = await prisma.artwork.findMany({
    where: { slug: null },
    select: { id: true, title: true },
    orderBy: { createdAt: "asc" },
  });

  if (artworks.length === 0) {
    console.log("No artworks missing a slug — nothing to do.");
    return;
  }

  console.log(`Backfilling slugs for ${artworks.length} artwork(s)...`);

  for (const artwork of artworks) {
    let slug = slugify(artwork.title);
    const existing = await prisma.artwork.findUnique({ where: { slug } });
    if (existing) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }
    await prisma.artwork.update({ where: { id: artwork.id }, data: { slug } });
    console.log(`  ${artwork.title} -> ${slug}`);
  }

  console.log("Done.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
