// app/(admin)/admin/products/page.tsx
import type { Metadata } from "next";
import { ShoppingBag } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminGoToMenu } from "@/components/admin/AdminGoToMenu";
import {
  getMuseumRoomStatus,
  museumEditorLink,
  museumRoomLink,
} from "@/lib/museum/roomStatus";
import { ProductsClient } from "./ProductsClient";

export const metadata: Metadata = { title: "Products" };
export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const [products, artworksWithoutProduct, museumRooms] = await Promise.all([
    prisma.product.findMany({
      where: { deletedAt: null },
      include: { artwork: true, variants: { orderBy: { sortOrder: "asc" } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.artwork.findMany({
      where: { product: null, deletedAt: null },
      orderBy: { title: "asc" },
    }),
    getMuseumRoomStatus(),
  ]);

  return (
    <div>
      <AdminPageHeader
        title="Products"
        description="Manage pricing and stock for the artworks listed in the Shop and the Digital Museum's Services Room."
        action={
          <AdminGoToMenu
            icon={<ShoppingBag size={16} />}
            links={[
              { label: "Shop Page", href: "/shop" },
              museumRoomLink(museumRooms, "services", "Digital Museum / Services Room"),
              museumEditorLink(museumRooms, "services", "Scene Editor / Services Room"),
            ]}
          />
        }
      />
      <ProductsClient
        initialProducts={products}
        artworksWithoutProduct={artworksWithoutProduct}
      />
    </div>
  );
}
