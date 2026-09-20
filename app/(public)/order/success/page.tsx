// app/(public)/order/success/page.tsx
import Link from "next/link";
import { CheckCircle } from "lucide-react";
import { AnimatedHeading } from "@/components/public/AnimatedHeading";
import { PlaySoundEffect } from "@/components/public/PlaySoundEffect";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Order Placed",
  description: "Your order was placed successfully.",
};

export default async function OrderSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const params = await searchParams;
  return (
    <div className="pt-24 pb-24">
      <PlaySoundEffect effectKey="payment.success" />
      <div className="section-padding">
        <div className="bg-black/30 dark:bg-black/45 rounded-2xl border border-white/5 shadow-2xl p-8 md:p-14">
          <div className="max-w-lg mx-auto text-center py-16">
            <CheckCircle
              size={56}
              strokeWidth={0.8}
              className="mx-auto text-emerald-400 mb-8"
            />
            <p className="font-body text-md tracking-[0.5em] uppercase text-sepia-light mb-3">
              Order Placed
            </p>
            <AnimatedHeading text="Confirmed" className="justify-center" />
            <div className="deco-line mt-6 mx-auto" />
            <p className="font-body text-sm text-white/70 leading-relaxed mt-8 mb-2">
              Thank you for your order. A confirmation will be sent to your
              email shortly.
            </p>
            <p className="font-body text-xs text-white/50 mb-10">
              Your order will be packed and shipped within 5–7
              business days.
            </p>
            {params.session_id && (
              <p className="font-jakarta text-xs text-white/40 mb-8">
                Ref: {params.session_id.slice(0, 20)}...
              </p>
            )}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/shop" className="btn-sepia">
                Continue Browsing
              </Link>
              <Link href="/" className="btn-sepia-outline">
                Return Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
