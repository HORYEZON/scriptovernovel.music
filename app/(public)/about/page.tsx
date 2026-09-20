// app/(public)/about/page.tsx
//
// The band's About page: a hazy hero over a band photo, the bio (with the
// tagline, base and genres from Profile), the members grid, the band
// photos, then Shows — upcoming first, the past by year, the map under
// them. Certificates & awards stay as an optional block for a band that
// has some. Every block hides when it has nothing.
//
// Profile fields keep their old names (displayName = band name, headline =
// tagline, basedIn, artistSkill = genres) — relabelled in the admin, not
// migrated.
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getProfile, getSocialLinks } from "@/lib/public-data";
import { getPublicBandMembers } from "@/lib/band-members-server";
import { SITE_URL } from "@/lib/site-url";
import { imageVariantUrl } from "@/lib/images/variants";
import { JsonLd } from "@/components/public/JsonLd";
import { PageHero } from "@/components/public/system/PageHero";
import { GlassPanel } from "@/components/public/system/GlassPanel";
import { SectionHeading } from "@/components/public/system/SectionHeading";
import { Reveal } from "@/components/public/system/Reveal";
import { CtaButton } from "@/components/public/system/CtaButton";
import { CertificatesGallery } from "@/components/public/CertificatesGallery";
import { EventsMap } from "@/components/public/EventsMap";
import { ShowRow, type ShowRowData } from "@/components/public/ShowRow";
import { MembersGrid } from "@/components/public/MembersGrid";
import { BandPhotos } from "@/components/public/BandPhotos";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "About",
  description: "ScriptOverNovel — who we are, who plays what, and where we've played.",
};

const DEFAULT_GENRES = ["Shoegaze", "Dreampop", "Math rock", "Post-rock"];

