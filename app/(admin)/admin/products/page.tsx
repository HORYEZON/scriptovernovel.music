// app/(admin)/admin/products/page.tsx
import type { Metadata } from "next";
import { ShoppingBag } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminGoToMenu } from "@/components/admin/AdminGoToMenu";
import { getMuseumRoomStatus, museumEditorLink, museumRoomLink } from "@/lib/museum/roomStatus";
import { PRODUCT_ARTWORK_SELECT } from "@/lib/store/queries";
import { waitingCounts } from "@/lib/store/notify-server";
import { ProductsClient } from "./ProductsClient";

export const metadata: Metadata = { title: "Products" };
export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const [products, artworksWithoutProduct, museumRooms, waiting] = await Promise.all([
    prisma.product.findMany({
      where: { deletedAt: null },
      include: { artwork: PRODUCT_ARTWORK_SELECT, variants: { orderBy: { sortOrder: "asc" } } },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    }),
    // The "Create from artwork" shortcut — gallery pieces that don't have a
    // listing yet. Their products hang in the Museum's Services Room.
    prisma.artwork.findMany({
      where: { product: null, deletedAt: null },
      select: { id: true, title: true, imageUrl: true, description: true },
      orderBy: { title: "asc" },
    }),
    getMuseumRoomStatus(),
    waitingCounts(),
  ]);

  return (
    <div>
      <AdminPageHeader
        title="Products"
        description="Merch in the Store — shirts, records, posters — with photos, sizes and stock. A product created from an artwork also hangs in the Digital Museum's Services Room."
        action={
          <AdminGoToMenu
            icon={<ShoppingBag size={16} />}
            links={[
              { label: "Store", href: "/shop" },
              museumRoomLink(museumRooms, "services", "Digital Museum / Services Room"),
              museumEditorLink(museumRooms, "services", "Scene Editor / Services Room"),
            ]}
          />
        }
      />
      <ProductsClient
        initialProducts={JSON.parse(JSON.stringify(products))}
        artworksWithoutProduct={artworksWithoutProduct}
        waiting={waiting}
      />
    </div>
  );
}
