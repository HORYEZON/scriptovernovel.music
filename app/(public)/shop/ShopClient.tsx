"use client";

// app/(public)/shop/ShopClient.tsx — the Store grid with a category filter
// and simple paging. Cards link to product pages; buying happens there.
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Reveal } from "@/components/public/system/Reveal";
import { ProductCard } from "@/components/public/store/ProductCard";
import { PRODUCT_CATEGORIES } from "@/lib/store/categories";
import type { PublicProduct } from "@/lib/store/public-product";

const PAGE_SIZE = 12;

export function ShopClient({ products }: { products: PublicProduct[] }) {
  const [category, setCategory] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const present = useMemo(() => new Set(products.map((p) => p.category ?? "other")), [products]);
  const shown = useMemo(
    () => (category === "ALL" ? products : products.filter((p) => (p.category ?? "other") === category)),
    [products, category]
  );
  const pages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const slice = shown.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (products.length === 0) {
    return (
      <div className="section-padding mt-16">
        <p className="font-body text-sm text-cream/60">Nothing in the store yet — merch is on the way.</p>
      </div>
    );
  }

  return (
    <div className="section-padding mt-12 md:mt-16">
      {present.size > 1 && (
        <div className="mb-10 flex flex-wrap gap-2">
          {["ALL", ...PRODUCT_CATEGORIES.filter((c) => present.has(c.value)).map((c) => c.value)].map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                setCategory(c);
                setPage(1);
              }}
              className={cn(
                "rounded-full border px-4 py-1.5 font-body text-[11px] uppercase tracking-[0.2em] transition-colors",
                category === c ? "border-cream/70 bg-cream/10 text-cream" : "border-cream/15 text-cream/60 hover:border-cream/40 hover:text-cream"
              )}
            >
              {c === "ALL" ? "All" : PRODUCT_CATEGORIES.find((x) => x.value === c)?.label}
            </button>
          ))}
        </div>
      )}
      <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 lg:grid-cols-4">
        {slice.map((p, i) => (
          <Reveal as="li" key={p.id} delayMs={(i % 4) * 60}>
            <ProductCard product={p} />
          </Reveal>
        ))}
      </ul>
      {pages > 1 && (
        <div className="mt-12 flex items-center justify-center gap-2">
          {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setPage(n)}
              aria-current={n === page ? "page" : undefined}
              className={cn(
                "h-9 w-9 rounded-full border font-body text-xs transition-colors",
                n === page ? "border-cream/70 bg-cream/10 text-cream" : "border-cream/15 text-cream/60 hover:border-cream/40"
              )}
            >
              {n}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
