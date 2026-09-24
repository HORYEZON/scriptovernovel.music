// app/(admin)/admin/site-design/page.tsx
//
// Site Design used to be its own admin module. Its Header / Menu / Homepage
// Hero sections now lead Settings → Preferences' tab bar (PreferencesClient
// renders SiteDesignClient there); this route only forwards old bookmarks and
// links, keeping the section they pointed at.
import { redirect } from "next/navigation";

export default async function AdminSiteDesignPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const section = tab === "menu" || tab === "hero" ? tab : "header";
  redirect(`/admin/settings/Preferences?tab=${section}`);
}
