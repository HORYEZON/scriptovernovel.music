"use client";

// app/(admin)/admin/site-design/SiteDesignClient.tsx
//
// The Site Design editor: three tabs (Header · Menu · Homepage Hero), each a
// column of controls beside a live preview that is the real public component
// (MenuPanel / HomeHero) rendered inside a scaled desktop frame. Everything
// is staged into one form and saved with one PUT to /api/site-design, so a
// half-finished recolour is never live.
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useSearchParams } from "next/navigation";
import { Moon, Play, RotateCcw, Save, Search, Sun } from "lucide-react";
import toast from "@/lib/toast";
import { cn, getErrorMessage } from "@/lib/utils";
import { UnsavedChangesBar } from "@/components/admin/UnsavedChangesBar";
import { SettingsAccordion, useAccordionSections } from "@/app/(admin)/admin/settings/Preferences/SettingsAccordion";
import { MenuPanel, type MenuSocialLink } from "@/components/public/site-design/MenuPanel";
import { MenuOpenTransition, useSheetLanded } from "@/components/public/site-design/MenuOpenTransition";
import { HomeHero } from "@/components/public/site-design/HomeHero";
import { SafeImg } from "@/components/ui/SafeImage";
import { isValidThemeColor, isValidThemeLength } from "@/lib/theme";
import { withAlpha } from "@/lib/museum/minimapHud";
import {
  DEFAULT_SITE_DESIGN,
  DEFAULT_MENU_ITEMS,
  SITE_DESIGN_FONT_OPTIONS,
  FONT_WEIGHT_OPTIONS,
  FONT_STYLE_OPTIONS,
  TEXT_TRANSFORM_OPTIONS,
  DECOR_POSITION_OPTIONS,
  MIN_MENU_PANEL_WIDTH,
  MAX_MENU_PANEL_WIDTH,
  MENU_OPEN_EFFECTS,
  MENU_CLOSE_EFFECTS,
  MENU_ITEMS_EFFECTS,
  CLOSE_HOVER_EFFECTS,
  MENU_OPEN_SPEED_PRESETS,
  MIN_MENU_OPEN_SPEED,
  MAX_MENU_OPEN_SPEED,
  MIN_MENU_LINE_HEIGHT,
  MAX_MENU_LINE_HEIGHT,
  MAX_LABEL_LENGTH,
  MAX_TEXT_LENGTH,
  isValidHref,
  isValidLetterSpacing,
  type SiteDesignSettings,
  type SiteMenuItem,
} from "@/lib/site-design";
import {
  ColorField,
  HrefField,
  ImageField,
  LengthField,
  LetterSpacingField,
  RangeField,
  SelectField,
  TextField,
  ToggleRow,
} from "./fields";
import { MenuItemsEditor } from "./MenuItemsEditor";
import { ScaledPreview } from "./ScaledPreview";

type TabId = "header" | "menu" | "hero";
const TABS: { id: TabId; label: string }[] = [
  { id: "header", label: "Header" },
  { id: "menu", label: "Menu" },
  { id: "hero", label: "Homepage Hero" },
];

// ── Header preview ───────────────────────────────────────────────────────────
// A static twin of SiteHeader's row (that component is fixed to the viewport
// and reads the router/cart stores, so it can't sit inside a preview frame).
// The bar is frosted glass on the live site; the tint is the admin's
// background colour at the same opacity SiteHeader uses at the top of a
// page, so the preview reads the way the header does over the page wash.
// Light-mode colours only — dark mode swaps to ink/cream (see SiteHeader).
function HeaderPreview({ settings }: { settings: SiteDesignSettings }) {
  const style: CSSProperties = { backgroundColor: withAlpha(settings.headerBgColor, 0.6), color: settings.headerTextColor };
  return (
    <div className="grid h-16 grid-cols-[1fr_auto_1fr] items-center border-b border-white/20 px-12 backdrop-blur-sm" style={style}>
      <div className="justify-self-start">{settings.headerShowSearch && <Search size={18} strokeWidth={1.75} />}</div>
      <div className="justify-self-center">
        <SafeImg
          src={settings.headerLogoImage ?? undefined}
          alt=""
          className="w-auto object-contain"
          style={{ height: settings.headerLogoHeight }}
          fallback={
            <span
              className="whitespace-nowrap leading-none"
              style={{ fontFamily: settings.headerLogoFontFamily, fontSize: settings.headerLogoFontSize }}
            >
              {settings.headerLogoText}
            </span>
          }
        />
      </div>
      <div className="flex items-center gap-3 justify-self-end font-body text-[11px] font-medium uppercase tracking-[0.12em]">
        <span className="flex items-center gap-2">
          <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true">
            <circle cx="2" cy="2" r="1.6" fill="currentColor" />
            <circle cx="8" cy="2" r="1.6" fill="currentColor" />
            <circle cx="2" cy="8" r="1.6" fill="currentColor" />
            <circle cx="8" cy="8" r="1.6" fill="currentColor" />
          </svg>
          {settings.headerMenuLabel}
        </span>
        {/* Static stand-in for the always-on light/dark toggle (ThemeToggle
            would flip the admin's own theme from inside the preview). */}
        <span aria-hidden="true" className="relative flex h-9 w-[72px] items-center justify-between rounded-full border border-black/10 bg-zinc-200/80 px-2.5">
          <Sun size={14} strokeWidth={2} className="text-amber-500" />
          <Moon size={14} strokeWidth={2} className="text-zinc-400 opacity-40" />
          <span className="absolute left-1 top-1 h-7 w-7 rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.15)]" />
        </span>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300">{children}</p>
  );
}

