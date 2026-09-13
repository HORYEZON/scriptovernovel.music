// app/(public)/checkout/CheckoutClient.tsx
"use client";

import { useState, useEffect } from "react";
import Image from "@/components/ui/SafeImage";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/lib/cart-store";
import { formatPrice, getErrorMessage } from "@/lib/utils";
import { CreditCard, Smartphone, Lock, QrCode } from "lucide-react";
import toast from "@/lib/toast";
import { AnimatedHeading } from "@/components/public/AnimatedHeading";
import { ImagePreviewModal, type PreviewImage } from "@/components/public/ImagePreviewModal";
import { imageVariantUrl } from "@/lib/images/variants";

export default function CheckoutClient() {
  const router = useRouter();
  const { items, totalPrice, clearCart } = useCartStore();
  const [loading, setLoading] = useState(false);
  const [previewImage, setPreviewImage] = useState<PreviewImage | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    address: "",
    phone: "",
    notes: "",
  });

  useEffect(() => {
    if (items.length === 0) {
      router.push("/cart");
    }
  }, [items.length, router]);

  if (items.length === 0) {
    return null;
  }

  async function handleCheckout() {
    if (!form.name || !form.email) {
      toast.error("Please fill in your name and email");
      return;
    }
    if (!form.address || !form.phone) {
      toast.error("Please fill in your shipping address and phone number");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: form.name,
          customerEmail: form.email,
          shippingAddress: form.address,
          shippingPhone: form.phone,
          deliveryNotes: form.notes,
          items: items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            variantLabel: item.variantLabel,
            quantity: item.quantity,
            price: item.price,
            title: item.title,
            imageUrl: item.imageUrl,
          })),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Checkout failed");
      }

      // Redirect to PayMongo checkout
      if (data.checkoutUrl) {
        clearCart();
        window.location.href = data.checkoutUrl;
      }
    } catch (err) {
      toast.error(getErrorMessage(err, "Something went wrong"));
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    "w-full bg-black/30 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 rounded-md px-4 py-3 font-body text-sm transition-colors duration-200";
  const labelCls =
    "block font-body text-xs tracking-widest uppercase text-white/50 mb-2";

  return (
    <div className="pt-24 pb-24">
      <div className="section-padding">
        <div className="bg-black/30 dark:bg-black/45 rounded-2xl border border-white/5 shadow-2xl p-8 md:p-14">
          {/* Header */}
          <div className="mb-16">
            <p className="font-body text-md tracking-[0.5em] uppercase text-sepia-light mb-3">
              Final Step
            </p>
            <AnimatedHeading text="Checkout" />
            <div className="deco-line mt-6" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Customer Details */}
            <div>
              <h2 className="font-body text-xs tracking-widest uppercase text-white/50 mb-6">
                Your Details
              </h2>
              <div className="space-y-5">
                <div>
                  <label className={labelCls}>Full Name</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className={inputCls}
                    placeholder="Your Name"
                  />
                </div>
                <div>
                  <label className={labelCls}>Email Address</label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className={inputCls}
                    placeholder="email@domain.com"
                  />
                  <p className="font-body text-xs text-white/40 mt-2">
                    Order confirmation will be sent to this email.
                  </p>
                </div>
                <div>
                  <label className={labelCls}>Shipping Address</label>
                  <textarea
                    required
                    rows={3}
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    className={`${inputCls} resize-none`}
                    placeholder="House/unit no., street, barangay, city, province, ZIP"
                  />
                </div>
                <div>
                  <label className={labelCls}>Phone Number</label>
                  <input
                    type="tel"
                    required
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className={inputCls}
                    placeholder="09XX XXX XXXX"
                  />
                </div>
                <div>
                  <label className={labelCls}>
                    Delivery Notes{" "}
                    <span className="normal-case tracking-normal text-white/30">
                      (optional)
                    </span>
                  </label>
                  <textarea
                    rows={2}
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className={`${inputCls} resize-none`}
                    placeholder="Landmark, preferred delivery time, etc."
                  />
                </div>
              </div>

              {/* Payment Methods */}
              <div className="mt-10">
                <h2 className="font-body text-xs tracking-widest uppercase text-white/50 mb-4">
                  Payment via PayMongo
                </h2>
                <div className="flex flex-wrap gap-3">
                  <div className="flex items-center gap-2 border border-white/15 text-white/70 px-4 py-3 flex-1 min-w-[9rem]">
                    <Smartphone size={16} className="text-sepia-light" />
                    <span className="font-body text-sm">GCash</span>
                  </div>
                  <div className="flex items-center gap-2 border border-white/15 text-white/70 px-4 py-3 flex-1 min-w-[9rem]">
                    <QrCode size={16} className="text-sepia-light" />
                    <span className="font-body text-sm">QR Ph</span>
                  </div>
                  <div className="flex items-center gap-2 border border-white/15 text-white/70 px-4 py-3 flex-1 min-w-[9rem]">
                    <CreditCard size={16} className="text-sepia-light" />
                    <span className="font-body text-sm">Card</span>
                  </div>
                </div>
                <p className="font-body text-xs text-white/40 mt-3 flex items-center gap-1.5">
                  <Lock size={12} />
                  You&apos;ll be securely redirected to PayMongo to complete payment.
                </p>
              </div>

              <button
                onClick={handleCheckout}
                disabled={loading}
                className="btn-sepia w-full mt-8"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-zinc-900/30 border-t-zinc-900 rounded-full animate-spin" />
                    Creating order...
                  </>
                ) : (
                  <>Pay {formatPrice(totalPrice())}</>
                )}
              </button>
            </div>

            {/* Order Summary */}
            <div>
              <h2 className="font-body text-xs tracking-widest uppercase text-white/50 mb-6">
                Order Review
              </h2>
              <div className="space-y-4">
                {items.map((item) => (
                  <div
                    key={`${item.productId}:${item.variantId ?? ""}`}
                    className="flex gap-4 pb-4 border-b border-white/10"
                  >
                    <div
                      className="relative w-20 h-24 bg-white/5 rounded-md overflow-hidden shrink-0 cursor-zoom-in"
                      onClick={() =>
                        setPreviewImage({ src: item.imageUrl, alt: item.title })
                      }
                    >
                      <Image
                        src={imageVariantUrl(item.imageUrl, "thumb")}
                        alt={item.title}
                        fill
                        className="object-cover transition-transform duration-300 hover:scale-105"
                      />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-display text-lg font-light italic text-white">
                        {item.title}
                      </h3>
                      {item.variantLabel && (
                        <p className="font-body text-xs text-sepia-light/80 mt-0.5">
                          {item.variantLabel}
                        </p>
                      )}
                      <p className="font-body text-xs text-white/40 mt-1">
                        Qty: {item.quantity}
                      </p>
                      <p className="font-jakarta text-sm text-white/70 mt-2">
                        {formatPrice(item.price * item.quantity)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 pt-4 border-t border-white/10 flex justify-between items-center">
                <span className="font-body text-xs uppercase tracking-widest text-white/50">
                  Total
                </span>
                <span className="font-jakarta text-2xl font-medium text-sepia-light">
                  {formatPrice(totalPrice())}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ImagePreviewModal image={previewImage} onClose={() => setPreviewImage(null)} />
    </div>
  );
}
