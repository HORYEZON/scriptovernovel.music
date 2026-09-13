"use client";

// components/admin/NotificationBell.tsx
//
// A bell button for admin-facing notifications (new orders, new minigame highscores —
// see prisma/schema.prisma's Notification model), rendered as a flex child
// inside the fixed top-right wrapper mounted once in app/(admin)/layout.tsx
// (alongside GlobalSearch's trigger), not per-page — so it floats over every
// admin screen consistently regardless of sidebar collapse state or which
// page is active. The button itself no longer positions itself (that's the
// wrapper's job); its ref-based getBoundingClientRect position math below is
// unaffected either way. Deliberately simple: fetch on mount + whenever the
// panel is opened, no websocket/polling. The admin already gets an email for
// both event types the instant they happen; this list is a secondary "what
// did I miss" view, not the primary alert.
//
// The panel is rendered through a portal into document.body rather than as
// a plain absolutely-positioned child, so it's never at the mercy of an
// ancestor's overflow/z-index (this previously lived inside AdminSidebar,
// whose wrapper's overflow-x-hidden silently clipped it — see git history).
// Colors are theme-aware (bg-white dark:bg-ink-900, matching the modal
// convention in IconPicker.tsx/ArtworkPicker.tsx) rather than hardcoded
// dark, since it now floats over whichever theme the page itself is in
// instead of always sitting on the sidebar's permanently-dark background.
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  Bell,
  Package,
  Trophy,
  Mail,
  Check,
  X,
  ExternalLink,
  Landmark,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import toast from "@/lib/toast";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";

interface ContactMetadata {
  name?: string;
  email?: string;
  subjectLabel?: string;
  message?: string;
}

interface NotificationRow {
  id: string;
  type: "ORDER" | "HIGHSCORE" | "CONTACT" | "MUSEUM";
  title: string;
  body: string;
  metadata: ContactMetadata | null;
  readAt: string | null;
  createdAt: string;
}

const TYPE_ICON: Record<NotificationRow["type"], typeof Package> = {
  ORDER: Package,
  HIGHSCORE: Trophy,
  CONTACT: Mail,
  MUSEUM: Landmark,
};

const VIEWPORT_MARGIN = 16; // keeps the panel off the very edge of the screen

/** Coarse "how long ago" — this list only ever shows the last 20 rows, so
 * precision beyond minutes/hours/days never matters. */
