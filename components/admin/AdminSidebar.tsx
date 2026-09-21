"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import nextDynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  ImagePlus,
  BookOpen,
  Shirt,
  Gamepad2,
  Landmark,
  ShoppingBag,
  Package,
  User,
  ExternalLink,
  LogOut,
  ChevronLeft,
  ChevronDown,
  Menu,
  X,
  Megaphone,
  Trash2,
  Settings,
  Bell,
  MapPin,
  StickyNote,
  Palette,
  Store,
  CircleUser,
  TrendingUp,
  LayoutTemplate,
  Disc3,
  Clapperboard,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { SquidIcon } from "@/components/ui/SquidIcon";
import { SafeImg } from "@/components/ui/SafeImage";
import { FooterWordmark } from "@/components/public/FooterWordmark";
import { parseIconValue } from "@/components/ui/icon-values";
import { useAdminLeaveGuard } from "@/components/admin/AdminLeaveGuard";

// DynamicIcon.tsx pulls in the full Lucide + Tabler icon-import maps
// (~3,000 entries) — dynamic-imported so that weight is only ever loaded
// if sidebarIcon is actually set (and only once, then cached), instead of
// being part of every admin page's compile via this always-mounted sidebar.
const DynamicIcon = nextDynamic(
  () => import("@/components/ui/DynamicIcon").then((m) => m.DynamicIcon),
  {
    ssr: false,
  }
);

// Kept in sync with IconHoverColorsEditor.tsx's DEFAULT_HOVER_COLORS — the
// factory-default cycle used when the admin hasn't customized it.
const DEFAULT_HOVER_COLORS = ["#FFE135", "#44D700", "#FF6B9D", "#5BC8F5"];

type NavLeaf = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Only match this exact pathname (used by Dashboard so it isn't "active" on every /admin/* route). */
  exact?: boolean;
};
type NavGroup = {
  /** Stable key for persisting the expanded/collapsed state. */
  id: string;
  label: string;
  icon: LucideIcon;
  children: NavLeaf[];
};
type NavEntry = NavLeaf | NavGroup;

const isGroup = (e: NavEntry): e is NavGroup => "children" in e;

// Top-level items stay flat; the mid-list modules are bucketed into three
// collapsible groups so the rail doesn't run off the bottom of the screen.
const NAV: NavEntry[] = [
  {
    href: "/admin/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    exact: true,
  },
  { href: "/admin/notifications", label: "Notifications", icon: Bell },
  {
    id: "music",
    label: "Music",
    icon: Disc3,
    children: [
      { href: "/admin/releases", label: "Releases", icon: Disc3 },
      { href: "/admin/videos", label: "Videos", icon: Clapperboard },
      { href: "/admin/vinyls", label: "Vinyls", icon: Disc3 },
    ],
  },
  {
    id: "gallery",
    label: "Museum & Archive",
    icon: Palette,
    children: [
      // Artworks owns a "Sections" tab now (the old /admin/sections route
      // redirects there); Minigames and Digital Museum are their own routes.
      { href: "/admin/artworks", label: "Museum Pieces", icon: ImagePlus },
      { href: "/admin/minigames", label: "Minigames", icon: Gamepad2 },
      // Same icon the museum's own favicon uses (lib/favicon.ts's
      // MUSEUM_FAVICON_ICON = "lucide:landmark") so the sidebar and the
      // browser tab agree on what "Digital Museum" looks like.
      { href: "/admin/museum", label: "Digital Museum", icon: Landmark },
      { href: "/admin/freedom-wall", label: "Freedom Wall", icon: StickyNote },
      { href: "/admin/stories", label: "Tales", icon: BookOpen },
      { href: "/admin/cosplays", label: "Cosplays", icon: Shirt },
      { href: "/admin/announcement", label: "Announcements", icon: Megaphone },
    ],
  },
  {
    id: "sales",
    label: "Sales",
    icon: Store,
    children: [
      // Revenue trend + top sellers. Sits first in the group: it's the read-only
      // overview you check before diving into the two modules that edit things.
      { href: "/admin/sales", label: "Sales Dashboard", icon: TrendingUp },
      { href: "/admin/products", label: "Products", icon: ShoppingBag },
      { href: "/admin/orders", label: "Orders", icon: Package },
    ],
  },
  {
    id: "profile",
    label: "Band",
    icon: CircleUser,
    children: [
      { href: "/admin/about", label: "About", icon: User },
      { href: "/admin/band-members", label: "Band Members", icon: Users },
      { href: "/admin/events", label: "Shows / Events", icon: MapPin },
    ],
  },
  // The public site's header / menu overlay / homepage hero look — its own
  // top-level entry (not a Preferences tab) since it's a whole surface with
  // a live preview, not a handful of knobs.
  { href: "/admin/site-design", label: "Site Design", icon: LayoutTemplate },
  { href: "/admin/settings", label: "Settings", icon: Settings },
  { href: "/admin/trash", label: "Trash", icon: Trash2 },
];

