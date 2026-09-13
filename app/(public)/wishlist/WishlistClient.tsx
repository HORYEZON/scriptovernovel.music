// app/(public)/wishlist/WishlistClient.tsx
"use client";

import Link from "next/link";
import Image from "@/components/ui/SafeImage";
import { Heart, X } from "lucide-react";
import { useWishlistStore } from "@/lib/wishlist-store";
import { formatPrice } from "@/lib/utils";
import { AnimatedHeading } from "@/components/public/AnimatedHeading";
import { imageVariantUrl } from "@/lib/images/variants";

export default function WishlistClient() {
  const { items, removeItem } = useWishlistStore();

  if (items.length === 0) {
    return (
      <div className="pt-24 pb-24">
        <div className="section-padding">
          <div className="bg-black/30 dark:bg-black/45 rounded-2xl border border-white/5 shadow-2xl p-8 md:p-14">
            <div className="text-center py-24">
              <Heart size={48} strokeWidth={1} className="mx-auto text-white/20 mb-6" />
              <p className="font-display text-3xl font-light italic text-white/40 mb-4">
                Your wishlist is empty
              </p>
              <p className="font-body text-sm text-white/40 mb-8">
                Tap the heart on any artwork to save it here for later.
              </p>
              <Link href="/" className="btn-sepia">
                Browse Gallery
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
              {items.length} saved
            </p>
            <AnimatedHeading text="Wishlist" />
            <div className="deco-line mt-6" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
            {items.map((item) => (
              <div key={item.artworkId} className="artwork-card group relative">
                <Link href={item.slug ? `/artwork/${item.slug}` : "/"} className="block">
                  <div className="relative aspect-[4/5] overflow-hidden rounded-xl">
                    <Image
                      src={imageVariantUrl(item.imageUrl, "thumb")}
                      alt={item.title}
                      fill
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                      sizes="(max-width: 640px) 50vw, 25vw"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent pointer-events-none" />

                    <div className="absolute bottom-0 left-0 right-0 p-3 pointer-events-none">
                      <h3 className="font-grotesk text-sm font-semibold tracking-wider uppercase text-white leading-tight line-clamp-2">
                        {item.title}
                      </h3>
                      {item.price !== null && (
                        <p className="font-jakarta text-xs text-white/70 mt-1">
                          {formatPrice(item.price)}
                        </p>
                      )}
                    </div>

                    {item.status === "SOLD" && (
                      <div className="absolute top-2 right-2 bg-vermillion px-2 py-0.5 rounded-md pointer-events-none">
                        <span className="font-body text-[9px] uppercase tracking-widest text-cream">
                          Sold
                        </span>
                      </div>
                    )}
                  </div>
                </Link>

                <button
                  type="button"
                  onClick={() => removeItem(item.artworkId)}
                  title="Remove from wishlist"
                  aria-label="Remove from wishlist"
                  className="absolute top-2 left-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-vermillion transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