function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [panelPos, setPanelPos] = useState<{
    top: number;
    right: number;
  } | null>(null);
  const [viewingItem, setViewingItem] = useState<NotificationRow | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Portals can only render once the component has mounted in the browser
  // (document.body doesn't exist during server rendering).
  useEffect(() => setMounted(true), []);

  useLockBodyScroll(Boolean(viewingItem));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/notifications");
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setNotifications(data.notifications ?? []);
        setUnreadCount(data.unreadCount ?? 0);
      }
    } catch {
      // Silent — the bell degrades to "no new notifications shown" rather
      // than surfacing a toast for what's a secondary, non-blocking feature.
    } finally {
      setLoading(false);
    }
  }, []);

  // Unread count on every admin page load, so the badge is right even if
  // the admin never opens the panel.
  useEffect(() => {
    load();
  }, [load]);

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPanelPos({
      top: rect.bottom + 8,
      right: Math.max(VIEWPORT_MARGIN, window.innerWidth - rect.right),
    });
  }, []);

  // Keep the panel glued to the bell across resizes/scrolls while it's open.
  useEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  function toggleOpen() {
    setOpen((o) => {
      const next = !o;
      if (next) load();
      return next;
    });
  }

  async function markAllRead() {
    if (unreadCount === 0) return;
    setNotifications((rows) =>
      rows.map((r) => ({ ...r, readAt: r.readAt ?? new Date().toISOString() }))
    );
    setUnreadCount(0);
    try {
      await fetch("/api/admin/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
    } catch {
      toast.error("Could not mark notifications read.");
      load();
    }
  }

  async function markOneRead(id: string) {
    setNotifications((rows) =>
      rows.map((r) =>
        r.id === id ? { ...r, readAt: r.readAt ?? new Date().toISOString() } : r
      )
    );
    setUnreadCount((n) => Math.max(0, n - 1));
    try {
      await fetch("/api/admin/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    } catch {
      load();
    }
  }

  // A row click always opens the View modal (the panel itself only ever
  // shows a truncated preview) and, same as the full /admin/notifications
  // page, marks it read in passing rather than requiring a separate click.
  function openItem(n: NotificationRow) {
    setOpen(false);
    setViewingItem(n);
    if (!n.readAt) markOneRead(n.id);
  }

  return (
    <>
      <button
        ref={triggerRef}
        onClick={toggleOpen}
        className={cn(
          "relative flex items-center justify-center transition-all duration-200",
          // Mobile: a plain icon sitting inside AdminSidebar's own mobile top
          // bar (h-14) — matches its hamburger button (same size, same
          // text-ink/cream color, no background/border/shadow of its own) so
          // it reads as part of that bar instead of a separate floating chip
          // stuck on top of it.
          "w-9 h-9 text-ink dark:text-cream hover:text-sepia dark:hover:text-sepia",
          // Desktop: no shared top bar to sit inside of (the sidebar is a
          // side rail, not a header), so it floats as its own card instead.
          "md:w-10 md:h-10 md:rounded-full md:bg-white md:dark:bg-ink-900 md:border md:border-black/10 md:dark:border-white/10 md:text-ink-400 md:dark:text-ink-300 md:shadow-md md:hover:shadow-lg md:backdrop-blur-md"
        )}
        aria-label={
          unreadCount > 0
            ? `Notifications (${unreadCount} unread)`
            : "Notifications"
        }
      >
        <Bell size={17} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[16px] h-[16px] px-[3px] rounded-full bg-vermillion text-[9px] font-bold text-white leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open &&
        mounted &&
        panelPos &&
        createPortal(
          <>
            {/* Click-outside catcher */}
            <div
              className="fixed inset-0 z-[59]"
              onClick={() => setOpen(false)}
            />
            <div
              style={{ top: panelPos.top, right: panelPos.right }}
              className="fixed z-[60] w-80 max-w-[calc(100vw-2rem)] rounded-2xl bg-white dark:bg-ink-900 border border-black/10 dark:border-white/10 shadow-2xl backdrop-blur-md overflow-hidden"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-black/10 dark:border-white/10">
                <span className="font-jakarta text-xs font-semibold text-ink dark:text-cream uppercase tracking-wide">
                  Notifications
                </span>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="flex items-center gap-1 text-[11px] text-ink-400 dark:text-ink-300 hover:text-sepia transition-colors"
                  >
                    <Check size={12} /> Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto">
                {loading && notifications.length === 0 ? (
                  <p className="px-4 py-6 text-xs text-ink-400 dark:text-ink-300 text-center">
                    Loading…
                  </p>
                ) : notifications.length === 0 ? (
                  <p className="px-4 py-6 text-xs text-ink-400 dark:text-ink-300 text-center">
                    No notifications yet.
                  </p>
                ) : (
                  notifications.map((n) => {
                    const Icon = TYPE_ICON[n.type];
                    const unread = !n.readAt;
                    return (
                      <button
                        key={n.id}
                        onClick={() => openItem(n)}
                        className={cn(
                          "w-full flex items-start gap-3 px-4 py-3 text-left border-b border-black/5 dark:border-white/5 last:border-0 transition-colors",
                          unread
                            ? "bg-sepia/5 hover:bg-sepia/10"
                            : "hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                        )}
                      >
                        <Icon
                          size={14}
                          className="shrink-0 mt-0.5 text-sepia"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="text-xs font-medium text-ink dark:text-cream truncate">
                              {n.title}
                            </span>
                            {unread && (
                              <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-sepia" />
                            )}
                          </span>
                          <span className="block text-[11px] text-ink-400 dark:text-ink-300 mt-0.5 line-clamp-2">
                            {n.body}
                          </span>
                          <span className="block text-[10px] text-ink-400/70 dark:text-ink-300/70 mt-1">
                            {timeAgo(n.createdAt)}
                          </span>
                        </span>
                      </button>
                    );
                  })
                )}
              </div>

              <Link
                href="/admin/notifications"
                onClick={() => setOpen(false)}
                className="block px-4 py-2.5 text-center font-body text-xs text-ink-400 dark:text-ink-300 hover:text-sepia border-t border-black/10 dark:border-white/10 transition-colors"
              >
                See all notifications
              </Link>
            </div>
          </>,
          document.body
        )}

      {/* View modal — a condensed version of the one on the full
          /admin/notifications page (same CONTACT-metadata layout + Reply via
          Gmail action), reachable straight from the bell so opening a New
          Email notification doesn't require leaving whatever page the admin
          is on. Row-level actions (Archive/Spam/Block/Delete) stay on the
          full page rather than being duplicated here. */}
      {viewingItem &&
        mounted &&
        createPortal(
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setViewingItem(null)}
          >
            <div
              className="bg-white dark:bg-ink-900 border border-black/10 dark:border-white/15 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-5 border-b border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 shrink-0">
                <div className="min-w-0">
                  <h3 className="font-jakarta text-lg font-semibold text-ink dark:text-cream truncate">
                    {viewingItem.title}
                  </h3>
                  <p className="font-body text-xs text-ink-400 dark:text-ink-300 mt-0.5">
                    {formatDate(viewingItem.createdAt)}
                  </p>
                </div>
                <button
                  onClick={() => setViewingItem(null)}
                  className="shrink-0 p-1 rounded-lg text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/10 dark:hover:bg-white/10"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-5 overflow-y-auto space-y-4">
                {viewingItem.type === "CONTACT" ? (
                  <div className="space-y-3 font-body text-sm">
                    {viewingItem.metadata?.name && (
                      <div className="flex justify-between gap-3">
                        <span className="text-ink-400 dark:text-ink-300 shrink-0">
                          From:
                        </span>
                        <span className="text-right font-medium text-ink dark:text-cream">
                          {viewingItem.metadata.name}
                        </span>
                      </div>
                    )}
                    {viewingItem.metadata?.email && (
                      <div className="flex justify-between gap-3">
                        <span className="text-ink-400 dark:text-ink-300 shrink-0">
                          Email:
                        </span>
                        <a
                          href={`mailto:${viewingItem.metadata.email}`}
                          className="text-right font-medium text-sepia hover:underline break-all"
                        >
                          {viewingItem.metadata.email}
                        </a>
                      </div>
                    )}
                    {viewingItem.metadata?.subjectLabel && (
                      <div className="flex justify-between gap-3">
                        <span className="text-ink-400 dark:text-ink-300 shrink-0">
                          Subject:
                        </span>
                        <span className="text-right font-medium text-ink dark:text-cream">
                          {viewingItem.metadata.subjectLabel}
                        </span>
                      </div>
                    )}
                    <div className="pt-2 border-t border-black/10 dark:border-white/10">
                      <p className="text-ink-400 dark:text-ink-300 text-xs uppercase tracking-wide mb-1.5">
                        Message
                      </p>
                      <p className="text-ink dark:text-cream whitespace-pre-line">
                        {viewingItem.metadata?.message ?? viewingItem.body}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="font-body text-sm text-ink dark:text-cream whitespace-pre-line">
                    {viewingItem.body}
                  </p>
                )}
              </div>

              <div className="p-5 pt-0 space-y-2 shrink-0">
                {viewingItem.type === "CONTACT" &&
                  viewingItem.metadata?.email && (
                    <a
                      href={`mailto:${viewingItem.metadata.email}?subject=${encodeURIComponent(
                        `Re: ${viewingItem.metadata.subjectLabel ?? "Your message"}`
                      )}`}
                      className="w-full flex items-center justify-center gap-1.5 py-2 px-4 rounded-xl bg-sepia text-white text-xs font-medium hover:bg-sepia-dark transition-colors"
                    >
                      <ExternalLink size={14} /> Reply via Gmail
                    </a>
                  )}
                <Link
                  href="/admin/notifications"
                  onClick={() => setViewingItem(null)}
                  className="w-full flex items-center justify-center py-2 px-4 rounded-xl bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/15 text-ink dark:text-cream hover:bg-black/10 dark:hover:bg-white/20 text-xs font-medium transition-colors"
                >
                  See all notifications
                </Link>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