// Icon-only collapsed rail can't show accordions — flatten every group back
// into a plain list so it looks (and behaves) exactly as it did before.
const FLAT_NAV: NavLeaf[] = NAV.flatMap((e) => (isGroup(e) ? e.children : [e]));

const NAV_GROUPS_STORAGE_KEY = "scriptovernovel:admin-nav-groups";

function isLeafActive(item: NavLeaf, pathname: string) {
  if (item.exact) return pathname === item.href;
  // The Museum Scene Editor still lives under /admin/artworks/museum-editor;
  // keep "Digital Museum" lit there rather than "Artworks".
  if (pathname.startsWith("/admin/artworks/museum-editor")) {
    return item.href === "/admin/museum";
  }
  return pathname.startsWith(item.href);
}

export function AdminSidebar({
  logoImage,
  sidebarIcon,
  sidebarIconColors,
  sidebarMobileIcon,
}: {
  logoImage?: string | null;
  sidebarIcon?: string | null;
  sidebarIconColors?: string[] | null;
  /** Separate from sidebarIcon — that one's the collapsed-desktop icon-only state; this is the mobile top bar's wordmark. */
  sidebarMobileIcon?: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { confirmLeave } = useAdminLeaveGuard();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [colorIndex, setColorIndex] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const hoverColors =
    sidebarIconColors && sidebarIconColors.length > 0
      ? sidebarIconColors
      : DEFAULT_HOVER_COLORS;
  const sidebarIconParsed = parseIconValue(sidebarIcon);
  const sidebarMobileIconParsed = parseIconValue(sidebarMobileIcon);

  // Published for anything fixed to the viewport that should span the
  // content column rather than sit over the rail (UnsavedChangesBar.tsx).
  // Mirrors the md:w-56 / md:w-[72px] classes on the <aside> below.
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--admin-sidebar-width",
      collapsed ? "72px" : "14rem"
    );
    return () => {
      document.documentElement.style.removeProperty("--admin-sidebar-width");
    };
  }, [collapsed]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Which group (if any) owns the current route. `usePathname` returns the
  // same value on the server and the first client render, so seeding the
  // open-state from this keeps hydration clean.
  const activeGroupId = useMemo(
    () =>
      NAV.find(
        (e): e is NavGroup =>
          isGroup(e) && e.children.some((c) => isLeafActive(c, pathname))
      )?.id ?? null,
    [pathname]
  );

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    activeGroupId ? { [activeGroupId]: true } : {}
  );

  // Merge the admin's persisted expand/collapse choices in once, after mount.
  // The active group always wins so you never land on a page whose group is
  // shut.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(NAV_GROUPS_STORAGE_KEY);
      if (raw) {
        const stored = JSON.parse(raw) as Record<string, boolean>;
        setOpenGroups((prev) => ({ ...stored, ...prev }));
      }
    } catch {
      /* private mode / bad JSON — keep the default open state */
    }
  }, []);

  // Re-open the active group on client-side navigation into a collapsed one.
  useEffect(() => {
    if (activeGroupId) {
      setOpenGroups((prev) =>
        prev[activeGroupId] ? prev : { ...prev, [activeGroupId]: true }
      );
    }
  }, [activeGroupId]);

  useEffect(() => {
    try {
      localStorage.setItem(NAV_GROUPS_STORAGE_KEY, JSON.stringify(openGroups));
    } catch {
      /* ignore */
    }
  }, [openGroups]);

  const toggleGroup = (id: string) =>
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));

  // A single nav row. `nested` rows sit inside an expanded group — indented,
  // and highlighted with a fill instead of the flush left-edge bar.
  const renderLeaf = (item: NavLeaf, opts?: { nested?: boolean }) => {
    const active = isLeafActive(item, pathname);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={handleNavClick}
        aria-current={active ? "page" : undefined}
        className={cn(
          "group relative flex items-center gap-3 py-3 font-body text-sm transition-all duration-200 whitespace-nowrap",
          opts?.nested ? "pl-12 pr-6" : "px-6",
          active
            ? opts?.nested
              ? "text-ink bg-black/[0.06] dark:text-cream dark:bg-white/10"
              : "text-ink bg-black/[0.06] border-l-2 border-sepia dark:text-cream dark:bg-white/10"
            : "text-ink-500 hover:text-ink hover:bg-black/5 dark:text-ink-300 dark:hover:text-cream dark:hover:bg-white/5"
        )}
      >
        <item.icon size={16} strokeWidth={1.5} className="shrink-0" />
        <span>{item.label}</span>
      </Link>
    );
  };

  // Icon-only rail row (desktop collapsed) — unchanged from the pre-grouping
  // layout: centred icon + hover tooltip.
  const renderRailLeaf = (item: NavLeaf) => {
    const active = isLeafActive(item, pathname);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={handleNavClick}
        aria-current={active ? "page" : undefined}
        className={cn(
          "group relative flex items-center justify-center py-3 mx-3 rounded-lg transition-all duration-200",
          active
            ? "text-ink bg-black/[0.06] dark:text-cream dark:bg-white/10"
            : "text-ink-500 hover:text-ink hover:bg-black/5 dark:text-ink-300 dark:hover:text-cream dark:hover:bg-white/5"
        )}
      >
        <item.icon size={16} strokeWidth={1.5} className="shrink-0" />
        <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 whitespace-nowrap rounded-md bg-ink dark:bg-black px-2 py-1 text-xs text-cream opacity-0 shadow-lg group-hover:opacity-100 transition-opacity z-[60]">
          {item.label}
        </span>
      </Link>
    );
  };

  const renderGroup = (group: NavGroup) => {
    const open = !!openGroups[group.id];
    const hasActiveChild = group.children.some((c) =>
      isLeafActive(c, pathname)
    );
    return (
      <div key={group.id}>
        <button
          type="button"
          onClick={() => toggleGroup(group.id)}
          aria-expanded={open}
          className={cn(
            "flex w-full items-center gap-3 px-6 py-3 font-body text-sm transition-all duration-200 whitespace-nowrap",
            hasActiveChild
              ? "text-ink dark:text-cream"
              : "text-ink-500 hover:text-ink hover:bg-black/5 dark:text-ink-300 dark:hover:text-cream dark:hover:bg-white/5"
          )}
        >
          <group.icon size={16} strokeWidth={1.5} className="shrink-0" />
          <span className="flex-1 text-left">{group.label}</span>
          {hasActiveChild && !open && (
            <span
              className="h-1.5 w-1.5 rounded-full bg-sepia shrink-0"
              aria-hidden="true"
            />
          )}
          <ChevronDown
            size={14}
            strokeWidth={2}
            className={cn(
              "shrink-0 transition-transform duration-200 text-ink-400",
              open && "rotate-180"
            )}
          />
        </button>
        {/* 0fr → 1fr grid row animates the height without a fixed max-height. */}
        <div
          className={cn(
            "grid transition-[grid-template-rows] duration-200 ease-out",
            open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          )}
        >
          <div className="overflow-hidden">
            {group.children.map((child) => renderLeaf(child, { nested: true }))}
          </div>
        </div>
      </div>
    );
  };

  async function handleSignOut() {
    // Nothing else catches this exit. `redirect: false` plus a router.push is
    // a session clear and a client-side route change — no page unload, so the
    // browser's own "leave site?" prompt never runs, and a screen with a
    // backup mid-run or unsaved edits would lose it without a word. Screens
    // that have something to protect say so through AdminLeaveGuard.
    if (!confirmLeave("signout")) return;
    await signOut({ redirect: false });
    router.push("/login");
  }

  // Every module link in this sidebar routes client-side, so a screen with
  // unsaved work gets no say and no browser prompt. Screens that stand to lose
  // something register a reason through AdminLeaveGuard; everything else is
  // unaffected and this is a plain drawer close.
  function handleNavClick(e: React.MouseEvent) {
    if (!confirmLeave("navigate")) {
      e.preventDefault();
      return;
    }
    setMobileOpen(false);
  }

  // "View Site" opens in a new tab — the admin isn't going anywhere, so there
  // is nothing to protect and nothing to ask about.
  function handleExternalNavClick() {
    setMobileOpen(false);
  }

  return (
    <>
      {/* Mobile top bar — glass/frosted style, scroll-aware like Navbar.tsx */}
      <div
        className={cn(
          "md:hidden fixed top-0 left-0 right-0 z-30 h-14 flex items-center justify-between px-4 transition-all duration-300",
          scrolled
            ? "bg-white/50 dark:bg-ink/50 backdrop-blur-md backdrop-saturate-150 border-b border-ink-100/30 dark:border-ink-800/40 shadow-sm"
            : "bg-white/60 dark:bg-ink/90 backdrop-blur-sm border-b border-white/20"
        )}
      >
        <button
          onClick={() => setMobileOpen((o) => !o)}
          className="flex items-center justify-center w-9 h-9 -ml-1.5 text-ink dark:text-cream"
          aria-label="Toggle menu"
        >
          <Menu size={20} />
        </button>
        <span className="group/logo font-badaboom font-light inline-flex items-center justify-center w-full text-lg tracking-[0.02em] uppercase text-ink dark:text-cream">
          <span className="transition-colors duration-200 hover:text-[#FFE135]">
            Ka
          </span>
          <span className="transition-colors duration-200 hover:text-[#44D700]">
            la
          </span>
          <span className="transition-colors duration-200 hover:text-[#FF6B9D]">
            m
          </span>
          {/* Squid stands in for the second "A" — kerned tight against the
              neighbouring letters so it reads as part of the word.
              animate-squid-drift bobs the wrapper and cycles --squid-glow,
              same as FooterWordmark.tsx, so the icon auto-cycles colour
              instead of only tinting on hover. */}
          <span className="relative inline-flex items-center justify-center -mx-px motion-safe:animate-squid-drift">
            <span
              aria-hidden="true"
              style={{
                backgroundColor: "color-mix(in srgb, var(--squid-glow) 35%, transparent)",
              }}
              className="pointer-events-none absolute inset-0 scale-75 rounded-full opacity-0 blur-md transition-all duration-300 group-hover/logo:scale-150 group-hover/logo:opacity-100"
            />
            {sidebarMobileIconParsed ? (
              <DynamicIcon
                platform={sidebarMobileIconParsed.platform}
                name={sidebarMobileIconParsed.name}
                style={{ color: "var(--squid-glow)" }}
                className="relative w-5 h-5 shrink-0 transition-transform duration-300 motion-safe:animate-squid-glow group-hover/logo:scale-110"
                fallback={
                  <SquidIcon
                    style={{ color: "var(--squid-glow)" }}
                    className="relative w-5 h-5 shrink-0 transition-transform duration-300 motion-safe:animate-squid-glow group-hover/logo:scale-110"
                  />
                }
              />
            ) : (
              <SquidIcon
                style={{ color: "var(--squid-glow)" }}
                className="relative w-5 h-5 shrink-0 transition-transform duration-300 motion-safe:animate-squid-glow group-hover/logo:scale-110"
              />
            )}
          </span>
          <span className="transition-colors duration-200 hover:text-[#5BC8F5]">
            ri
          </span>
        </span>
      </div>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "glass-card",
          // .glass-card ships with overflow-hidden, which clips the collapse
          // toggle that deliberately straddles the right edge. Scrolling is
          // already scoped to the inner wrapper + <nav>, so nothing here needs
          // to clip.
          // Theme-aware: white rail in light mode, near-black in dark mode.
          "!rounded-none !overflow-visible !border-0 !border-r",
          "!bg-white !border-black/10 dark:!bg-black/90 dark:!border-white/15",
          "shrink-0 text-ink dark:text-cream h-screen z-50",
          "transition-all duration-300 ease-in-out",
          "fixed inset-y-0 left-0 w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          "md:sticky md:top-0 md:translate-x-0",
          collapsed ? "md:w-[72px]" : "md:w-56"
        )}
      >
        {/* Desktop Collapse toggle - Placed outside the inner wrapper so it doesn't get cut.
            -right-3.5 is exactly half of w-7, so the pill sits centred on the border. */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className={cn(
            "hidden md:flex absolute -right-3.5 top-9 z-50 items-center justify-center",
            "w-7 h-7 rounded-full backdrop-blur-md border shadow-md",
            "bg-white border-black/10 text-ink-400 shadow-black/10",
            "dark:bg-black/90 dark:border-white/10 dark:text-ink-300 dark:shadow-black/50",
            "transition-all duration-200 ease-out",
            "hover:text-ink hover:bg-ink-50 hover:border-black/20 hover:scale-110",
            "dark:hover:text-cream dark:hover:bg-black dark:hover:border-white/30",
            "active:scale-95",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sepia focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-black"
          )}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronLeft
            size={14}
            strokeWidth={2}
            className={cn(
              "transition-transform duration-300 ease-out",
              collapsed && "rotate-180"
            )}
          />
        </button>

        {/* Mobile close button */}
        <button
          onClick={() => setMobileOpen(false)}
          className="md:hidden absolute right-3 top-3 z-20 flex items-center justify-center w-8 h-8 text-ink-400 hover:text-ink dark:text-ink-300 dark:hover:text-cream"
          aria-label="Close menu"
        >
          <X size={18} />
        </button>

        {/* Inner Content Wrapper - Handles vertical flex & hides horizontal scrollbars */}
        <div className="flex flex-col h-full w-full overflow-x-hidden">
          {/* Logo Section — overflow-hidden clips the squid-glow blur from
              the collapsed icon (opacity-70 blur-xl scale-150) from spilling
              past the sidebar's right edge into the main content area. The
              collapse toggle lives outside this inner wrapper, so it is
              unaffected; nav tooltips are in a sibling <nav>, also unaffected. */}
          <div
            className={cn(
              "border-b border-black/10 dark:border-white/10 transition-all duration-300 shrink-0 overflow-hidden",
              collapsed ? "px-3 py-6 flex justify-center" : "px-6 pt-2 pb-6"
            )}
          >
            {collapsed ? (
              sidebarIconParsed ? (
                <DynamicIcon
                  platform={sidebarIconParsed.platform}
                  name={sidebarIconParsed.name}
                  className="w-7 h-7 transition-colors duration-200 cursor-pointer shrink-0"
                  style={{ color: hoverColors[colorIndex] }}
                  onMouseEnter={() =>
                    setColorIndex((i) => (i + 1) % hoverColors.length)
                  }
                />
              ) : (
                // No custom sidebarIcon set — fall back to the squid, animated
                // the same way as FooterWordmark.tsx / MaintenancePage.tsx
                // (auto-cycling CSS animation) instead of the hover-driven
                // colour cycle above, since hover never fires on mobile touch.
                <span className="relative inline-flex items-center justify-center motion-safe:animate-squid-drift">
                  <span
                    aria-hidden="true"
                    style={{
                      backgroundColor:
                        "color-mix(in srgb, var(--squid-glow) 35%, transparent)",
                    }}
                    className="pointer-events-none absolute inset-0 scale-150 rounded-full opacity-70 blur-xl"
                  />
                  <SquidIcon
                    style={{ color: "var(--squid-glow)" }}
                    className="relative w-7 h-7 shrink-0 motion-safe:animate-squid-glow"
                  />
                </span>
              )
            ) : (
              // Centred as a column: the logo (or the wordmark), the caption
              // under it and the theme toggle under that all share one axis.
              // The logo only looked centred before because a wide upload hits
              // max-w-full and fills the sidebar — a narrower one, the text
              // wordmark, the caption and the toggle all sat flush left against
              // it.
              <div className="whitespace-nowrap flex flex-col items-center text-center">
                {/* No logo, or a logo whose file is gone: the same
                    SCRIPT/N(squid)VEL lockup as the public navbar/footer. */}
                <SafeImg
                  src={logoImage ?? undefined}
                  alt="Logo"
                  className="h-20 md:h-40 w-auto max-w-full object-contain"
                  fallback={
                    <span className="text-ink dark:text-cream">
                      <FooterWordmark className="text-3xl" />
                    </span>
                  }
                />
                <p className="font-body text-[10px] text-ink-400 tracking-widest uppercase mt-1">
                  Admin Panel
                </p>
                <div className="mt-3">
                  <ThemeToggle />
                </div>
              </div>
            )}
          </div>

          {/* Spacer for Mobile */}
          <div className="md:hidden h-2 shrink-0" />

          {/* Nav Links */}
          <nav className="flex-1 py-6 overflow-y-auto overflow-x-hidden">
            {/* Desktop icon-only rail: groups can't be accordions at 72px,
                so every module is flattened back to a plain icon list. */}
            {collapsed && (
              <div className="hidden md:block">
                {FLAT_NAV.map(renderRailLeaf)}
              </div>
            )}
            {/* Full grouped nav — always on mobile, and on desktop whenever
                the rail isn't collapsed. */}
            <div className={collapsed ? "md:hidden" : undefined}>
              {NAV.map((entry) =>
                isGroup(entry) ? renderGroup(entry) : renderLeaf(entry)
              )}
            </div>
          </nav>

          {/* Footer / Bottom Section */}
          <div className="py-4 border-t border-black/10 dark:border-white/10 space-y-2 shrink-0">
            {/* View Site */}
            <Link
              href="/"
              target="_blank"
              onClick={handleExternalNavClick}
              className={cn(
                "group relative flex items-center gap-3 py-2.5 font-body text-xs text-ink-500 hover:text-ink dark:text-ink-400 dark:hover:text-cream transition-colors whitespace-nowrap",
                collapsed ? "px-6 md:justify-center md:px-0" : "px-6"
              )}
            >
              <ExternalLink size={14} className="shrink-0" />
              <span className={collapsed ? "md:hidden" : ""}>View Site</span>
              {collapsed && (
                <span className="hidden md:block pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 whitespace-nowrap rounded-md bg-ink dark:bg-black px-2 py-1 text-xs text-cream opacity-0 shadow-lg group-hover:opacity-100 transition-opacity z-[60]">
                  View Site
                </span>
              )}
            </Link>

            {/* Sign Out */}
            <button
              onClick={handleSignOut}
              className={cn(
                "group relative flex items-center gap-3 py-2.5 font-body text-xs text-ink-500 hover:text-vermillion dark:text-ink-400 transition-colors w-full whitespace-nowrap",
                collapsed ? "px-6 md:justify-center md:px-0" : "px-6"
              )}
            >
              <LogOut size={14} className="shrink-0" />
              <span className={collapsed ? "md:hidden" : ""}>Sign Out</span>
              {collapsed && (
                <span className="hidden md:block pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-2 whitespace-nowrap rounded-md bg-ink dark:bg-black px-2 py-1 text-xs text-cream opacity-0 shadow-lg group-hover:opacity-100 transition-opacity z-[60]">
                  Sign Out
                </span>
              )}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
