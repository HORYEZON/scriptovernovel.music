// lib/store/revalidate.ts — every page a product shows on.
import { revalidatePath } from "next/cache";

export function revalidateStorePaths() {
  revalidatePath("/", "layout");
  revalidatePath("/shop");
  revalidatePath("/admin/products");
}
