// app/(public)/wishlist/page.tsx
import WishlistClient from "./WishlistClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Wishlist",
  description: "Artworks you've saved to revisit later.",
};

export default function WishlistPage() {
  return <WishlistClient />;
}
