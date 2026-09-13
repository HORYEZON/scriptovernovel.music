// app/(admin)/admin/settings/maintenance/page.tsx
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { MaintenanceClient } from "./MaintenanceClient";

export const metadata: Metadata = { title: "Maintenance Mode" };

export const dynamic = "force-dynamic";

export default async function AdminMaintenancePage() {
  const profile = await prisma.profile.findFirst().catch(() => null);

  return (
    <div>
      <AdminPageHeader
        breadcrumbs={[
          { label: "Settings", href: "/admin/settings" },
          { label: "Maintenance Mode" },
        ]}
        title="Maintenance Mode"
        description="Take the public site offline behind a branded page while you make changes."
      />

      <MaintenanceClient
        initialMaintenanceMode={profile?.maintenanceMode ?? false}
        initialMaintenanceMessage={profile?.maintenanceMessage ?? ""}
        maintenanceIcon={profile?.maintenanceIcon ?? ""}
      />
    </div>
  );
}
