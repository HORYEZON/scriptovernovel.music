// app/(admin)/admin/settings/Preferences/BrandingSection.tsx
"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { motion } from "framer-motion";
import toast from "@/lib/toast";
import { toggleSaved } from "@/lib/admin/toggleToast";
import { LogoUploader } from "./LogoUploader";
import { IconPicker } from "./IconPicker";
import { DEFAULT_HOVER_COLORS } from "./IconHoverColorsEditor";
import { BackgroundUploader } from "./BackgroundUploader";
import { IntroSplashSection } from "./IntroSplashSection";
import { SettingsAccordion, useAccordionSections } from "./SettingsAccordion";
import {
  CAROUSEL_MODES,
  CAROUSEL_SPEED_PRESETS,
  CAROUSEL_DEFAULTS,
  MIN_CAROUSEL_SPEED,
  MAX_CAROUSEL_SPEED,
  carouselLoopDuration,
  type CarouselMode,
} from "@/lib/gallery-carousel";
import { INTRO_DEFAULTS, type IntroEffect, type IntroLetterColors } from "@/lib/intro-splash";
import { UnsavedChangesBar } from "@/components/admin/UnsavedChangesBar";
import {
  SHIMMER_SURFACES,
  SHIMMER_SPEED_PRESETS,
  DEFAULT_SHIMMER,
  DEFAULT_HOVER_SHIMMER,
  MIN_SHIMMER_SPEED,
  MAX_SHIMMER_SPEED,
  MIN_SHIMMER_BRIGHTNESS,
  MAX_SHIMMER_BRIGHTNESS,
  sanitizeShimmerColor,
  shimmerBandStyle,
  type HoverShimmerSettings,
  type ShimmerSettings,
  type ShimmerSurface,
} from "@/lib/hover-shimmer";
import {
  BG_BLUR_PRESETS,
  MIN_BG_BLUR,
  MAX_BG_BLUR,
  parseBlurPx,
  formatBlurPx,
} from "@/lib/theme";

interface BrandingForm {
  logoImage: string;
  sidebarIcon: string;
  chatIcon: string;
  sidebarIconColors: string[];
  // More icon-gallery picker slots — see prisma/schema.prisma's comment on
  // each Profile field for exactly where it renders.
  maintenanceIcon: string;
  errorIcon: string;
  footerIcon: string;
  sidebarMobileIcon: string;
  splashIcon: string;
  faviconIcon: string;
  // Each hover-color-enabled slot's own independent cycle — see
  // IconPicker.tsx's hoverColors prop. chatIcon/errorIcon deliberately have
  // no counterpart here (excluded from the feature).
  maintenanceIconColors: string[];
  footerIconColors: string[];
  sidebarMobileIconColors: string[];
  splashIconColors: string[];
  faviconIconColors: string[];
  backgroundImage: string;
  // SiteTheme.bgBlur — the public background's frosted-glass blur intensity
  // (a "Npx" length string, see lib/theme.ts). Saved via the same /api/theme
  // PUT as adminBackgroundImage below, for the same reason.
  bgBlur: string;
  // SiteTheme.adminBackgroundImage, not a Profile column — saved via a
  // separate /api/theme PUT in save() below, kept in this same form purely
  // so BackgroundUploader's dirty/reset handling works like every other
  // field here.
  adminBackgroundImage: string;
  // SiteTheme.adminBgBlur — same idea as bgBlur, for the admin dashboard's
  // own background image.
  adminBgBlur: string;
  carouselMode: CarouselMode;
  carouselSpeed: number;
  storiesCarouselMode: CarouselMode;
  storiesCarouselSpeed: number;
  // Profile.hoverShimmer — the hover light-sweep on the Gallery / Tales /
  // Shop grids, per surface. Sent whole; see lib/hover-shimmer.ts.
  hoverShimmer: HoverShimmerSettings;
  introEnabled: boolean;
  introEffect: IntroEffect;
  introSpeedMs: number;
  introText: string;
  introTextAbove: string;
  introBgColor: string;
  introTaglineFontSize: string;
  introTaglineColor: string;
  introTaglineAboveFontSize: string;
  introTaglineAboveColor: string;
  introTaglineFontFamily: string;
  introTaglineAboveFontFamily: string;
  introTaglineFontSizeMobile: string | null;
  introTaglineAboveFontSizeMobile: string | null;
  introGlowIntensity: number;
  introGlowColor: string;
  introGlowShimmer: boolean;
  introGlowOffsetX: number;
  introGlowOffsetY: number;
  introLetterColors: IntroLetterColors;
  introSquidColor: string;
}

