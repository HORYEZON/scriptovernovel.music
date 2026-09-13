// app/api/release-notes/active/route.ts
//
// Public counterpart to /api/release-notes — the newest few published notes,
// nothing else. Drafts never leave the admin panel, and the row cap is
// applied here in the query rather than trusted to the client, so the
// response can't be widened by editing a fetch.
//
// The panel is server-rendered in app/(public)/layout.tsx for the first
// paint; this route exists for the same reason MarqueeBanner's does — most
// public routes prerender, so a note published afterwards would otherwise
// stay invisible until something revalidated the page.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clampReleaseNoteLimit } from "@/lib/release-notes";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const profile = await prisma.profile.findFirst({
      select: { releaseNotesEnabled: true, releaseNotesLimit: true },
    });

    // Switched off in Settings means the panel shows nothing at all, not an
    // empty list with an icon still sitting in the navbar.
    if (profile && !profile.releaseNotesEnabled) {
      return NextResponse.json({ enabled: false, notes: [] });
    }

    const notes = await prisma.releaseNote.findMany({
      where: { isPublished: true, deletedAt: null },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      take: clampReleaseNoteLimit(profile?.releaseNotesLimit),
      select: {
        id: true,
        title: true,
        body: true,
        category: true,
        version: true,
        publishedAt: true,
      },
    });

    return NextResponse.json({ enabled: true, notes });
  } catch {
    // A failure here should cost the visitor an icon, not the page — the
    // panel renders nothing on an empty list.
    return NextResponse.json({ enabled: false, notes: [] });
  }
}
