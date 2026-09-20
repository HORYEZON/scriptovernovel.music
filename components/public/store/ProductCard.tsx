// components/public/store/ProductCard.tsx
//
// One merch item in the Store grid: the first photo (second on hover when
// there is one), title, category, price or range, sold-out / last-one
// state. The whole card links to the product's page. Server-safe.
import Link from "next/link";
import { imageVariantUrl } from "@/lib/images/variants";
import { formatPriceRange } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { productCategoryLabel } from "@/lib/store/categories";
import type { PublicProduct } from "@/lib/store/public-product";

export function productStockState(p: PublicProduct): "out" | "last" | "ok" {
  const stock = p.variants.length > 0 ? p.variants.reduce((s, v) => s + v.stock, 0) : p.stock;
  if (stock <= 0) return "out";
  if (stock === 1) return "last";
  return "ok";
}

export function ProductCard({ product, className }: { product: PublicProduct; className?: string }) {
  const [first, second] = product.images;
  const state = productStockState(product);
  const category = productCategoryLabel(product.category);
  return (
    <Link href={product.href} className={cn("group block", className)}>
      <div className="relative aspect-square overflow-hidden rounded-2xl border border-white/10 bg-black/30">
        {first ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageVariantUrl(first, "medium")}
              alt={product.title}
              draggable={false}
              loading="lazy"
              className={cn(
                "h-full w-full object-cover transition-[transform,opacity] duration-700 group-hover:scale-105",
                second && "group-hover:opacity-0"
              )}
            />
            {second && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageVariantUrl(second, "medium")}
                alt=""
                draggable={false}
                loading="lazy"
                className="absolute inset-0 h-full w-full scale-105 object-cover opacity-0 transition-opacity duration-700 group-hover:opacity-100"
              />
            )}
          </>
        ) : (
          <div aria-hidden="true" className="h-full w-full bg-[radial-gradient(circle_at_40%_30%,rgba(200,169,110,0.2),transparent_55%)]" />
        )}
        {state !== "ok" && (
          <span className="absolute left-3 top-3 rounded-full border border-cream/30 bg-ink/70 px-2.5 py-1 font-body text-[10px] uppercase tracking-[0.2em] text-cream backdrop-blur-md">
            {state === "out" ? "Sold out" : "Last one"}
          </span>
        )}
      </div>
      <div className="mt-3">
        {category && <p className="font-body text-[10px] uppercase tracking-[0.3em] text-sepia-light">{category}</p>}
        <p className="mt-0.5 truncate font-fraunces text-lg font-light text-cream">{product.title}</p>
        <p className="font-body text-xs tracking-wide text-cream/60">{formatPriceRange(product.price, product.variants.map((v) => v.price))}</p>
      </div>
    </Link>
  );
}
