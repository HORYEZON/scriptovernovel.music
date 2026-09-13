// app/api/products/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { logContentChange } from "@/lib/activity-log-server";
import { prisma } from "@/lib/prisma";
import { getErrorCode } from "@/lib/utils";

type VariantInput = { label?: string; price?: number | string; stock?: number | string };

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      where: { deletedAt: null },
      include: { artwork: true, variants: { orderBy: { sortOrder: "asc" } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(products);
  } catch {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { artworkId, price, stock, variants } = await request.json();

    if (!artworkId || price === undefined) {
      return NextResponse.json({ error: "artworkId and price are required" }, { status: 400 });
    }

    const validVariants = Array.isArray(variants)
      ? variants.filter((v: VariantInput) => v.label?.trim() && v.price !== undefined && v.price !== "")
      : [];

    const product = await prisma.product.create({
      data: {
        artworkId,
        price: parseFloat(price),
        stock: parseInt(stock) || 1,
        available: true,
        ...(validVariants.length > 0 && {
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

    logContentChange("created", "product", { id: product.id, name: product.artwork?.title }, { request });

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    if (getErrorCode(error) === "P2002") {
      return NextResponse.json({ error: "Product already exists for this artwork" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create" }, { status: 500 });
  }
}
