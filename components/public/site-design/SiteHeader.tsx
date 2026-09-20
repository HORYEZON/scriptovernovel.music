"use client";

// components/public/site-design/SiteHeader.tsx
//
// The public site's fixed header: search on the left, the wordmark centred,
// "⠿ MENU" + the light/dark toggle on the right — the bare three-part row of
// the reference design — with the optional utility icons (what's new,
// wishlist, cart) an admin can switch on from Site Design → Header. Opens
// MenuOverlay and SearchOverlay; the marquee ticker rides above the row
// inside the same fixed block so the two never scroll apart.
//
// The bar is frosted glass, the same recipe as kalamari.arts's Navbar: a
// translucent tint over backdrop-blur that thickens once the page scrolls.
// In light mode the tint and text are the admin's Header colours (at glass
// opacity); dark mode uses the site's ink/cream so the bar actually goes
// dark with the rest of the page instead of staying a cream slab.
//
// Replaces the old components/public/Navbar.tsx.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { Search, ShoppingBag, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCartStore } from "@/lib/cart-store";
import { useWishlistStore } from "@/lib/wishlist-store";
import { withAlpha } from "@/lib/museum/minimapHud";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { SafeImg } from "@/components/ui/SafeImage";
import { MarqueeBanner } from "@/components/public/MarqueeBanner";
import { ReleaseNotes, type PublicReleaseNote } from "@/components/public/ReleaseNotes";
import type { Marquee } from "@/lib/marquee";
import type { SiteDesignSettings, SiteMenuItem } from "@/lib/site-design";
import { MenuOverlay } from "./MenuOverlay";
import { SearchOverlay } from "./SearchOverlay";
import type { MenuSocialLink } from "./MenuPanel";

// Per lib/site-design.ts's CLOSE_HOVER_EFFECTS, applied to the MENU button.
// "spin" turns only the dots glyph — rotating the word would be unreadable.
const MENU_HOVER_TRANSFORM: Record<SiteDesignSettings["headerMenuHoverEffect"], { button: string; dots: string }> = {
  spin: { button: "none", dots: "rotate(90deg)" },
  grow: { button: "scale(1.08)", dots: "none" },
  shrink: { button: "scale(0.92)", dots: "none" },
  none: { button: "none", dots: "none" },
};

/** The 2×2 dot glyph beside "MENU". */
function DotsIcon({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true" className={className} style={style}>
      <circle cx="2" cy="2" r="1.6" fill="currentColor" />
      <circle cx="8" cy="2" r="1.6" fill="currentColor" />
      <circle cx="2" cy="8" r="1.6" fill="currentColor" />
      <circle cx="8" cy="8" r="1.6" fill="currentColor" />
    </svg>
  );
}

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-vermillion font-jakarta text-[9px] text-cream">
      {count}
    </span>
  );
}

