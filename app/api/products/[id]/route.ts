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

const EDITABLE = ["title", "description", "images", "category", "featured", "price", "stock", "available", "variants", "sortOrder"];

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id } = await params;
    const body = await request.json();
    const { price, stock, available, variants, sortOrder } = body;
    const merch = sanitizeMerchFields(body);
    if ("error" in merch) return NextResponse.json({ error: merch.error }, { status: 400 });
    if (price !== undefined && !Number.isFinite(parseFloat(price))) return NextResponse.json({ error: "Invalid price" }, { status: 400 });
    if (stock !== undefined && !Number.isFinite(parseInt(stock))) return NextResponse.json({ error: "Invalid stock" }, { status: 400 });
    if (available !== undefined && typeof available !== "boolean") return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    if (sortOrder !== undefined && !Number.isInteger(sortOrder)) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

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
          ...(validVariants !== null && validVariants.length > 0 && { variants: { create: validVariants } }),
        },
        include: { artwork: PRODUCT_ARTWORK_SELECT, variants: { orderBy: { sortOrder: "asc" } } },
      });
    });

    revalidateStorePaths();
    if (product.slug) revalidatePath(`/shop/${product.slug}`);
    logContentChange("updated", "product", { id: product.id, name: productTitle(product) }, { request, changed: changedFields(body, EDITABLE) });
    return NextResponse.json(product);
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