export default async function AboutPage() {
  const [profile, members, certificates, skills, socialLinks, events] = await Promise.all([
    getProfile().catch(() => null),
    getPublicBandMembers().catch(() => []),
    prisma.certificateAward.findMany({ orderBy: { displayOrder: "asc" } }).catch(() => []),
    prisma.artistSkill.findMany({ orderBy: { sortOrder: "asc" } }).catch(() => []),
    getSocialLinks().catch(() => []),
    prisma.event
      .findMany({
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
          media: { orderBy: { order: "asc" }, select: { id: true, url: true, type: true } },
        },
        orderBy: [{ eventDate: "desc" }, { displayOrder: "asc" }],
      })
      .catch(() => []),
  ]);

  const bandName = profile?.displayName || "ScriptOverNovel";
  const genres = skills.length > 0 ? skills.map((s) => s.name) : DEFAULT_GENRES;
  const photos = (profile?.profileImages?.length ? profile.profileImages : profile?.profileImage ? [profile.profileImage] : []).slice(0, 8);

  const now = new Date();
  const toRow = (e: (typeof events)[number]): ShowRowData => ({
    id: e.id,
    title: e.title,
    venueName: e.venueName,
    eventDate: e.eventDate ? e.eventDate.toISOString() : null,
    isNextEvent: e.isNextEvent,
  });
  const upcoming = events.filter((e) => e.eventDate && e.eventDate >= now).sort((a, b) => a.eventDate!.getTime() - b.eventDate!.getTime()).map(toRow);
  const past = events.filter((e) => !e.eventDate || e.eventDate < now).map(toRow);
  const pastByYear = new Map<string, ShowRowData[]>();
  for (const show of past) {
    const year = show.eventDate ? new Date(show.eventDate).getFullYear().toString() : "Undated";
    pastByYear.set(year, [...(pastByYear.get(year) ?? []), show]);
  }

  return (
    <div className="pb-24">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "MusicGroup",
          name: bandName,
          url: `${SITE_URL}/about`,
          genre: genres,
          ...(profile?.bio && { description: profile.bio }),
          ...(photos[0] && { image: photos[0] }),
          ...(profile?.basedIn && { foundingLocation: { "@type": "Place", name: profile.basedIn } }),
          ...(members.length > 0 && { member: members.map((m) => ({ "@type": "Person", name: m.name, roleName: m.role })) }),
          ...(socialLinks.length > 0 && { sameAs: socialLinks.map((l) => l.url) }),
        }}
      />

      <PageHero image={photos[0] ?? profile?.backgroundImage ?? null} blur="md" eyebrow={genres.join(" · ")} title={bandName} subtitle={profile?.headline || null} />

      <div className="mt-12 space-y-16 md:mt-16 md:space-y-24">
        {/* Bio */}
        <Reveal as="section" className="section-padding">
          <GlassPanel padding="page">
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-16">
              <div className="lg:col-span-4">
                <SectionHeading eyebrow="The story" title="About" className="mb-8" />
                {(profile?.basedIn || profile?.experience || profile?.email) && (
                  <dl className="space-y-4 font-body text-sm">
                    {profile?.basedIn && (
                      <div>
                        <dt className="text-[10px] uppercase tracking-[0.3em] text-sepia-light">Based in</dt>
                        <dd className="mt-1 text-cream">{profile.basedIn}</dd>
                      </div>
                    )}
                    {profile?.experience && (
                      <div>
                        <dt className="text-[10px] uppercase tracking-[0.3em] text-sepia-light">Playing since</dt>
                        <dd className="mt-1 text-cream">{profile.experience}</dd>
                      </div>
                    )}
                    {profile?.email && (
                      <div>
                        <dt className="text-[10px] uppercase tracking-[0.3em] text-sepia-light">Booking & press</dt>
                        <dd className="mt-1">
                          <a href={`mailto:${profile.email}`} className="text-cream hover:text-sepia-light hover:underline">
                            {profile.email}
                          </a>
                        </dd>
                      </div>
                    )}
                  </dl>
                )}
              </div>
              <div className="lg:col-span-8">
                <div className="space-y-6 font-body text-base leading-[1.9] text-cream/80">
                  {profile?.bio ? (
                    profile.bio.split("\n\n").map((para, i) => <p key={i}>{para}</p>)
                  ) : (
                    <p className="italic text-cream/40">Our story is still being written.</p>
                  )}
                </div>
                <div className="mt-10 flex flex-wrap gap-2">
                  {genres.map((g) => (
                    <span key={g} className="rounded-full border border-cream/15 px-3.5 py-1.5 font-body text-[10px] uppercase tracking-[0.2em] text-cream/70">
                      {g}
                    </span>
                  ))}
                </div>
                <div className="mt-10 flex flex-wrap gap-3">
                  <CtaButton href="/music">Listen</CtaButton>
                  <CtaButton href="/contact" variant="ghost">
                    Book us
                  </CtaButton>
                </div>
              </div>
            </div>
          </GlassPanel>
        </Reveal>

        {/* Members */}
        {members.length > 0 && (
          <Reveal as="section" className="section-padding">
            <SectionHeading eyebrow="The band" title="Who plays what" />
            <MembersGrid members={members} />
          </Reveal>
        )}

        {/* Photos */}
        {photos.length > 0 && (
          <Reveal as="section" className="section-padding">
            <SectionHeading eyebrow="Photos" title="On and off stage" />
            <BandPhotos photos={photos.map((p) => ({ full: imageVariantUrl(p, "full"), medium: imageVariantUrl(p, "medium") }))} />
          </Reveal>
        )}

        {/* Shows */}
        {events.length > 0 && (
          <Reveal as="section" className="section-padding" >
            <div id="shows" className="scroll-mt-24">
              <GlassPanel padding="page">
                <SectionHeading eyebrow="Live" title="Shows" description={`${events.length} show${events.length === 1 ? "" : "s"}${upcoming.length ? ` · ${upcoming.length} upcoming` : ""}`} />
                {upcoming.length > 0 && (
                  <div className="mb-10">
                    <p className="mb-2 font-body text-[10px] uppercase tracking-[0.3em] text-sepia-light">Upcoming</p>
                    <ul className="divide-y divide-white/10">
                      {upcoming.map((s) => (
                        <ShowRow key={s.id} show={s} />
                      ))}
                    </ul>
                  </div>
                )}
                {Array.from(pastByYear.entries()).map(([year, shows]) => (
                  <div key={year} className="mb-8">
                    <p className="mb-2 font-body text-[10px] uppercase tracking-[0.3em] text-cream/50">{year}</p>
                    <ul className="divide-y divide-white/10">
                      {shows.map((s) => (
                        <ShowRow key={s.id} show={s} muted />
                      ))}
                    </ul>
                  </div>
                ))}
                <div className="mt-6">
                  <EventsMap events={JSON.parse(JSON.stringify(events))} />
                </div>
              </GlassPanel>
            </div>
          </Reveal>
        )}

        {/* Certificates & awards — optional, for a band that has some */}
        {certificates.length > 0 && (
          <Reveal as="section" className="section-padding">
            <GlassPanel padding="page">
              <SectionHeading eyebrow="Recognition" title="Awards" />
              <CertificatesGallery certificates={certificates} />
            </GlassPanel>
          </Reveal>
        )}
      </div>
    </div>
  );
}
