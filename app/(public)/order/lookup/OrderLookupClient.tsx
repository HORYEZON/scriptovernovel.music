// app/(public)/order/lookup/OrderLookupClient.tsx
"use client";

import { orderItemTitle, orderItemImageOrPlaceholder } from "@/lib/orders/item-display";
import { useState } from "react";
import Image from "@/components/ui/SafeImage";
import { Search, MapPin, Phone, StickyNote, PackageSearch } from "lucide-react";
import { formatPrice, formatDate, ORDER_STATUS_COLORS, getErrorMessage } from "@/lib/utils";
import toast from "@/lib/toast";
import { imageVariantUrl } from "@/lib/images/variants";

interface LookupOrderItem {
  id: string;
  quantity: number;
  price: number;
  variantLabel: string | null;
  /** Null once the product was permanently deleted — see lib/orders/item-display.ts. */
  product: {
    title?: string | null;
    images?: string[];
    artwork: { title: string; imageUrl: string } | null;
  } | null;
  titleSnapshot?: string | null;
  imageSnapshot?: string | null;
}

interface LookupOrder {
  id: string;
  status: keyof typeof ORDER_STATUS_COLORS;
  total: number;
  paymongoRef: string | null;
  shippingAddress: string | null;
  shippingPhone: string | null;
  deliveryNotes: string | null;
  items: LookupOrderItem[];
  createdAt: string;
}

const inputCls =
  "w-full bg-black/30 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 rounded-md px-4 py-3 font-body text-sm transition-colors duration-200";
const labelCls = "block font-body text-xs tracking-widest uppercase text-white/50 mb-2";

export function OrderLookupClient() {
  const [email, setEmail] = useState("");
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<LookupOrder | null>(null);

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !reference) {
      toast.error("Please fill in both fields");
      return;
    }

    setLoading(true);
    setOrder(null);
    try {
      const res = await fetch("/api/orders/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, reference: reference.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Order not found");
      setOrder(data);
    } catch (err) {
      toast.error(getErrorMessage(err, "Something went wrong"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <form onSubmit={handleLookup} className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className={labelCls}>Email Address</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputCls}
            placeholder="email@domain.com"
          />
        </div>
        <div>
          <label className={labelCls}>Order Reference</label>
          <input
            type="text"
            required
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            className={inputCls}
            placeholder="e.g. KAL-XXXXXXXX-XXXXXXXX"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="btn-sepia sm:col-span-2 justify-self-start"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-zinc-900/30 border-t-zinc-900 rounded-full animate-spin" />
          ) : (
            <Search size={16} strokeWidth={1.5} />
          )}
          Check Status
        </button>
      </form>

      {order && (
        <div className="mt-12 pt-10 border-t border-white/10">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
            <div>
              <p className="font-body text-xs text-white/40 uppercase tracking-widest mb-1">
                {order.paymongoRef || order.id}
              </p>
              <p className="font-body text-xs text-white/40">
                Placed {formatDate(order.createdAt)}
              </p>
            </div>
            <span
              className={`font-body text-xs font-medium tracking-widest uppercase px-3 py-1.5 rounded-md ${ORDER_STATUS_COLORS[order.status]}`}
            >
              {order.status}
            </span>
          </div>

          <div className="space-y-4">
            {order.items.map((item) => (
              <div key={item.id} className="flex gap-4 pb-4 border-b border-white/10">
                <div className="relative w-16 h-20 bg-white/5 rounded-md overflow-hidden shrink-0">
                  <Image
                    src={imageVariantUrl(orderItemImageOrPlaceholder(item), "thumb")}
                    alt={orderItemTitle(item)}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="flex-1">
                  <h3 className="font-display text-lg font-light italic text-white">
                    {orderItemTitle(item)}
                  </h3>
                  {item.variantLabel && (
                    <p className="font-body text-xs text-sepia-light/80 mt-0.5">
                      {item.variantLabel}
                    </p>
                  )}
                  <p className="font-body text-xs text-white/40 mt-1">Qty: {item.quantity}</p>
                  <p className="font-jakarta text-sm text-white/70 mt-1">
                    {formatPrice(item.price * item.quantity)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center mt-4 mb-8">
            <span className="font-body text-xs uppercase tracking-widest text-white/50">
              Total
            </span>
            <span className="font-jakarta text-xl font-medium text-sepia-light">
              {formatPrice(order.total)}
            </span>
          </div>

          {(order.shippingAddress || order.shippingPhone) && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-3">
              <p className="font-body text-xs tracking-widest uppercase text-white/50 mb-1">
                Shipping To
              </p>
              {order.shippingAddress && (
                <div className="flex items-start gap-2.5">
                  <MapPin size={14} className="text-white/40 mt-0.5 shrink-0" />
                  <p className="font-body text-sm text-white/80 whitespace-pre-line">
                    {order.shippingAddress}
                  </p>
                </div>
              )}
              {order.shippingPhone && (
                <div className="flex items-center gap-2.5">
                  <Phone size={14} className="text-white/40 shrink-0" />
                  <p className="font-body text-sm text-white/80">{order.shippingPhone}</p>
                </div>
              )}
              {order.deliveryNotes && (
                <div className="flex items-start gap-2.5">
                  <StickyNote size={14} className="text-white/40 mt-0.5 shrink-0" />
                  <p className="font-body text-xs text-white/50 whitespace-pre-line">
                    {order.deliveryNotes}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {!order && !loading && (
        <div className="mt-12 pt-10 border-t border-white/10 text-center">
          <PackageSearch size={40} strokeWidth={1} className="mx-auto text-white/20 mb-4" />
          <p className="font-body text-sm text-white/40">
            Enter your details above to check your order status.
          </p>
        </div>
      )}
    </div>
  );
}
