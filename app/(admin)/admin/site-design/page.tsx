// app/(admin)/admin/site-design/page.tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { getSiteDesign } from "@/lib/site-design-server";
import { getSocialLinks } from "@/lib/public-data";
import { SiteDesignClient } from "./SiteDesignClient";

export const metadata: Metadata = { title: "Site Design" };
export const dynamic = "force-dynamic";

export default async function AdminSiteDesignPage() {
  const [{ settings, menuItems }, socialLinks] = await Promise.all([
    getSiteDesign(),
    getSocialLinks().catch(() => []),
  ]);

  return (
    <div>
      <AdminPageHeader
        title="Site Design"
        description="The public site's header, the full-screen menu it opens, and the homepage hero — fonts, colours, sizes and images."
      />
      {/* SiteDesignClient reads ?tab= via useSearchParams, which needs a
          Suspense boundary above it on a dynamic route. */}
      <Suspense fallback={null}>
        <SiteDesignClient
          initialSettings={settings}
          initialMenuItems={menuItems}
          socialLinks={socialLinks.map(({ label, url, iconKey, hoverColor }) => ({ label, url, iconKey, hoverColor }))}
        />
      </Suspense>
    </div>
  );
}
