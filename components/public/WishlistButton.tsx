// components/public/WishlistButton.tsx
//
// Heart toggle — save/unsave an artwork, no login needed (localStorage via
// lib/wishlist-store.ts, same pattern as the cart). Used on artwork cards,
// the detail modal, and the dedicated /artwork/[slug] page.
"use client";

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import toast from "@/lib/toast";
import { useWishlistStore } from "@/lib/wishlist-store";
import type { WishlistItem } from "@/types";

export function WishlistButton({
  artwork,
  className,
  size = 16,
  showLabel = false,
}: {
  artwork: WishlistItem;
  className?: string;
  size?: number;
  // Icon-only by default (artwork cards, overlays); a text label reads
  // better next to ShareButton's labeled "Share" trigger in the modal/page.
  showLabel?: boolean;
}) {
  const inWishlist = useWishlistStore((s) => s.isInWishlist(artwork.artworkId));
  const toggleItem = useWishlistStore((s) => s.toggleItem);

  // Same fix as the Navbar badges: `inWishlist` comes from a
  // localStorage-persisted store that rehydrates before the client's first
  // render, while the server always renders "not saved". Hold the visible
  // saved/unsaved state to the server's default until after mount so the
  // two renders agree; the click handler below still uses the real
  // `inWishlist` value, so the toggle/toast behavior is unchanged.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const displayInWishlist = mounted && inWishlist;

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    toggleItem(artwork);
    toast.success(
      inWishlist
        ? `Removed "${artwork.title}" from wishlist`
        : `Saved "${artwork.title}" to wishlist`
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      title={displayInWishlist ? "Remove from wishlist" : "Save to wishlist"}
      aria-label={displayInWishlist ? "Remove from wishlist" : "Save to wishlist"}
      className={
        className ??
        `p-2 rounded-full transition-colors ${
          displayInWishlist
            ? "bg-vermillion/20 text-vermillion"
            : "bg-black/60 text-white hover:bg-black/80"
        }`
      }
    >
      <Heart size={size} className={displayInWishlist ? "fill-current" : ""} />
      {showLabel && (displayInWishlist ? "Saved" : "Save")}
    </button>
  );
}
