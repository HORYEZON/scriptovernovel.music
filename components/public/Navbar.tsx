"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { ShoppingBag, Heart, Menu, X } from "lucide-react";
import { useCartStore } from "@/lib/cart-store";
import { useWishlistStore } from "@/lib/wishlist-store";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { SafeImg } from "@/components/ui/SafeImage";
import { SquidLetter } from "@/components/public/SquidLetter";
import { MarqueeBanner } from "@/components/public/MarqueeBanner";
import { ReleaseNotes, type PublicReleaseNote } from "@/components/public/ReleaseNotes";
import type { Marquee } from "@/lib/marquee";

const NAV_LINKS = [
  { href: "/", label: "Gallery" },
  { href: "/stories", label: "Tales" },
  { href: "/shop", label: "Shop" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export function Navbar({
  logoImage,
  marquees = [],
  releaseNotes = [],
}: {
  logoImage?: string | null;
  marquees?: Marquee[];
  releaseNotes?: PublicReleaseNote[];
}) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const totalItems = useCartStore((s) => s.totalItems());
  const wishlistCount = useWishlistStore((s) => s.items.length);

  // Cart/wishlist counts come from localStorage-persisted stores, which
  // rehydrate on the client before React reconciles the first paint — the
  // server always renders 0, so a returning visitor with items already
  // saved would mismatch. Hold the badges back until after mount, once
  // the client and server have agreed on an initial render.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // The Digital Museum is a full-viewport 3D room with its own HUD (see
  // MuseumClient.tsx) — this fixed, z-50 navbar (and the marquee it renders)
  // would otherwise float on top of it, same as it does on every other page.
  if (pathname?.startsWith("/gallery/museum")) return null;

  return (
    <>
      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-300 ease-in-out",
          scrolled
            ? // On scroll: Full glassy effect (frosted glass with backdrop blur)
              "bg-white/50 dark:bg-ink/50 backdrop-blur-md backdrop-saturate-150 border-b border-ink-100/30 dark:border-ink-800/40 shadow-sm"
            : // At the top: Light white background with subtle transparency & blur
              "bg-white/60 dark:bg-ink/90 backdrop-blur-sm border-b border-white/20"
        )}
      >
        {/* Ticker rides above the nav inside the same fixed block, so the two
            scroll (or rather, don't) as one unit. */}
        <MarqueeBanner items={marquees} />

        <nav className="section-padding flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <Link href="/" className="group flex items-center">
            <span className="inline-block group-hover:opacity-80 transition-opacity duration-300">
              {/* No logo, or a logo whose file is gone: just the glowing
                  squid (SquidLetter — the same always-on halo + colour-cycle
                  every heading's squid wears), not the full SCRIPT/N(squid)VEL
                  wordmark. A row this short has no room for six letters of
                  text without repeating the crowded-hamburger problem the
                  wordmark itself had. */}
              <SafeImg
                src={logoImage ?? undefined}
                alt="ScriptOverNovel Customs Logo"
                // Capped well under the h-16/h-20 nav row (not just under it)
                // and width-limited — an uploaded logo is whatever aspect
                // ratio the admin cropped it, and at the old h-14 a wide one
                // ran wide enough to shove the hamburger/cart/wishlist
                // icons against the edge, or past it, on a phone.
                className="h-9 sm:h-11 md:h-14 lg:h-16 w-auto max-w-[8rem] sm:max-w-[11rem] md:max-w-none object-contain"
                fallback={
                  <span className="h-9 sm:h-11 md:h-14 lg:h-16 flex items-center">
                    {/* mr-[0.1em] rides along from SquidLetter's own base
                        classes — negligible at this size, not worth fighting
                        the cascade to strip for a standalone icon. */}
                    <SquidLetter letter="ScriptOverNovel" className="text-3xl sm:text-4xl md:text-5xl" />
                  </span>
                }
              />
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "font-body text-xs tracking-widest uppercase transition-all duration-200",
                  pathname === link.href
                    ? "text-ink dark:text-cream border-b border-ink dark:border-cream"
                    : "text-ink-500 dark:text-cream/60 hover:text-ink dark:hover:text-cream"
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {/* Sits next to the theme toggle deliberately: both are about the
                site itself rather than the artwork, unlike wishlist/cart. */}
            <ReleaseNotes initialNotes={releaseNotes} />
            {/* Wishlist doesn't depend on checkout/Shop going live (Phase 2
                below) — it's pure browsing, localStorage only, so it's on now. */}
            <Link
              href="/wishlist"
              className="relative p-2 text-ink dark:text-cream hover:text-sepia transition-colors"
              aria-label="Wishlist"
            >
              <Heart size={18} strokeWidth={1.5} />
              {mounted && wishlistCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-vermillion text-cream text-[9px] font-jakarta flex items-center justify-center rounded-full">
                  {wishlistCount}
                </span>
              )}
            </Link>
            {/* This Shopping will Implement on Phase 2 */}
            <Link
              href="/cart"
              className="relative p-2 text-ink dark:text-cream hover:text-sepia transition-colors"
              aria-label="Cart"
            >
              <ShoppingBag size={18} strokeWidth={1.5} />
              {mounted && totalItems > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-vermillion text-cream text-[9px] font-jakarta flex items-center justify-center rounded-full">
                  {totalItems}
                </span>
              )}
            </Link>
            <button
              className="md:hidden p-2 text-ink dark:text-cream focus:outline-none"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? (
                <X size={20} strokeWidth={1.5} />
              ) : (
                <Menu size={20} strokeWidth={1.5} />
              )}
            </button>
          </div>
        </nav>
      </header>

      {/* Mobile Menu with Glassy Background */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-cream/80 dark:bg-ink/80 backdrop-blur-xl flex flex-col justify-center items-center gap-8 transition-all duration-300 md:hidden",
          mobileOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        )}
      >
        {NAV_LINKS.map((link, i) => (
          <Link
            key={link.href}
            href={link.href}
            onClick={() => setMobileOpen(false)}
            className={cn(
              "font-jakarta text-4xl font-light tracking-tight transition-all duration-200",
              pathname === link.href
                ? "text-sepia"
                : "text-ink dark:text-cream hover:text-sepia",
              "animate-fade-up"
            )}
            style={{ animationDelay: `${i * 80}ms` }}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </>
  );
}
