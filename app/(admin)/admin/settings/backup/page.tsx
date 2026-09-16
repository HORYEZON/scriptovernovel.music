// app/(admin)/admin/settings/backup/page.tsx
import type { Metadata } from "next";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { BackupClient } from "./BackupClient";

export const metadata: Metadata = { title: "Backup & Restore" };
export const dynamic = "force-dynamic";

export default function AdminBackupPage() {
  // The storage origin is what tells the exporter which of the many URLs in
  // the data are *our* uploaded files rather than links out to someone else's
  // site. Read here rather than in the client so it comes from the same env
  // var the uploader writes with, instead of a second copy of the hostname.
  // The origin every media URL in the database starts with — what the
  // exporter uses to tell "one of our files" from an Unsplash seed or a
  // retired host. See lib/storage/r2.ts's publicOrigin.
  const storageOrigin = (process.env.R2_PUBLIC_URL ?? "").replace(/\/+$/, "");

  return (
    <div>
      <AdminPageHeader
        breadcrumbs={[
          { label: "Settings", href: "/admin/settings" },
          { label: "Backup & Restore" },
        ]}
        title="Backup & Restore"
        description="Download the whole site as one archive, or put one back"
      />
      <BackupClient storageOrigin={storageOrigin} />
    </div>
  );
}
