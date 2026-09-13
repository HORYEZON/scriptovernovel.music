// app/(public)/about/page.tsx
import { prisma } from "@/lib/prisma";
import { getProfile, getSocialLinks } from "@/lib/public-data";
import Link from "next/link";
import { Mail, Award } from "lucide-react";
import { ProfileSlideshow } from "@/components/public/ProfileSlideshow";
import { CertificatesGallery } from "@/components/public/CertificatesGallery";
import { SquidLetter } from "@/components/public/SquidLetter";
import { JsonLd } from "@/components/public/JsonLd";
import { EventsMap } from "@/components/public/EventsMap";
import { SITE_URL } from "@/lib/site-url";
import { MapPin } from "lucide-react";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "About",
  description: "Learn about the artist behind ScriptOverNovel.",
};

// Extend the Prisma-generated type until the TS server picks up the new fields
// (prisma generate already updated the files; this cast is a no-op after a TS restart)
type ProfileWithStats = Awaited<ReturnType<typeof prisma.profile.findFirst>> & {
  displayName?: string | null;
  basedIn?: string | null;
  experience?: string | null;
  languages?: string | null;
};

export default async function AboutPage() {
  const [rawProfile, certificates, artistSkills, socialLinks, events] = await Promise.all([
    getProfile(),
    prisma.certificateAward.findMany({ orderBy: { displayOrder: "asc" } }),
    prisma.artistSkill.findMany({ orderBy: { sortOrder: "asc" } }),
    getSocialLinks().catch(() => []),
    prisma.event.findMany({
      where: { enabled: true, deletedAt: null },
      select: {
        id: true,
        title: true,
        description: true,
        venueName: true,
        latitude: true,
        longitude: true,
        eventDate: true,
        isNextEvent: true,
        createdAt: true,
        media: {
          orderBy: { order: "asc" },
          select: { id: true, url: true, type: true },
        },
      },
      orderBy: [{ isNextEvent: "desc" }, { eventDate: "desc" }, { displayOrder: "asc" }],
    }),
  ]);
  // "New Events" = upcoming (eventDate today or later) — not a separate
  // admin-set flag, just today's date vs each event's own eventDate.
  const upcomingEventCount = events.filter((e) => e.eventDate && e.eventDate >= new Date()).length;
  const profile = rawProfile as ProfileWithStats | null;
  const artistName = profile?.displayName || "Kyla Marie Zuñiga";

  const slideImages = (
    profile?.profileImages?.length
      ? profile.profileImages
      : profile?.profileImage
        ? [profile.profileImage]
        : []
  ).slice(0, 5);

  return (
    <div className="pt-24 pb-24">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Person",
          name: artistName,
          url: `${SITE_URL}/about`,
          ...(profile?.headline && { jobTitle: profile.headline }),
          ...(profile?.bio && { description: profile.bio }),
          ...(profile?.profileImage && { image: profile.profileImage }),
          ...(profile?.email && { email: profile.email }),
          ...(socialLinks.length > 0 && {
            sameAs: socialLinks.map((link) => link.url),
          }),
        }}
      />
      <div className="section-padding">
        {/* Card base intact: p-8 md:p-14 */}
        <div className="bg-black/30 dark:bg-black/45 rounded-2xl border border-white/5 shadow-2xl p-8 md:p-14">

          {/* Header */}
          <div className="mb-20">
            <p className="font-body text-md tracking-[0.5em] uppercase text-sepia-light mb-3">
              The Story
            </p>
            <h1 className="font-grotesk font-bold text-4xl md:text-6xl tracking-widest uppercase text-white drop-shadow-sm flex">
              <SquidLetter letter="A" />
              <span className="transition-colors duration-200 hover:text-[#44D700]">b</span>
              <span className="transition-colors duration-200 hover:text-[#FF6B9D]">o</span>
              <span className="transition-colors duration-200 hover:text-[#5BC8F5]">u</span>
              <span className="transition-colors duration-200 hover:text-[#FFE135]">t</span>
            </h1>
            <div className="deco-line mt-6" />
          </div>

          {/* Main Content */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-24 items-start">

            {/* Image Column */}
            <div className="relative lg:col-span-5 flex flex-col items-center">
              {/* Framed portrait — scaled down and centered within its panel */}
              <div className="relative w-full max-w-[320px] sm:max-w-[360px] mx-auto">
                <div className="group aspect-[3/4] max-h-[480px] relative bg-ink-800/60 overflow-hidden cursor-pointer mx-auto">
                  <ProfileSlideshow images={slideImages} />
                </div>

                {/* Offset decorative frame (golden thin-line border) */}
                <div className="absolute -bottom-6 -left-6 w-full h-full border border-sepia -z-10 hidden lg:block" />
              </div>

              {/* Social Links (Centered on mobile & desktop) */}
              <div className="flex flex-col items-center justify-center gap-2 mt-8">
                {/* Name Above Email */}
                <h3 className="font-heading text-lg sm:text-xl font-medium text-white text-center">
                  {profile?.displayName || "Kyla Marie Zuñiga"}
                </h3>

                {profile?.email && (
                  <a
                    href={`mailto:${profile.email}`}
                    className="flex items-center gap-2 font-body text-xs sm:text-sm text-white/50 hover:text-white transition-colors min-w-0 max-w-full justify-center text-center"
                  >
                    <Mail size={16} strokeWidth={1.5} className="shrink-0" />
                    <span className="truncate">{profile.email}</span>
                  </a>
                )}
              </div>
            </div>

            {/* Text Column */}
            <div className="lg:col-span-7 lg:pt-8">
              {profile?.headline && (
                <h2 className="font-body text-3xl font-light italic mb-8 text-sepia">
                  {profile.headline}
                </h2>
              )}

              <div className="space-y-6 font-body text-sm text-white/75 leading-[1.9]">
                {profile?.bio ? (
                  profile.bio
                    .split("\n\n")
                    .map((para, i) => <p key={i}>{para}</p>)
                ) : (
                  <p className="text-white/40 italic">
                    Biography coming soon.
                  </p>
                )}
              </div>

              {(profile?.basedIn || profile?.experience || profile?.languages) && (
                <div className="mt-12 space-y-4">
                  <div className="deco-line" />
                  <div className="grid grid-cols-3 gap-6 pt-4">
                    {profile?.basedIn && (
                      <div>
                        <p className="font-jakarta font-semibold text-xs uppercase tracking-wider text-neutral-400 mb-1">
                          Based in
                        </p>
                        <p className="font-jakarta font-semibold text-sm sm:text-base text-slate-100">
                          {profile.basedIn}
                        </p>
                      </div>
                    )}
                    {profile?.experience && (
                      <div>
                        <p className="font-jakarta font-semibold text-xs uppercase tracking-wider text-neutral-400 mb-1">
                          Experience
                        </p>
                        <p className="font-jakarta font-semibold text-sm sm:text-base text-slate-100">
                          {profile.experience}
                        </p>
                      </div>
                    )}
                    {profile?.languages && (
                      <div>
                        <p className="font-jakarta font-semibold text-xs uppercase tracking-wider text-neutral-400 mb-1">
                          Languages
                        </p>
                        <p className="font-jakarta font-semibold text-sm sm:text-base text-slate-100">
                          {profile.languages}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons (CENTERED ON MOBILE) */}
              <div className="mt-12 flex flex-col sm:flex-row items-center sm:items-stretch justify-center sm:justify-start gap-4">
                <Link 
                  href="/" 
                  className="px-6 py-3 rounded-md bg-white/5 border border-white/10 text-sepia-light font-medium hover:bg-sepia-light hover:text-black transition-all duration-300 text-center justify-center w-full sm:w-auto"
                >
                  View Gallery
                </Link>
                <Link
                  href="/contact"
                  className="relative group inline-flex items-center justify-center overflow-hidden rounded-md border border-sepia-light/60 px-6 py-3 text-sepia-light transition-all duration-300 hover:border-sepia-light hover:text-black hover:shadow-[0_0_20px_rgba(232,213,168,0.3)] w-full sm:w-auto"
                >
                  {/* Shimmer Light Moving Effect */}
                  <span className="absolute inset-0 bg-gradient-to-r from-transparent via-sepia-light/20 to-transparent animate-shimmer pointer-events-none" />

                  {/* Fill Background on Hover */}
                  <span className="absolute inset-0 bg-sepia-light opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                  {/* Button Label */}
                  <span className="relative z-10 font-medium transition-colors duration-300 group-hover:text-black">
                    Commission a Piece
                  </span>
                </Link>
              </div>
            </div>
          </div>

          {/* Certificates and Awards */}
          {certificates.length > 0 && (
            <div className="mt-24 md:mt-32 max-w-4xl">
              <div className="flex items-center gap-2 mb-8">
                <Award size={14} className="text-sepia" strokeWidth={1.5} />
                <h3 className="font-body text-xs tracking-[0.3em] uppercase text-sepia-light">
                  Certificates & Awards
                </h3>
              </div>

              <CertificatesGallery certificates={certificates} />
            </div>
          )}

          {/* Artist Skills */}
          {artistSkills.length > 0 && (
            <div className="mt-24 md:mt-32 max-w-3xl">
              <h3 className="font-body text-xs tracking-[0.3em] uppercase text-sepia-light mb-8">
                Artist Skills
              </h3>
              <ul
                className="flex flex-wrap gap-2 sm:gap-3"
                aria-label="Artist skills and disciplines"
              >
                {artistSkills.map((skill) => (
                  <li key={skill.id}>
                    <span
                      className="group/skill relative inline-block overflow-hidden font-body text-[10px] sm:text-xs tracking-[0.06em] sm:tracking-[0.12em] uppercase text-white/70 border border-white/15 rounded-full px-3 py-1.5 sm:px-4 sm:py-2 bg-white/[0.03] cursor-default select-none transition-all duration-300 hover:-translate-y-0.5 active:scale-95 hover:[color:var(--skill-color)] hover:border-[color-mix(in_srgb,var(--skill-color)_55%,transparent)] hover:bg-[color-mix(in_srgb,var(--skill-color)_16%,transparent)] hover:shadow-[0_6px_22px_-6px_var(--skill-color)]"
                      style={{ "--skill-color": skill.hoverColor } as React.CSSProperties}
                    >
                      {/* Light sweep — same shimmer treatment as the Featured/New
                          Release badges, gated to hover so a dense skill list
                          doesn't shimmer all at once; the color itself still
                          comes from the admin-configured --skill-color, unchanged */}
                      <span className="pointer-events-none absolute inset-0 -translate-x-full opacity-0 bg-gradient-to-r from-transparent via-white/60 to-transparent transition-opacity duration-200 group-hover/skill:opacity-100 group-hover/skill:animate-shimmer" />
                      <span className="relative">{skill.name}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Timeline / Gigs — Google Map of places Kyla has performed or
              exhibited at. Silently omitted when no Maps API key is
              configured (see EventsMap.tsx) or no events are enabled yet,
              rather than showing a broken/empty map. */}
          {events.length > 0 && (
            <div className="mt-24 md:mt-32">
              <div className="mb-8">
                <div className="flex items-center gap-2">
                  <MapPin size={14} className="text-sepia" strokeWidth={1.5} />
                  <h3 className="font-body text-xs tracking-[0.3em] uppercase text-sepia-light">
                    Timeline &amp; Gigs
                  </h3>
                </div>
                <p className="font-body text-xs text-white/50 mt-2 ml-[22px]">
                  <span className="text-white/80 font-semibold">{events.length}</span>{" "}
                  Event{events.length !== 1 ? "s" : ""}
                  {upcomingEventCount > 0 && (
                    <>
                      {" "}
                      &middot; <span className="text-[#FFE135] font-semibold">{upcomingEventCount}</span> New
                      Event{upcomingEventCount !== 1 ? "s" : ""}
                    </>
                  )}
                </p>
              </div>
              <EventsMap events={JSON.parse(JSON.stringify(events))} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}