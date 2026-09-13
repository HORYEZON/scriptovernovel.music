// app/(public)/cart/CartClient.tsx
"use client";

import { useState } from "react";
import Image from "@/components/ui/SafeImage";
import Link from "next/link";
import { Minus, Plus, X, ShoppingBag, ArrowRight } from "lucide-react";
import { useCartStore } from "@/lib/cart-store";
import { formatPrice } from "@/lib/utils";
import { AnimatedHeading } from "@/components/public/AnimatedHeading";
import { imageVariantUrl } from "@/lib/images/variants";
import {
  ImagePreviewModal,
  type PreviewImage,
} from "@/components/public/ImagePreviewModal";

export default function CartClient() {
  const { items, removeItem, updateQuantity, totalPrice, totalItems } =
    useCartStore();
  const [previewImage, setPreviewImage] = useState<PreviewImage | null>(null);

  if (items.length === 0) {
    return (
      <div className="pt-24 pb-24">
        <div className="section-padding">
          <div className="bg-black/30 dark:bg-black/45 rounded-2xl border border-white/5 shadow-2xl p-8 md:p-14">
            <div className="text-center py-24">
              <ShoppingBag
                size={48}
                strokeWidth={1}
                className="mx-auto text-white/20 mb-6"
              />
              <p className="font-display text-3xl font-light italic text-white/40 mb-4">
                Your cart is empty
              </p>
              <p className="font-body text-sm text-white/40 mb-8">
                Discover original artworks ready for acquisition.
              </p>
              <Link href="/shop" className="btn-sepia">
                Browse Shop
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-24 pb-24">
      <div className="section-padding">
        <div className="bg-black/30 dark:bg-black/45 rounded-2xl border border-white/5 shadow-2xl p-8 md:p-14">
          {/* Header */}
          <div className="mb-16">
            <p className="font-body text-md tracking-[0.5em] uppercase text-sepia-light mb-3">
              {totalItems()} item{totalItems() !== 1 ? "s" : ""}
            </p>
            {/* "A" at index 1 — the glowing squid, same as Gallery/Tales/About/Contact. */}
            <AnimatedHeading text="Cart" squidLetterIndex={1} />
            <div className="deco-line mt-6" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 lg:gap-16">
            {/* Items */}
            <div className="lg:col-span-2 space-y-6">
              {items.map((item) => (
                <div
                  key={`${item.productId}:${item.variantId ?? ""}`}
                  className="flex gap-4 sm:gap-6 pb-6 border-b border-white/10"
                >
                  <div
                    className="relative w-20 h-28 sm:w-24 sm:h-32 shrink-0 bg-white/5 rounded-md overflow-hidden cursor-zoom-in"
                    onClick={() =>
                      setPreviewImage({ src: item.imageUrl, alt: item.title })
                    }
                  >
                    <Image
                      src={imageVariantUrl(item.imageUrl, "thumb")}
                      alt={item.title}
                      fill
                      className="object-cover transition-transform duration-300 hover:scale-105"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 sm:gap-4">
                      <h3 className="font-display text-xl font-light italic text-white break-words min-w-0">
                        {item.title}
                      </h3>
                      <button
                        onClick={() => removeItem(item.productId, item.variantId)}
                        className="text-white/40 hover:text-vermillion transition-colors shrink-0 p-1 -m-1"
                        aria-label={`Remove ${item.title} from cart`}
                      >
                        <X size={16} />
                      </button>
                    </div>
                    {item.variantLabel && (
                      <p className="font-body text-xs text-sepia-light/80 mt-1">
                        {item.variantLabel}
                      </p>
                    )}
                    <p className="font-jakarta text-sm text-white/60 mt-1">
                      {formatPrice(item.price)}
                    </p>
                    <div className="flex flex-wrap items-center gap-3 mt-4">
                      <button
                        onClick={() =>
                          updateQuantity(item.productId, item.quantity - 1, item.variantId)
                        }
                        className="w-8 h-8 border border-white/15 text-white/60 flex items-center justify-center hover:bg-white/10 hover:border-white/30 hover:text-white transition-all"
                      >
                        <Minus size={12} />
                      </button>
                      <span className="font-jakarta text-sm text-white w-6 text-center">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() =>
                          updateQuantity(item.productId, item.quantity + 1, item.variantId)
                        }
                        disabled={item.quantity >= item.stock}
                        className="w-8 h-8 border border-white/15 text-white/60 flex items-center justify-center hover:bg-white/10 hover:border-white/30 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Plus size={12} />
                      </button>
                      <span className="font-body text-xs text-white/40">
                        ({item.stock} available)
                      </span>
                    </div>
                    <p className="font-jakarta text-base text-sepia-light font-medium mt-4">
                      {formatPrice(item.price * item.quantity)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="lg:col-span-1">
              <div className="bg-white/5 border border-white/10 rounded-xl p-8 sticky top-24">
                <h2 className="font-display text-2xl font-light italic text-white mb-6">
                  Order Summary
                </h2>
                <div className="space-y-3 mb-6">
                  {items.map((item) => (
                    <div
                      key={`${item.productId}:${item.variantId ?? ""}`}
                      className="flex justify-between text-sm font-body text-white/60"
                    >
                      <span className="italic">
                        {item.title}
                        {item.variantLabel ? ` (${item.variantLabel})` : ""} ×{item.quantity}
                      </span>
                      <span className="font-jakarta">
                        {formatPrice(item.price * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-white/10 pt-4 mb-8">
                  <div className="flex justify-between items-center">
                    <span className="font-body text-sm uppercase tracking-widest text-white/50">
                      Total
                    </span>
                    <span className="font-jakarta text-2xl text-sepia-light">
                      {formatPrice(totalPrice())}
                    </span>
                  </div>
                  <p className="font-body text-[10px] text-white/40 mt-2 tracking-wide">
                    Shipping calculated at checkout
                  </p>
                </div>
                <Link href="/checkout" className="btn-sepia w-full">
                  Proceed to Checkout
                  <ArrowRight size={16} />
                </Link>
                <Link href="/shop" className="btn-sepia-outline w-full mt-4">
                  Continue Shopping
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ImagePreviewModal
        image={previewImage}
        onClose={() => setPreviewImage(null)}
      />
    </div>
  );
}
