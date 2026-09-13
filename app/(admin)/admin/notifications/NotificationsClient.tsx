"use client";

// app/(admin)/admin/notifications/NotificationsClient.tsx
//
// The full history behind the sidebar bell (components/admin/
// NotificationBell.tsx), which only ever shows the most recent 20. Same
// data, same API (app/api/admin/notifications/route.ts), just with tabs to
// split Orders/Minigame (Highscores)/contact-form messages, a Gmail-tab subject +
// spam sub-filter, an Archive toggle available on every tab (unlike Spam/
// Block, which are Gmail-only), page-by-page browsing, and a View modal
// per row with Delete/Archive/Spam/Block actions.
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Package,
  Trophy,
  Mail,
  Check,
  Bell,
  X,
  Trash2,
  ShieldAlert,
  ShieldOff,
  Ban,
  ExternalLink,
  Archive,
  ArchiveRestore,
  Landmark,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import toast from "@/lib/toast";
import { CONTACT_SUBJECTS } from "@/lib/contact";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";
import { AdminConfirmModal } from "@/components/admin/AdminConfirmModal";

type NotificationType = "ORDER" | "HIGHSCORE" | "CONTACT" | "MUSEUM";

// Loosely named after its original CONTACT-only use, but generic enough
// to double as the shape read from the detail view for any notification
// type that carries a name/email — MUSEUM rows (Digital Museum
// Achievement claims, see lib/notifications/museum-achievement.ts) key
// their metadata the same way deliberately, so no separate rendering
// path is needed for them.
interface ContactMetadata {
  name?: string;
  email?: string;
  subject?: string;
  subjectLabel?: string;
  message?: string;
}

interface NotificationRow {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  metadata: ContactMetadata | null;
  isSpam: boolean;
  isArchived: boolean;
  readAt: string | Date | null;
  createdAt: string | Date;
}

// "Gmail" rather than "Contact" — CONTACT rows come from the public contact
// form (app/api/contact/route.ts), but what the admin actually associates
// this with is where they read it: their Gmail inbox.
const TABS: {
  id: NotificationType | "ALL";
  label: string;
  icon: typeof Bell;
}[] = [
  { id: "ALL", label: "All", icon: Bell },
  { id: "CONTACT", label: "Gmail", icon: Mail },
  { id: "ORDER", label: "Orders", icon: Package },
  { id: "HIGHSCORE", label: "Minigame (Highscores)", icon: Trophy },
  { id: "MUSEUM", label: "Museum", icon: Landmark },
];

const TYPE_ICON: Record<NotificationType, typeof Package> = {
  ORDER: Package,
  HIGHSCORE: Trophy,
  CONTACT: Mail,
  MUSEUM: Landmark,
};

