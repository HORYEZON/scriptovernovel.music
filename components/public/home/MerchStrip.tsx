// components/public/home/MerchStrip.tsx
//
// A row of merch (featured first), linking into the Store. Reads products
// through lib/store/product-display.ts. Hidden when the store has nothing
// available.
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatPriceRange } from "@/lib/utils";
import { imageVariantUrl } from "@/lib/images/variants";
import { productHref, productImage, productTitle } from "@/lib/store/product-display";
import { LIVE_PRODUCT_WHERE, PRODUCT_ARTWORK_SELECT, PUBLIC_PRODUCT_ORDER } from "@/lib/store/queries";
import { SectionHeading } from "@/components/public/system/SectionHeading";
import { Reveal } from "@/components/public/system/Reveal";

export async function MerchStrip() {
  const products = await prisma.product
    .findMany({
      where: LIVE_PRODUCT_WHERE,
      include: { artwork: PRODUCT_ARTWORK_SELECT, variants: true },
      orderBy: PUBLIC_PRODUCT_ORDER,
      take: 4,
    })
    .catch(() => []);
  if (products.length === 0) return null;

  return (
    <Reveal as="section" className="section-padding">
      <SectionHeading eyebrow="Store" title="Merch" action={{ label: "Everything", href: "/shop" }} />
      <ul className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
        {products.map((p) => {
          const image = productImage(p);
          const title = productTitle(p) ?? "Untitled";
          return (
            <li key={p.id}>
              <Link href={productHref(p)} className="group block">
                <div className="relative aspect-square overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                  {image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img draggable={false}
                      src={imageVariantUrl(image, "medium")}
                      alt={title}
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                      loading="lazy"
                    />
                  )}
                </div>
                <p className="mt-3 truncate font-fraunces text-lg font-light text-cream">{title}</p>
                <p className="font-body text-xs tracking-wide text-cream/60">
                  {formatPriceRange(p.price, p.variants.map((v) => v.price))}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </Reveal>
  );
}
