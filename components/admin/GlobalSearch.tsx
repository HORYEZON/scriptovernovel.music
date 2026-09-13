"use client";

// components/admin/GlobalSearch.tsx
//
// Command-palette style search, mounted once next to NotificationBell (see
// app/(admin)/layout.tsx) so it's available from every admin page. The
// trigger is a plain icon button styled to match the bell (same size/shape
// on both breakpoints); activating it — click, or the ⌘K/Ctrl+K shortcut
// from anywhere in the admin — opens a centered modal, same footprint as
// ArtworkPicker.tsx's picker dialog.
//
// With an empty query it shows quick links to every admin page (a fuzzy nav
// shortcut). Typing 2+ characters additionally searches Artworks, Stories,
// Products, Orders, Sections, Announcements and FAQs via /api/admin/search,
// debounced. None of those content models have their own detail route —
// everything is edited via modal on its list page — so results land on that
// list page rather than a specific record; still faster than hunting through
// the sidebar.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  Search,
  X,
  Loader2,
  LayoutDashboard,
  Bell,
  ImagePlus,
  BookOpen,
  Shirt,
  FolderOpen,
  Megaphone,
  ShoppingBag,
  Package,
  User,
  Settings,
  Trash2,
  MessageCircleQuestion,
  Palette,
  Music,
  Gamepad2,
  Volume2,
  ShieldCheck,
  Ban,
  PowerOff,
  Building2,
  DoorOpen,
  MapPin,
  StickyNote,
  DatabaseBackup,
  Sparkles,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { SafeImg } from "@/components/ui/SafeImage";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";
import { cn, formatPrice, ORDER_STATUS_COLORS } from "@/lib/utils";
import { storyTypeLabel } from "@/lib/stories";

type PageGroupLabel =
  "Overview" | "Artworks" | "Stories" | "Content" | "Shop" | "Site" | "Settings" | "Trash";
type AdminPage = {
  label: string;
  href: string;
  icon: LucideIcon;
  keywords: string;
  group: PageGroupLabel;
};

// Which order the quick-nav page groups render in — every ADMIN_PAGES entry
// below must use one of these labels (see the "Pages" grouping in `groups`
// further down). Order matches the AdminSidebar NAV so the palette feels like
// a keyboard-accessible mirror of the sidebar rather than a separate layout.
const PAGE_GROUP_ORDER: PageGroupLabel[] = [
  "Overview",    // Dashboard, Notifications
  "Artworks",    // Artworks + Digital Museum + Mini Games tabs
  "Stories",     // Books, novels, comics & manga
  "Content",     // Sections, Announcements, FAQ Chatbox
  "Shop",        // Products, Orders
  "Site",        // About
  "Settings",    // Settings + all sub-pages / tabs
  "Trash",       // Trash
];

