// app/(public)/shop/page.tsx
//
// The Store: every product a visitor can buy, as ProductCards with a
// category filter. Each card opens the product's own page (/shop/[slug]);
// a gallery-era product without a slug opens its artwork page instead.
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { LIVE_PRODUCT_WHERE, PRODUCT_ARTWORK_SELECT, PUBLIC_PRODUCT_ORDER } from "@/lib/store/queries";
import { toPublicProduct, type PublicProduct } from "@/lib/store/public-product";
import { PageHero } from "@/components/public/system/PageHero";
import { ShopClient } from "./ShopClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Store",
  description: "ScriptOverNovel merch — shirts, vinyl, CDs, posters. Shipped from Valenzuela City.",
};

export default async function ShopPage() {
  const rows = await prisma.product
    .findMany({
      where: LIVE_PRODUCT_WHERE,
      include: { artwork: PRODUCT_ARTWORK_SELECT, variants: { orderBy: { sortOrder: "asc" } } },
      orderBy: PUBLIC_PRODUCT_ORDER,
    })
    .catch(() => []);
  const products = rows.map(toPublicProduct).filter((p): p is PublicProduct => p !== null);
  const lead = products.find((p) => p.featured && p.images[0]) ?? products.find((p) => p.images[0]);

  return (
    <div className="pb-24">
      <PageHero image={lead?.images[0] ?? null} blur="lg" eyebrow="Merch" title="Store" subtitle="Shirts, records and paper things. Shipped from Valenzuela City." />
      <ShopClient products={products} />
    </div>
  );
}