// Blur/glass intensity meter shown under a BackgroundUploader once it has an
// image — a slider + preset chips (same language as the carousel Speed
// control below) plus a live swatch of the uploaded photo at the chosen
// blur, so the effect is visible without leaving this page. Only ever
// rendered for an uploaded image, hence taking imageUrl as required.
function BlurIntensityControl({
  label,
  imageUrl,
  valuePx,
  onChange,
}: {
  label: string;
  imageUrl: string;
  valuePx: number;
  onChange: (px: number) => void;
}) {
  return (
    <div className="mt-4 pt-4 border-t border-black/10 dark:border-white/10">
      <div className="flex items-center justify-between mb-2">
        <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300">
          {label}
        </label>
        <span className="font-mono text-xs text-ink-400 dark:text-ink-300">
          {valuePx}px
        </span>
      </div>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <input
          type="range"
          min={MIN_BG_BLUR}
          max={MAX_BG_BLUR}
          value={valuePx}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 accent-sepia cursor-pointer"
          aria-label={label}
        />
        <div className="flex gap-1 shrink-0">
          {BG_BLUR_PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => onChange(preset.px)}
              title={preset.name}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] uppercase tracking-wider border transition-all ${
                valuePx === preset.px
                  ? "bg-sepia text-white border-sepia font-medium"
                  : "border-black/10 dark:border-white/10 text-ink-400 dark:text-ink-300 hover:border-black/30 dark:hover:border-white/30"
              }`}
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* Live preview — the actual uploaded photo at the chosen blur, since
          backdrop-filter blur only reads correctly against real content and
          can't be previewed meaningfully any other way. */}
      <div className="mt-3 relative w-full h-24 rounded-xl overflow-hidden border border-black/10 dark:border-white/10 bg-ink-100 dark:bg-ink-800">
        <div
          className="absolute -inset-2 bg-cover bg-center"
          style={{ backgroundImage: `url('${imageUrl}')`, filter: `blur(${valuePx}px)` }}
          aria-hidden="true"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-body text-[10px] tracking-widest uppercase text-white bg-black/50 px-2 py-1 rounded-md">
            Preview
          </span>
        </div>
      </div>
    </div>
  );
}

// A handful of stand-in "section cards" — no real gallery data needed, this
// is purely to demonstrate motion/layout, not content.
const PREVIEW_CARDS = [
  { label: "Traditional", from: "from-sepia/50" },
  { label: "Digital", from: "from-indigo-500/50" },
  { label: "Sketches", from: "from-emerald-500/50" },
  { label: "Portraits", from: "from-vermillion/50" },
  { label: "Character", from: "from-sky-500/50" },
  { label: "Concept", from: "from-fuchsia-500/50" },
];

function PreviewCard({ label, from }: { label: string; from: string }) {
  return (
    <div
      className={`aspect-[4/5] w-20 shrink-0 rounded-lg bg-gradient-to-br ${from} to-black/60 border border-white/10 flex items-end p-1.5`}
    >
      <span className="font-body text-[8px] text-white/80 uppercase tracking-wide truncate">
        {label}
      </span>
    </div>
  );
}

// Live demo of the actual mobile behavior each carousel mode produces —
// same math (carouselLoopDuration) the public GalleryClient uses, so the
// "Xs per loop" in the caption is the real number, not an approximation.
function CarouselPreview({
  mode,
  speed,
}: {
  mode: CarouselMode;
  speed: number;
}) {
  const doubled = [...PREVIEW_CARDS, ...PREVIEW_CARDS];
  const duration = carouselLoopDuration(PREVIEW_CARDS.length, speed);

  return (
    <div className="rounded-xl border border-white/10 bg-ink-900 p-4 overflow-hidden">
      <p className="font-body text-[10px] tracking-widest uppercase text-cream/40 mb-3">
        Preview — mobile
      </p>

      {mode === "grid" ? (
        // Real 2-column grid (matches GalleryClient.tsx's grid-cols-2 on
        // mobile) with fixed-width tracks so cards stay the same size as
        // the swipe/auto previews instead of stretching to fill the row.
        <div className="grid grid-cols-[repeat(2,5rem)] gap-2 mx-auto justify-center">
          {PREVIEW_CARDS.map((card) => (
            <PreviewCard key={card.label} label={card.label} from={card.from} />
          ))}
        </div>
      ) : mode === "swipe" ? (
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {PREVIEW_CARDS.map((card) => (
            <PreviewCard key={card.label} label={card.label} from={card.from} />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden">
          <motion.div
            className="flex gap-2 w-max"
            animate={{ x: ["0%", "-50%"] }}
            transition={{
              x: {
                repeat: Infinity,
                repeatType: "loop",
                duration,
                ease: "linear",
              },
            }}
          >
            {doubled.map((card, i) => (
              <PreviewCard
                key={`${card.label}-${i}`}
                label={card.label}
                from={card.from}
              />
            ))}
          </motion.div>
        </div>
      )}

      <p className="font-body text-[10px] text-cream/40 mt-3">
        {mode === "auto" && `Auto-scrolling — full loop every ~${duration}s`}
        {mode === "swipe" &&
          "Static here — on a phone, visitors swipe to browse"}
        {mode === "grid" && "Static grid — identical to the desktop layout"}
      </p>
    </div>
  );
}

// Moved out of AboutClient.tsx's "Media & Branding" tab — logo/background
// are still Profile columns (see prisma/schema.prisma), just edited from
// Settings → Preferences now instead of About. Saves via a partial PUT to
// /api/profile, which only updates the fields present in the body.
export function BrandingSection({
  initialLogoImage,
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
  initialIntroTextAbove,
  initialIntroBgColor,
  initialIntroTaglineFontSize,
  initialIntroTaglineFontFamily,
  initialIntroTaglineColor,
  initialIntroTaglineAboveFontSize,
  initialIntroTaglineAboveFontFamily,
  initialIntroTaglineFontSizeMobile,
  initialIntroTaglineAboveFontSizeMobile,
  initialIntroTaglineAboveColor,
  initialIntroGlowIntensity,
  initialIntroGlowColor,
  initialIntroGlowShimmer,
  initialIntroGlowOffsetX,
  initialIntroGlowOffsetY,
  initialIntroLetterColors,
  initialIntroSquidColor,
}: {
  initialLogoImage: string;
  initialSidebarIcon: string;
  initialChatIcon: string;
  initialSidebarIconColors: string[];
  initialMaintenanceIcon?: string;
  initialErrorIcon?: string;
  initialFooterIcon?: string;
  initialSidebarMobileIcon?: string;
  initialSplashIcon?: string;
  initialFaviconIcon?: string;
  initialMaintenanceIconColors?: string[];
  initialFooterIconColors?: string[];
  initialSidebarMobileIconColors?: string[];
  initialSplashIconColors?: string[];
  initialFaviconIconColors?: string[];
  initialBackgroundImage: string;
  initialBgBlur?: string;
  initialAdminBackgroundImage?: string;
  initialAdminBgBlur?: string;
  initialCarouselMode?: CarouselMode;
  initialCarouselSpeed?: number;
  initialStoriesCarouselMode?: CarouselMode;
  initialStoriesCarouselSpeed?: number;
  initialHoverShimmer?: HoverShimmerSettings;
  initialIntroEnabled?: boolean;
  initialIntroEffect?: IntroEffect;
  initialIntroSpeedMs?: number;
  initialIntroText?: string;
  initialIntroTextAbove?: string;
  initialIntroBgColor?: string;
  initialIntroTaglineFontSize?: string;
  initialIntroTaglineFontFamily?: string;
  initialIntroTaglineColor?: string;
  initialIntroTaglineAboveFontSize?: string;
  initialIntroTaglineAboveFontFamily?: string;
  /** Null (and absent) both mean "phones follow the desktop size". */
  initialIntroTaglineFontSizeMobile?: string | null;
  initialIntroTaglineAboveFontSizeMobile?: string | null;
  initialIntroTaglineAboveColor?: string;
  initialIntroGlowIntensity?: number;
  initialIntroGlowColor?: string;
  initialIntroGlowShimmer?: boolean;
  initialIntroGlowOffsetX?: number;
  initialIntroGlowOffsetY?: number;
  initialIntroLetterColors?: IntroLetterColors;
  initialIntroSquidColor?: string;
}) {
  const formInit: BrandingForm = {
    logoImage: initialLogoImage,
    sidebarIcon: initialSidebarIcon,
    chatIcon: initialChatIcon,
    sidebarIconColors:
      initialSidebarIconColors.length > 0
        ? initialSidebarIconColors
        : DEFAULT_HOVER_COLORS,
    maintenanceIcon: initialMaintenanceIcon ?? "",
    errorIcon: initialErrorIcon ?? "",
    footerIcon: initialFooterIcon ?? "",
    sidebarMobileIcon: initialSidebarMobileIcon ?? "",
    splashIcon: initialSplashIcon ?? "",
    faviconIcon: initialFaviconIcon ?? "",
    maintenanceIconColors:
      initialMaintenanceIconColors && initialMaintenanceIconColors.length > 0
        ? initialMaintenanceIconColors
        : DEFAULT_HOVER_COLORS,
    footerIconColors:
      initialFooterIconColors && initialFooterIconColors.length > 0
        ? initialFooterIconColors
        : DEFAULT_HOVER_COLORS,
    sidebarMobileIconColors:
      initialSidebarMobileIconColors &&
      initialSidebarMobileIconColors.length > 0
        ? initialSidebarMobileIconColors
        : DEFAULT_HOVER_COLORS,
    splashIconColors:
      initialSplashIconColors && initialSplashIconColors.length > 0
        ? initialSplashIconColors
        : DEFAULT_HOVER_COLORS,
    faviconIconColors:
      initialFaviconIconColors && initialFaviconIconColors.length > 0
        ? initialFaviconIconColors
        : DEFAULT_HOVER_COLORS,
    backgroundImage: initialBackgroundImage,
    bgBlur: initialBgBlur ?? "10px",
    adminBackgroundImage: initialAdminBackgroundImage ?? "",
    adminBgBlur: initialAdminBgBlur ?? "0px",
    carouselMode: initialCarouselMode ?? CAROUSEL_DEFAULTS.carouselMode,
    carouselSpeed: initialCarouselSpeed ?? CAROUSEL_DEFAULTS.carouselSpeed,
    storiesCarouselMode: initialStoriesCarouselMode ?? CAROUSEL_DEFAULTS.carouselMode,
    storiesCarouselSpeed: initialStoriesCarouselSpeed ?? CAROUSEL_DEFAULTS.carouselSpeed,
    hoverShimmer: initialHoverShimmer ?? DEFAULT_HOVER_SHIMMER,
    introEnabled: initialIntroEnabled ?? INTRO_DEFAULTS.introEnabled,
    introEffect: initialIntroEffect ?? INTRO_DEFAULTS.introEffect,
    introSpeedMs: initialIntroSpeedMs ?? INTRO_DEFAULTS.introSpeedMs,
    introText: initialIntroText ?? INTRO_DEFAULTS.introText,
    introBgColor: initialIntroBgColor ?? INTRO_DEFAULTS.introBgColor,
    introTaglineFontSize:
      initialIntroTaglineFontSize ?? INTRO_DEFAULTS.introTaglineFontSize,
    introTaglineFontFamily:
      initialIntroTaglineFontFamily ?? INTRO_DEFAULTS.introTaglineFontFamily,
    introTextAbove: initialIntroTextAbove ?? INTRO_DEFAULTS.introTextAbove,
    introTaglineColor: initialIntroTaglineColor ?? INTRO_DEFAULTS.introTaglineColor,
    introTaglineAboveFontSize:
      initialIntroTaglineAboveFontSize ?? INTRO_DEFAULTS.introTaglineAboveFontSize,
    introTaglineAboveColor:
      initialIntroTaglineAboveColor ?? INTRO_DEFAULTS.introTaglineAboveColor,
    introTaglineAboveFontFamily:
      initialIntroTaglineAboveFontFamily ?? INTRO_DEFAULTS.introTaglineAboveFontFamily,
    // `?? null`, not a default — an unset override is the feature's off state,
    // not a missing value to fill in.
    introTaglineFontSizeMobile: initialIntroTaglineFontSizeMobile ?? null,
    introTaglineAboveFontSizeMobile: initialIntroTaglineAboveFontSizeMobile ?? null,
    introGlowIntensity: initialIntroGlowIntensity ?? INTRO_DEFAULTS.introGlowIntensity,
    introGlowColor: initialIntroGlowColor ?? INTRO_DEFAULTS.introGlowColor,
    introGlowShimmer: initialIntroGlowShimmer ?? INTRO_DEFAULTS.introGlowShimmer,
    introGlowOffsetX: initialIntroGlowOffsetX ?? INTRO_DEFAULTS.introGlowOffsetX,
    introGlowOffsetY: initialIntroGlowOffsetY ?? INTRO_DEFAULTS.introGlowOffsetY,
    introLetterColors: initialIntroLetterColors ?? INTRO_DEFAULTS.introLetterColors,
    introSquidColor: initialIntroSquidColor ?? INTRO_DEFAULTS.introSquidColor,
  };
  // Every section starts open, so the tab looks exactly as it did before the
  // accordions existed until an admin folds one — same choice RoomsTab made.
  const sections = useAccordionSections("admin_preferences_branding_sections", {
    branding: true,
    icons: true,
    carousels: true,
    shimmer: true,
    splash: true,
  });
  const [form, setForm] = useState<BrandingForm>(formInit);
  const savedFormRef = useRef(formInit);
  const [saving, setSaving] = useState(false);
  const isDirty = JSON.stringify(form) !== JSON.stringify(savedFormRef.current);
  const allSectionsOpen = Object.values(sections.open).every(Boolean);
  const router = useRouter();

  async function save() {
    setSaving(true);
    try {
      // adminBackgroundImage/bgBlur/adminBgBlur all live on SiteTheme, not
      // Profile — split into two independent PUTs so they never ride along
      // in the Profile payload (which the API route would just ignore
      // anyway) and, more importantly, so a later save from the Theme tab
      // can't clobber adminBackgroundImage — see app/api/theme/route.ts's
      // comment on why that one's handled as its own passthrough there.
      // bgBlur/adminBgBlur go through the same call since they're proper
      // SiteThemeSettings fields (sanitizeThemeInput validates them).
      const { adminBackgroundImage, bgBlur, adminBgBlur, ...profileForm } = form;
      const [profileRes, themeRes] = await Promise.all([
        fetch("/api/profile", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(profileForm),
        }),
        fetch("/api/theme", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ adminBackgroundImage, bgBlur, adminBgBlur }),
        }),
      ]);
      if (!profileRes.ok || !themeRes.ok) throw new Error();
      savedFormRef.current = { ...form };
      toast.success("Branding updated");
      // AdminThemeStyle/the root layout's --bg-image are rendered by server
      // components (app/(admin)/layout.tsx, app/layout.tsx) that only
      // re-fetch on navigation — without this, a successful save wouldn't
      // visibly change anything (background image, blur, or otherwise)
      // until the admin manually reloaded the page.
      router.refresh();
    } catch {
      toast.error("Failed to save branding");
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setForm({ ...savedFormRef.current });
  }

  /**
   * A single field written straight to the database, no Save Branding needed.
   *
   * Reserved for the Entrance Splash's two switches. Every other control on
   * this tab is a value being *composed* — a colour being nudged, a tagline
   * being typed — where staging until Save is right. A switch isn't: an admin
   * flipping "Shimmer" has already made the whole decision, and asking them to
   * then find a button at the bottom of a long tab to commit one boolean was
   * the extra step. Persisting only the one field (the API's PUT is partial —
   * see app/api/profile/route.ts) means it can't carry someone's half-composed
   * tagline along with it.
   *
   * savedFormRef moves with the form, so the flip doesn't leave the tab
   * looking dirty; a failed write rolls both back so what's on screen is
   * always what's in the database.
   */
  async function saveField(patch: Partial<BrandingForm>, label: string, on: boolean) {
    const keys = Object.keys(patch) as (keyof BrandingForm)[];
    const previous = Object.fromEntries(
      keys.map((k) => [k, savedFormRef.current[k]])
    ) as Partial<BrandingForm>;
    setForm((f) => ({ ...f, ...patch }));
    savedFormRef.current = { ...savedFormRef.current, ...patch };
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error();
      toggleSaved(label, on);
      router.refresh();
    } catch {
      setForm((f) => ({ ...f, ...previous }));
      savedFormRef.current = { ...savedFormRef.current, ...previous };
      toast.error(`Failed to save ${label.toLowerCase()}`);
    }
  }

  return (
    <div className="space-y-5">
      {/* One control for all four sections — folding them one at a time to get
          to the bottom of the tab is the chore the accordions were meant to
          remove, not create. */}
      <div className="flex justify-end -mb-1">
        <button
          type="button"
          onClick={() => sections.setAll(!allSectionsOpen)}
          className="font-body text-xs text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream transition-colors"
        >
          {allSectionsOpen ? "Collapse all" : "Expand all"}
        </button>
      </div>

      <SettingsAccordion
        title="Branding"
        description="Site logo and the background photos behind the public site and this dashboard."
        open={sections.open.branding}
        onToggle={() => sections.toggle("branding")}
      >

        {/* Same 3-up card-grid language as Icons/Transition Effect below —
            these dropzones used to stack full-width, which read as
            oversized/mostly-empty banners once there were three of them on
            a wide desktop viewport. */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <LogoUploader
            value={form.logoImage}
            onChange={(url) => setForm((f) => ({ ...f, logoImage: url }))}
          />
          <div>
            <BackgroundUploader
              value={form.backgroundImage}
              onChange={(url) => setForm((f) => ({ ...f, backgroundImage: url }))}
            />
            {form.backgroundImage && (
              <BlurIntensityControl
                label="Blur / Glass Intensity"
                imageUrl={form.backgroundImage}
                valuePx={parseBlurPx(form.bgBlur)}
                onChange={(px) =>
                  setForm((f) => ({ ...f, bgBlur: formatBlurPx(px) }))
                }
              />
            )}
          </div>
          <div>
            <BackgroundUploader
              value={form.adminBackgroundImage}
              onChange={(url) =>
                setForm((f) => ({ ...f, adminBackgroundImage: url }))
              }
              label="Admin Background Image"
              helpText="Shown behind the admin dashboard's own cards. Leave unset to keep today's plain background."
              revertLabel="Revert to default admin background"
            />
            {form.adminBackgroundImage && (
              <BlurIntensityControl
                label="Blur / Glass Intensity"
                imageUrl={form.adminBackgroundImage}
                valuePx={parseBlurPx(form.adminBgBlur)}
                onChange={(px) =>
                  setForm((f) => ({ ...f, adminBgBlur: formatBlurPx(px) }))
                }
              />
            )}
          </div>
        </div>
      </SettingsAccordion>

      <SettingsAccordion
        title="Icons"
        description="Every squid mascot on the site, each independently swappable. Hover a tile for what it controls; unset ones keep the default squid. Icons are listed alphabetically inside each picker, and most have their own hover-color cycle, editable from inside that picker’s own dialog."
        open={sections.open.icons}
        onToggle={() => sections.toggle("icons")}
      >

        {/* Same card grid language as Transition Effect below — one compact
            tile per icon slot instead of each being its own full-width row,
            now that there are 8 of these. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <IconPicker
            label="Admin Sidebar Icon"
            helpText="Shown when the Admin Sidebar is collapsed. Leave unset to keep the default squid."
            value={form.sidebarIcon}
            onChange={(name) => setForm((f) => ({ ...f, sidebarIcon: name }))}
            defaultLabel="Using the default squid icon"
            hoverColors={form.sidebarIconColors}
            onHoverColorsChange={(colors) =>
              setForm((f) => ({ ...f, sidebarIconColors: colors }))
            }
          />
          <IconPicker
            label="Admin Sidebar Mobile Icon"
            helpText="Stands in for the second “A” in the SCRIPTOVERNOVEL wordmark shown in the Admin Sidebar's mobile top bar (below the md breakpoint). Separate from Admin Sidebar Icon above, which is the collapsed desktop sidebar's icon-only state. Leave unset to keep the default squid."
            value={form.sidebarMobileIcon}
            onChange={(name) =>
              setForm((f) => ({ ...f, sidebarMobileIcon: name }))
            }
            defaultLabel="Using the default squid icon"
            hoverColors={form.sidebarMobileIconColors}
            onHoverColorsChange={(colors) =>
              setForm((f) => ({ ...f, sidebarMobileIconColors: colors }))
            }
          />
          <IconPicker
            label="Entrance Splash Icon"
            helpText="Stands in for the second “A” in the SCRIPTOVERNOVEL wordmark shown on the homepage's one-time entrance splash — see the Entrance Splash card below for the rest of that animation's settings. Leave unset to keep the default squid."
            value={form.splashIcon}
            onChange={(name) => setForm((f) => ({ ...f, splashIcon: name }))}
            defaultLabel="Using the default squid icon"
            hoverColors={form.splashIconColors}
            onHoverColorsChange={(colors) =>
              setForm((f) => ({ ...f, splashIconColors: colors }))
            }
          />
          <IconPicker
            label="FAQ Chat Icon"
            helpText="Shown on the public FAQ chat toggle button. Leave unset to keep the default squid."
            value={form.chatIcon}
            onChange={(name) => setForm((f) => ({ ...f, chatIcon: name }))}
            defaultLabel="Using the default squid icon"
          />
          <IconPicker
            label="Favicon"
            helpText="The browser-tab icon for the whole site, on a dark background — cycles through the hover colors below (that's a real animation here, not just a picker preview). Browsers cache favicons aggressively, so a change here may take a visit or two to show up. Leave unset to keep the default squid."
            value={form.faviconIcon}
            onChange={(name) => setForm((f) => ({ ...f, faviconIcon: name }))}
            defaultLabel="Using the default squid icon"
            hoverColors={form.faviconIconColors}
            onHoverColorsChange={(colors) =>
              setForm((f) => ({ ...f, faviconIconColors: colors }))
            }
            hoverColorsHelpText="Colors the browser-tab favicon actually glows through, live, on a loop — not just a preview in this dialog."
          />
          <IconPicker
            label="Footer Icon"
            helpText="Stands in for the second “A” in the SCRIPTOVERNOVEL wordmark shown in the site footer. Leave unset to keep the default squid."
            value={form.footerIcon}
            onChange={(name) => setForm((f) => ({ ...f, footerIcon: name }))}
            defaultLabel="Using the default squid icon"
            hoverColors={form.footerIconColors}
            onHoverColorsChange={(colors) =>
              setForm((f) => ({ ...f, footerIconColors: colors }))
            }
          />
          <IconPicker
            label="Maintenance Mode Icon"
            helpText="Shown on the maintenance page visitors see while the site is offline (Settings → Maintenance). Leave unset to keep the default squid."
            value={form.maintenanceIcon}
            onChange={(name) =>
              setForm((f) => ({ ...f, maintenanceIcon: name }))
            }
            defaultLabel="Using the default squid icon"
            hoverColors={form.maintenanceIconColors}
            onHoverColorsChange={(colors) =>
              setForm((f) => ({ ...f, maintenanceIconColors: colors }))
            }
          />
          <IconPicker
            label="Server Error Icon"
            helpText="Shown on the “Something Went Wrong” page after an unexpected crash. Leave unset to keep the default squid."
            value={form.errorIcon}
            onChange={(name) => setForm((f) => ({ ...f, errorIcon: name }))}
            defaultLabel="Using the default squid icon"
          />
        </div>
      </SettingsAccordion>

      {/* One card, two tabs (Gallery / Stories). Same controls and sanitizers
          for each — they just write to separate Profile columns (see
          Profile.storiesCarouselMode). Kept as one card because the Stories
          shelf shipped its own carousel and a second full-height card here was
          pure duplication. */}
      <CarouselSettingsCard
        open={sections.open.carousels}
        onToggle={() => sections.toggle("carousels")}
        tabs={[
          {
            id: "gallery",
            label: "Gallery",
            description:
              "Controls how the homepage's section cards behave on small screens.",
            idPrefix: "gallery",
            mode: form.carouselMode,
            speed: form.carouselSpeed,
            onModeChange: (mode) =>
              setForm((f) => ({ ...f, carouselMode: mode })),
            onSpeedChange: (speed) =>
              setForm((f) => ({ ...f, carouselSpeed: speed })),
          },
          {
            id: "stories",
            label: "Stories",
            description:
              "Controls how the Stories shelf's book covers behave on small screens.",
            idPrefix: "stories",
            mode: form.storiesCarouselMode,
            speed: form.storiesCarouselSpeed,
            onModeChange: (mode) =>
              setForm((f) => ({ ...f, storiesCarouselMode: mode })),
            onSpeedChange: (speed) =>
              setForm((f) => ({ ...f, storiesCarouselSpeed: speed })),
          },
        ]}
      />

      {/* Same one-card / tab-strip shape as Mobile Carousels above, for the
          same reason: three grids, one set of controls, each tab writing to
          its own key of the one Profile.hoverShimmer column. */}
      <HoverShimmerCard
        value={form.hoverShimmer}
        onChange={(surface, patch) =>
          setForm((f) => ({
            ...f,
            hoverShimmer: {
              ...f.hoverShimmer,
              [surface]: { ...f.hoverShimmer[surface], ...patch },
            },
          }))
        }
        open={sections.open.shimmer}
        onToggle={() => sections.toggle("shimmer")}
      />

      <IntroSplashSection
        value={{
          introEnabled: form.introEnabled,
          introEffect: form.introEffect,
          introSpeedMs: form.introSpeedMs,
          introText: form.introText,
          introBgColor: form.introBgColor,
          introTaglineFontSize: form.introTaglineFontSize,
          introTaglineFontFamily: form.introTaglineFontFamily,
          introTextAbove: form.introTextAbove,
          introTaglineColor: form.introTaglineColor,
          introTaglineAboveFontSize: form.introTaglineAboveFontSize,
          introTaglineAboveFontFamily: form.introTaglineAboveFontFamily,
          introTaglineAboveColor: form.introTaglineAboveColor,
          introTaglineFontSizeMobile: form.introTaglineFontSizeMobile,
          introTaglineAboveFontSizeMobile: form.introTaglineAboveFontSizeMobile,
          introGlowIntensity: form.introGlowIntensity,
          introGlowColor: form.introGlowColor,
          introGlowShimmer: form.introGlowShimmer,
          introGlowOffsetX: form.introGlowOffsetX,
          introGlowOffsetY: form.introGlowOffsetY,
          introLetterColors: form.introLetterColors,
          introSquidColor: form.introSquidColor,
          // Read-only here — edited via the Entrance Splash Icon picker in
          // the Icons card above, just passed through so this card's own
          // preview reflects it too instead of looking stale/wrong.
          splashIcon: form.splashIcon,
        }}
        onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
        // The two switches in this card write themselves — see saveField.
        onToggleSave={(patch, label, on) => void saveField(patch, label, on)}
        open={sections.open.splash}
        onToggle={() => sections.toggle("splash")}
      />

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving || !isDirty}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sepia text-white font-jakarta text-sm font-medium hover:bg-sepia-dark transition-all duration-200 shadow-md disabled:opacity-50"
        >
          {saving ? (
            <>
              <div className="w-4 h-4 border border-cream/30 border-t-cream rounded-full animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Save size={16} />
              Save Branding
            </>
          )}
        </button>
        {isDirty && !saving && (
          <button
            type="button"
            onClick={reset}
            className="font-body text-xs text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream transition-colors"
          >
            Discard changes
          </button>
        )}
      </div>

      <UnsavedChangesBar
        dirty={isDirty}
        what="branding"
        saving={saving}
        onSave={save}
        onReset={reset}
      />
    </div>
  );
}

type CarouselTab = {
  id: string;
  label: string;
  description: string;
  /** Keeps the range input's id unique across tabs. */
  idPrefix: string;
  mode: CarouselMode;
  speed: number;
  onModeChange: (mode: CarouselMode) => void;
  onSpeedChange: (speed: number) => void;
};

// The Mobile Carousel settings card. One card, one set of controls, with a
// tab strip selecting which grid (Gallery / Stories) the controls currently
// edit — each tab writes to its own Profile columns. Extracted rather than
// written per-grid so the mode picker + speed slider + live preview stay in
// one place instead of drifting between copies.
function CarouselSettingsCard({
  tabs,
  open,
  onToggle,
}: {
  tabs: CarouselTab[];
  open: boolean;
  onToggle: () => void;
}) {
  const [activeId, setActiveId] = useState(tabs[0]?.id);
  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];

  if (!active) return null;

  return (
    <SettingsAccordion title="Mobile Carousels" open={open} onToggle={onToggle}>
        <div className="border-b border-black/10 dark:border-white/10 pb-4">
          <div
            role="tablist"
            aria-label="Which carousel to configure"
            className="mt-3 inline-flex gap-1 p-1 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10"
          >
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={t.id === active.id}
                onClick={() => setActiveId(t.id)}
                className={`px-4 py-1.5 rounded-lg font-body text-xs font-medium transition-all ${
                  t.id === active.id
                    ? "bg-white dark:bg-[#1A1A1A] text-ink dark:text-cream shadow-sm"
                    : "text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <p className="font-body text-xs text-ink-400 dark:text-ink-300 mt-3">
            {active.description}
          </p>
        </div>

        <CarouselControls
          idPrefix={active.idPrefix}
          mode={active.mode}
          speed={active.speed}
          onModeChange={active.onModeChange}
          onSpeedChange={active.onSpeedChange}
        />
    </SettingsAccordion>
  );
}

