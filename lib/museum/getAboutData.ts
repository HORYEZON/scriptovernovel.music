// lib/museum/getAboutData.ts
//
// Builds the About ScriptOverNovel room's content payload from the exact same
// Profile/CertificateAward/ArtistSkill/SocialLink rows app/(public)/about
// /page.tsx reads (same fallback display name too) — used by both the
// public museum (app/(public)/gallery/museum/page.tsx) and the Museum
// Scene Editor (museum-editor/[roomId]/page.tsx, so an admin repositioning
// the About room's 3 movable blocks sees the real content instead of a
// placeholder). Extracted here rather than duplicated so both call sites
// can never drift apart.
import { prisma } from "@/lib/prisma";
import { getProfile, getSocialLinks } from "@/lib/public-data";
import type { MuseumAboutData } from "@/types";

export async function getAboutData(): Promise<MuseumAboutData> {
  const [aboutProfile, aboutCertificates, aboutSkills, aboutSocialLinks, aboutGigs] = await Promise.all([
    getProfile().catch(() => null),
    prisma.certificateAward.findMany({ orderBy: { displayOrder: "asc" } }).catch(() => []),
    prisma.artistSkill.findMany({ orderBy: { sortOrder: "asc" } }).catch(() => []),
    getSocialLinks().catch(() => []),
    // Same query as app/api/events/public/route.ts — the Timeline & Gigs
    // wall map. Ordered so the "Next Event" pin sorts first.
    prisma.event.findMany({
      where: { enabled: true, deletedAt: null },
      select: {
        id: true, title: true, description: true, venueName: true,
        latitude: true, longitude: true, eventDate: true, isNextEvent: true,
        createdAt: true,
        media: { orderBy: { order: "asc" }, select: { id: true, url: true, type: true } },
      },
      orderBy: [{ isNextEvent: "desc" }, { eventDate: "desc" }, { displayOrder: "asc" }],
    }).catch(() => []),
  ]);

  return {
    displayName: aboutProfile?.displayName || "Kyla Marie Zuñiga",
    headline: aboutProfile?.headline ?? null,
    bio: aboutProfile?.bio ?? null,
    email: aboutProfile?.email ?? null,
    basedIn: aboutProfile?.basedIn ?? null,
    experience: aboutProfile?.experience ?? null,
    languages: aboutProfile?.languages ?? null,
    logoImage: aboutProfile?.logoImage ?? null,
    images: (
      aboutProfile?.profileImages?.length
        ? aboutProfile.profileImages
        : aboutProfile?.profileImage
          ? [aboutProfile.profileImage]
          : []
    ).slice(0, 5),
    certificates: aboutCertificates.map((c) => ({
      id: c.id,
      title: c.title,
      issuer: c.issuer,
      description: c.description,
      imageUrl: c.imageUrl,
      dateAwarded: c.dateAwarded,
    })),
    skills: aboutSkills.map((s) => ({ id: s.id, name: s.name, hoverColor: s.hoverColor })),
    socialLinks: aboutSocialLinks.map((l) => ({
      label: l.label,
      url: l.url,
      iconKey: l.iconKey,
      hoverColor: l.hoverColor,
    })),
    // Calling card images — same Profile fields ContactClient.tsx reads.
    callingCardFront: (aboutProfile as { callingCardFront?: string | null } | null)?.callingCardFront ?? null,
    callingCardBack:  (aboutProfile as { callingCardBack?: string | null } | null)?.callingCardBack  ?? null,
    gigs: aboutGigs.map((e) => ({
      id: e.id,
      title: e.title,
      description: e.description,
      venueName: e.venueName,
      latitude: e.latitude,
      longitude: e.longitude,
      eventDate: e.eventDate ? e.eventDate.toISOString() : null,
      isNextEvent: e.isNextEvent,
      createdAt: e.createdAt.toISOString(),
      media: e.media.map((m) => ({ id: m.id, url: m.url, type: m.type })),
    })),
  };
}