// Kept in sync with AdminSidebar.tsx's NAV plus the module cards on
// /admin/settings — there's no shared source of truth for "every admin
// page" to import from, so this is a second hand-maintained copy.
// Array order mirrors the sidebar (Dashboard → Notifications → Artworks →
// Stories → Content → Shop → About → Settings → Trash) so the palette reads
// in the same sequence a user scanning the sidebar would expect.
const ADMIN_PAGES: AdminPage[] = [
  // ── Overview ─────────────────────────────────────────────────────────────
  {
    label: "Dashboard",
    href: "/admin/dashboard",
    icon: LayoutDashboard,
    keywords: "dashboard overview home analytics",
    group: "Overview",
  },
  {
    label: "Notifications",
    href: "/admin/notifications",
    icon: Bell,
    keywords:
      "notifications gmail alerts inbox orders minigame highscores museum",
    group: "Overview",
  },
  // ── Artworks (main page + tab-based sub-modules) ──────────────────────────
  {
    label: "Artworks",
    href: "/admin/artworks",
    icon: ImagePlus,
    keywords: "artworks gallery art pieces upload manage",
    group: "Artworks",
  },
  {
    label: "Mini Games",
    href: "/admin/minigames",
    icon: Gamepad2,
    keywords: "mini games puzzle leaderboard rewards highscore",
    group: "Artworks",
  },
  {
    label: "Digital Museum",
    href: "/admin/museum",
    icon: Building2,
    keywords: "digital museum 3d gallery rooms exhibitions walkthrough splash",
    group: "Artworks",
  },
  // Has both a dedicated route (sidebar) and a Digital Museum sub-tab; the
  // standalone page is the canonical target here since it deep-links cleanly.
  {
    label: "Freedom Wall",
    href: "/admin/freedom-wall",
    icon: StickyNote,
    keywords: "freedom wall sticky notes events messages visitors board pin",
    group: "Artworks",
  },
  // ── Stories ──────────────────────────────────────────────────────────────
  {
    label: "Stories",
    href: "/admin/stories",
    icon: BookOpen,
    keywords: "stories books novels comics manga anthology artbook zine webtoon pages reader cover",
    group: "Stories",
  },
  {
    label: "Cosplays",
    href: "/admin/cosplays",
    icon: Shirt,
    keywords: "cosplay cosplays costume standee character series convention con photoshoot wig prop",
    group: "Stories",
  },
  // ── Content ──────────────────────────────────────────────────────────────
  // Tab on the Artworks page (ArtworksTabs.tsx reads ?tab=sections).
  {
    label: "Sections",
    href: "/admin/artworks?tab=sections",
    icon: FolderOpen,
    keywords: "sections collections categories",
    group: "Artworks",
  },
  {
    label: "Announcements",
    href: "/admin/announcement",
    icon: Megaphone,
    keywords: "announcements marquee ticker popup",
    group: "Content",
  },
  // Tab on the Announcements page (AnnouncementTabs.tsx reads ?tab=faqs).
  {
    label: "FAQ Chatbox",
    href: "/admin/announcement?tab=faqs",
    icon: MessageCircleQuestion,
    keywords: "faq chatbox questions answers",
    group: "Content",
  },
  // ── Shop ─────────────────────────────────────────────────────────────────
  {
    label: "Products",
    href: "/admin/products",
    icon: ShoppingBag,
    keywords: "products shop store pricing",
    group: "Shop",
  },
  {
    label: "Orders",
    href: "/admin/orders",
    icon: Package,
    keywords: "orders sales purchases checkout",
    group: "Shop",
  },
  // ── Site ─────────────────────────────────────────────────────────────────
  {
    label: "About",
    href: "/admin/about",
    icon: User,
    keywords: "about artist bio profile",
    group: "Site",
  },
  {
    label: "Timeline / Events",
    href: "/admin/events",
    icon: MapPin,
    keywords: "timeline events gigs shows map pins next event",
    group: "Site",
  },
  // ── Settings (main hub + sub-pages + preference tabs) ────────────────────
  {
    label: "Settings",
    href: "/admin/settings",
    icon: Settings,
    keywords: "settings configuration hub",
    group: "Settings",
  },
  {
    label: "Preferences",
    href: "/admin/settings/Preferences",
    icon: Palette,
    keywords:
      "preferences branding theme logo background buttons scrollbar fonts icons splash",
    group: "Settings",
  },
  // Tab on the Preferences page (PreferencesClient.tsx reads ?tab=music).
  {
    label: "Background Music",
    href: "/admin/settings/Preferences?tab=music",
    icon: Music,
    keywords: "music audio background track",
    group: "Settings",
  },
  // Tab on the Preferences page (PreferencesClient.tsx reads ?tab=sound).
  {
    label: "Sound",
    href: "/admin/settings/Preferences?tab=sound",
    icon: Volume2,
    keywords: "sound effects toast payment",
    group: "Settings",
  },
  {
    label: "Security",
    href: "/admin/settings/security",
    icon: ShieldCheck,
    keywords: "security two-factor 2fa totp",
    group: "Settings",
  },
  {
    label: "Blocked Emails",
    href: "/admin/settings/blocked-emails",
    icon: Ban,
    keywords: "blocked emails spam contact form",
    group: "Settings",
  },
  {
    label: "Maintenance",
    href: "/admin/settings/maintenance",
    icon: PowerOff,
    keywords: "maintenance mode down site offline",
    group: "Settings",
  },
  {
    label: "Backup & Restore",
    href: "/admin/settings/backup",
    icon: DatabaseBackup,
    keywords: "backup restore export import archive download database",
    group: "Settings",
  },
  {
    label: "Release Notes",
    href: "/admin/settings/release-notes",
    icon: Sparkles,
    keywords: "release notes changelog what's new updates",
    group: "Settings",
  },
  {
    label: "Visitor Milestones",
    href: "/admin/settings/visitor-milestones",
    icon: Trophy,
    keywords: "visitor milestones rewards achievements badges",
    group: "Settings",
  },
  // ── Trash ─────────────────────────────────────────────────────────────────
  {
    label: "Trash",
    href: "/admin/trash",
    icon: Trash2,
    keywords: "trash deleted recover restore",
    group: "Trash",
  },
];

