// components/public/store/ProductCard.tsx
//
// One merch item in the Store grid: the first photo (second on hover when
// there is one), title, category, price or range, and its state badge —
// Coming soon / Sold out / Last one. The whole card links to the product's
// page. Server-safe.
import Link from "next/link";
import { imageVariantUrl } from "@/lib/images/variants";
import { formatPriceRange } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { productCategoryLabel } from "@/lib/store/categories";
import { HoverShimmer } from "@/components/public/HoverShimmer";
import { DEFAULT_HOVER_SHIMMER, type ShimmerSettings } from "@/lib/hover-shimmer";
import type { PublicProduct } from "@/lib/store/public-product";
import { comingSoonLine, productState, productStateBadge } from "@/lib/store/availability";

export function ProductCard({
  product,
  className,
  // Settings → Preferences → Branding → Hover Shimmer, "Shop" surface. That
  // surface has existed in the admin since the shimmer was added but nothing
  // rendered it here, so the setting did nothing on this page. The default
  // keeps every other caller working without passing it.
  shimmer = DEFAULT_HOVER_SHIMMER.shop,
}: {
  product: PublicProduct;
  className?: string;
  shimmer?: ShimmerSettings;
}) {
  const [first, second] = product.images;
  // One source for the state — the card used to work it out from stock alone,
  // which is how it ended up able to disagree with the product page.
  const state = productState(product);
  const badge = productStateBadge(state);
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
        {/* Above the photos, under the stock badge — the sweep should cross
            the image, not the label. */}
        <HoverShimmer settings={shimmer} />
        {badge && (
          <span
            className={cn(
              "absolute left-3 top-3 z-10 rounded-full border px-2.5 py-1 font-body text-[10px] uppercase tracking-[0.2em] backdrop-blur-md",
              state === "coming_soon"
                ? "border-sepia/60 bg-ink/70 text-sepia-light"
                : "border-cream/30 bg-ink/70 text-cream"
            )}
          >
            {badge}
          </span>
        )}
      </div>
      <div className="mt-3">
        {category && <p className="font-body text-[10px] uppercase tracking-[0.3em] text-sepia-light">{category}</p>}
        <p className="mt-0.5 truncate font-fraunces text-lg font-light text-cream">{product.title}</p>
        <p className="font-body text-xs tracking-wide text-cream/60">{formatPriceRange(product.price, product.variants.map((v) => v.price))}</p>
        {state === "coming_soon" && (
          <p className="font-body text-[11px] tracking-wide text-sepia-light">{comingSoonLine(product.releaseAt)}</p>
        )}
      </div>
    </Link>
  );
}
