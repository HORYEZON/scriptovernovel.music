// app/(public)/layout.tsx
import { Analytics } from "@vercel/analytics/next";
import { SiteHeader } from "@/components/public/site-design/SiteHeader";
import { Footer } from "@/components/public/Footer";
import { IntroSplash } from "@/components/public/IntroSplash";
import { CartProvider } from "@/components/public/CartProvider";
import { AnnouncementPopup } from "@/components/public/AnnouncementPopup";
import { FaqChatbox } from "@/components/public/FaqChatbox";
import { BackToTop } from "@/components/public/BackToTop";
import { VisitorCounterWidget } from "@/components/public/VisitorCounterWidget";
import { PublicThemeStyle } from "@/components/public/PublicThemeStyle";
import { CursorGlow } from "@/components/public/CursorGlow";
import { BackgroundParallax } from "@/components/public/BackgroundParallax";
import { NoImageDrag } from "@/components/NoImageDrag";
import { BackgroundMusicPlayer } from "@/components/public/BackgroundMusicPlayer";
import { MaintenancePage } from "@/components/public/MaintenancePage";
import { Toaster } from "react-hot-toast";
import { RecaptchaProvider } from "@/components/public/RecaptchaProvider";
import { prisma } from "@/lib/prisma";
import { getProfile, getSocialLinks } from "@/lib/public-data";
import { getSiteDesign } from "@/lib/site-design-server";
import { estimateMarqueeHeight, type Marquee } from "@/lib/marquee";
import { clampReleaseNoteLimit } from "@/lib/release-notes";
import type { PublicReleaseNote } from "@/components/public/ReleaseNotes";
import { TOAST_OPTIONS } from "@/lib/toast-config";
import { resolveSiteTheme } from "@/lib/theme";
import {
  sanitizeIntroEffect,
  clampIntroSpeed,
  sanitizeIntroText,
  sanitizeIntroBgColor,
  sanitizeIntroTaglineFontSize,
  sanitizeIntroTaglineFontFamily,
  sanitizeIntroTextAbove,
  sanitizeIntroTaglineColor,
  sanitizeIntroTaglineAboveFontSize,
  sanitizeIntroTaglineAboveFontFamily,
  sanitizeIntroTaglineAboveColor,
  sanitizeIntroTaglineFontSizeMobile,
  clampIntroGlowIntensity,
  clampIntroGlowOffset,
  sanitizeIntroLetterColors,
  sanitizeIntroSquidColor,
  sanitizeIntroGlowColor,
  INTRO_DEFAULTS,
} from "@/lib/intro-splash";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getProfile().catch(() => null);

  // Site-wide kill switch — every /(public) route is gated here (before any
  // of the other queries below run), while /admin keeps working normally
  // since it's a separate route group with its own layout.
  if (profile?.maintenanceMode) {
    return <MaintenancePage message={profile.maintenanceMessage} icon={profile.maintenanceIcon} />;
  }

  // Live ticker rows, fetched here rather than client-side so the bar is in the
  // first paint. Null start/end mean the bound is simply not set.
  const now = new Date();

  // Independent of each other and of `profile` above, so run them together
  // instead of awaiting one at a time.
  const [socialLinks, theme, siteDesign, marqueeRows, releaseNoteRows] = await Promise.all([
    getSocialLinks().catch(() => []),
    prisma.siteTheme.findFirst().catch(() => null),
    // Header + menu overlay look (Admin → Site Design). getSiteDesign never
    // throws — it falls back to lib/site-design.ts's defaults per query.
    getSiteDesign(),
    prisma.marqueeAnnouncement
      .findMany({
        where: {
          deletedAt: null,
          isActive: true,
          AND: [
            { OR: [{ startDate: null }, { startDate: { lte: now } }] },
            { OR: [{ endDate: null }, { endDate: { gte: now } }] },
          ],
        },
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      })
      .catch(() => []),
    // Newest few only — the navbar panel is a "what's new", not an archive,
    // so an older note drops off as a newer one is published. Fetched here
    // rather than client-side so the icon is in the first paint; the
    // component refreshes itself once on mount for prerendered routes.
    profile?.releaseNotesEnabled === false
      ? Promise.resolve([])
      : prisma.releaseNote
          .findMany({
            where: { isPublished: true },
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
          })
          .catch(() => []),
  ]);
  const resolvedTheme = resolveSiteTheme(theme);

  const marquees: Marquee[] = JSON.parse(JSON.stringify(marqueeRows));
  const releaseNotes: PublicReleaseNote[] = JSON.parse(JSON.stringify(releaseNoteRows));

  // Fallback for `--marquee-h` until MarqueeBanner measures itself — pages set
  // their own top padding for the navbar only, so the ticker's height is extra.
  const marqueeOffset = estimateMarqueeHeight(marquees);

  return (
    <RecaptchaProvider>
    <IntroSplash
      enabled={profile?.introEnabled ?? INTRO_DEFAULTS.introEnabled}
      effect={sanitizeIntroEffect(profile?.introEffect)}
      speedMs={clampIntroSpeed(profile?.introSpeedMs)}
      text={sanitizeIntroText(profile?.introText)}
      bgColor={sanitizeIntroBgColor(profile?.introBgColor)}
      icon={profile?.splashIcon}
      textAbove={sanitizeIntroTextAbove(profile?.introTextAbove)}
      taglineFontSize={sanitizeIntroTaglineFontSize(profile?.introTaglineFontSize)}
      taglineFontFamily={sanitizeIntroTaglineFontFamily(profile?.introTaglineFontFamily)}
      taglineColor={sanitizeIntroTaglineColor(profile?.introTaglineColor)}
      taglineAboveFontSize={sanitizeIntroTaglineAboveFontSize(profile?.introTaglineAboveFontSize)}
      taglineAboveFontFamily={sanitizeIntroTaglineAboveFontFamily(
        profile?.introTaglineAboveFontFamily
      )}
      taglineAboveColor={sanitizeIntroTaglineAboveColor(profile?.introTaglineAboveColor)}
      taglineFontSizeMobile={sanitizeIntroTaglineFontSizeMobile(profile?.introTaglineFontSizeMobile)}
      taglineAboveFontSizeMobile={sanitizeIntroTaglineFontSizeMobile(
        profile?.introTaglineAboveFontSizeMobile
      )}
      glowIntensity={clampIntroGlowIntensity(profile?.introGlowIntensity)}
      glowColor={sanitizeIntroGlowColor(profile?.introGlowColor)}
      glowShimmer={profile?.introGlowShimmer ?? INTRO_DEFAULTS.introGlowShimmer}
      glowOffsetX={clampIntroGlowOffset(profile?.introGlowOffsetX)}
      glowOffsetY={clampIntroGlowOffset(profile?.introGlowOffsetY)}
      letterColors={sanitizeIntroLetterColors(profile?.introLetterColors)}
      squidColor={sanitizeIntroSquidColor(profile?.introSquidColor)}
    />
    <PublicThemeStyle theme={theme} />
    <NoImageDrag />
    <CursorGlow enabled={resolvedTheme.cursorGlowEnabled} />
    <BackgroundParallax enabled={resolvedTheme.bgEffect === "parallax"} />
    <CartProvider>
      <div className="min-h-screen flex flex-col">
        <SiteHeader
          settings={siteDesign.settings}
          menuItems={siteDesign.menuItems}
          socialLinks={socialLinks}
          marquees={marquees}
          releaseNotes={releaseNotes}
        />
        <main
          className="flex-1"
          style={{ paddingTop: `var(--marquee-h, ${marqueeOffset}px)` }}
        >
          {children}
        </main>
        <Footer socialLinks={socialLinks} footerIcon={profile?.footerIcon} />
      </div>
      <AnnouncementPopup />
      <FaqChatbox chatIcon={profile?.chatIcon} />
      <BackToTop />
      <VisitorCounterWidget />
      <BackgroundMusicPlayer
        musicUrl={profile?.musicEnabled ? profile.musicUrl : null}
        volume={profile?.musicVolume ?? 50}
      />
      <Toaster position="bottom-right" toastOptions={TOAST_OPTIONS} />
    </CartProvider>
    {/*
      Vercel Web Analytics tracking script — mounted here (public layout) only,
      never in app/(admin)/layout.tsx or the root app/layout.tsx, so admin
      sessions are never counted as site traffic. If pageviews aren't showing
      up in Vercel, confirm Web Analytics is actually turned on for this
      project: Vercel Dashboard → your project → Analytics tab → Enable.
      That toggle is separate from this script being present in the bundle.
    */}
    <Analytics />
    </RecaptchaProvider>
  );
}

