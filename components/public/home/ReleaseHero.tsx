// components/public/home/ReleaseHero.tsx
//
// The homepage's first screen. Resolution order:
//   1. the featured (else newest) published Release — its cover as the hazy
//      backdrop, LISTEN into its player on /music, WATCH → /videos (a
//      release's own video, once Videos ship);
//   2. the admin's own custom hero from Site Design → Homepage Hero, when
//      it is switched on (HomeHero, unchanged);
//   3. the band: name and tagline over the site's background photo, with
//      LISTEN → /music and WATCH → /videos.
// Genres in the eyebrow come from Profile's skills list (relabelled
// "Genres / tags" in the admin) and fall back to the band's four.
import { prisma } from "@/lib/prisma";
import { getProfile } from "@/lib/public-data";
import { getSiteDesign } from "@/lib/site-design-server";
import { getLeadRelease } from "@/lib/releases-server";
import { RELEASE_TYPE_LABELS, formatReleaseDate, primaryEmbed } from "@/lib/releases";
import { HomeHero } from "@/components/public/site-design/HomeHero";
import { PageHero } from "@/components/public/system/PageHero";
import { CtaButton } from "@/components/public/system/CtaButton";

const DEFAULT_GENRES = ["Shoegaze", "Dreampop", "Math rock", "Post-rock"];

export async function ReleaseHero() {
  const [siteDesign, profile, skills, release] = await Promise.all([
    getSiteDesign(),
    getProfile().catch(() => null),
    prisma.artistSkill.findMany({ orderBy: { sortOrder: "asc" }, select: { name: true }, take: 6 }).catch(() => []),
    getLeadRelease().catch(() => null),
  ]);
  const { settings } = siteDesign;
  const cta = { bg: settings.heroCtaBgColor, text: settings.heroCtaTextColor };

  if (release) {
    const player = primaryEmbed(release);
    const anchor = `/music#${release.slug ?? release.id}`;
    return (
      <PageHero
        size="full"
        image={release.coverImageUrl}
        imageAlt=""
        blur="md"
        eyebrow={`${release.featured ? "Out now" : "Latest"} · ${RELEASE_TYPE_LABELS[release.type]}${release.releaseDate ? ` · ${formatReleaseDate(release.releaseDate)}` : ""}`}
        title={release.title}
        subtitle={release.description ? release.description.split("\n")[0] : profile?.headline || null}
      >
        <CtaButton href={player ? anchor : "/music"} colors={cta}>
          Listen
        </CtaButton>
        <CtaButton href="/videos" variant="ghost">
          Watch
        </CtaButton>
      </PageHero>
    );
  }

  if (settings.heroEnabled) return <HomeHero settings={settings} />;

  const genres = skills.length > 0 ? skills.map((s) => s.name) : DEFAULT_GENRES;

  return (
    <PageHero
      size="full"
      image={profile?.backgroundImage}
      blur="lg"
      eyebrow={genres.join(" · ")}
      title={
        settings.headerLogoImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img draggable={false} src={settings.headerLogoImage} alt={settings.headerLogoText} className="mx-auto h-[1.2em] w-auto max-w-[90vw] object-contain" />
        ) : (
          <span style={{ fontFamily: settings.headerLogoFontFamily }}>{settings.headerLogoText}</span>
        )
      }
      subtitle={profile?.headline || null}
    >
      <CtaButton href="/music" colors={cta}>
        Listen
      </CtaButton>
      <CtaButton href="/videos" variant="ghost">
        Watch
      </CtaButton>
    </PageHero>
  );
}
