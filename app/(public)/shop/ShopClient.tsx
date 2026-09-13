// app/(public)/shop/ShopClient.tsx
"use client";

import { useRef, useState } from "react";
import Image from "@/components/ui/SafeImage";
import {
  ShoppingBag,
  CheckCircle,
  FolderOpen,
  Expand,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useCartStore } from "@/lib/cart-store";
import { formatPrice } from "@/lib/utils";
import toast from "@/lib/toast";
import Link from "next/link";
import { ImagePreviewModal, type PreviewImage } from "@/components/public/ImagePreviewModal";
import { LastOneBadge } from "@/components/public/ArtworkBadge";
import { HoverShimmer } from "@/components/public/HoverShimmer";
import { DEFAULT_SHIMMER, type ShimmerSettings } from "@/lib/hover-shimmer";
import { imageVariantUrl } from "@/lib/images/variants";

interface ProductVariant {
  id: string;
  label: string;
  price: number;
  stock: number;
}

interface Product {
  id: string;
  price: number;
  stock: number;
  available: boolean;
  variants: ProductVariant[];
  artwork: {
    id: string;
    title: string;
    description: string;
    imageUrl: string;
    tags: string[];
    medium: string | null;
    dimensions: string | null;
    year: number | null;
  };
}

// Divides evenly by every column count the grid uses (1 / 2 / 3), so the last
// row of a full page is never a lone orphaned card on any breakpoint.
const PAGE_SIZE = 12;

/**
 * Which page buttons to render: first, last, the current page and its
 * immediate neighbours, with "gap" standing in for the runs between.
 *
 * The admin tables render every page number, which is fine for a handful and
 * unusable past a dozen — on a phone it wraps into a block of numbers taller
 * than the control it belongs to. Windowing keeps this one line wide whether
 * the shop has 3 pages or 30. Under 8 pages there's nothing to elide, so the
 * full run renders and no "…" ever appears for a small shop.
 */
function pageWindow(current: number, total: number): (number | "gap")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const wanted = [1, total, current, current - 1, current + 1];
  const shown = [...new Set(wanted)]
    .filter((p) => p >= 1 && p <= total)
    .sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  let previous = 0;
  for (const page of shown) {
    if (previous && page - previous > 1) out.push("gap");
    out.push(page);
    previous = page;
  }
  return out;
}

