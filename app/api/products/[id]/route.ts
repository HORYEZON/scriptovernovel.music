// app/api/products/[id]/route.ts — partial update and soft delete.
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/api-auth";
import { logContentChange, changedFields } from "@/lib/activity-log-server";
import { prisma } from "@/lib/prisma";
import { getErrorCode } from "@/lib/utils";
import { productTitle } from "@/lib/store/product-display";
import { PRODUCT_ARTWORK_SELECT } from "@/lib/store/queries";
import { parseVariants, sanitizeMerchFields } from "@/lib/store/sanitize";
import { revalidateStorePaths } from "@/lib/store/revalidate";
import { isBuyable } from "@/lib/store/availability";
import { notifyIfNowAvailable } from "@/lib/store/notify-server";

const EDITABLE = ["title", "description", "images", "category", "featured", "price", "stock", "available", "variants", "sortOrder", "comingSoon", "releaseAt"];

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id } = await params;
    const body = await request.json();
    const { price, stock, available, variants, sortOrder, comingSoon, releaseAt } = body;
    const merch = sanitizeMerchFields(body);
    if ("error" in merch) return NextResponse.json({ error: merch.error }, { status: 400 });
    if (price !== undefined && !Number.isFinite(parseFloat(price))) return NextResponse.json({ error: "Invalid price" }, { status: 400 });
    if (stock !== undefined && !Number.isFinite(parseInt(stock))) return NextResponse.json({ error: "Invalid stock" }, { status: 400 });
    if (available !== undefined && typeof available !== "boolean") return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    if (sortOrder !== undefined && !Number.isInteger(sortOrder)) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    if (comingSoon !== undefined && typeof comingSoon !== "boolean") return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    let releaseAtValue: Date | null | undefined;
    if (releaseAt !== undefined) {
      if (releaseAt === null || releaseAt === "") releaseAtValue = null;
      else {
        const d = new Date(releaseAt);
        if (Number.isNaN(d.getTime())) return NextResponse.json({ error: "Invalid release date" }, { status: 400 });
        releaseAtValue = d;
      }
    }

    // Read the state *before* the write: the stock alert fires on a product
    // becoming buyable, which can only be told by comparing the two. Variants
    // included, since a product with variants takes its stock from them.
    const before = await prisma.product.findUnique({
      where: { id },
      select: { stock: true, comingSoon: true, available: true, variants: { select: { stock: true } } },
    });
    const wasBuyable = before ? isBuyable(before) : false;

    // Variant list is treated as a full replace when sent — simpler than
    // diffing against what's stored, at the cost of variant ids changing on
    // every edit. Fine here: OrderItem keeps its own variantLabel snapshot
    // and variantId SetNulls on delete, so past orders are unaffected.
    const validVariants = parseVariants(variants);

    const product = await prisma.$transaction(async (tx) => {
      if (validVariants !== null) await tx.productVariant.deleteMany({ where: { productId: id } });
      return tx.product.update({
        where: { id },
        data: {
          ...merch.data,
          ...(price !== undefined && { price: Math.max(0, parseFloat(price)) }),
          ...(stock !== undefined && { stock: Math.max(0, parseInt(stock)) }),
          ...(available !== undefined && { available }),
          ...(sortOrder !== undefined && { sortOrder }),
          ...(comingSoon !== undefined && { comingSoon }),
          ...(releaseAtValue !== undefined && { releaseAt: releaseAtValue }),
          ...(validVariants !== null && validVariants.length > 0 && { variants: { create: validVariants } }),
        },
        include: { artwork: PRODUCT_ARTWORK_SELECT, variants: { orderBy: { sortOrder: "asc" } } },
      });
    });

    revalidateStorePaths();
    if (product.slug) revalidatePath(`/shop/${product.slug}`);

    // Anyone waiting on this hears about it now. Awaited rather than
    // fire-and-forget so the admin's toast can say how many were told, and
    // written so a mail failure leaves the rows unnotified for the next save
    // rather than failing this one.
    const notified = await notifyIfNowAvailable(product.id, wasBuyable);

    logContentChange("updated", "product", { id: product.id, name: productTitle(product) }, { request, changed: changedFields(body, EDITABLE) });
    return NextResponse.json({ ...product, notifiedCount: notified });
  } catch (error) {
    if (getErrorCode(error) === "P2025") return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const { id } = await params;
    const deleted = await prisma.product.update({
      where: { id },
      data: { deletedAt: new Date() },
      include: { artwork: { select: { title: true, imageUrl: true } } },
    });
    revalidateStorePaths();
    revalidatePath("/admin/trash");
    logContentChange("deleted", "product", { id, name: productTitle(deleted) }, { request });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (getErrorCode(error) === "P2025") return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
