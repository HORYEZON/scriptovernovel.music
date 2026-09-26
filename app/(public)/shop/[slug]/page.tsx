// app/(public)/shop/[slug]/page.tsx
//
// One merch item: its photos, description, size/format picker and Add to
// cart. Found by the product's own slug (write-once, set on create).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { LIVE_PRODUCT_WHERE, PRODUCT_ARTWORK_SELECT } from "@/lib/store/queries";
import { toPublicProduct } from "@/lib/store/public-product";
import { productState, schemaAvailability } from "@/lib/store/availability";
import { SITE_URL } from "@/lib/site-url";
import { JsonLd } from "@/components/public/JsonLd";
import { ProductDetailClient } from "./ProductDetailClient";

export const dynamic = "force-dynamic";

async function loadProduct(slug: string) {
  const row = await prisma.product
    .findFirst({
      where: { slug, ...LIVE_PRODUCT_WHERE },
      include: { artwork: PRODUCT_ARTWORK_SELECT, variants: { orderBy: { sortOrder: "asc" } } },
    })
    .catch(() => null);
  return row ? toPublicProduct(row) : null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await loadProduct(slug);
  if (!product) return { title: "Store" };
  const description = product.description?.split("\n")[0] ?? "ScriptOverNovel merch";
  return {
    title: product.title,
    description,
    openGraph: {
      title: `${product.title} — ScriptOverNovel`,
      description,
      siteName: "ScriptOverNovel",
      type: "website",
      ...(product.images[0] && { images: [{ url: product.images[0] }] }),
    },
    twitter: { card: "summary_large_image", title: `${product.title} — ScriptOverNovel`, description },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await loadProduct(slug);
  if (!product) notFound();

  const prices = product.variants.length ? product.variants.map((v) => v.price) : [product.price];
  // Through the shared helper rather than a stock sum, so the structured data
  // can't say InStock over a page that says Coming soon.
  const state = productState(product);

  return (
    <div className="pb-24 pt-24 md:pt-28">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: product.title,
          url: `${SITE_URL}/shop/${slug}`,
          ...(product.description && { description: product.description }),
          ...(product.images.length && { image: product.images }),
          brand: { "@type": "MusicGroup", name: "ScriptOverNovel" },
          offers: {
            "@type": "AggregateOffer",
            priceCurrency: "PHP",
            lowPrice: Math.min(...prices),
            highPrice: Math.max(...prices),
            availability: schemaAvailability(state),
            url: `${SITE_URL}/shop/${slug}`,
          },
        }}
      />
      <ProductDetailClient product={product} />
    </div>
  );
}
