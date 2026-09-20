// app/api/products/route.ts — Store products: public list + admin create.
//
// A product is merch with its own title / description / images / category
// (lib/store/sanitize.ts). `artworkId` is the gallery-era shortcut — create
// from an artwork and the product borrows its title and image until given
// its own (lib/store/product-display.ts). One or the other is required.
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { logContentChange } from "@/lib/activity-log-server";
import { prisma } from "@/lib/prisma";
import { getErrorCode, slugify } from "@/lib/utils";
import { productTitle } from "@/lib/store/product-display";
import { PRODUCT_ARTWORK_SELECT } from "@/lib/store/queries";
import { parseVariants, sanitizeMerchFields } from "@/lib/store/sanitize";
import { revalidateStorePaths } from "@/lib/store/revalidate";

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      where: { deletedAt: null },
      include: { artwork: PRODUCT_ARTWORK_SELECT, variants: { orderBy: { sortOrder: "asc" } } },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
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
    const body = await request.json();
    const { artworkId, price, stock, variants, available } = body;
    const merch = sanitizeMerchFields(body);
    if ("error" in merch) return NextResponse.json({ error: merch.error }, { status: 400 });

    if (price === undefined || price === "" || !Number.isFinite(parseFloat(price))) {
      return NextResponse.json({ error: "A price is required." }, { status: 400 });
    }
    if (!merch.data.title && !artworkId) {
      return NextResponse.json({ error: "Give the product a title (or create it from an artwork)." }, { status: 400 });
    }
    if (artworkId !== undefined && artworkId !== null) {
      if (typeof artworkId !== "string" || !(await prisma.artwork.findFirst({ where: { id: artworkId, deletedAt: null }, select: { id: true } }))) {
        return NextResponse.json({ error: "That artwork doesn't exist." }, { status: 400 });
      }
    }

    const seed = merch.data.title ?? (artworkId ? (await prisma.artwork.findUnique({ where: { id: artworkId }, select: { title: true } }))?.title : null) ?? "item";
    let slug = slugify(seed) || "item";
    if (await prisma.product.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString(36)}`;
    const maxOrder = await prisma.product.aggregate({ _max: { sortOrder: true } });
    const validVariants = parseVariants(variants) ?? [];

    const product = await prisma.product.create({
      data: {
        ...merch.data,
        artworkId: artworkId ?? null,
        slug,
        price: Math.max(0, parseFloat(price)),
        stock: Math.max(0, parseInt(stock) || 0) || (validVariants.length ? 0 : 1),
        available: available !== false,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
        ...(validVariants.length > 0 && { variants: { create: validVariants } }),
      },
      include: { artwork: PRODUCT_ARTWORK_SELECT, variants: { orderBy: { sortOrder: "asc" } } },
    });

    revalidateStorePaths();
    logContentChange("created", "product", { id: product.id, name: productTitle(product) }, { request });
    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    if (getErrorCode(error) === "P2002") {
      return NextResponse.json({ error: "A product already exists for this artwork" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create" }, { status: 500 });
  }
}
