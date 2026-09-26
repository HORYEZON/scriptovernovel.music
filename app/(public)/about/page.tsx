// app/(public)/about/page.tsx
//
// The band's About page: a hazy hero over a band photo, the bio (with the
// tagline, base and genres from Profile), the members grid, the band
// photos, then the next few Shows with a link out to /shows, which owns the
// archive, the ticket links and the map. Certificates & awards stay as an
// optional block for a band that has some. Every block hides when it has
// nothing.
//
// Profile fields keep their old names (displayName = band name, headline =
// tagline, basedIn, artistSkill = genres) — relabelled in the admin, not
// migrated.
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getProfile, getSocialLinks } from "@/lib/public-data";
import { getPublicBandMembers } from "@/lib/band-members-server";
import { getUpcomingShows, PUBLIC_SHOW_WHERE } from "@/lib/shows-server";
import { SITE_URL } from "@/lib/site-url";
import { imageVariantUrl } from "@/lib/images/variants";
import { JsonLd } from "@/components/public/JsonLd";
import { PageHero } from "@/components/public/system/PageHero";
import { GlassPanel } from "@/components/public/system/GlassPanel";
import { SectionHeading } from "@/components/public/system/SectionHeading";
import { Reveal } from "@/components/public/system/Reveal";
import { CtaButton } from "@/components/public/system/CtaButton";
import { CertificatesGallery } from "@/components/public/CertificatesGallery";
import { ShowRow } from "@/components/public/ShowRow";
import { MembersGrid } from "@/components/public/MembersGrid";
import { BandPhotos } from "@/components/public/BandPhotos";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "About",
  description: "ScriptOverNovel — who we are, who plays what, and where we've played.",
};

const DEFAULT_GENRES = ["Shoegaze", "Dreampop", "Math rock", "Post-rock"];

export default async function AboutPage() {
  const [profile, members, certificates, skills, socialLinks, upcoming, showCount] = await Promise.all([
    getProfile().catch(() => null),
    getPublicBandMembers().catch(() => []),
    prisma.certificateAward.findMany({ orderBy: { displayOrder: "asc" } }).catch(() => []),
    prisma.artistSkill.findMany({ orderBy: { sortOrder: "asc" } }).catch(() => []),
    getSocialLinks().catch(() => []),
    getUpcomingShows(3),
    prisma.event.count({ where: PUBLIC_SHOW_WHERE }).catch(() => 0),
  ]);

  const bandName = profile?.displayName || "ScriptOverNovel";
  const genres = skills.length > 0 ? skills.map((s) => s.name) : DEFAULT_GENRES;
  const photos = (profile?.profileImages?.length ? profile.profileImages : profile?.profileImage ? [profile.profileImage] : []).slice(0, 8);

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
                  {/* Not links, so the hover is a "this is a thing" nudge
                      rather than an affordance: the border picks up the
                      logo's gold, the type comes up to full cream and the
                      chip lifts a hair. */}
                  {genres.map((g) => (
                    <span
                      key={g}
                      className="cursor-default rounded-full border border-cream/15 px-3.5 py-1.5 font-body text-[10px] uppercase tracking-[0.2em] text-cream/70 transition-[color,border-color,background-color,transform] duration-300 hover:-translate-y-0.5 hover:border-sepia/60 hover:bg-cream/5 hover:text-cream"
                    >
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

        {/* Shows — the next few only. The archive, the ticket links and the
            map moved to /shows; `id="shows"` stays so every link ever posted
            to /about#shows still lands on something about shows. */}
        {showCount > 0 && (
          <Reveal as="section" className="section-padding" >
            <div id="shows" className="scroll-mt-24">
              <GlassPanel padding="page">
                <SectionHeading
                  eyebrow="Live"
                  title="Shows"
                  description={`${showCount} show${showCount === 1 ? "" : "s"} played${upcoming.length ? ` · ${upcoming.length} coming up` : ""}`}
                  action={{ label: "All shows", href: "/shows" }}
                />
                {upcoming.length > 0 ? (
                  <ul className="divide-y divide-white/10">
                    {upcoming.map((s) => (
                      <ShowRow key={s.id} show={s} />
                    ))}
                  </ul>
                ) : (
                  <p className="font-body text-sm leading-relaxed text-cream/60">
                    Nothing booked at the moment — the full history is on the{" "}
                    <a href="/shows" className="text-sepia-light underline decoration-sepia/40 hover:text-cream">
                      shows page
                    </a>
                    .
                  </p>
                )}
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
