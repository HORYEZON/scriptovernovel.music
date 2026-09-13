// app/(public)/cart/page.tsx
import CartClient from "./CartClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cart",
  description: "Review the artworks in your cart before checkout.",
};

export default function CartPage() {
  return <CartClient />;
}
