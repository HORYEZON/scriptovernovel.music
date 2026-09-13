// app/(admin)/admin/sections/page.tsx
//
// Sections moved into the Artworks module as a tab (ArtworksTabs.tsx). This
// route is kept only so old links / bookmarks / revalidatePath("/admin/sections")
// calls still resolve — it just forwards to the tab.
import { redirect } from "next/navigation";

export default function AdminSectionsPage() {
  redirect("/admin/artworks?tab=sections");
}
