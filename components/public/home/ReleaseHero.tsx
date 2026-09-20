// components/public/home/ReleaseHero.tsx
//
// The homepage's first screen. Resolution order:
//   1. (Phase 2) the featured / newest published Release — its cover as the
//      hazy backdrop, LISTEN into it, WATCH into its video;
//   2. the admin's own custom hero from Site Design → Homepage Hero, when
//      it is switched on (HomeHero, unchanged);
//   3. the band: name and tagline over the site's background photo, with
//      LISTEN → /music and WATCH → /videos.
// Genres in the eyebrow come from Profile's skills list (relabelled
// "Genres / tags" in the admin) and fall back to the band's four.
import { prisma } from "@/lib/prisma";
import { getProfile } from "@/lib/public-data";
import { getSiteDesign } from "@/lib/site-design-server";
import { HomeHero } from "@/components/public/site-design/HomeHero";
import { PageHero } from "@/components/public/system/PageHero";
import { CtaButton } from "@/components/public/system/CtaButton";

const DEFAULT_GENRES = ["Shoegaze", "Dreampop", "Math rock", "Post-rock"];

export async function ReleaseHero() {
  const [siteDesign, profile, skills] = await Promise.all([
    getSiteDesign(),
    getProfile().catch(() => null),
    prisma.artistSkill.findMany({ orderBy: { sortOrder: "asc" }, select: { name: true }, take: 6 }).catch(() => []),
  ]);
  const { settings } = siteDesign;

  if (settings.heroEnabled) return <HomeHero settings={settings} />;

  const genres = skills.length > 0 ? skills.map((s) => s.name) : DEFAULT_GENRES;
  const cta = { bg: settings.heroCtaBgColor, text: settings.heroCtaTextColor };

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