export function ShopClient({
  products,
  shimmer = DEFAULT_SHIMMER,
}: {
  products: Product[];
  // Admin-configured hover light-sweep for the product cards (Settings →
  // Preferences → Branding → Hover Shimmer, "Shop" tab). Resolved server-side
  // by page.tsx; defaults to a white sweep when nothing is saved.
  shimmer?: ShimmerSettings;
}) {
  const { addItem, items } = useCartStore();
  const [previewImage, setPreviewImage] = useState<PreviewImage | null>(null);
  // Which size is selected per product — defaults to the first variant
  // below, this only tracks explicit choices away from that default.
  const [selectedVariant, setSelectedVariant] = useState<Record<string, string>>({});

  const [currentPage, setCurrentPage] = useState(1);
  const gridRef = useRef<HTMLDivElement>(null);

  const totalPages = Math.max(1, Math.ceil(products.length / PAGE_SIZE));
  // Derived rather than corrected in an effect: `products` is server-fed and
  // can shrink between loads (something sold out and was hidden), and reading
  // the clamped value straight through means there's never a render where the
  // page is out of range.
  const page = Math.min(currentPage, totalPages);
  const pageProducts = products.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function goToPage(next: number) {
    const target = Math.min(totalPages, Math.max(1, next));
    if (target === page) return;
    setCurrentPage(target);
    // Land back at the top of the grid, not the top of the document — the
    // page header above it is the same on every page, so scrolling past it
    // again would just be a longer trip to the same place. Offset by the
    // fixed navbar's height so the first row isn't tucked underneath it.
    const top = gridRef.current?.getBoundingClientRect().top ?? 0;
    window.scrollTo({ top: window.scrollY + top - 96, behavior: "smooth" });
  }

  function activeVariant(product: Product): ProductVariant | null {
    if (product.variants.length === 0) return null;
    const chosenId = selectedVariant[product.id];
    return product.variants.find((v) => v.id === chosenId) ?? product.variants[0];
  }

  function isInCart(product: Product, variant: ProductVariant | null) {
    return items.some(
      (i) => i.productId === product.id && (i.variantId ?? null) === (variant?.id ?? null)
    );
  }

  function handleAdd(product: Product) {
    const variant = activeVariant(product);
    addItem({
      productId: product.id,
      artworkId: product.artwork.id,
      title: product.artwork.title,
      imageUrl: product.artwork.imageUrl,
      price: variant?.price ?? product.price,
      stock: variant?.stock ?? product.stock,
      variantId: variant?.id ?? null,
      variantLabel: variant?.label ?? null,
    });
    toast.success(
      `"${product.artwork.title}"${variant ? ` (${variant.label})` : ""} added to cart`
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-24">
        <FolderOpen size={48} strokeWidth={1} className="mx-auto mb-4 text-white/20" />
        <p className="font-display text-3xl font-light italic text-white/40">
          No products available
        </p>
        <p className="font-body text-sm text-white/30 mt-2">
          Check back soon for new works.
        </p>
      </div>
    );
  }

  return (
    <>
      <div ref={gridRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {pageProducts.map((product, i) => {
          const variant = activeVariant(product);
          const price = variant?.price ?? product.price;
          const stock = variant?.stock ?? product.stock;
          const inCart = isInCart(product, variant);

          return (
            <div
              key={product.id}
              className="artwork-card group animate-fade-up"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              {/* Image */}
              <div
                className="relative aspect-[3/4] overflow-hidden cursor-zoom-in"
                onClick={() =>
                  setPreviewImage({
                    src: product.artwork.imageUrl,
                    alt: product.artwork.title,
                  })
                }
              >
                <Image
                  src={imageVariantUrl(product.artwork.imageUrl, "thumb")}
                  alt={product.artwork.title}
                  fill
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
                <HoverShimmer settings={shimmer} />
                {/* The site's shared badge pill (Featured / New Release /
                    Last One) rather than a flat rectangle — it carries the
                    shimmer sweep, and the wrapper stays here because each
                    caller positions its own badge. */}
                {stock <= 1 && stock > 0 && (
                  <div className="absolute top-4 left-4 z-10">
                    <LastOneBadge />
                  </div>
                )}
                {stock === 0 && (
                  <div className="absolute inset-0 bg-ink/60 flex items-center justify-center">
                    <span className="font-display text-2xl italic text-cream/80">
                      Sold
                    </span>
                  </div>
                )}
                {/* Zoom hint */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-300 pointer-events-none">
                  <Expand size={20} strokeWidth={1.5} className="text-white/90" />
                </div>
              </div>

              {/* Info */}
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-display text-xl font-light italic text-white leading-tight">
                      {product.artwork.title}
                    </h2>
                    <p className="font-body text-xs text-white/50 uppercase tracking-wider mt-1">
                      {product.artwork.medium}
                      {product.artwork.dimensions &&
                        ` · ${product.artwork.dimensions}`}
                    </p>
                  </div>
                  <span className="font-jakarta text-xl font-light text-sepia-light shrink-0">
                    {formatPrice(price)}
                  </span>
                </div>

                <p className="font-body text-sm text-white/60 leading-relaxed mt-3 line-clamp-2">
                  {product.artwork.description}
                </p>

                {/* Size / variant picker */}
                {product.variants.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    {product.variants.map((v) => {
                      const active = variant?.id === v.id;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          disabled={v.stock === 0}
                          onClick={() =>
                            setSelectedVariant((prev) => ({ ...prev, [product.id]: v.id }))
                          }
                          className={`font-body text-[11px] tracking-wider uppercase px-3 py-1.5 border transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                            active
                              ? "border-sepia-light text-sepia-light bg-sepia-light/10"
                              : "border-white/20 text-white/60 hover:border-white/40 hover:text-white"
                          }`}
                        >
                          {v.label}
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="flex gap-3 mt-5">
                  {stock === 0 ? (
                    <span className="font-body text-xs text-white/40 italic py-3">
                      No longer available
                    </span>
                  ) : inCart ? (
                    <Link href="/cart" className="btn-sepia-outline flex-1">
                      <CheckCircle size={16} strokeWidth={1.5} />
                      View Cart
                    </Link>
                  ) : (
                    <button
                      onClick={() => handleAdd(product)}
                      className="btn-sepia flex-1"
                    >
                      <ShoppingBag size={16} strokeWidth={1.5} />
                      Add to Cart
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination — one control for both breakpoints. Prev/Next and the
          count are always there; the numbered buttons are desktop-only
          (sm:flex), because on a phone they're small targets competing for a
          narrow row while Prev/Next is the gesture anyone actually reaches
          for. Mobile gets "Page X of Y" in that space instead, which is the
          information the numbers were carrying anyway. */}
      {totalPages > 1 && (
        <div className="mt-16 flex flex-col items-center gap-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => goToPage(page - 1)}
              disabled={page === 1}
              aria-label="Previous page"
              className="inline-flex items-center gap-1.5 font-body text-[11px] tracking-wider uppercase px-3 py-2 border border-white/20 text-white/60 hover:border-white/40 hover:text-white transition-colors disabled:opacity-25 disabled:cursor-not-allowed disabled:hover:border-white/20 disabled:hover:text-white/60"
            >
              <ChevronLeft size={14} strokeWidth={1.5} />
              Prev
            </button>

            {/* Same active/inactive treatment as the size picker above, so a
                selected page and a selected size read as the same kind of
                choice. */}
            <div className="hidden sm:flex items-center gap-2">
              {pageWindow(page, totalPages).map((entry, i) =>
                entry === "gap" ? (
                  <span
                    key={`gap-${i}`}
                    aria-hidden="true"
                    className="font-body text-[11px] text-white/30 px-1 select-none"
                  >
                    …
                  </span>
                ) : (
                  <button
                    key={entry}
                    type="button"
                    onClick={() => goToPage(entry)}
                    aria-label={`Page ${entry}`}
                    aria-current={entry === page ? "page" : undefined}
                    className={`w-9 h-9 font-body text-[11px] tracking-wider border transition-colors ${
                      entry === page
                        ? "border-sepia-light text-sepia-light bg-sepia-light/10"
                        : "border-white/20 text-white/60 hover:border-white/40 hover:text-white"
                    }`}
                  >
                    {entry}
                  </button>
                )
              )}
            </div>

            <span className="sm:hidden font-body text-[11px] tracking-wider uppercase text-white/50 px-2">
              Page {page} of {totalPages}
            </span>

            <button
              type="button"
              onClick={() => goToPage(page + 1)}
              disabled={page === totalPages}
              aria-label="Next page"
              className="inline-flex items-center gap-1.5 font-body text-[11px] tracking-wider uppercase px-3 py-2 border border-white/20 text-white/60 hover:border-white/40 hover:text-white transition-colors disabled:opacity-25 disabled:cursor-not-allowed disabled:hover:border-white/20 disabled:hover:text-white/60"
            >
              Next
              <ChevronRight size={14} strokeWidth={1.5} />
            </button>
          </div>

          <p className="font-body text-xs text-white/30">
            Showing {(page - 1) * PAGE_SIZE + 1}–
            {Math.min(page * PAGE_SIZE, products.length)} of {products.length} works
          </p>
        </div>
      )}

      <ImagePreviewModal image={previewImage} onClose={() => setPreviewImage(null)} />
    </>
  );
}
