// app/(admin)/admin/settings/Preferences/PreferencesClient.tsx
"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BrandingSection } from "./BrandingSection";
import { ThemeSection } from "./ThemeSection";
import { MusicClient } from "./MusicClient";
import { SoundClient } from "./SoundClient";
import { SiteDesignClient, SITE_DESIGN_TABS, type SiteDesignTabId } from "@/app/(admin)/admin/site-design/SiteDesignClient";
import type { MenuSocialLink } from "@/components/public/site-design/MenuPanel";
import type { SiteDesignSettings, SiteMenuItem } from "@/lib/site-design";
import type { SiteThemeSettings } from "@/lib/theme";
import type { CarouselMode } from "@/lib/gallery-carousel";
import type { HoverShimmerSettings } from "@/lib/hover-shimmer";
import type { IntroEffect, IntroLetterColors } from "@/lib/intro-splash";
import type { BgEffect } from "@/lib/theme";
import type { AdminSoundEffect } from "@/lib/sound/server";

// Site Design's three sections lead, ahead of Branding: they were their own
// sidebar module until they moved in here, and the header is the first thing
// anyone configuring the site's look reaches for.
type TabId = SiteDesignTabId | "branding" | "theme" | "music" | "sound";
const TAB_IDS: readonly TabId[] = ["header", "menu", "hero", "branding", "theme", "music", "sound"];
const TABS: { id: TabId; label: string }[] = [
  ...SITE_DESIGN_TABS,
  { id: "branding", label: "Branding" },
  { id: "theme", label: "Theme Customization" },
  { id: "music", label: "Background Music" },
  { id: "sound", label: "Sound" },
];