const ROOM_TYPE_LABEL: Record<
  "MAIN_HALL" | "GALLERY" | "SPECIAL_EXHIBITION",
  string
> = {
  MAIN_HALL: "Main Hall",
  GALLERY: "Gallery",
  SPECIAL_EXHIBITION: "Special Exhibition",
};

interface SearchResponse {
  artworks: {
    id: string;
    title: string;
    imageUrl: string;
    status: "AVAILABLE" | "SOLD";
    published: boolean;
  }[];
  stories: {
    id: string;
    title: string;
    coverImageUrl: string;
    type: string;
    author: string | null;
    published: boolean;
  }[];
  cosplays: {
    id: string;
    title: string;
    character: string | null;
    series: string | null;
    standeeImageUrl: string;
    published: boolean;
  }[];
  products: {
    id: string;
    price: number;
    available: boolean;
    artwork: { title: string; imageUrl: string };
  }[];
  orders: {
    id: string;
    customerName: string;
    customerEmail: string;
    status: keyof typeof ORDER_STATUS_COLORS;
    total: number;
  }[];
  sections: { id: string; name: string; isPublished: boolean }[];
  rooms: {
    id: string;
    name: string;
    roomType: "MAIN_HALL" | "GALLERY" | "SPECIAL_EXHIBITION";
    enabled: boolean;
  }[];
  announcements: {
    id: string;
    text: string;
    category: string;
    isActive: boolean;
  }[];
  faqs: { id: string; question: string; isActive: boolean }[];
  events: {
    id: string;
    title: string;
    venueName: string | null;
    enabled: boolean;
    isNextEvent: boolean;
  }[];
}

const EMPTY_RESULTS: SearchResponse = {
  artworks: [],
  stories: [],
  cosplays: [],
  products: [],
  orders: [],
  sections: [],
  rooms: [],
  announcements: [],
  faqs: [],
  events: [],
};

interface ResultItem {
  key: string;
  title: string;
  subtitle?: string;
  href: string;
  image?: string | null;
  icon?: LucideIcon;
  badge?: { label: string; className: string };
}

interface ResultGroup {
  key: string;
  label: string;
  icon: LucideIcon;
  items: ResultItem[];
}

const ACTIVE_BADGE =
  "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20";
const INACTIVE_BADGE =
  "bg-gray-500/10 text-gray-600 dark:text-gray-400 border border-gray-500/20";