export function SiteHeader({
  settings,
  menuItems,
  socialLinks,
  marquees = [],
  releaseNotes = [],
}: {
  settings: SiteDesignSettings;
  menuItems: SiteMenuItem[];
  socialLinks: MenuSocialLink[];
  marquees?: Marquee[];
  releaseNotes?: PublicReleaseNote[];
}) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuHovered, setMenuHovered] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const totalItems = useCartStore((s) => s.totalItems());
  const wishlistCount = useWishlistStore((s) => s.items.length);

  // Cart/wishlist counts rehydrate from localStorage after the first paint;
  // the server always renders 0, so hold the badges (and the count-driven
  // icon reveal) until mounted to avoid a hydration mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);

  // The Digital Museum is a full-viewport 3D room with its own HUD — this
  // fixed header (and the marquee it renders) would float on top of it.
  if (pathname?.startsWith("/gallery/museum")) return null;

  const showCart = settings.headerShowCart || (mounted && totalItems > 0);
  const showWishlist = settings.headerShowWishlist || (mounted && wishlistCount > 0);

  // Over the hero at the top of the homepage the bar goes fully transparent
  // (no tint, no blur) so the hero's colour/texture runs under it
  // uninterrupted (the reference look); it frosts over as soon as the page
  // scrolls, and everywhere else.
  const overHero = pathname === "/" && settings.heroEnabled && !scrolled;
  // The admin's Header colours reach the light-mode utilities through CSS
  // vars so the `dark:` classes can override them — an inline
  // background-color/color would beat any class. Kalamari's tint opacities
  // (white/60 at the top, white/50 once scrolled) applied to the admin's
  // colour instead of plain white. `--logo-size` is the same trick for the
  // wordmark: the admin's size on md+, capped by viewport width on phones.
  const chrome = {
    "--header-glass": withAlpha(settings.headerBgColor, 0.6),
    "--header-glass-scrolled": withAlpha(settings.headerBgColor, 0.5),
    "--header-text": settings.headerTextColor,
    "--logo-size": settings.headerLogoFontSize,
  } as CSSProperties;
  const iconBtn =
    "relative flex h-9 w-9 items-center justify-center rounded-full transition-opacity hover:opacity-60";

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 transition-all duration-300 ease-in-out",
          "text-[color:var(--header-text)] dark:text-cream",
          overHero
            ? "border-b border-transparent bg-transparent"
            : scrolled
              ? // Scrolled: full frosted glass — thinner tint, heavier blur, a hairline + shadow to lift it off the page.
                "bg-[color:var(--header-glass-scrolled)] dark:bg-ink/50 backdrop-blur-md backdrop-saturate-150 border-b border-ink-100/30 dark:border-ink-800/40 shadow-sm"
              : // At the top: a denser tint with a light blur.
                "bg-[color:var(--header-glass)] dark:bg-ink/90 backdrop-blur-sm border-b border-white/20"
        )}
        style={chrome}
      >
        <MarqueeBanner items={marquees} />

        {/* Phones: the side columns are only as wide as their contents and the
            wordmark takes whatever is left (it's no longer viewport-centred,
            but MENU + the theme toggle are ~130px and a 1fr/auto/1fr grid would
            mirror that on the left and overflow a 375px screen). md+: equal
            side columns so the wordmark sits dead-centre. */}
        <div className="section-padding grid h-14 grid-cols-[auto_minmax(0,1fr)_auto] items-center md:h-16 md:grid-cols-[1fr_auto_1fr]">
          {/* Left — search */}
          <div className="flex items-center gap-1 justify-self-start">
            {settings.headerShowSearch && (
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                aria-label="Search"
                className={cn(iconBtn, "-ml-2")}
              >
                <Search size={18} strokeWidth={1.75} />
              </button>
            )}
          </div>

          {/* Centre — wordmark */}
          <Link href="/" className="flex min-w-0 items-center justify-center justify-self-center transition-opacity hover:opacity-70">
            <SafeImg
              src={settings.headerLogoImage ?? undefined}
              alt={settings.headerLogoText || "Home"}
              className="w-auto max-w-[40vw] object-contain md:max-w-none"
              style={{ height: settings.headerLogoHeight }}
              fallback={
                <span
                  className="whitespace-nowrap leading-none text-[length:min(var(--logo-size),7vw)] md:text-[length:var(--logo-size)]"
                  style={{ fontFamily: settings.headerLogoFontFamily }}
                >
                  {settings.headerLogoText}
                </span>
              }
            />
          </Link>

          {/* Right — utilities + MENU + theme toggle */}
          <div className="flex items-center gap-1 justify-self-end">
            {settings.headerShowReleaseNotes && <ReleaseNotes initialNotes={releaseNotes} />}
            {showWishlist && (
              <Link href="/wishlist" aria-label="Wishlist" className={iconBtn}>
                <Heart size={18} strokeWidth={1.75} />
                {mounted && <Badge count={wishlistCount} />}
              </Link>
            )}
            {showCart && (
              <Link href="/cart" aria-label="Cart" className={iconBtn}>
                <ShoppingBag size={18} strokeWidth={1.75} />
                {mounted && <Badge count={totalItems} />}
              </Link>
            )}
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              onMouseEnter={() => setMenuHovered(true)}
              onMouseLeave={() => setMenuHovered(false)}
              onFocus={() => setMenuHovered(true)}
              onBlur={() => setMenuHovered(false)}
              aria-haspopup="dialog"
              aria-expanded={menuOpen}
              className="flex h-9 items-center gap-2 rounded-full px-3 font-body text-[11px] font-medium uppercase tracking-[0.12em] outline-none transition-[background-color,color,transform] duration-300 ease-out"
              style={{
                backgroundColor: menuHovered ? settings.headerMenuHoverBgColor : "transparent",
                // Resting colour is inherited from the header (admin text
                // colour in light mode, cream in dark) — an inline value here
                // would pin it to the light-mode colour in both modes.
                color: menuHovered ? settings.headerMenuHoverTextColor : undefined,
                transform: menuHovered ? MENU_HOVER_TRANSFORM[settings.headerMenuHoverEffect].button : "none",
              }}
            >
              <DotsIcon
                className="transition-transform duration-300 ease-out"
                style={{ transform: menuHovered ? MENU_HOVER_TRANSFORM[settings.headerMenuHoverEffect].dots : "none" }}
              />
              {settings.headerMenuLabel}
            </button>
            {/* Always on, and last so it hugs the right edge: the site defaults
                to dark (app/layout.tsx's inline script) and this is the only
                way a visitor gets back to light. */}
            <ThemeToggle compactOnMobile />
          </div>
        </div>
      </header>

      {settings.headerShowSearch && (
        <SearchOverlay
          open={searchOpen}
          onClose={closeSearch}
          bgColor={settings.headerBgColor}
          textColor={settings.headerTextColor}
        />
      )}

      <MenuOverlay
        open={menuOpen}
        onClose={closeMenu}
        settings={settings}
        items={menuItems}
        socialLinks={socialLinks}
      />
    </>
  );
}