export function NotificationsClient({
  initialNotifications,
  initialTotal,
  pageSize,
}: {
  initialNotifications: NotificationRow[];
  initialTotal: number;
  pageSize: number;
}) {
  const [tab, setTab] = useState<NotificationType | "ALL">("ALL");
  // Only meaningful while tab === "CONTACT" — sub-filters on top of the
  // Gmail tab: by subject (lib/contact.ts's list) or, mutually exclusively,
  // "show only what's flagged spam". Both clear whenever a different tab is
  // picked, so switching away and back always starts from "All subjects".
  const [subject, setSubject] = useState<string | null>(null);
  const [spamOnly, setSpamOnly] = useState(false);
  // Unlike subject/spam (Gmail-tab only), Archived is available regardless
  // of which tab is open — an archived Order or Highscore is just as valid
  // as an archived Gmail message. Mutually exclusive with spamOnly.
  const [archivedOnly, setArchivedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [total, setTotal] = useState(initialTotal);
  const [unreadCount, setUnreadCount] = useState(
    initialNotifications.filter((n) => !n.readAt).length
  );
  const [loading, setLoading] = useState(false);
  const [viewingItem, setViewingItem] = useState<NotificationRow | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  // What's awaiting confirmation — one notification to trash, or one sender
  // to block. The in-app dialog every other admin module uses, in place of
  // the browser's confirm() these two had. Stacks above the detail modal
  // (the dialog is z-[60] for exactly this) since both actions are also
  // offered from inside it.
  const [pendingDelete, setPendingDelete] = useState<NotificationRow | null>(null);
  const [pendingBlock, setPendingBlock] = useState<NotificationRow | null>(null);

  useLockBodyScroll(Boolean(viewingItem));

  const load = useCallback(
    async (
      targetTab: NotificationType | "ALL",
      targetSubject: string | null,
      targetSpamOnly: boolean,
      targetArchivedOnly: boolean,
      targetPage: number
    ) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(targetPage),
          pageSize: String(pageSize),
        });
        if (targetTab !== "ALL") params.set("type", targetTab);
        if (targetArchivedOnly) params.set("archived", "1");
        else if (targetTab === "CONTACT") {
          if (targetSpamOnly) params.set("spam", "1");
          else if (targetSubject) params.set("subject", targetSubject);
        }

        const res = await fetch(
          `/api/admin/notifications?${params.toString()}`
        );
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setNotifications(data.notifications ?? []);
          setTotal(data.total ?? 0);
          setUnreadCount(data.unreadCount ?? 0);
        } else {
          toast.error("Could not load notifications.");
        }
      } catch {
        toast.error("Could not reach the server.");
      } finally {
        setLoading(false);
      }
    },
    [pageSize]
  );

  // Re-fetch whenever a filter or the page changes — skips the very first
  // render, which already has the server-fetched "All, page 1" data.
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    load(tab, subject, spamOnly, archivedOnly, page);
  }, [tab, subject, spamOnly, archivedOnly, page, load]);

  function changeTab(next: NotificationType | "ALL") {
    setTab(next);
    setSubject(null);
    setSpamOnly(false);
    setPage(1);
    // Archived stays on across a tab switch — "show me archived Orders"
    // then "show me archived Gmail" is a reasonable flow to support,
    // unlike Spam/subject which only ever make sense inside Gmail.
  }

  function changeSubject(next: string | null) {
    setSubject(next);
    setSpamOnly(false);
    setPage(1);
  }

  function toggleSpamOnly() {
    setSpamOnly((v) => !v);
    setSubject(null);
    setArchivedOnly(false);
    setPage(1);
  }

  function toggleArchivedOnly() {
    setArchivedOnly((v) => !v);
    setSpamOnly(false);
    setPage(1);
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
      load(tab, subject, spamOnly, archivedOnly, page);
    }
  }

  async function markOneRead(id: string) {
    const row = notifications.find((n) => n.id === id);
    if (!row || row.readAt) return;
    setNotifications((rows) =>
      rows.map((r) =>
        r.id === id ? { ...r, readAt: new Date().toISOString() } : r
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
      load(tab, subject, spamOnly, archivedOnly, page);
    }
  }

  function openItem(n: NotificationRow) {
    setViewingItem(n);
    if (!n.readAt) markOneRead(n.id);
  }

  function removeFromList(id: string) {
    setNotifications((rows) => rows.filter((r) => r.id !== id));
    setTotal((t) => Math.max(0, t - 1));
  }

  async function handleDelete(item: NotificationRow) {
    setPendingDelete(null);
    setActionLoading(`delete-${item.id}`);
    try {
      const res = await fetch(`/api/admin/notifications/${item.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      removeFromList(item.id);
      setViewingItem(null);
      toast.success("Moved to Trash");
    } catch {
      toast.error("Could not delete that notification.");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleToggleSpam(item: NotificationRow) {
    const nextSpam = !item.isSpam;
    setActionLoading(`spam-${item.id}`);
    try {
      const res = await fetch(`/api/admin/notifications/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isSpam: nextSpam }),
      });
      if (!res.ok) throw new Error();
      // Marking spam drops it out of the current (non-spam) view; unmarking
      // while inside the spam-only view does the same in reverse — either
      // way it no longer belongs in whatever list is currently showing.
      removeFromList(item.id);
      setViewingItem(null);
      toast.success(nextSpam ? "Marked as spam" : "Unmarked as spam");
    } catch {
      toast.error("Could not update that notification.");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleToggleArchive(item: NotificationRow) {
    const nextArchived = !item.isArchived;
    setActionLoading(`archive-${item.id}`);
    try {
      const res = await fetch(`/api/admin/notifications/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived: nextArchived }),
      });
      if (!res.ok) throw new Error();
      // Same reasoning as handleToggleSpam — archiving/unarchiving always
      // moves the row out of whatever view is currently showing.
      removeFromList(item.id);
      setViewingItem(null);
      toast.success(nextArchived ? "Archived" : "Unarchived");
    } catch {
      toast.error("Could not update that notification.");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleBlock(item: NotificationRow) {
    const email = item.metadata?.email;
    if (!email) return;
    setPendingBlock(null);
    setActionLoading(`block-${item.id}`);
    try {
      const res = await fetch(`/api/admin/notifications/${item.id}/block`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error);
      removeFromList(item.id);
      setViewingItem(null);
      toast.success(`${email} blocked`);
    } catch {
      toast.error("Could not block this sender.");
    } finally {
      setActionLoading(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Tabs — horizontally scrollable on mobile so long labels like
            "Minigame (Highscores)" never wrap or overflow the viewport. */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar border-b border-black/10 dark:border-white/10 sm:border-0 -mx-1 px-1 sm:mx-0 sm:px-0 sm:flex-wrap">
          {TABS.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => changeTab(item.id)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "shrink-0 whitespace-nowrap inline-flex items-center gap-2 px-4 py-2.5 font-jakarta text-sm font-medium transition-colors border-b-2 -mb-px sm:mb-0 sm:rounded-xl sm:border-b-0",
                  active
                    ? "border-sepia text-ink dark:text-cream sm:bg-sepia sm:text-white"
                    : "border-transparent text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream"
                )}
              >
                <Icon size={15} />
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Available on every tab, unlike the Gmail-only subject/spam
              chips below — an archived Order is as valid as an archived
              Gmail message. */}
          <button
            type="button"
            onClick={toggleArchivedOnly}
            aria-pressed={archivedOnly}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-body text-xs transition-colors",
              archivedOnly
                ? "bg-sepia/10 border-sepia text-sepia font-medium"
                : "border-black/10 dark:border-white/10 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/5 dark:hover:bg-white/5"
            )}
          >
            <Archive size={13} />{" "}
            {archivedOnly ? "Viewing Archived" : "Archived"}
          </button>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-black/10 dark:border-white/10 font-body text-xs text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              <Check size={13} /> Mark all read ({unreadCount})
            </button>
          )}
        </div>
      </div>

      {/* Gmail tab's sub-filters — subject chips, plus a Spam toggle at the
          end. Only relevant (and only shown) within Gmail. */}
      {tab === "CONTACT" && (
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => changeSubject(null)}
            aria-pressed={subject === null && !spamOnly}
            className={cn(
              "px-3 py-1.5 rounded-lg font-body text-xs tracking-wide border transition-colors",
              subject === null && !spamOnly
                ? "bg-sepia/10 border-sepia text-sepia font-medium"
                : "border-black/10 dark:border-white/10 text-ink-400 dark:text-ink-300 hover:border-black/30 dark:hover:border-white/30"
            )}
          >
            All subjects
          </button>
          {CONTACT_SUBJECTS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => changeSubject(s.key)}
              aria-pressed={subject === s.key}
              className={cn(
                "px-3 py-1.5 rounded-lg font-body text-xs tracking-wide border transition-colors",
                subject === s.key
                  ? "bg-sepia/10 border-sepia text-sepia font-medium"
                  : "border-black/10 dark:border-white/10 text-ink-400 dark:text-ink-300 hover:border-black/30 dark:hover:border-white/30"
              )}
            >
              {s.label}
            </button>
          ))}
          <span className="w-px h-5 bg-black/10 dark:bg-white/10 mx-1" />
          <button
            type="button"
            onClick={toggleSpamOnly}
            aria-pressed={spamOnly}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-body text-xs tracking-wide border transition-colors",
              spamOnly
                ? "bg-vermillion/10 border-vermillion text-vermillion font-medium"
                : "border-black/10 dark:border-white/10 text-ink-400 dark:text-ink-300 hover:border-black/30 dark:hover:border-white/30"
            )}
          >
            <ShieldAlert size={12} /> Spam
          </button>
          <Link
            href="/admin/settings/blocked-emails"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-body text-xs tracking-wide text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream transition-colors ml-auto"
          >
            <Ban size={12} /> Manage blocked emails
          </Link>
        </div>
      )}

      {/* List */}
      <div className="admin-card border rounded-2xl backdrop-blur-md shadow-sm overflow-hidden">
        {loading ? (
          <p className="px-4 py-10 text-center font-body text-sm text-ink-400 dark:text-ink-300">
            Loading…
          </p>
        ) : notifications.length === 0 ? (
          <p className="px-4 py-10 text-center font-body text-sm text-ink-400 dark:text-ink-300">
            {archivedOnly
              ? "Nothing archived."
              : spamOnly
                ? "No spam-flagged messages."
                : `No notifications ${tab !== "ALL" ? "in this category " : ""}yet.`}
          </p>
        ) : (
          <ul className="divide-y divide-black/5 dark:divide-white/5">
            {notifications.map((n) => {
              const Icon = TYPE_ICON[n.type];
              const unread = !n.readAt;
              return (
                <li key={n.id}>
                  <div
                    className={cn(
                      "w-full flex items-start gap-3 px-4 sm:px-5 py-4 transition-colors",
                      unread
                        ? "bg-sepia/5 hover:bg-sepia/10"
                        : "hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => openItem(n)}
                      className="flex items-start gap-3 flex-1 min-w-0 text-left"
                    >
                      <span className="shrink-0 w-9 h-9 rounded-lg bg-sepia/10 text-sepia flex items-center justify-center mt-0.5">
                        <Icon size={16} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 flex-wrap">
                          <span className="font-jakarta text-sm font-medium text-ink dark:text-cream">
                            {n.title}
                          </span>
                          {unread && (
                            <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-sepia" />
                          )}
                        </span>
                        <span className="block font-body text-xs text-ink-400 dark:text-ink-300 mt-1">
                          {n.body}
                        </span>
                        <span className="block font-body text-[11px] text-ink-400/70 dark:text-ink-300/70 mt-1.5">
                          {formatDate(n.createdAt)}
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleArchive(n)}
                      disabled={actionLoading === `archive-${n.id}`}
                      title={n.isArchived ? "Unarchive" : "Archive"}
                      className="shrink-0 p-2 rounded-lg text-ink-400 dark:text-ink-300 hover:text-sepia hover:bg-sepia/10 transition-colors disabled:opacity-50"
                    >
                      {n.isArchived ? (
                        <ArchiveRestore size={15} />
                      ) : (
                        <Archive size={15} />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDelete(n)}
                      disabled={actionLoading === `delete-${n.id}`}
                      title="Delete"
                      className="shrink-0 p-2 rounded-lg text-ink-400 dark:text-ink-300 hover:text-vermillion hover:bg-vermillion/10 transition-colors disabled:opacity-50"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
            className="px-3.5 py-1.5 rounded-xl bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-xs font-medium disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ← Prev
          </button>
          <span className="font-body text-xs text-ink-400 dark:text-ink-300 px-2">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages || loading}
            className="px-3.5 py-1.5 rounded-xl bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-xs font-medium disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        </div>
      )}

      {/* View Modal */}
      {viewingItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
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
                  {/* The actual, untruncated email — the list/bell only ever
                      show a 200-char preview (lib/notifications/contact.ts);
                      this is the full message. */}
                  <div className="pt-2 border-t border-black/10 dark:border-white/10">
                    <p className="text-ink-400 dark:text-ink-300 text-xs uppercase tracking-wide mb-1.5">
                      Message
                    </p>
                    <p className="text-ink dark:text-cream whitespace-pre-line">
                      {viewingItem.metadata?.message ?? viewingItem.body}
                    </p>
                  </div>
                  {viewingItem.isSpam && (
                    <p className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-vermillion/10 text-vermillion text-xs font-medium">
                      <ShieldAlert size={12} /> Flagged as spam
                    </p>
                  )}
                </div>
              ) : (
                <p className="font-body text-sm text-ink dark:text-cream whitespace-pre-line">
                  {viewingItem.body}
                </p>
              )}
              {viewingItem.isArchived && (
                <p className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sepia/10 text-sepia text-xs font-medium">
                  <Archive size={12} /> Archived
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="p-5 pt-0 space-y-2 shrink-0">
              <button
                type="button"
                onClick={() => handleToggleArchive(viewingItem)}
                disabled={!!actionLoading}
                className="w-full py-2 px-3 rounded-xl bg-sepia/10 border border-sepia/30 text-sepia hover:bg-sepia/20 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {viewingItem.isArchived ? (
                  <ArchiveRestore size={14} />
                ) : (
                  <Archive size={14} />
                )}
                {viewingItem.isArchived ? "Unarchive" : "Archive"}
              </button>
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

              {viewingItem.type === "CONTACT" && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleSpam(viewingItem)}
                    disabled={!!actionLoading}
                    className="flex-1 py-2 px-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    {viewingItem.isSpam ? (
                      <ShieldOff size={14} />
                    ) : (
                      <ShieldAlert size={14} />
                    )}
                    {viewingItem.isSpam ? "Unmark Spam" : "Set as Spam"}
                  </button>
                  {viewingItem.metadata?.email && (
                    <button
                      type="button"
                      onClick={() => setPendingBlock(viewingItem)}
                      disabled={!!actionLoading}
                      className="flex-1 py-2 px-3 rounded-xl bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/15 text-ink dark:text-cream hover:bg-black/10 dark:hover:bg-white/20 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                    >
                      <Ban size={14} /> Block Sender
                    </button>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={() => setPendingDelete(viewingItem)}
                disabled={!!actionLoading}
                className="w-full py-2 px-4 rounded-xl bg-vermillion/10 border border-vermillion/30 text-vermillion hover:bg-vermillion/20 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <AdminConfirmModal
        open={pendingDelete !== null}
        title={pendingDelete ? `Move "${pendingDelete.title}" to Trash?` : ""}
        description="You can restore it from the Trash module at any time."
        confirmLabel="Move to Trash"
        loading={pendingDelete !== null && actionLoading === `delete-${pendingDelete.id}`}
        onConfirm={() => pendingDelete && handleDelete(pendingDelete)}
        onCancel={() => setPendingDelete(null)}
      />

      <AdminConfirmModal
        open={pendingBlock !== null}
        title={pendingBlock ? `Block ${pendingBlock.metadata?.email}?` : ""}
        description="Future contact-form messages from this address will be silently rejected. You can unblock it later under Settings → Blocked Emails."
        confirmLabel="Block sender"
        loading={pendingBlock !== null && actionLoading === `block-${pendingBlock.id}`}
        onConfirm={() => pendingBlock && handleBlock(pendingBlock)}
        onCancel={() => setPendingBlock(null)}
      />
    </div>
  );
}
