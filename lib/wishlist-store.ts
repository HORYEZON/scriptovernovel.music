// lib/wishlist-store.ts
//
// Same shape as lib/cart-store.ts on purpose: a persisted Zustand store,
// no login required. Saving/removing is a toggle (one click either way)
// rather than the cart's separate add/remove/quantity — a wishlist doesn't
// have quantities.
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { WishlistItem } from "@/types";

interface WishlistStore {
  items: WishlistItem[];
  toggleItem: (item: WishlistItem) => void;
  removeItem: (artworkId: string) => void;
  isInWishlist: (artworkId: string) => boolean;
  clearWishlist: () => void;
}

export const useWishlistStore = create<WishlistStore>()(
  persist(
    (set, get) => ({
      items: [],

      toggleItem: (item) => {
        const exists = get().items.some((i) => i.artworkId === item.artworkId);
        if (exists) {
          set({ items: get().items.filter((i) => i.artworkId !== item.artworkId) });
        } else {
          set({ items: [...get().items, item] });
        }
      },

      removeItem: (artworkId) => {
        set({ items: get().items.filter((i) => i.artworkId !== artworkId) });
      },

      isInWishlist: (artworkId) => get().items.some((i) => i.artworkId === artworkId),

      clearWishlist: () => set({ items: [] }),
    }),
    { name: "scriptovernovel-wishlist" }
  )
);
