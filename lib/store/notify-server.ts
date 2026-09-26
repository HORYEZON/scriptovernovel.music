// lib/store/notify-server.ts
//
// Server-only side of the stock alerts: recording a request, and sending the one
// email a request ever gets.
//
// The send is driven by the products write route noticing a product *become*
// available — see `notifyIfNowAvailable`. Nothing polls, and nothing fires off a
// date: a release date is a hope, and the alert has to mean "it's on the shelf",
// which only the admin flipping the switch can tell us.
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { isBuyable } from "@/lib/store/availability";
import { productTitle } from "@/lib/store/product-display";
import { sendBackInStockEmail } from "@/lib/mail";
import { SITE_URL } from "@/lib/site-url";

/**
 * Record a request, or leave an existing one alone.
 *
 * Deduped here rather than by a unique index because `variantId` is nullable and
 * Postgres treats NULLs as distinct — a unique on (productId, variantId, email)
 * would let every "any variant" request through twice.
 *
 * An already-notified row is *not* revived: they asked, they were told. If the
 * thing sold out again and they want telling again, that's a new request they
 * can make from the page, and this keeps a restock from re-mailing everyone who
 * was alerted months ago.
 */
export async function recordStockRequest(
  productId: string,
  variantId: string | null,
  email: string
): Promise<"added" | "already"> {
  const existing = await prisma.stockNotification.findFirst({
    where: { productId, variantId, email, notifiedAt: null },
    select: { id: true },
  });
  if (existing) return "already";
  await prisma.stockNotification.create({ data: { productId, variantId, email } });
  return "added";
}

/** How many people are waiting on each product — the admin's own read on
 *  whether a repress is worth it. Only rows not yet alerted. */
export async function waitingCounts(): Promise<Record<string, number>> {
  const rows = await prisma.stockNotification
    .groupBy({ by: ["productId"], where: { notifiedAt: null }, _count: { _all: true } })
    .catch(() => []);
  const out: Record<string, number> = {};
  for (const r of rows) out[r.productId] = r._count._all;
  return out;
}

const PRODUCT_FOR_ALERT = {
  id: true,
  title: true,
  slug: true,
  images: true,
  price: true,
  stock: true,
  comingSoon: true,
  available: true,
  deletedAt: true,
  artwork: { select: { title: true, imageUrl: true, slug: true } },
  variants: { select: { id: true, label: true, stock: true } },
} satisfies Prisma.ProductSelect;

/**
 * Send the alert to everyone waiting, if this product just became buyable.
 *
 * Called after a product write with the state from *before* it. Returns how many
 * were emailed. Never throws into the caller: an admin saving a product should
 * not see a failure because a mail server hiccuped, and the rows stay unnotified
 * so the next save tries again.
 */
export async function notifyIfNowAvailable(
  productId: string,
  wasBuyable: boolean
): Promise<number> {
  try {
    const product = await prisma.product.findUnique({ where: { id: productId }, select: PRODUCT_FOR_ALERT });
    // A product that has been hidden or trashed is not "available", whatever
    // its stock says.
    if (!product || !product.available || product.deletedAt) return 0;
    if (wasBuyable || !isBuyable(product)) return 0;

    const waiting = await prisma.stockNotification.findMany({
      where: { productId, notifiedAt: null },
      select: { id: true, email: true, variantId: true },
    });
    if (waiting.length === 0) return 0;

    const title = productTitle(product) ?? "Something you were waiting for";
    const href = product.slug ? `${SITE_URL}/shop/${product.slug}` : `${SITE_URL}/shop`;
    const image = product.images[0] ?? product.artwork?.imageUrl ?? null;
    const variantLabel = new Map(product.variants.map((v) => [v.id, v.label]));

    let sent = 0;
    for (const row of waiting) {
      // A request for one size only gets the alert when *that* size is back.
      if (row.variantId) {
        const variant = product.variants.find((v) => v.id === row.variantId);
        if (!variant || variant.stock <= 0) continue;
      }
      try {
        await sendBackInStockEmail(row.email, {
          title,
          url: href,
          imageUrl: image,
          price: product.price,
          variantLabel: row.variantId ? variantLabel.get(row.variantId) ?? null : null,
        });
        await prisma.stockNotification.update({ where: { id: row.id }, data: { notifiedAt: new Date() } });
        sent += 1;
      } catch {
        // Leave this row unnotified; the next save picks it up.
      }
    }
    return sent;
  } catch {
    return 0;
  }
}

export function revalidateStockAlertPaths() {
  revalidatePath("/admin/products");
}
