// app/(admin)/admin/settings/Preferences/page.tsx
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { resolveSiteTheme } from "@/lib/theme";
import { buildAdminSoundEffects } from "@/lib/sound/server";
import { sanitizeCarouselMode, clampCarouselSpeed } from "@/lib/gallery-carousel";
import { sanitizeHoverShimmer } from "@/lib/hover-shimmer";
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
import { getSiteDesign } from "@/lib/site-design-server";
import { getSocialLinks } from "@/lib/public-data";
import { PreferencesClient } from "./PreferencesClient";

export const metadata: Metadata = { title: "Preferences" };
export const dynamic = "force-dynamic";

export default async function AdminPreferencesPage() {
  const [profile, theme, soundEffects, siteDesign, socialLinks] = await Promise.all([
    prisma.profile.findFirst().catch(() => null),
    prisma.siteTheme.findFirst().catch(() => null),
    buildAdminSoundEffects().catch(() => []),
    // The Header / Menu / Homepage Hero tabs (Site Design, moved in here).
    getSiteDesign(),
    getSocialLinks().catch(() => []),
  ]);
  const resolvedTheme = resolveSiteTheme(theme);

  return (
    <div>
      <AdminPageHeader
        breadcrumbs={[
          { label: "Settings", href: "/admin/settings" },
          { label: "Preferences" },
        ]}
        title="Preferences"
        description="The public site's header, menu and homepage hero, site branding, the theme customizer, background music, and sound effects."
      />

      <PreferencesClient
        initialSidebarIcon={profile?.sidebarIcon || ""}
        initialChatIcon={profile?.chatIcon || ""}
        initialSidebarIconColors={profile?.sidebarIconColors || []}
        initialMaintenanceIcon={profile?.maintenanceIcon || ""}
        initialErrorIcon={profile?.errorIcon || ""}
        initialFooterIcon={profile?.footerIcon || ""}
        initialSidebarMobileIcon={profile?.sidebarMobileIcon || ""}
        initialSplashIcon={profile?.splashIcon || ""}
        initialFaviconIcon={profile?.faviconIcon || ""}
        initialMaintenanceIconColors={profile?.maintenanceIconColors || []}
        initialFooterIconColors={profile?.footerIconColors || []}
        initialSidebarMobileIconColors={profile?.sidebarMobileIconColors || []}
        initialSplashIconColors={profile?.splashIconColors || []}
        initialFaviconIconColors={profile?.faviconIconColors || []}
        initialBackgroundImage={profile?.backgroundImage || ""}
        initialBgBlur={resolvedTheme.bgBlur}
        initialBgEffect={resolvedTheme.bgEffect}
        initialBgEffectSpeedMs={resolvedTheme.bgEffectSpeedMs}
        initialAdminBackgroundImage={theme?.adminBackgroundImage || ""}
        initialAdminBgBlur={resolvedTheme.adminBgBlur}
        initialCarouselMode={sanitizeCarouselMode(profile?.carouselMode)}
        initialCarouselSpeed={clampCarouselSpeed(profile?.carouselSpeed)}
        initialStoriesCarouselMode={sanitizeCarouselMode(profile?.storiesCarouselMode)}
        initialStoriesCarouselSpeed={clampCarouselSpeed(profile?.storiesCarouselSpeed)}
        initialHoverShimmer={sanitizeHoverShimmer(profile?.hoverShimmer)}
        initialIntroEnabled={profile?.introEnabled ?? INTRO_DEFAULTS.introEnabled}
        initialIntroEffect={sanitizeIntroEffect(profile?.introEffect)}
        initialIntroSpeedMs={clampIntroSpeed(profile?.introSpeedMs)}
        initialIntroText={sanitizeIntroText(profile?.introText)}
        initialIntroBgColor={sanitizeIntroBgColor(profile?.introBgColor)}
        initialIntroTaglineFontSize={sanitizeIntroTaglineFontSize(profile?.introTaglineFontSize)}
        initialIntroTaglineFontFamily={sanitizeIntroTaglineFontFamily(profile?.introTaglineFontFamily)}
        initialIntroTextAbove={sanitizeIntroTextAbove(profile?.introTextAbove)}
        initialIntroTaglineColor={sanitizeIntroTaglineColor(profile?.introTaglineColor)}
        initialIntroTaglineAboveFontSize={sanitizeIntroTaglineAboveFontSize(profile?.introTaglineAboveFontSize)}
        initialIntroTaglineAboveFontFamily={sanitizeIntroTaglineAboveFontFamily(
          profile?.introTaglineAboveFontFamily
        )}
        initialIntroTaglineAboveColor={sanitizeIntroTaglineAboveColor(profile?.introTaglineAboveColor)}
        initialIntroTaglineFontSizeMobile={sanitizeIntroTaglineFontSizeMobile(
          profile?.introTaglineFontSizeMobile
        )}
        initialIntroTaglineAboveFontSizeMobile={sanitizeIntroTaglineFontSizeMobile(
          profile?.introTaglineAboveFontSizeMobile
        )}
        initialIntroGlowIntensity={clampIntroGlowIntensity(profile?.introGlowIntensity)}
        initialIntroGlowColor={sanitizeIntroGlowColor(profile?.introGlowColor)}
        initialIntroGlowShimmer={profile?.introGlowShimmer ?? INTRO_DEFAULTS.introGlowShimmer}
        initialIntroGlowOffsetX={clampIntroGlowOffset(profile?.introGlowOffsetX)}
        initialIntroGlowOffsetY={clampIntroGlowOffset(profile?.introGlowOffsetY)}
        initialIntroLetterColors={sanitizeIntroLetterColors(profile?.introLetterColors)}
        initialIntroSquidColor={sanitizeIntroSquidColor(profile?.introSquidColor)}
        initialTheme={resolvedTheme}
        initialMusicUrl={profile?.musicUrl ?? ""}
        initialMusicEnabled={profile?.musicEnabled ?? false}
        initialMusicVolume={profile?.musicVolume ?? 50}
        initialSoundEffects={soundEffects}
        siteDesign={{
          settings: siteDesign.settings,
          menuItems: siteDesign.menuItems,
          socialLinks: socialLinks.map(({ label, url, iconKey, hoverColor }) => ({ label, url, iconKey, hoverColor })),
        }}
      />
    </div>
  );
}
