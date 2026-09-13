// app/(admin)/admin/settings/security/page.tsx
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { SecurityClient } from "./SecurityClient";

export const metadata: Metadata = { title: "Security" };

export const dynamic = "force-dynamic";

export default async function AdminSecurityPage() {
  const session = await auth();
  const userId = (session!.user as { id: string }).id;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      totpEnabled: true,
      inactivityLogoutEnabled: true,
      inactivityLogoutMinutes: true,
    },
  });

  return (
    <div>
      <AdminPageHeader
        breadcrumbs={[
          { label: "Settings", href: "/admin/settings" },
          { label: "Security" },
        ]}
        title="Security"
        description="Two-factor authentication and automatic sign-out for your admin account."
      />

      <SecurityClient
        email={user?.email ?? ""}
        initialTotpEnabled={user?.totpEnabled ?? false}
        initialInactivityEnabled={user?.inactivityLogoutEnabled ?? false}
        initialInactivityMinutes={user?.inactivityLogoutMinutes ?? 30}
      />
    </div>
  );
}