// Mode picker + speed slider + live preview for a single carousel. Rendered
// once by CarouselSettingsCard, fed whichever tab is active.
function CarouselControls({
  idPrefix,
  mode,
  speed,
  onModeChange,
  onSpeedChange,
}: {
  idPrefix: string;
  mode: CarouselMode;
  speed: number;
  onModeChange: (mode: CarouselMode) => void;
  onSpeedChange: (speed: number) => void;
}) {
  return (
    <>
        {/* Mode picker */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">
            Mode
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {CAROUSEL_MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() =>
                  onModeChange(m.value)
                }
                className={`text-left p-3 rounded-xl border transition-all ${
                  mode === m.value
                    ? "border-sepia bg-sepia/10"
                    : "border-black/10 dark:border-white/10 hover:border-black/30 dark:hover:border-white/30"
                }`}
              >
                <p
                  className={`font-body text-sm font-medium ${
                    mode === m.value
                      ? "text-sepia"
                      : "text-ink dark:text-cream"
                  }`}
                >
                  {m.label}
                </p>
                <p className="font-body text-[11px] text-ink-400 dark:text-ink-300 mt-1">
                  {m.description}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Speed — only meaningful in Auto-scroll mode */}
        <div
          className={
            mode !== "auto" ? "opacity-50 pointer-events-none" : ""
          }
        >
          <label
            htmlFor={`${idPrefix}-carousel-speed`}
            className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2"
          >
            Speed —{" "}
            <span className="font-mono normal-case tracking-normal text-ink dark:text-cream">
              {speed}s per card
            </span>
          </label>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <input
              id={`${idPrefix}-carousel-speed`}
              type="range"
              min={MIN_CAROUSEL_SPEED}
              max={MAX_CAROUSEL_SPEED}
              value={speed}
              onChange={(e) =>
                onSpeedChange(Number(e.target.value))
              }
              className="flex-1 accent-sepia cursor-pointer"
            />
            <div className="flex gap-1 shrink-0">
              {CAROUSEL_SPEED_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() =>
                    onSpeedChange(preset.value)
                  }
                  className={`px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-wider border transition-all ${
                    speed === preset.value
                      ? "bg-sepia text-white border-sepia font-medium"
                      : "border-black/10 dark:border-white/10 text-ink-400 dark:text-ink-300 hover:border-black/30 dark:hover:border-white/30"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
          {mode !== "auto" && (
            <p className="font-body text-[11px] text-ink-400 dark:text-ink-300 mt-1.5">
              Only applies in Auto-scroll mode.
            </p>
          )}
        </div>

        {/* Live preview */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">
            Preview
          </label>
          <CarouselPreview
            mode={mode}
            speed={speed}
          />
        </div>
    </>
  );
}

// The Hover Shimmer settings card. Same one-card / tab-strip / live-preview
// layout as CarouselSettingsCard, with a tab per grid (Gallery / Tales /
// Shop) selecting which surface's colour, speed and brightness the three
// controls currently edit. The preview is the real thing — the same
// `animate-shimmer` band, with shimmerBandStyle() feeding it exactly the
// values the public cards will read — so what the admin sees here is what a
// visitor gets, not an approximation of it.
function HoverShimmerCard({
  value,
  onChange,
  open,
  onToggle,
}: {
  value: HoverShimmerSettings;
  onChange: (surface: ShimmerSurface, patch: Partial<ShimmerSettings>) => void;
  open: boolean;
  onToggle: () => void;
}) {
  const [activeId, setActiveId] = useState<ShimmerSurface>(SHIMMER_SURFACES[0].id);
  const active = SHIMMER_SURFACES.find((s) => s.id === activeId) ?? SHIMMER_SURFACES[0];
  const settings = value[active.id];
  // Per-surface: the Gallery's default is its gold sweep, the Shop's white.
  const surfaceDefault = DEFAULT_HOVER_SHIMMER[active.id];
  const isDefault =
    settings.color === surfaceDefault.color &&
    settings.speed === surfaceDefault.speed &&
    settings.brightness === surfaceDefault.brightness;

  return (
    <SettingsAccordion title="Hover Shimmer" open={open} onToggle={onToggle}>
      <div className="border-b border-black/10 dark:border-white/10 pb-4">
        <div
          role="tablist"
          aria-label="Which grid's hover shimmer to configure"
          className="mt-3 inline-flex gap-1 p-1 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10"
        >
          {SHIMMER_SURFACES.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={s.id === active.id}
              onClick={() => setActiveId(s.id)}
              className={`px-4 py-1.5 rounded-lg font-body text-xs font-medium transition-all ${
                s.id === active.id
                  ? "bg-white dark:bg-[#1A1A1A] text-ink dark:text-cream shadow-sm"
                  : "text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <p className="font-body text-xs text-ink-400 dark:text-ink-300 mt-3">
          {active.description}
        </p>
      </div>

      {/* Colour */}
      <div>
        <label
          htmlFor={`${active.id}-shimmer-color`}
          className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2"
        >
          Color
        </label>
        <div className="flex items-center gap-2">
          <input
            id={`${active.id}-shimmer-color`}
            type="color"
            value={settings.color}
            onChange={(e) => onChange(active.id, { color: e.target.value.toUpperCase() })}
            className="w-10 h-10 rounded border border-black/10 dark:border-white/15 cursor-pointer bg-transparent shrink-0"
          />
          <input
            type="text"
            value={settings.color}
            onChange={(e) => onChange(active.id, { color: e.target.value })}
            // Free typing while editing; only a valid hex is kept on blur so
            // the preview (and withAlpha) never sees a half-typed value.
            onBlur={(e) => onChange(active.id, { color: sanitizeShimmerColor(e.target.value) })}
            className="w-28 px-4 py-2.5 rounded-xl admin-input border text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors font-mono text-xs"
            placeholder={DEFAULT_SHIMMER.color}
            aria-label="Shimmer color (hex)"
          />
          <button
            type="button"
            onClick={() => onChange(active.id, { color: DEFAULT_SHIMMER.color })}
            className="px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-wider border border-black/10 dark:border-white/10 text-ink-400 dark:text-ink-300 hover:border-black/30 dark:hover:border-white/30 transition-all"
          >
            White
          </button>
        </div>
      </div>

      {/* Speed */}
      <div>
        <label
          htmlFor={`${active.id}-shimmer-speed`}
          className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2"
        >
          Speed —{" "}
          <span className="font-mono normal-case tracking-normal text-ink dark:text-cream">
            {settings.speed}s per sweep
          </span>
        </label>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <input
            id={`${active.id}-shimmer-speed`}
            type="range"
            min={MIN_SHIMMER_SPEED}
            max={MAX_SHIMMER_SPEED}
            step={0.1}
            value={settings.speed}
            onChange={(e) => onChange(active.id, { speed: Number(e.target.value) })}
            className="flex-1 accent-sepia cursor-pointer"
          />
          <div className="flex gap-1 shrink-0">
            {SHIMMER_SPEED_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => onChange(active.id, { speed: preset.value })}
                className={`px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-wider border transition-all ${
                  settings.speed === preset.value
                    ? "bg-sepia text-white border-sepia font-medium"
                    : "border-black/10 dark:border-white/10 text-ink-400 dark:text-ink-300 hover:border-black/30 dark:hover:border-white/30"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
        <p className="font-body text-[11px] text-ink-400 dark:text-ink-300 mt-1.5">
          Lower is faster.
        </p>
      </div>

      {/* Brightness */}
      <div>
        <label
          htmlFor={`${active.id}-shimmer-brightness`}
          className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2"
        >
          Brightness —{" "}
          <span className="font-mono normal-case tracking-normal text-ink dark:text-cream">
            {settings.brightness}%
          </span>
        </label>
        <input
          id={`${active.id}-shimmer-brightness`}
          type="range"
          min={MIN_SHIMMER_BRIGHTNESS}
          max={MAX_SHIMMER_BRIGHTNESS}
          step={1}
          value={settings.brightness}
          onChange={(e) => onChange(active.id, { brightness: Number(e.target.value) })}
          className="w-full accent-sepia cursor-pointer"
        />
        <p className="font-body text-[11px] text-ink-400 dark:text-ink-300 mt-1.5">
          {settings.brightness === 0
            ? "0% turns the shimmer off for this grid."
            : "How strong the band is at its brightest point."}
        </p>
      </div>

      {/* Live preview */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300">
            Preview
          </label>
          {!isDefault && (
            <button
              type="button"
              onClick={() => onChange(active.id, { ...surfaceDefault })}
              className="font-body text-[11px] text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream transition-colors"
            >
              Reset {active.label} to default
            </button>
          )}
        </div>
        <ShimmerPreview settings={settings} />
      </div>
    </SettingsAccordion>
  );
}

// A stand-in card with the sweep running continuously, so the admin doesn't
// have to hover to judge the setting. Uses PREVIEW_CARDS' first gradient
// for the "artwork" so it reads as the same family as the carousel preview
// beside it.
function ShimmerPreview({ settings }: { settings: ShimmerSettings }) {
  return (
    <div className="rounded-xl border border-white/10 bg-ink-900 p-4">
      <p className="font-body text-[10px] tracking-widest uppercase text-cream/40 mb-3">
        Preview — sweep runs continuously here; on the site it runs on hover
      </p>
      <div className="flex gap-3 justify-center">
        {PREVIEW_CARDS.slice(0, 3).map((card) => (
          <div
            key={card.label}
            className="relative w-24 aspect-[3/4] rounded-lg overflow-hidden border border-white/10"
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${card.from} to-black/60`} />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 animate-shimmer"
              style={shimmerBandStyle(settings)}
            />
            <span className="absolute bottom-1.5 left-2 font-body text-[9px] tracking-widest uppercase text-cream/60">
              {card.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
