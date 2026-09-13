// app/(admin)/admin/settings/release-notes/page.tsx
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { clampReleaseNoteLimit, RELEASE_NOTE_LIMIT_DEFAULT } from "@/lib/release-notes";
import { ReleaseNotesClient } from "./ReleaseNotesClient";

export const metadata: Metadata = { title: "Release Notes" };
export const dynamic = "force-dynamic";

export default async function ReleaseNotesPage() {
  const [profile, notes] = await Promise.all([
    prisma.profile
      .findFirst({ select: { releaseNotesEnabled: true, releaseNotesLimit: true } })
      .catch(() => null),
    // deletedAt: null was missing here — every other trashable model's list
    // page filters it (Artworks, Stories, Cosplays, Products, Events,
    // Announcements, Notifications, Freedom Wall), this one didn't. A
    // soft-deleted note vanished from the list optimistically on the client
    // (ReleaseNotesClient's own setNotes), but a refresh re-fetched it from
    // here — unfiltered — and it came right back, right up until Trash's own
    // DELETE actually destroyed the row.
    prisma.releaseNote
      .findMany({
        where: { deletedAt: null },
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      })
      .catch(() => []),
  ]);

  return (
    <div>
      <AdminPageHeader
        breadcrumbs={[{ label: "Settings", href: "/admin/settings" }, { label: "Release Notes" }]}
        title="Release Notes"
        description="What visitors see behind the sparkle icon in the site navbar — the newest few changes to the public site, in plain words"
      />

      <ReleaseNotesClient
        initialEnabled={profile?.releaseNotesEnabled ?? true}
        initialLimit={clampReleaseNoteLimit(profile?.releaseNotesLimit ?? RELEASE_NOTE_LIMIT_DEFAULT)}
        initialNotes={JSON.parse(JSON.stringify(notes))}
      />
    </div>
  );
}
