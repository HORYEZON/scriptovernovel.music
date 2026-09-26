// components/public/home/ReleaseHero.tsx
//
// The homepage's first screen. Resolution order:
//   1. the admin's own custom hero from Site Design → Homepage Hero, when it
//      is switched on (HomeHero, unchanged). It wins outright: the point of
//      the switch is a takeover — a hand-designed splash for a launch or an
//      announcement — and it would be useless if the release below could
//      outrank it, since a release is exactly when you'd reach for it;
//   2. the featured (else newest) published Release — its cover as the hazy
//      backdrop, LISTEN into its own release page, WATCH → /videos (a
//      release's own video, once Videos ship);
//   3. the band: the Profile headline as the title over the site's
//      background photo, the bio's first line under it, with LISTEN → /music
//      and WATCH → /videos. The band's name is deliberately *not* the title
//      here — the header wordmark is already on screen, and the same words
//      twice on one screen read as a mistake.
// Genres in the eyebrow come from Profile's skills list (relabelled
// "Genres / tags" in the admin) and fall back to the band's four.
import { prisma } from "@/lib/prisma";
import { getProfile } from "@/lib/public-data";
import { getSiteDesign } from "@/lib/site-design-server";
import { getLeadRelease } from "@/lib/releases-server";
import { RELEASE_TYPE_LABELS, formatReleaseDate, primaryEmbed, releaseHref } from "@/lib/releases";
import { HomeHero } from "@/components/public/site-design/HomeHero";
import { PageHero } from "@/components/public/system/PageHero";
import { CtaButton } from "@/components/public/system/CtaButton";

const DEFAULT_GENRES = ["Shoegaze", "Dreampop", "Math rock", "Post-rock"];
// Title of the band hero when the Profile headline is blank.
const DEFAULT_HEADLINE = "New music, shows and videos";

export async function ReleaseHero() {
  const [siteDesign, profile, skills, release] = await Promise.all([
    getSiteDesign(),
    getProfile().catch(() => null),
    prisma.artistSkill.findMany({ orderBy: { sortOrder: "asc" }, select: { name: true }, take: 6 }).catch(() => []),
    getLeadRelease().catch(() => null),
  ]);
  const { settings } = siteDesign;
  const cta = { bg: settings.heroCtaBgColor, text: settings.heroCtaTextColor };

  if (settings.heroEnabled) return <HomeHero settings={settings} />;

  if (release) {
    const player = primaryEmbed(release);
    const href = releaseHref(release);
    // WATCH goes to the release's own video when it has one, else /videos.
    const video = await prisma.video
      .findFirst({ where: { releaseId: release.id, published: true, deletedAt: null }, orderBy: [{ featured: "desc" }, { sortOrder: "asc" }], select: { id: true } })
      .catch(() => null);
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
        <CtaButton href={player ? href : "/music"} colors={cta}>
          Listen
        </CtaButton>
        <CtaButton href={video ? `/videos#${video.id}` : "/videos"} variant="ghost">
          Watch
        </CtaButton>
      </PageHero>
    );
  }

  const genres = skills.length > 0 ? skills.map((s) => s.name) : DEFAULT_GENRES;
  const headline = profile?.headline?.trim() || DEFAULT_HEADLINE;
  // First line of the bio, unless it's just the headline again.
  const bioLine = profile?.bio?.split("\n").map((l) => l.trim()).find(Boolean) ?? null;
  const subtitle = bioLine && bioLine !== headline ? bioLine : profile?.basedIn || null;

  return (
    <PageHero
      size="full"
      image={profile?.backgroundImage}
      blur="lg"
      eyebrow={genres.join(" · ")}
      title={headline}
      subtitle={subtitle}
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
