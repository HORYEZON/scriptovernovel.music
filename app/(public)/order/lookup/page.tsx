// app/(public)/order/lookup/page.tsx
import { AnimatedHeading } from "@/components/public/AnimatedHeading";
import { OrderLookupClient } from "./OrderLookupClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Track Your Order",
  description: "Check the status of your ScriptOverNovel Music order.",
};

export default function OrderLookupPage() {
  return (
    <div className="pt-24 pb-24">
      <div className="section-padding">
        <div className="bg-black/30 dark:bg-black/45 rounded-2xl border border-white/5 shadow-2xl p-8 md:p-14">
          <div className="mb-12 max-w-lg">
            <p className="font-body text-md tracking-[0.5em] uppercase text-sepia-light mb-3">
              Order Status
            </p>
            <AnimatedHeading text="Track Order" />
            <p className="font-body text-sm text-white/60 max-w-lg mt-4 leading-relaxed">
              Enter the email you checked out with and your order reference
              number (from your confirmation email) to check its status.
            </p>
            <div className="deco-line mt-6" />
          </div>

          <OrderLookupClient />
        </div>
      </div>
    </div>
  );
}