export function SiteDesignClient({
  initialSettings,
  initialMenuItems,
  socialLinks,
}: {
  initialSettings: SiteDesignSettings;
  initialMenuItems: SiteMenuItem[];
  socialLinks: MenuSocialLink[];
}) {
  const [activeTab, setActiveTab] = useState<TabId>("header");
  const searchParams = useSearchParams();
  useEffect(() => {
    const requested = searchParams.get("tab");
    if (requested === "header" || requested === "menu" || requested === "hero") setActiveTab(requested);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const [settings, setSettings] = useState<SiteDesignSettings>(initialSettings);
  const [menuItems, setMenuItems] = useState<SiteMenuItem[]>(initialMenuItems);
  const savedRef = useRef({ settings: initialSettings, menuItems: initialMenuItems });
  const [saving, setSaving] = useState(false);

  const isDirty = useMemo(
    () =>
      JSON.stringify({ settings, menuItems }) !==
      JSON.stringify({ settings: savedRef.current.settings, menuItems: savedRef.current.menuItems }),
    [settings, menuItems]
  );

  function set<K extends keyof SiteDesignSettings>(field: K, value: SiteDesignSettings[K]) {
    setSettings((s) => ({ ...s, [field]: value }));
  }

  function isFormValid() {
    const s = settings;
    const colors = [
      s.headerBgColor, s.headerTextColor, s.headerMenuHoverBgColor, s.headerMenuHoverTextColor,
      s.menuTextColor, s.menuHoverTextColor, s.menuBgColor,
      s.menuCloseBgColor, s.menuCloseIconColor, s.menuCloseHoverBgColor, s.menuCloseHoverIconColor,
      s.heroBgColor, s.heroHeadingColor,
      s.heroCtaBgColor, s.heroCtaTextColor,
    ];
    const lengths = [
      s.headerLogoFontSize, s.headerLogoHeight, s.menuFontSize, s.menuFontSizeMobile,
      s.heroImageWidth, s.heroHeadingFontSize, s.heroDecorWidth,
    ];
    return (
      colors.every(isValidThemeColor) &&
      lengths.every(isValidThemeLength) &&
      isValidLetterSpacing(s.menuLetterSpacing) &&
      isValidHref(s.menuFooterHref) &&
      isValidHref(s.heroCtaHref) &&
      menuItems.every(
        (i) =>
          i.label.trim() !== "" &&
          isValidHref(i.href) &&
          isValidThemeColor(i.bgColor) &&
          isValidThemeColor(i.underlineColor)
      )
    );
  }

  async function save() {
    if (!isFormValid()) {
      toast.error("Fix the highlighted fields before saving");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/site-design", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings, menuItems }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setSettings(data.settings);
      setMenuItems(data.menuItems);
      savedRef.current = { settings: data.settings, menuItems: data.menuItems };
      toast.success("Site design updated");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to save site design"));
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setSettings(savedRef.current.settings);
    setMenuItems(savedRef.current.menuItems);
  }

  function restoreDefaults(tab: TabId) {
    const d = DEFAULT_SITE_DESIGN;
    const keys = (Object.keys(d) as (keyof SiteDesignSettings)[]).filter((k) =>
      tab === "header" ? k.startsWith("header") : tab === "menu" ? k.startsWith("menu") : k.startsWith("hero")
    );
    setSettings((s) => {
      const next = { ...s };
      for (const k of keys) (next as Record<string, unknown>)[k] = d[k];
      return next;
    });
    if (tab === "menu") setMenuItems(DEFAULT_MENU_ITEMS);
  }

  const sections = useAccordionSections("admin_site_design_sections", {
    headerLogo: true,
    headerFavicon: true,
    headerColors: true,
    headerIcons: true,
    menuOpen: true,
    menuType: true,
    menuPanel: true,
    menuFoot: true,
    menuLinks: true,
    heroLayout: true,
    heroText: true,
    heroCta: true,
    heroDecor: true,
  });

  // Menu preview's open animation: hidden → shown replays the real
  // MenuOpenTransition. Replayed automatically when the effect or speed
  // changes, and on demand via the Play button.
  const [menuPreviewShown, setMenuPreviewShown] = useState(true);
  const [menuPreviewClosing, setMenuPreviewClosing] = useState(false);
  // Same landing gate the public overlay uses, so the link entrance previews
  // where visitors actually see it: after the sheet has arrived.
  const menuPreviewLanded = useSheetLanded(menuPreviewShown, settings.menuOpenSpeedMs);
  const replayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playMenuOpen = useCallback(() => {
    if (replayTimer.current) clearTimeout(replayTimer.current);
    setMenuPreviewClosing(false);
    setMenuPreviewShown(false);
    // Two frames: one for the start pose to land, one to start the trip.
    requestAnimationFrame(() => requestAnimationFrame(() => setMenuPreviewShown(true)));
  }, []);
  // Plays the close, then — after it has finished — re-opens with the open
  // effect so the preview is never left blank.
  const playMenuClose = useCallback(() => {
    if (replayTimer.current) clearTimeout(replayTimer.current);
    setMenuPreviewClosing(true);
    setMenuPreviewShown(false);
    replayTimer.current = setTimeout(playMenuOpen, settings.menuCloseSpeedMs + 400);
  }, [playMenuOpen, settings.menuCloseSpeedMs]);
  useEffect(() => () => { if (replayTimer.current) clearTimeout(replayTimer.current); }, []);

  const firstMenuRender = useRef(true);
  useEffect(() => {
    if (firstMenuRender.current) {
      firstMenuRender.current = false;
      return;
    }
    if (activeTab === "menu") playMenuOpen();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- replay only when the open / link-entrance effect or speed change
  }, [settings.menuOpenEffect, settings.menuOpenSpeedMs, settings.menuItemsEffect, settings.menuItemsSpeedMs]);
  const firstCloseRender = useRef(true);
  useEffect(() => {
    if (firstCloseRender.current) {
      firstCloseRender.current = false;
      return;
    }
    if (activeTab === "menu") playMenuClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- replay only when the close effect/speed change
  }, [settings.menuCloseEffect, settings.menuCloseSpeedMs]);

  const restoreButton = (tab: TabId) => (
    <button
      type="button"
      onClick={() => restoreDefaults(tab)}
      className="flex items-center gap-1.5 font-body text-xs text-ink-400 transition-colors hover:text-ink dark:text-ink-300 dark:hover:text-cream"
    >
      <RotateCcw size={12} />
      Restore defaults
    </button>
  );

  return (
    <div>
      <div
        role="tablist"
        aria-label="Site design section"
        className="admin-input mb-6 flex w-full gap-1 overflow-x-auto rounded-2xl border p-1 sm:inline-flex sm:w-auto"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "inline-flex flex-1 items-center justify-center whitespace-nowrap rounded-xl px-4 py-2.5 font-jakarta text-sm font-medium transition-all sm:flex-none",
              activeTab === tab.id
                ? "bg-white text-ink shadow-sm dark:bg-[#1A1A1A] dark:text-cream"
                : "text-ink-400 hover:text-ink dark:text-ink-300 dark:hover:text-cream"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══ HEADER ══════════════════════════════════════════════════════════ */}
      {activeTab === "header" && (
        <div className="space-y-5">
          <div className="admin-card rounded-2xl border p-4 shadow-sm backdrop-blur-md sm:p-6">
            <div className="mb-3 flex items-center justify-between">
              <SectionTitle>Live preview</SectionTitle>
              {restoreButton("header")}
            </div>
            <ScaledPreview width={1440} height={64}>
              <HeaderPreview settings={settings} />
            </ScaledPreview>
          </div>

          <SettingsAccordion
            title="Wordmark"
            description="The signature in the centre — an uploaded image, or your name in a handwriting font."
            open={sections.open.headerLogo}
            onToggle={() => sections.toggle("headerLogo")}
          >
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <ImageField
                label="Logo image"
                value={settings.headerLogoImage}
                onChange={(v) => set("headerLogoImage", v)}
                hint="A transparent PNG of a handwritten signature works best. Independent of the Preferences → Branding logo."
                aspect="aspect-[3/1]"
              />
              <div className="space-y-4">
                <LengthField label="Logo height" value={settings.headerLogoHeight} onChange={(v) => set("headerLogoHeight", v)} placeholder="40px" />
                <TextField label="Fallback text" value={settings.headerLogoText} onChange={(v) => set("headerLogoText", v)} maxLength={MAX_LABEL_LENGTH} hint="Shown when there's no logo image." />
                <SelectField label="Fallback font" value={settings.headerLogoFontFamily} onChange={(v) => set("headerLogoFontFamily", v)} options={SITE_DESIGN_FONT_OPTIONS} />
                <LengthField label="Fallback size" value={settings.headerLogoFontSize} onChange={(v) => set("headerLogoFontSize", v)} placeholder="2rem" />
              </div>
            </div>
          </SettingsAccordion>

          <SettingsAccordion
            title="Favicon"
            description="The browser-tab icon. Replaces the icon-catalog favicon from Preferences → Branding while set."
            open={sections.open.headerFavicon}
            onToggle={() => sections.toggle("headerFavicon")}
          >
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <ImageField
                label="Favicon image"
                value={settings.faviconImage}
                onChange={(v) => set("faviconImage", v)}
                hint="A square PNG with a transparent background, at least 64×64. Remove it to go back to the catalog icon and its colour cycle."
                aspect="aspect-square max-w-[200px]"
              />
              {settings.faviconImage && (
                <div className="flex items-center gap-3 self-start rounded-xl border border-black/10 px-4 py-3 dark:border-white/10">
                  <SafeImg src={settings.faviconImage} alt="" className="h-4 w-4 object-contain" />
                  <span className="font-body text-xs text-ink-400 dark:text-ink-300">How it reads at tab size (16px)</span>
                </div>
              )}
            </div>
          </SettingsAccordion>

          <SettingsAccordion
            title="Colours & label"
            description="Header background and text, and what the menu button says."
            open={sections.open.headerColors}
            onToggle={() => sections.toggle("headerColors")}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <ColorField label="Background" value={settings.headerBgColor} onChange={(v) => set("headerBgColor", v)} hint="Tints the frosted-glass bar in light mode. Dark mode uses the site's ink." />
              <ColorField label="Text & icons" value={settings.headerTextColor} onChange={(v) => set("headerTextColor", v)} hint="Light mode only — dark mode switches to cream." />
              <TextField label="Menu button label" value={settings.headerMenuLabel} onChange={(v) => set("headerMenuLabel", v)} maxLength={MAX_LABEL_LENGTH} placeholder="MENU" />
            </div>
            <div>
              <p className="mb-3 block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300">
                Menu button hover
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <ColorField label="Pill colour (hover)" value={settings.headerMenuHoverBgColor} onChange={(v) => set("headerMenuHoverBgColor", v)} hint="Fills the pill behind ⠿ MENU while hovered." />
                <ColorField label="Text (hover)" value={settings.headerMenuHoverTextColor} onChange={(v) => set("headerMenuHoverTextColor", v)} />
                <SelectField
                  label="Motion"
                  value={settings.headerMenuHoverEffect}
                  onChange={(v) => set("headerMenuHoverEffect", v)}
                  options={CLOSE_HOVER_EFFECTS}
                  hint={settings.headerMenuHoverEffect === "spin" ? "The ⠿ dots turn a quarter turn." : CLOSE_HOVER_EFFECTS.find((o) => o.value === settings.headerMenuHoverEffect)?.description}
                />
              </div>
            </div>
          </SettingsAccordion>

          <SettingsAccordion
            title="Header icons"
            description="Which utility icons sit beside the wordmark and menu button. The light/dark toggle is always on, to the right of the menu button."
            open={sections.open.headerIcons}
            onToggle={() => sections.toggle("headerIcons")}
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <ToggleRow label="Search" description="Magnifier on the left; searches published artworks." value={settings.headerShowSearch} onChange={(v) => set("headerShowSearch", v)} words={{ on: "shown", off: "hidden" }} />
              <ToggleRow label="What's new" description="The release-notes bell." value={settings.headerShowReleaseNotes} onChange={(v) => set("headerShowReleaseNotes", v)} words={{ on: "shown", off: "hidden" }} />
              <ToggleRow label="Wishlist" description="Also appears on its own whenever the visitor has saved something." value={settings.headerShowWishlist} onChange={(v) => set("headerShowWishlist", v)} words={{ on: "shown", off: "hidden" }} />
              <ToggleRow label="Cart" description="Also appears on its own whenever the cart isn't empty." value={settings.headerShowCart} onChange={(v) => set("headerShowCart", v)} words={{ on: "shown", off: "hidden" }} />
            </div>
          </SettingsAccordion>
        </div>
      )}

      {/* ══ MENU ════════════════════════════════════════════════════════════ */}
      {activeTab === "menu" && (
        <div className="space-y-5">
          <div className="admin-card rounded-2xl border p-4 shadow-sm backdrop-blur-md sm:p-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <SectionTitle>Live preview — hover a link to see its colour, photo and underline</SectionTitle>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={playMenuOpen}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-black/10 px-2.5 py-1 font-body text-xs text-ink-500 transition-colors hover:border-sepia hover:text-ink dark:border-white/10 dark:text-ink-300 dark:hover:text-cream"
                >
                  <Play size={12} />
                  Play open
                </button>
                <button
                  type="button"
                  onClick={playMenuClose}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-black/10 px-2.5 py-1 font-body text-xs text-ink-500 transition-colors hover:border-sepia hover:text-ink dark:border-white/10 dark:text-ink-300 dark:hover:text-cream"
                >
                  <Play size={12} />
                  Play close
                </button>
                {restoreButton("menu")}
              </div>
            </div>
            <ScaledPreview width={1440} height={900}>
              <MenuOpenTransition
                openEffect={settings.menuOpenEffect}
                openSpeedMs={settings.menuOpenSpeedMs}
                closeEffect={settings.menuCloseEffect}
                closeSpeedMs={settings.menuCloseSpeedMs}
                shown={menuPreviewShown}
                closing={menuPreviewClosing}
                className="h-full w-full"
              >
                <MenuPanel settings={settings} items={menuItems} socialLinks={socialLinks} preview revealed={menuPreviewLanded} sheetShown={menuPreviewShown} closing={menuPreviewClosing} />
              </MenuOpenTransition>
            </ScaledPreview>
          </div>

          <SettingsAccordion
            title="Open & close animation"
            description="How the menu enters when MENU is pressed and how it leaves when × is pressed — each its own effect and speed."
            open={sections.open.menuOpen}
            onToggle={() => sections.toggle("menuOpen")}
          >
            <div>
              <p className="mb-2 block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300">
                Open effect
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {MENU_OPEN_EFFECTS.map((e) => {
                  const selected = settings.menuOpenEffect === e.value;
                  return (
                    <button
                      key={e.value}
                      type="button"
                      onClick={() => set("menuOpenEffect", e.value)}
                      className={cn(
                        "rounded-xl border p-3 text-left transition-all",
                        selected
                          ? "border-sepia bg-sepia/10"
                          : "border-black/10 hover:border-black/30 dark:border-white/10 dark:hover:border-white/30"
                      )}
                    >
                      <p className={cn("font-body text-sm font-medium", selected ? "text-sepia" : "text-ink dark:text-cream")}>
                        {e.label}
                      </p>
                      <p className="mt-1 font-body text-[11px] text-ink-400 dark:text-ink-300">{e.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label
                htmlFor="menu-open-speed"
                className="mb-2 block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300"
              >
                Open speed —{" "}
                <span className="font-mono normal-case tracking-normal text-ink dark:text-cream">
                  {(settings.menuOpenSpeedMs / 1000).toFixed(2)}s
                </span>
              </label>
              <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                <input
                  id="menu-open-speed"
                  type="range"
                  min={MIN_MENU_OPEN_SPEED}
                  max={MAX_MENU_OPEN_SPEED}
                  step={50}
                  value={settings.menuOpenSpeedMs}
                  onChange={(e) => set("menuOpenSpeedMs", Number(e.target.value))}
                  className="min-w-0 flex-1 cursor-pointer accent-sepia"
                />
                <div className="flex shrink-0 flex-wrap gap-1">
                  {MENU_OPEN_SPEED_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => set("menuOpenSpeedMs", preset.value)}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-[10px] uppercase tracking-wider transition-all",
                        settings.menuOpenSpeedMs === preset.value
                          ? "border-sepia bg-sepia font-medium text-white"
                          : "border-black/10 text-ink-400 hover:border-black/30 dark:border-white/10 dark:text-ink-300 dark:hover:border-white/30"
                      )}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-t border-black/10 pt-6 dark:border-white/10">
              <p className="mb-2 block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300">
                Close effect
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {MENU_CLOSE_EFFECTS.map((e) => {
                  const selected = settings.menuCloseEffect === e.value;
                  return (
                    <button
                      key={e.value}
                      type="button"
                      onClick={() => set("menuCloseEffect", e.value)}
                      className={cn(
                        "rounded-xl border p-3 text-left transition-all",
                        selected
                          ? "border-sepia bg-sepia/10"
                          : "border-black/10 hover:border-black/30 dark:border-white/10 dark:hover:border-white/30"
                      )}
                    >
                      <p className={cn("font-body text-sm font-medium", selected ? "text-sepia" : "text-ink dark:text-cream")}>
                        {e.label}
                      </p>
                      <p className="mt-1 font-body text-[11px] text-ink-400 dark:text-ink-300">{e.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label
                htmlFor="menu-close-speed"
                className="mb-2 block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300"
              >
                Close speed —{" "}
                <span className="font-mono normal-case tracking-normal text-ink dark:text-cream">
                  {(settings.menuCloseSpeedMs / 1000).toFixed(2)}s
                </span>
              </label>
              <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                <input
                  id="menu-close-speed"
                  type="range"
                  min={MIN_MENU_OPEN_SPEED}
                  max={MAX_MENU_OPEN_SPEED}
                  step={50}
                  value={settings.menuCloseSpeedMs}
                  onChange={(e) => set("menuCloseSpeedMs", Number(e.target.value))}
                  className="min-w-0 flex-1 cursor-pointer accent-sepia"
                />
                <div className="flex shrink-0 flex-wrap gap-1">
                  {MENU_OPEN_SPEED_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => set("menuCloseSpeedMs", preset.value)}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-[10px] uppercase tracking-wider transition-all",
                        settings.menuCloseSpeedMs === preset.value
                          ? "border-sepia bg-sepia font-medium text-white"
                          : "border-black/10 text-ink-400 hover:border-black/30 dark:border-white/10 dark:text-ink-300 dark:hover:border-white/30"
                      )}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-t border-black/10 pt-6 dark:border-white/10">
              <p className="mb-2 block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300">
                Link entrance
              </p>
              <p className="mb-3 font-body text-xs text-ink-400 dark:text-ink-300">
                How the links (and the foot) appear once the sheet has opened.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {MENU_ITEMS_EFFECTS.map((e) => {
                  const selected = settings.menuItemsEffect === e.value;
                  return (
                    <button
                      key={e.value}
                      type="button"
                      onClick={() => set("menuItemsEffect", e.value)}
                      className={cn(
                        "rounded-xl border p-3 text-left transition-all",
                        selected
                          ? "border-sepia bg-sepia/10"
                          : "border-black/10 hover:border-black/30 dark:border-white/10 dark:hover:border-white/30"
                      )}
                    >
                      <p className={cn("font-body text-sm font-medium", selected ? "text-sepia" : "text-ink dark:text-cream")}>
                        {e.label}
                      </p>
                      <p className="mt-1 font-body text-[11px] text-ink-400 dark:text-ink-300">{e.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label
                htmlFor="menu-items-speed"
                className="mb-2 block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300"
              >
                Link entrance speed —{" "}
                <span className="font-mono normal-case tracking-normal text-ink dark:text-cream">
                  {(settings.menuItemsSpeedMs / 1000).toFixed(2)}s
                </span>
              </label>
              <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                <input
                  id="menu-items-speed"
                  type="range"
                  min={MIN_MENU_OPEN_SPEED}
                  max={MAX_MENU_OPEN_SPEED}
                  step={50}
                  value={settings.menuItemsSpeedMs}
                  onChange={(e) => set("menuItemsSpeedMs", Number(e.target.value))}
                  className="min-w-0 flex-1 cursor-pointer accent-sepia"
                  disabled={settings.menuItemsEffect === "none"}
                />
                <div className="flex shrink-0 flex-wrap gap-1">
                  {MENU_OPEN_SPEED_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => set("menuItemsSpeedMs", preset.value)}
                      disabled={settings.menuItemsEffect === "none"}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-[10px] uppercase tracking-wider transition-all disabled:opacity-40",
                        settings.menuItemsSpeedMs === preset.value
                          ? "border-sepia bg-sepia font-medium text-white"
                          : "border-black/10 text-ink-400 hover:border-black/30 dark:border-white/10 dark:text-ink-300 dark:hover:border-white/30"
                      )}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
              <p className="mt-1.5 font-body text-[11px] text-ink-400 dark:text-ink-300">
                The preview above replays whenever you change an effect or speed.
              </p>
            </div>
          </SettingsAccordion>

          <SettingsAccordion
            title="Links"
            description="The stack of links, in order. Each has its own panel colour, underline and photo."
            open={sections.open.menuLinks}
            onToggle={() => sections.toggle("menuLinks")}
          >
            <MenuItemsEditor items={menuItems} onChange={setMenuItems} />
          </SettingsAccordion>

          <SettingsAccordion
            title="Typography"
            description="Font, weight, size and spacing of the links."
            open={sections.open.menuType}
            onToggle={() => sections.toggle("menuType")}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <SelectField label="Font" value={settings.menuFontFamily} onChange={(v) => set("menuFontFamily", v)} options={SITE_DESIGN_FONT_OPTIONS} />
              <SelectField label="Weight" value={settings.menuFontWeight} onChange={(v) => set("menuFontWeight", v)} options={FONT_WEIGHT_OPTIONS} />
              <SelectField label="Style" value={settings.menuFontStyle} onChange={(v) => set("menuFontStyle", v)} options={FONT_STYLE_OPTIONS} />
              <LengthField label="Size (desktop)" value={settings.menuFontSize} onChange={(v) => set("menuFontSize", v)} placeholder="6rem" />
              <LengthField label="Size (phone)" value={settings.menuFontSizeMobile} onChange={(v) => set("menuFontSizeMobile", v)} placeholder="3.25rem" />
              <SelectField label="Case" value={settings.menuTextTransform} onChange={(v) => set("menuTextTransform", v)} options={TEXT_TRANSFORM_OPTIONS} />
              <LetterSpacingField value={settings.menuLetterSpacing} onChange={(v) => set("menuLetterSpacing", v)} />
              <RangeField label="Line height" value={settings.menuLineHeight} onChange={(v) => set("menuLineHeight", v)} min={MIN_MENU_LINE_HEIGHT} max={MAX_MENU_LINE_HEIGHT} step={0.05} format={(v) => v.toFixed(2)} />
              <ColorField label="Resting text colour" value={settings.menuTextColor} onChange={(v) => set("menuTextColor", v)} hint="Links and the foot before anything is hovered." />
              <ColorField label="Hover text colour" value={settings.menuHoverTextColor} onChange={(v) => set("menuHoverTextColor", v)} hint="Every link flips to this while one is hovered." />
            </div>
          </SettingsAccordion>

          <SettingsAccordion
            title="Panels"
            description="The resting panel colour and photo (before anything is hovered), the split, and the close button."
            open={sections.open.menuPanel}
            onToggle={() => sections.toggle("menuPanel")}
          >
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <ImageField
                label="Default photo"
                value={settings.menuImage}
                onChange={(v) => set("menuImage", v)}
                hint="Right half at rest (before anything is hovered), and for any link without its own photo."
              />
              <div className="space-y-4">
                <ColorField label="Resting panel colour" value={settings.menuBgColor} onChange={(v) => set("menuBgColor", v)} hint="The panel before any link is hovered." />
                <RangeField label="Colour panel width" value={settings.menuPanelWidth} onChange={(v) => set("menuPanelWidth", v)} min={MIN_MENU_PANEL_WIDTH} max={MAX_MENU_PANEL_WIDTH} step={1} format={(v) => `${v}%`} />
                <div className="grid grid-cols-2 gap-4">
                  <ColorField label="Close button" value={settings.menuCloseBgColor} onChange={(v) => set("menuCloseBgColor", v)} />
                  <ColorField label="Close icon" value={settings.menuCloseIconColor} onChange={(v) => set("menuCloseIconColor", v)} />
                  <ColorField label="Close button (hover)" value={settings.menuCloseHoverBgColor} onChange={(v) => set("menuCloseHoverBgColor", v)} />
                  <ColorField label="Close icon (hover)" value={settings.menuCloseHoverIconColor} onChange={(v) => set("menuCloseHoverIconColor", v)} />
                </div>
                <SelectField
                  label="Close button hover motion"
                  value={settings.menuCloseHoverEffect}
                  onChange={(v) => set("menuCloseHoverEffect", v)}
                  options={CLOSE_HOVER_EFFECTS}
                  hint={CLOSE_HOVER_EFFECTS.find((o) => o.value === settings.menuCloseHoverEffect)?.description}
                />
              </div>
            </div>
          </SettingsAccordion>

          <SettingsAccordion
            title="Panel foot"
            description="The small line and social icons at the bottom of the colour panel."
            open={sections.open.menuFoot}
            onToggle={() => sections.toggle("menuFoot")}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField label="Text" value={settings.menuFooterText} onChange={(v) => set("menuFooterText", v)} maxLength={MAX_TEXT_LENGTH} placeholder="JOIN THE MAILING LIST" hint="Leave empty to hide." />
              <HrefField label="Text link" value={settings.menuFooterHref} onChange={(v) => set("menuFooterHref", v)} />
            </div>
            <p className="font-body text-xs text-ink-400 dark:text-ink-300">
              The foot follows the resting / hover text colours set under Typography.
            </p>
            <ToggleRow label="Social icons" description="Your links from Profile → About → Social Links." value={settings.menuShowSocialLinks} onChange={(v) => set("menuShowSocialLinks", v)} words={{ on: "shown", off: "hidden" }} />
          </SettingsAccordion>
        </div>
      )}

      {/* ══ HERO ════════════════════════════════════════════════════════════ */}
      {activeTab === "hero" && (
        <div className="space-y-5">
          <div className="admin-card rounded-2xl border p-4 shadow-sm backdrop-blur-md sm:p-6">
            <div className="mb-3 flex items-center justify-between">
              <SectionTitle>Live preview</SectionTitle>
              {restoreButton("hero")}
            </div>
            <ScaledPreview width={1440} height={800}>
              <div className="flex h-full flex-col">
                <HeaderPreview settings={settings} />
                <div className="min-h-0 flex-1">
                  <HomeHero settings={settings} preview />
                </div>
              </div>
            </ScaledPreview>
            <div className="mt-4">
              <ToggleRow label="Show the hero" description="Off, and the homepage opens straight on the collection as before." value={settings.heroEnabled} onChange={(v) => set("heroEnabled", v)} />
            </div>
          </div>

          <SettingsAccordion
            title="Background & image"
            description="The colour field and the centred artwork."
            open={sections.open.heroLayout}
            onToggle={() => sections.toggle("heroLayout")}
          >
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <ImageField label="Hero image" value={settings.heroImage} onChange={(v) => set("heroImage", v)} hint="Album art, the featured piece — a PNG with transparency sits best on the colour field." aspect="aspect-[4/3]" />
              <div className="space-y-4">
                <ColorField label="Background colour" value={settings.heroBgColor} onChange={(v) => set("heroBgColor", v)} hint="Shows through a transparent texture, and while a texture is still loading." />
                <LengthField label="Image width" value={settings.heroImageWidth} onChange={(v) => set("heroImageWidth", v)} placeholder="480px" />
              </div>
              <ImageField
                label="Background texture"
                value={settings.heroBgImage}
                onChange={(v) => set("heroBgImage", v)}
                hint="Optional — a paper or newsprint scan, say. Covers the whole hero; the header goes transparent over it at the top of the homepage."
              />
            </div>
          </SettingsAccordion>

          <SettingsAccordion
            title="Heading"
            description="The line under the image."
            open={sections.open.heroText}
            onToggle={() => sections.toggle("heroText")}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <TextField label="Heading" value={settings.heroHeading} onChange={(v) => set("heroHeading", v)} maxLength={MAX_TEXT_LENGTH} placeholder="The new collection" />
              <TextField label="Subheading" value={settings.heroSubheading} onChange={(v) => set("heroSubheading", v)} maxLength={MAX_TEXT_LENGTH} hint="Optional." />
              <ColorField label="Colour" value={settings.heroHeadingColor} onChange={(v) => set("heroHeadingColor", v)} />
              <SelectField label="Font" value={settings.heroHeadingFontFamily} onChange={(v) => set("heroHeadingFontFamily", v)} options={SITE_DESIGN_FONT_OPTIONS} />
              <SelectField label="Weight" value={settings.heroHeadingFontWeight} onChange={(v) => set("heroHeadingFontWeight", v)} options={FONT_WEIGHT_OPTIONS} />
              <LengthField label="Size" value={settings.heroHeadingFontSize} onChange={(v) => set("heroHeadingFontSize", v)} placeholder="3rem" />
            </div>
          </SettingsAccordion>

          <SettingsAccordion
            title="Button"
            description="The pill call-to-action."
            open={sections.open.heroCta}
            onToggle={() => sections.toggle("heroCta")}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <TextField label="Label" value={settings.heroCtaLabel} onChange={(v) => set("heroCtaLabel", v)} maxLength={MAX_LABEL_LENGTH} placeholder="VIEW NOW" hint="Leave empty to hide." />
              <HrefField label="Link" value={settings.heroCtaHref} onChange={(v) => set("heroCtaHref", v)} />
              <ColorField label="Fill" value={settings.heroCtaBgColor} onChange={(v) => set("heroCtaBgColor", v)} />
              <ColorField label="Text" value={settings.heroCtaTextColor} onChange={(v) => set("heroCtaTextColor", v)} />
            </div>
          </SettingsAccordion>

          <SettingsAccordion
            title="Corner ornament"
            description="A small illustration pinned to one corner of the hero."
            open={sections.open.heroDecor}
            onToggle={() => sections.toggle("heroDecor")}
          >
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <ImageField label="Ornament image" value={settings.heroDecorImage} onChange={(v) => set("heroDecorImage", v)} hint="Optional — nothing renders when empty." aspect="aspect-[4/3]" />
              <div className="space-y-4">
                <SelectField label="Position" value={settings.heroDecorPosition} onChange={(v) => set("heroDecorPosition", v)} options={DECOR_POSITION_OPTIONS} />
                <LengthField label="Width" value={settings.heroDecorWidth} onChange={(v) => set("heroDecorWidth", v)} placeholder="96px" />
              </div>
            </div>
          </SettingsAccordion>
        </div>
      )}

      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving || !isDirty}
          className="inline-flex items-center gap-2 rounded-xl bg-sepia px-4 py-2.5 font-jakarta text-sm font-medium text-white shadow-md transition-all duration-200 hover:bg-sepia-dark disabled:opacity-50"
        >
          {saving ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border border-cream/30 border-t-cream" />
              Saving…
            </>
          ) : (
            <>
              <Save size={16} />
              Save Site Design
            </>
          )}
        </button>
        {isDirty && !saving && (
          <button
            type="button"
            onClick={reset}
            className="font-body text-xs text-ink-400 transition-colors hover:text-ink dark:text-ink-300 dark:hover:text-cream"
          >
            Discard changes
          </button>
        )}
      </div>

      <UnsavedChangesBar dirty={isDirty} what="site design" saving={saving} onSave={save} onReset={reset} />
    </div>
  );
}
