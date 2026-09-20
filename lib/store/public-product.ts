// lib/store/public-product.ts — the shape the Store's public pages and the
// cart hand around, already resolved through product-display so a client
// component never touches `artwork` directly. Client-safe type; the
// `toPublicProduct` mapper is used by server pages.
import { productDescription, productHref, productImages, productTitle, type ProductDisplayLike } from "@/lib/store/product-display";

export interface PublicProductVariant {
  id: string;
  label: string;
  price: number;
  stock: number;
}

export interface PublicProduct {
  id: string;
  slug: string | null;
  title: string;
  description: string | null;
  images: string[];
  category: string | null;
  featured: boolean;
  price: number;
  stock: number;
  available: boolean;
  variants: PublicProductVariant[];
  /** Where the product's own page is (or the artwork page for a legacy row). */
  href: string;
  /** Set for gallery-era products — lets the wishlist keep working for them. */
  artworkId: string | null;
}

type ProductRowLike = ProductDisplayLike & {
  id: string;
  slug: string | null;
  category: string | null;
  featured: boolean;
  price: number;
  stock: number;
  available: boolean;
  artworkId: string | null;
  variants: { id: string; label: string; price: number; stock: number }[];
};

export function toPublicProduct(p: ProductRowLike): PublicProduct | null {
  const title = productTitle(p);
  if (!title) return null;
  return {
    id: p.id,
    slug: p.slug,
    title,
    description: productDescription(p),
    images: productImages(p),
    category: p.category,
    featured: p.featured,
    price: p.price,
    stock: p.stock,
    available: p.available,
    variants: p.variants.map((v) => ({ id: v.id, label: v.label, price: v.price, stock: v.stock })),
    href: productHref(p),
    artworkId: p.artworkId,
  };
}
