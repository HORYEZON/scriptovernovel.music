// app/api/products/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { logContentChange, changedFields } from "@/lib/activity-log-server";
import { prisma } from "@/lib/prisma";
import { getErrorCode } from "@/lib/utils";

type VariantInput = { label?: string; price?: number | string; stock?: number | string };

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id } = await params;
    const { price, stock, available, variants } = await request.json();

    // Variant list is treated as a full replace when sent — simpler than
    // diffing against what's stored, at the cost of variant ids changing on
    // every edit. Fine here: OrderItem keeps its own variantLabel snapshot
    // and variantId SetNulls on delete, so past orders are unaffected.
    const validVariants = Array.isArray(variants)
      ? variants.filter((v: VariantInput) => v.label?.trim() && v.price !== undefined && v.price !== "")
      : null;

    const product = await prisma.$transaction(async (tx) => {
      if (validVariants !== null) {
        await tx.productVariant.deleteMany({ where: { productId: id } });
      }
      return tx.product.update({
        where: { id },
        data: {
          ...(price !== undefined && { price: parseFloat(price) }),
          ...(stock !== undefined && { stock: parseInt(stock) }),
          ...(available !== undefined && { available }),
          ...(validVariants !== null &&
            validVariants.length > 0 && {
              variants: {
                create: validVariants.map((v: VariantInput, i: number) => ({
                  label: v.label!.trim(),
                  price: parseFloat(String(v.price)),
                  stock: parseInt(String(v.stock)) || 0,
                  sortOrder: i,
                })),
              },
            }),
        },
        include: { artwork: true, variants: { orderBy: { sortOrder: "asc" } } },
      });
    });

    logContentChange("updated", "product", { id: product.id, name: product.artwork?.title }, {
      request,
      // This route destructures the body straight into locals rather than
      // keeping it around, so the changed-field list is built from those.
      changed: changedFields({ price, stock, available, variants }, [
        "price", "stock", "available", "variants",
      ]),
    });

    return NextResponse.json(product);
  } catch (error) {
    if (getErrorCode(error) === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id } = await params;

    const deleted = await prisma.product.update({
      where: { id },
      data: { deletedAt: new Date() },
      include: { artwork: { select: { title: true } } },
    });

    logContentChange("deleted", "product", { id, name: deleted.artwork?.title }, { request });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (getErrorCode(error) === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