const DRAFT_BADGE =
  "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20";

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResponse>(EMPTY_RESULTS);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  useEffect(() => setMounted(true), []);
  useLockBodyScroll(open);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setResults(EMPTY_RESULTS);
    setSelectedIndex(0);
  }, []);

  // ⌘K / Ctrl+K opens (or refocuses) the palette from anywhere in the admin,
  // Esc closes it — same shortcut convention as most admin tooling.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
        requestAnimationFrame(() => inputRef.current?.focus());
      } else if (event.key === "Escape" && open) {
        close();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  // Debounced data search — quick-nav page matches below are cheap/local and
  // update on every keystroke instead.
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults(EMPTY_RESULTS);
      setLoading(false);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/admin/search?q=${encodeURIComponent(trimmed)}`,
          {
            signal: controller.signal,
          }
        );
        const data = await res.json().catch(() => null);
        if (res.ok && data) setResults(data);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          // Silent, same "degrade quietly" pattern as NotificationBell — a
          // failed search just shows no data results rather than a toast.
        }
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const pageMatches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return ADMIN_PAGES;
    return ADMIN_PAGES.filter(
      (page) =>
        page.label.toLowerCase().includes(needle) ||
        page.keywords.includes(needle)
    );
  }, [query]);

  const groups = useMemo<ResultGroup[]>(() => {
    const list: ResultGroup[] = [];

    // Quick-nav pages split into their own labeled clusters (Overview /
    // Content / Digital Museum / Shop / Site / Settings) instead of one
    // flat "Pages" list — the page count nearly doubled since this was
    // first built, and Digital Museum needed somewhere that visibly reads
    // as "part of the museum," not just another line indistinguishable
    // from Products or Trash.
    for (const groupLabel of PAGE_GROUP_ORDER) {
      const pagesInGroup = pageMatches.filter((p) => p.group === groupLabel);
      if (pagesInGroup.length === 0) continue;
      list.push({
        key: `pages-${groupLabel}`,
        label: groupLabel,
        icon: LayoutDashboard,
        items: pagesInGroup.map((page) => ({
          key: page.href,
          title: page.label,
          href: page.href,
          icon: page.icon,
        })),
      });
    }

    if (results.artworks.length > 0) {
      list.push({
        key: "artworks",
        label: "Artworks",
        icon: ImagePlus,
        items: results.artworks.map((a) => ({
          key: a.id,
          title: a.title,
          href: "/admin/artworks",
          image: a.imageUrl,
          badge:
            a.status === "SOLD"
              ? { label: "Sold", className: DRAFT_BADGE }
              : a.published
                ? { label: "Published", className: ACTIVE_BADGE }
                : { label: "Draft", className: INACTIVE_BADGE },
        })),
      });
    }

    if (results.stories.length > 0) {
      list.push({
        key: "stories",
        label: "Stories",
        icon: BookOpen,
        items: results.stories.map((s) => ({
          key: s.id,
          title: s.title,
          subtitle: [storyTypeLabel(s.type), s.author].filter(Boolean).join(" · "),
          href: "/admin/stories",
          image: s.coverImageUrl,
          badge: s.published
            ? { label: "Published", className: ACTIVE_BADGE }
            : { label: "Draft", className: INACTIVE_BADGE },
        })),
      });
    }

    if (results.cosplays.length > 0) {
      list.push({
        key: "cosplays",
        label: "Cosplays",
        icon: Shirt,
        items: results.cosplays.map((c) => ({
          key: c.id,
          // The character is what the standee's plaque reads, so it's what an
          // admin is searching for; the title backs it up underneath.
          title: c.character || c.title,
          subtitle: [c.series, c.character ? c.title : null].filter(Boolean).join(" · "),
          href: "/admin/cosplays",
          image: c.standeeImageUrl,
          badge: c.published
            ? { label: "Published", className: ACTIVE_BADGE }
            : { label: "Draft", className: INACTIVE_BADGE },
        })),
      });
    }

    if (results.products.length > 0) {
      list.push({
        key: "products",
        label: "Products",
        icon: ShoppingBag,
        items: results.products.map((p) => ({
          key: p.id,
          title: p.artwork.title,
          subtitle: formatPrice(p.price),
          href: "/admin/products",
          image: p.artwork.imageUrl,
          badge: p.available
            ? { label: "Available", className: ACTIVE_BADGE }
            : { label: "Unavailable", className: INACTIVE_BADGE },
        })),
      });
    }

    if (results.orders.length > 0) {
      list.push({
        key: "orders",
        label: "Orders",
        icon: Package,
        items: results.orders.map((o) => ({
          key: o.id,
          title: o.customerName,
          subtitle: `${o.customerEmail} · ${formatPrice(o.total)}`,
          href: "/admin/orders",
          badge: {
            label: o.status,
            className: ORDER_STATUS_COLORS[o.status] ?? INACTIVE_BADGE,
          },
        })),
      });
    }

    if (results.sections.length > 0) {
      list.push({
        key: "sections",
        label: "Sections",
        icon: FolderOpen,
        items: results.sections.map((s) => ({
          key: s.id,
          title: s.name,
          href: "/admin/artworks?tab=sections",
          badge: s.isPublished
            ? { label: "Published", className: ACTIVE_BADGE }
            : { label: "Draft", className: INACTIVE_BADGE },
        })),
      });
    }

    if (results.rooms.length > 0) {
      list.push({
        key: "rooms",
        label: "Digital Museum · Rooms",
        icon: DoorOpen,
        items: results.rooms.map((r) => ({
          key: r.id,
          title: r.name,
          subtitle: ROOM_TYPE_LABEL[r.roomType],
          href: "/admin/museum?museumTab=rooms",
          badge: r.enabled
            ? { label: "Enabled", className: ACTIVE_BADGE }
            : { label: "Disabled", className: INACTIVE_BADGE },
        })),
      });
    }

    if (results.announcements.length > 0) {
      list.push({
        key: "announcements",
        label: "Announcements",
        icon: Megaphone,
        items: results.announcements.map((a) => ({
          key: a.id,
          title: a.text,
          subtitle: a.category,
          href: "/admin/announcement",
          badge: a.isActive
            ? { label: "Active", className: ACTIVE_BADGE }
            : { label: "Inactive", className: INACTIVE_BADGE },
        })),
      });
    }

    if (results.faqs.length > 0) {
      list.push({
        key: "faqs",
        label: "FAQs",
        icon: MessageCircleQuestion,
        items: results.faqs.map((f) => ({
          key: f.id,
          title: f.question,
          href: "/admin/announcement?tab=faqs",
          badge: f.isActive
            ? { label: "Active", className: ACTIVE_BADGE }
            : { label: "Inactive", className: INACTIVE_BADGE },
        })),
      });
    }

    if (results.events.length > 0) {
      list.push({
        key: "events",
        label: "Timeline / Events",
        icon: MapPin,
        items: results.events.map((e) => ({
          key: e.id,
          title: e.title,
          subtitle: e.venueName ?? undefined,
          href: "/admin/events",
          badge: e.isNextEvent
            ? { label: "Next Event", className: DRAFT_BADGE }
            : e.enabled
              ? { label: "Enabled", className: ACTIVE_BADGE }
              : { label: "Disabled", className: INACTIVE_BADGE },
        })),
      });
    }

    return list;
  }, [pageMatches, results]);

  const flatItems = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  // Selection can go stale (e.g. shrinks past the new list length) whenever
  // the result set changes underneath it.
  useEffect(() => {
    setSelectedIndex((i) => Math.min(i, Math.max(0, flatItems.length - 1)));
  }, [flatItems.length]);

  useEffect(() => {
    itemRefs.current[selectedIndex]?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  function navigate(href: string) {
    router.push(href);
    close();
  }

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (flatItems.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedIndex((i) => (i + 1) % flatItems.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex((i) => (i - 1 + flatItems.length) % flatItems.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const item = flatItems[selectedIndex];
      if (item) navigate(item.href);
    }
  }

  let runningIndex = -1;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "relative flex items-center justify-center transition-all duration-200",
          // Mirrors NotificationBell.tsx's non-positional classes exactly
          // (positioning now lives on the shared wrapper in layout.tsx) so
          // the two sit side by side as a matched pair on both breakpoints.
          "w-9 h-9 text-ink dark:text-cream hover:text-sepia dark:hover:text-sepia",
          "md:w-10 md:h-10 md:rounded-full md:bg-white md:dark:bg-ink-900 md:border md:border-black/10 md:dark:border-white/10 md:text-ink-400 md:dark:text-ink-300 md:shadow-md md:hover:shadow-lg md:backdrop-blur-md"
        )}
        aria-label="Search (⌘K)"
        title="Search (⌘K)"
      >
        <Search size={17} />
      </button>

      {open &&
        mounted &&
        createPortal(
          <div
            className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-start sm:items-center justify-center p-0 sm:p-4"
            onClick={close}
            role="dialog"
            aria-modal="true"
            aria-label="Global search"
          >
            <div
              className="w-full h-full sm:h-auto sm:max-w-xl sm:max-h-[80vh] flex flex-col bg-white dark:bg-ink-900 sm:rounded-2xl border-0 sm:border border-black/10 dark:border-white/10 shadow-2xl overflow-hidden"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center gap-3 p-4 border-b border-black/10 dark:border-white/10 shrink-0">
                <Search size={18} className="text-ink-400 shrink-0" />
                <input
                  ref={inputRef}
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={onInputKeyDown}
                  placeholder="Search artworks, rooms, orders, pages…"
                  aria-label="Global search"
                  className="flex-1 min-w-0 bg-transparent text-sm text-ink dark:text-cream placeholder-ink-400 focus:outline-none"
                />
                {loading && (
                  <Loader2
                    size={15}
                    className="animate-spin text-ink-400 shrink-0"
                  />
                )}
                <button
                  onClick={close}
                  aria-label="Close search"
                  className="p-1.5 -m-1 text-ink-400 hover:text-ink dark:hover:text-cream transition-colors shrink-0"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto overscroll-contain">
                {groups.length === 0 ? (
                  <p className="px-4 py-10 text-center text-xs text-ink-400 dark:text-ink-300">
                    {query.trim().length >= 2
                      ? "No matches found."
                      : "Start typing to search, or pick a page below."}
                  </p>
                ) : (
                  groups.map((group) => (
                    <div key={group.key} className="py-2">
                      {/* Sticky within the scroll area — with 6 page groups
                          plus up to 7 content-result groups possible now,
                          knowing which cluster you're scrolled into matters
                          more than it used to. */}
                      <p className="sticky top-0 z-[1] bg-white dark:bg-ink-900 px-4 py-1 font-body text-[10px] font-semibold uppercase tracking-widest text-ink-400 dark:text-ink-300">
                        {group.label}
                      </p>
                      {group.items.map((item) => {
                        runningIndex += 1;
                        const index = runningIndex;
                        const Icon = item.icon ?? group.icon;
                        const active = index === selectedIndex;
                        return (
                          <a
                            key={item.key}
                            ref={(el) => {
                              itemRefs.current[index] = el;
                            }}
                            href={item.href}
                            onMouseEnter={() => setSelectedIndex(index)}
                            onClick={(event) => {
                              event.preventDefault();
                              navigate(item.href);
                            }}
                            className={cn(
                              "flex items-center gap-3 px-4 py-2.5 text-left transition-colors cursor-pointer",
                              active
                                ? "bg-sepia/10"
                                : "hover:bg-black/[0.03] dark:hover:bg-white/[0.03]"
                            )}
                          >
                            {item.image ? (
                              <SafeImg
                                src={item.image}
                                alt=""
                                className="w-8 h-8 rounded-md object-cover shrink-0 bg-black/5 dark:bg-white/5"
                              />
                            ) : (
                              <span className="flex items-center justify-center w-8 h-8 rounded-md bg-sepia/10 text-sepia shrink-0">
                                <Icon size={14} />
                              </span>
                            )}
                            <span className="min-w-0 flex-1">
                              <span className="block text-xs font-medium text-ink dark:text-cream truncate">
                                {item.title}
                              </span>
                              {item.subtitle && (
                                <span className="block text-[11px] text-ink-400 dark:text-ink-300 truncate mt-0.5">
                                  {item.subtitle}
                                </span>
                              )}
                            </span>
                            {item.badge && (
                              <span
                                className={cn(
                                  "shrink-0 font-body text-[9px] tracking-widest uppercase px-2 py-0.5 rounded-md",
                                  item.badge.className
                                )}
                              >
                                {item.badge.label}
                              </span>
                            )}
                          </a>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
