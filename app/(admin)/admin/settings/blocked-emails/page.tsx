// app/(admin)/admin/settings/blocked-emails/page.tsx
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { BlockedEmailsClient } from "./BlockedEmailsClient";

export const metadata: Metadata = { title: "Blocked Emails" };
export const dynamic = "force-dynamic";

export default async function AdminBlockedEmailsPage() {
  const blockedEmails = await prisma.blockedEmail.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <AdminPageHeader
        breadcrumbs={[
          { label: "Settings", href: "/admin/settings" },
          { label: "Blocked Emails" },
        ]}
        title="Blocked Emails"
        description='Addresses blocked from the public contact form — via the "Block Sender" action on a Gmail notification, or added directly here.'
      />

      <BlockedEmailsClient initialBlockedEmails={JSON.parse(JSON.stringify(blockedEmails))} />
    </div>
  );
}
