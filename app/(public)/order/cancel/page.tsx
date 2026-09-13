// app/(public)/order/cancel/page.tsx
import Link from "next/link";
import { XCircle } from "lucide-react";
import { AnimatedHeading } from "@/components/public/AnimatedHeading";
import { PlaySoundEffect } from "@/components/public/PlaySoundEffect";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Payment Cancelled",
  description: "Your payment was cancelled.",
};

export default function OrderCancelPage() {
  return (
    <div className="pt-24 pb-24">
      <PlaySoundEffect effectKey="payment.error" />
      <div className="section-padding">
        <div className="bg-black/30 dark:bg-black/45 rounded-2xl border border-white/5 shadow-2xl p-8 md:p-14">
          <div className="max-w-lg mx-auto text-center py-16">
            <XCircle
              size={56}
              strokeWidth={0.8}
              className="mx-auto text-vermillion mb-8"
            />
            <p className="font-body text-md tracking-[0.5em] uppercase text-sepia-light mb-3">
              Payment Cancelled
            </p>
            <AnimatedHeading text="Cancelled" className="justify-center" />
            <div className="deco-line mt-6 mx-auto" />
            <p className="font-body text-sm text-white/70 leading-relaxed mt-8 mb-10">
              Your payment was cancelled. Your cart items are still saved if
              you&apos;d like to try again.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/checkout" className="btn-sepia">
                Try Again
              </Link>
              <Link href="/cart" className="btn-sepia-outline">
                Back to Cart
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
