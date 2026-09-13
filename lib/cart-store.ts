// lib/cart-store.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CartItem } from "@/types";

// A cart line is identified by product + variant together, not product
// alone — the same artwork can appear twice in the cart as two different
// sizes. Pass variantId explicitly (undefined/null both mean "no variant")
// so callers can't accidentally collapse two distinct lines.
function matchesLine(item: CartItem, productId: string, variantId?: string | null) {
  return item.productId === productId && (item.variantId ?? null) === (variantId ?? null);
}

interface CartStore {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity">) => void;
  removeItem: (productId: string, variantId?: string | null) => void;
  updateQuantity: (productId: string, quantity: number, variantId?: string | null) => void;
  clearCart: () => void;
  totalItems: () => number;
  totalPrice: () => number;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item) => {
        const existing = get().items.find((i) => matchesLine(i, item.productId, item.variantId));
        if (existing) {
          set({
            items: get().items.map((i) =>
              matchesLine(i, item.productId, item.variantId)
                ? { ...i, quantity: Math.min(i.quantity + 1, i.stock) }
                : i
            ),
          });
        } else {
          set({ items: [...get().items, { ...item, quantity: 1 }] });
        }
      },

      removeItem: (productId, variantId) => {
        set({ items: get().items.filter((i) => !matchesLine(i, productId, variantId)) });
      },

      updateQuantity: (productId, quantity, variantId) => {
        if (quantity < 1) {
          get().removeItem(productId, variantId);
          return;
        }
        set({
          items: get().items.map((i) =>
            matchesLine(i, productId, variantId) ? { ...i, quantity } : i
          ),
        });
      },

      clearCart: () => set({ items: [] }),

      totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),

      totalPrice: () =>
        get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
    }),
    { name: "scriptovernovel-cart" }
  )
);