export function PreferencesClient({
  initialSidebarIcon,
  initialChatIcon,
  initialSidebarIconColors,
  initialMaintenanceIcon,
  initialErrorIcon,
  initialFooterIcon,
  initialSidebarMobileIcon,
  initialSplashIcon,
  initialFaviconIcon,
  initialMaintenanceIconColors,
  initialFooterIconColors,
  initialSidebarMobileIconColors,
  initialSplashIconColors,
  initialFaviconIconColors,
  initialBackgroundImage,
  initialBgBlur,
  initialBgEffect,
  initialBgEffectSpeedMs,
  initialAdminBackgroundImage,
  initialAdminBgBlur,
  initialCarouselMode,
  initialCarouselSpeed,
  initialStoriesCarouselMode,
  initialStoriesCarouselSpeed,
  initialHoverShimmer,
  initialIntroEnabled,
  initialIntroEffect,
  initialIntroSpeedMs,
  initialIntroText,
  initialIntroBgColor,
  initialIntroTaglineFontSize,
  initialIntroTaglineFontFamily,
  initialIntroTextAbove,
  initialIntroTaglineColor,
  initialIntroTaglineAboveFontSize,
  initialIntroTaglineAboveFontFamily,
  initialIntroTaglineAboveColor,
  initialIntroTaglineFontSizeMobile,
  initialIntroTaglineAboveFontSizeMobile,
  initialIntroGlowIntensity,
  initialIntroGlowColor,
  initialIntroGlowShimmer,
  initialIntroGlowOffsetX,
  initialIntroGlowOffsetY,
  initialIntroLetterColors,
  initialIntroSquidColor,
  initialTheme,
  initialMusicUrl,
  initialMusicEnabled,
  initialMusicVolume,
  initialSoundEffects,
  siteDesign,
}: {
  initialSidebarIcon: string;
  initialChatIcon: string;
  initialSidebarIconColors: string[];
  initialMaintenanceIcon: string;
  initialErrorIcon: string;
  initialFooterIcon: string;
  initialSidebarMobileIcon: string;
  initialSplashIcon: string;
  initialFaviconIcon: string;
  initialMaintenanceIconColors: string[];
  initialFooterIconColors: string[];
  initialSidebarMobileIconColors: string[];
  initialSplashIconColors: string[];
  initialFaviconIconColors: string[];
  initialBackgroundImage: string;
  initialBgBlur: string;
  initialBgEffect: BgEffect;
  initialBgEffectSpeedMs: number;
  initialAdminBackgroundImage: string;
  initialAdminBgBlur: string;
  initialCarouselMode: CarouselMode;
  initialCarouselSpeed: number;
  initialStoriesCarouselMode: CarouselMode;
  initialStoriesCarouselSpeed: number;
  initialHoverShimmer: HoverShimmerSettings;
  initialIntroEnabled: boolean;
  initialIntroEffect: IntroEffect;
  initialIntroSpeedMs: number;
  initialIntroText: string;
  initialIntroBgColor: string;
  initialIntroTaglineFontSize: string;
  initialIntroTaglineFontFamily: string;
  initialIntroTextAbove: string;
  initialIntroTaglineColor: string;
  initialIntroTaglineAboveFontSize: string;
  initialIntroTaglineAboveFontFamily: string;
  initialIntroTaglineAboveColor: string;
  /** Null = phones follow the desktop tagline size. */
  initialIntroTaglineFontSizeMobile: string | null;
  initialIntroTaglineAboveFontSizeMobile: string | null;
  initialIntroGlowIntensity: number;
  initialIntroGlowColor: string;
  initialIntroGlowShimmer: boolean;
  initialIntroGlowOffsetX: number;
  initialIntroGlowOffsetY: number;
  initialIntroLetterColors: IntroLetterColors;
  initialIntroSquidColor: string;
  initialTheme: SiteThemeSettings;
  initialMusicUrl: string;
  initialMusicEnabled: boolean;
  initialMusicVolume: number;
  initialSoundEffects: AdminSoundEffect[];
  siteDesign: {
    settings: SiteDesignSettings;
    menuItems: SiteMenuItem[];
    socialLinks: MenuSocialLink[];
  };
}) {
  const [activeTab, setActiveTab] = useState<TabId>("header");
  const searchParams = useSearchParams();

  // Deep-link support (e.g. /admin/settings/Preferences?tab=sound) — same
  // pattern as ArtworksClient.tsx's ?tab=museum, used by the Settings hub
  // cards and the Mini Games module's "configured under Sound" link.
  useEffect(() => {
    const requested = searchParams.get("tab");
    if (requested && (TAB_IDS as readonly string[]).includes(requested)) {
      setActiveTab(requested as TabId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return (
    <div>
      {/* Same segmented-control pattern as ArtworksClient.tsx/AnnouncementTabs.tsx
          — each tab sized to its own label (not stretched via flex-1 inside a
          max-w cap, which is what squeezed "Theme Customization" into
          "Background Music" once a 3rd/4th tab joined Branding/Theme). */}
      <div
        role="tablist"
        aria-label="Preferences section"
        className="flex gap-1 p-1 rounded-2xl admin-input border w-full sm:w-auto sm:inline-flex mb-6 overflow-x-auto"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 sm:flex-none inline-flex items-center justify-center px-4 py-2.5 rounded-xl font-jakarta text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? "bg-white dark:bg-[#1A1A1A] text-ink dark:text-cream shadow-sm"
                : "text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* One element for all three Site Design tabs, so it stays mounted
          while moving between them and they keep sharing one staged form
          and one Save — the way they did as their own page. */}
      {(activeTab === "header" || activeTab === "menu" || activeTab === "hero") && (
        <SiteDesignClient
          embedded
          tab={activeTab}
          initialSettings={siteDesign.settings}
          initialMenuItems={siteDesign.menuItems}
          socialLinks={siteDesign.socialLinks}
        />
      )}
      {activeTab === "branding" && (
        <BrandingSection
          initialSidebarIcon={initialSidebarIcon}
          initialChatIcon={initialChatIcon}
          initialSidebarIconColors={initialSidebarIconColors}
          initialMaintenanceIcon={initialMaintenanceIcon}
          initialErrorIcon={initialErrorIcon}
          initialFooterIcon={initialFooterIcon}
          initialSidebarMobileIcon={initialSidebarMobileIcon}
          initialSplashIcon={initialSplashIcon}
          initialFaviconIcon={initialFaviconIcon}
          initialMaintenanceIconColors={initialMaintenanceIconColors}
          initialFooterIconColors={initialFooterIconColors}
          initialSidebarMobileIconColors={initialSidebarMobileIconColors}
          initialSplashIconColors={initialSplashIconColors}
          initialFaviconIconColors={initialFaviconIconColors}
          initialBackgroundImage={initialBackgroundImage}
          initialBgBlur={initialBgBlur}
          initialBgEffect={initialBgEffect}
          initialBgEffectSpeedMs={initialBgEffectSpeedMs}
          initialAdminBackgroundImage={initialAdminBackgroundImage}
          initialAdminBgBlur={initialAdminBgBlur}
          initialCarouselMode={initialCarouselMode}
          initialCarouselSpeed={initialCarouselSpeed}
          initialStoriesCarouselMode={initialStoriesCarouselMode}
          initialStoriesCarouselSpeed={initialStoriesCarouselSpeed}
          initialHoverShimmer={initialHoverShimmer}
          initialIntroEnabled={initialIntroEnabled}
          initialIntroEffect={initialIntroEffect}
          initialIntroSpeedMs={initialIntroSpeedMs}
          initialIntroText={initialIntroText}
          initialIntroBgColor={initialIntroBgColor}
          initialIntroTaglineFontSize={initialIntroTaglineFontSize}
          initialIntroTaglineFontFamily={initialIntroTaglineFontFamily}
          initialIntroTextAbove={initialIntroTextAbove}
          initialIntroTaglineColor={initialIntroTaglineColor}
          initialIntroTaglineAboveFontSize={initialIntroTaglineAboveFontSize}
          initialIntroTaglineAboveFontFamily={initialIntroTaglineAboveFontFamily}
          initialIntroTaglineAboveColor={initialIntroTaglineAboveColor}
          initialIntroTaglineFontSizeMobile={initialIntroTaglineFontSizeMobile}
          initialIntroTaglineAboveFontSizeMobile={initialIntroTaglineAboveFontSizeMobile}
          initialIntroGlowIntensity={initialIntroGlowIntensity}
          initialIntroGlowColor={initialIntroGlowColor}
          initialIntroGlowShimmer={initialIntroGlowShimmer}
          initialIntroGlowOffsetX={initialIntroGlowOffsetX}
          initialIntroGlowOffsetY={initialIntroGlowOffsetY}
          initialIntroLetterColors={initialIntroLetterColors}
          initialIntroSquidColor={initialIntroSquidColor}
        />
      )}
      {activeTab === "theme" && <ThemeSection initialTheme={initialTheme} />}
      {activeTab === "music" && (
        <MusicClient
          initialMusicUrl={initialMusicUrl}
          initialMusicEnabled={initialMusicEnabled}
          initialMusicVolume={initialMusicVolume}
        />
      )}
      {activeTab === "sound" && <SoundClient effects={initialSoundEffects} />}
    </div>
  );
}
