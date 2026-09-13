// app/(public)/checkout/page.tsx
import CheckoutClient from "./CheckoutClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Complete your purchase securely via PayMongo.",
};

export default function CheckoutPage() {
  return <CheckoutClient />;
}
