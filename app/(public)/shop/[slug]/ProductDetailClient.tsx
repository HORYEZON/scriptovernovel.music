"use client";

// app/(public)/shop/[slug]/ProductDetailClient.tsx
//
// The buying half of a product page: photo gallery (tap to open), price,
// size/format picker when there are variants, quantity-aware Add to cart
// (the cart store clamps to stock), share link, and a way back to the
// Store. Same cart contract as before the Store decoupling — a CartItem
// snapshot with the product's resolved title and image.
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Share2, ShoppingBag } from "lucide-react";
import toast from "@/lib/toast";
import { cn, formatPrice } from "@/lib/utils";
import { useCartStore } from "@/lib/cart-store";
import { imageVariantUrl } from "@/lib/images/variants";
import { productCategoryLabel } from "@/lib/store/categories";
import { GlassPanel } from "@/components/public/system/GlassPanel";
import { Eyebrow } from "@/components/public/system/Eyebrow";
import { ImagePreviewModal } from "@/components/public/ImagePreviewModal";
import type { PublicProduct } from "@/lib/store/public-product";
import { acceptsStockAlerts, comingSoonLine, isBuyable, productState } from "@/lib/store/availability";
import { NotifyMeForm } from "@/components/public/store/NotifyMeForm";

export function ProductDetailClient({ product }: { product: PublicProduct }) {
  const { addItem, items } = useCartStore();
  const [image, setImage] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [variantId, setVariantId] = useState<string | null>(product.variants.find((v) => v.stock > 0)?.id ?? product.variants[0]?.id ?? null);
  const variant = product.variants.find((v) => v.id === variantId) ?? null;
  const price = variant?.price ?? product.price;
  const stock = variant?.stock ?? product.stock;
  const inCart = items.find((i) => i.productId === product.id && (i.variantId ?? null) === (variant?.id ?? null))?.quantity ?? 0;
  const canAdd = stock > 0 && inCart < stock;
  // One source for what can be done with this product — the same functions the
  // Store card and the API use.
  const state = productState(product);
  const buyable = isBuyable(product) && stock > 0;
  const takesAlerts = acceptsStockAlerts(product);
  const category = productCategoryLabel(product.category);

  function add() {
    if (!canAdd) return;
    addItem({
      productId: product.id,
      artworkId: product.artworkId,
      title: product.title,
      imageUrl: product.images[0] ?? "",
      price,
      stock,
      variantId: variant?.id ?? null,
      variantLabel: variant?.label ?? null,
    });
    toast.success(`${product.title}${variant ? ` (${variant.label})` : ""} added to cart`);
  }

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: product.title, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
    } catch {
      /* dismissed */
    }
  }

  return (
    <div className="section-padding">
      <Link href="/shop" className="mb-6 inline-flex items-center gap-2 font-body text-[11px] uppercase tracking-[0.25em] text-cream/60 transition-colors hover:text-cream">
        <ArrowLeft size={14} /> Store
      </Link>
      <GlassPanel padding="page">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
          {/* Gallery */}
          <div>
            <button
              type="button"
              onClick={() => product.images[image] && setPreview(product.images[image])}
              className="block w-full overflow-hidden rounded-2xl border border-white/10 bg-black/30"
              aria-label="Open photo"
            >
              {product.images[image] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageVariantUrl(product.images[image], "full")} alt={product.title} draggable={false} className="aspect-square w-full object-cover" />
              ) : (
                <div aria-hidden="true" className="aspect-square w-full bg-[radial-gradient(circle_at_40%_30%,rgba(200,169,110,0.2),transparent_55%)]" />
              )}
            </button>
            {product.images.length > 1 && (
              <ul className="mt-3 grid grid-cols-5 gap-2">
                {product.images.map((src, i) => (
                  <li key={src}>
                    <button
                      type="button"
                      onClick={() => setImage(i)}
                      aria-label={`Photo ${i + 1}`}
                      className={cn("block aspect-square w-full overflow-hidden rounded-lg border transition-colors", i === image ? "border-cream/70" : "border-white/10 hover:border-white/40")}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imageVariantUrl(src, "thumb")} alt="" draggable={false} className="h-full w-full object-cover" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Details */}
          <div className="flex flex-col">
            {category && <Eyebrow className="mb-3">{category}</Eyebrow>}
            <h1 className="font-fraunces text-3xl font-light leading-tight text-cream md:text-5xl">{product.title}</h1>
            <p className="mt-4 font-body text-xl text-cream">{formatPrice(price)}</p>

            {product.variants.length > 0 && (
              <div className="mt-8">
                <p className="mb-2 font-body text-[10px] uppercase tracking-[0.3em] text-sepia-light">Size / format</p>
                <div className="flex flex-wrap gap-2">
                  {product.variants.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      disabled={v.stock === 0}
                      onClick={() => setVariantId(v.id)}
                      className={cn(
                        "rounded-full border px-4 py-2 font-body text-xs transition-colors disabled:cursor-not-allowed disabled:line-through disabled:opacity-40",
                        v.id === variantId ? "border-cream/70 bg-cream/10 text-cream" : "border-cream/15 text-cream/70 hover:border-cream/40"
                      )}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Coming soon replaces the buy row outright: the thing isn't for
                sale, so a greyed-out Add to cart would be a worse answer than
                the date and a way to be told. */}
            {state === "coming_soon" && (
              <p className="mt-6 font-body text-sm text-sepia-light">{comingSoonLine(product.releaseAt)}</p>
            )}

            <div className="mt-8 flex flex-wrap items-center gap-3">
              {buyable && (
                <button
                  type="button"
                  onClick={add}
                  disabled={!canAdd}
                  className="inline-flex items-center gap-2 rounded-full bg-cream px-6 py-3 font-body text-[11px] font-medium uppercase tracking-[0.18em] text-ink transition-transform hover:scale-[1.04] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
                >
                  {inCart >= stock ? <><Check size={14} /> All in cart</> : <><ShoppingBag size={14} /> Add to cart</>}
                </button>
              )}
              <button type="button" onClick={share} className="inline-flex items-center gap-2 rounded-full border border-cream/30 px-5 py-3 font-body text-[11px] uppercase tracking-[0.18em] text-cream transition-colors hover:border-cream/70">
                <Share2 size={14} /> Share
              </button>
              {inCart > 0 && (
                <Link href="/cart" className="font-body text-[11px] uppercase tracking-[0.2em] text-cream/60 underline-offset-4 hover:text-cream hover:underline">
                  {inCart} in cart
                </Link>
              )}
            </div>
            {buyable && stock <= 3 && <p className="mt-3 font-body text-xs text-sepia-light">Only {stock} left.</p>}

            {/* The alert takes the buy button's place. `variantId` is passed
                along so someone waiting on one size is only told when *that*
                size is back. */}
            {takesAlerts && (
              <NotifyMeForm
                productId={product.id}
                variantId={variantId}
                variantLabel={variant?.label ?? null}
                className="mt-6 max-w-md"
              />
            )}

            {product.description && (
              <p className="mt-10 whitespace-pre-line font-body text-sm leading-relaxed text-cream/70">{product.description}</p>
            )}
          </div>
        </div>
      </GlassPanel>
      <ImagePreviewModal image={preview ? { src: preview, alt: product.title } : null} onClose={() => setPreview(null)} />
    </div>
  );
}
