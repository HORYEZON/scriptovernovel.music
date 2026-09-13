// components/admin/ActivityLogPanel.tsx
"use client";

// Dashboard ▸ Activity Log — the reading end of the audit trail written by
// lib/activity-log-server.ts.
//
// Entirely client-fetched (unlike Website Analytics, which is handed a
// server-rendered first snapshot), because every useful thing here is a
// filter: category, action, actor type, free-text search. Server-rendering a
// first page would save one request and then be thrown away the moment the
// admin touched a pill, so the panel just owns its own loading state from the
// start.
//
// The toolbar and pager are the shared admin ones (components/admin/
// Pagination.tsx, RowsPerPageSelect.tsx) so this reads and behaves exactly
// like the Orders/Artworks/Products lists: search box, Sort ▾ with an
// asc/desc toggle, Rows-per-page, and a numbered ← Prev / 1 2 3 / Next →
// pager underneath.
//
// The one thing that differs is where the paging happens. Those modules load
// their whole table and slice it in the browser; this one pages on the
// server, because the trail is unbounded by design (it records visitor
// events) and fetching all of it to show twenty rows is not an option. The
// controls are the same components either way — only `load()` knows.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  ChevronDown,
  Loader2,
  RefreshCw,
  Search,
  Trash2,
  User,
  Globe,
  Server,
  X,
} from "lucide-react";
import toast from "@/lib/toast";
import { Pagination, SortControl, RowsPerPageSelect } from "./Pagination";
import { AdminConfirmModal } from "./AdminConfirmModal";
import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_CATEGORY_META,
  ACTIVITY_ACTIONS,
  ALL_ACTIVITY_ACTIONS,
  ACTIVITY_RETENTION_DAYS,
  ACTIVITY_PAGE_SIZE,
  ACTIVITY_SORT_FIELDS,
  ACTIVITY_SORT_LABELS,
  formatActivityAction,
  type ActivityCategory,
  type ActivityLogRow,
  type ActivitySortField,
} from "@/lib/activity-log";

const SORT_OPTIONS = ACTIVITY_SORT_FIELDS.map((value) => ({
  value,
  label: ACTIVITY_SORT_LABELS[value],
}));

const ACTOR_ICONS = { admin: User, visitor: Globe, system: Server } as const;

/** "3m ago" / "4h ago" / "12 Mar". Relative while it's still recent enough
 *  for "when" to mean something to a person reading down the list, absolute
 *  once it isn't. The full timestamp is always on the row's `title`. */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(iso).toLocaleDateString("en-PH", { day: "numeric", month: "short" });
}

function CategoryChip({ category }: { category: ActivityCategory }) {
  const meta = ACTIVITY_CATEGORY_META[category];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-jakarta font-semibold tracking-wide uppercase ${meta.chipClass}`}
    >
      {meta.label}
    </span>
  );
}

/** One trail entry. Collapsed to a single line; clicking expands the detail
 *  drawer (metadata, IP, user agent, entity id) — which is where the
 *  forensically useful but visually noisy fields live, so the list stays
 *  scannable at a glance and complete on demand. */
function LogRow({ row }: { row: ActivityLogRow }) {
  const [open, setOpen] = useState(false);
  const ActorIcon = ACTOR_ICONS[row.actorType] ?? Server;
  const hasDetail = Boolean(
    row.metadata || row.ipAddress || row.userAgent || row.entityId
  );

  return (
    <li className="border-b border-black/5 dark:border-white/5 last:border-0">
      <div
        className={`flex items-start gap-3 px-4 sm:px-5 py-3 ${
          hasDetail ? "cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.02]" : ""
        } transition-colors`}
        onClick={hasDetail ? () => setOpen((prev) => !prev) : undefined}
        role={hasDetail ? "button" : undefined}
        tabIndex={hasDetail ? 0 : undefined}
        onKeyDown={
          hasDetail
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setOpen((prev) => !prev);
                }
              }
            : undefined
        }
      >
        <ActorIcon
          size={15}
          strokeWidth={1.5}
          className="mt-0.5 shrink-0 text-ink-400 dark:text-ink-300"
        />

        <div className="min-w-0 flex-1">
          <p className="font-body text-sm text-ink dark:text-cream break-words">{row.summary}</p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
            <CategoryChip category={row.category} />
            <span className="font-mono text-[10px] text-ink-400 dark:text-ink-300">
              {row.action}
            </span>
            {row.actorLabel && (
              <span className="font-body text-[11px] text-ink-400 dark:text-ink-300">
                · {row.actorLabel}
              </span>
            )}
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-1.5">
          <time
            dateTime={row.createdAt}
            title={new Date(row.createdAt).toLocaleString("en-PH")}
            className="font-jakarta text-[11px] tabular-nums text-ink-400 dark:text-ink-300 whitespace-nowrap"
          >
            {relativeTime(row.createdAt)}
          </time>
          {hasDetail && (
            <ChevronDown
              size={13}
              strokeWidth={1.5}
              className={`text-ink-400 dark:text-ink-300 transition-transform ${open ? "rotate-180" : ""}`}
            />
          )}
        </div>
      </div>

      {open && hasDetail && (
        <dl className="px-4 sm:px-5 pb-3 pl-12 grid grid-cols-1 sm:grid-cols-[7rem_1fr] gap-x-4 gap-y-1.5 font-body text-[11px]">
          {row.entityId && (
            <>
              <dt className="text-ink-400 dark:text-ink-300">
                {row.entityType ?? "Entity"}
              </dt>
              <dd className="font-mono text-ink dark:text-cream break-all">{row.entityId}</dd>
            </>
          )}
          {row.actorEmail && (
            <>
              <dt className="text-ink-400 dark:text-ink-300">Email</dt>
              <dd className="text-ink dark:text-cream break-all">{row.actorEmail}</dd>
            </>
          )}
          {row.ipAddress && (
            <>
              <dt className="text-ink-400 dark:text-ink-300">IP</dt>
              <dd className="font-mono text-ink dark:text-cream">{row.ipAddress}</dd>
            </>
          )}
          {row.userAgent && (
            <>
              <dt className="text-ink-400 dark:text-ink-300">User agent</dt>
              <dd className="text-ink dark:text-cream break-all">{row.userAgent}</dd>
            </>
          )}
          {row.metadata && (
            <>
              <dt className="text-ink-400 dark:text-ink-300">Details</dt>
              <dd>
                <pre className="font-mono text-[10px] text-ink dark:text-cream whitespace-pre-wrap break-all admin-input border rounded-lg p-2 overflow-x-auto">
                  {JSON.stringify(row.metadata, null, 2)}
                </pre>
              </dd>
            </>
          )}
        </dl>
      )}
    </li>
  );
}

export function ActivityLogPanel() {
  const [rows, setRows] = useState<ActivityLogRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [category, setCategory] = useState<ActivityCategory | null>(null);
  const [action, setAction] = useState<string>("");
  const [search, setSearch] = useState("");
  // The value actually sent to the API — `search` updates on every keystroke,
  // this trails it by DEBOUNCE_MS so typing doesn't fire a query per letter.
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [purging, setPurging] = useState(false);
  // The prune is an irreversible delete behind a one-icon button, and the
  // only admin destructive action with no "are you sure?" — this gates it
  // with the same dialog every other module uses.
  const [confirmPrune, setConfirmPrune] = useState(false);

  // Sort + paging, matching the other admin list views' controls exactly.
  const [sortBy, setSortBy] = useState<ActivitySortField>("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(ACTIVITY_PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Guards against an out-of-order response overwriting a newer one: only the
  // most recently issued request is allowed to commit its result. Without it,
  // clicking two category pills quickly can leave the slower (older) response
  // on screen under the newer pill.
  const requestSeq = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    setLoading(true);

    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      sort: sortBy,
      order: sortOrder,
    });
    if (category) params.set("category", category);
    if (action) params.set("action", action);
    if (debouncedSearch) params.set("q", debouncedSearch);

    try {
      const res = await fetch(`/api/admin/activity-log?${params}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Request failed");
      const data = await res.json();
      if (seq !== requestSeq.current) return;
      setRows(data.rows ?? []);
      setCounts(data.counts ?? {});
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
    } catch {
      if (seq === requestSeq.current) toast.error("Couldn't load the activity log.");
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [category, action, debouncedSearch, page, pageSize, sortBy, sortOrder]);

  useEffect(() => {
    void load();
  }, [load]);

  // Any change to *what* is listed sends the reader back to page 1. Without
  // this, narrowing a 30-page list to 2 pages while sitting on page 9 asks
  // the server for an offset past the end and renders an empty table that
  // looks like "no results".
  useEffect(() => {
    setPage(1);
  }, [category, action, debouncedSearch, pageSize, sortBy, sortOrder]);

  // Switching category narrows the action dropdown to that category's verbs,
  // which can leave a now-impossible action selected (e.g. "auth.login.failed"
  // while filtering to CONTENT) — a filter pair that matches nothing forever.
  useEffect(() => {
    if (action && category && !ACTIVITY_ACTIONS[category].includes(action)) setAction("");
  }, [category, action]);

  async function runPrune() {
    if (purging) return;
    setConfirmPrune(false);
    setPurging(true);
    try {
      const res = await fetch("/api/admin/activity-log", { method: "DELETE" });
      if (!res.ok) throw new Error("Request failed");
      const data = await res.json();
      toast.success(
        data.removed > 0
          ? `Removed ${data.removed} expired entr${data.removed === 1 ? "y" : "ies"}.`
          : "Nothing past its retention window."
      );
      void load();
    } catch {
      toast.error("Couldn't prune the activity log.");
    } finally {
      setPurging(false);
    }
  }

  const actionOptions = category ? ACTIVITY_ACTIONS[category] : ALL_ACTIVITY_ACTIONS;

  return (
    <div className="admin-card border rounded-2xl overflow-hidden backdrop-blur-md shadow-xl">
      <div className="p-4 sm:p-5 border-b border-black/5 dark:border-white/5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-jakarta text-sm font-semibold text-ink dark:text-cream flex items-center gap-2">
              <Activity size={15} strokeWidth={1.5} className="text-sepia" />
              Activity Log
            </h2>
            <p className="font-body text-xs text-ink-400 dark:text-ink-300 mt-1">
              Every change, sign-in and visitor event, newest first.
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              title="Refresh"
              className="p-2 rounded-xl admin-input border text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream transition-colors disabled:opacity-50"
            >
              <RefreshCw size={14} strokeWidth={1.5} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              type="button"
              onClick={() => setConfirmPrune(true)}
              disabled={purging}
              title="Remove entries past their retention window"
              className="p-2 rounded-xl admin-input border text-ink-400 dark:text-ink-300 hover:text-rose-500 transition-colors disabled:opacity-50"
            >
              {purging ? (
                <Loader2 size={14} strokeWidth={1.5} className="animate-spin" />
              ) : (
                <Trash2 size={14} strokeWidth={1.5} />
              )}
            </button>
          </div>
        </div>

        {/* Category pills — each carries its own count under the current
            search/action filters, so they double as a breakdown of what the
            filtered set contains rather than just being buttons. */}
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setCategory(null)}
            className={`px-3 py-1.5 rounded-xl font-jakarta text-xs font-medium transition-colors ${
              category === null
                ? "bg-sepia/15 text-sepia"
                : "admin-input border text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream"
            }`}
          >
            All
          </button>
          {ACTIVITY_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(category === c ? null : c)}
              title={`${ACTIVITY_CATEGORY_META[c].description} Kept for ${ACTIVITY_RETENTION_DAYS[c]} days.`}
              className={`px-3 py-1.5 rounded-xl font-jakarta text-xs font-medium transition-colors inline-flex items-center gap-1.5 ${
                category === c
                  ? "bg-sepia/15 text-sepia"
                  : "admin-input border text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream"
              }`}
            >
              {ACTIVITY_CATEGORY_META[c].label}
              <span className="tabular-nums opacity-60">{counts[c] ?? 0}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search
              size={14}
              strokeWidth={1.5}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400 dark:text-ink-300 pointer-events-none"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search summary, person, IP or record id…"
              className="w-full admin-input border rounded-xl pl-9 pr-8 py-2 font-body text-xs text-ink dark:text-cream placeholder:text-ink-400 dark:placeholder:text-ink-300"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink dark:hover:text-cream"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Secondary controls — the same 2-up-on-mobile grid the Orders and
            Artworks toolbars use, with the same Sort/Rows components. */}
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <SortControl
            value={sortBy}
            options={SORT_OPTIONS}
            order={sortOrder}
            onChange={setSortBy}
            onOrderChange={setSortOrder}
          />

          <div className="relative flex items-center gap-1 rounded-xl admin-input border pl-2 pr-7 py-1.5 w-full sm:w-auto sm:shrink-0">
            <select
              value={action}
              onChange={(e) => setAction(e.target.value)}
              title="Filter by action"
              className="flex-1 sm:flex-none appearance-none bg-transparent font-body text-xs text-ink dark:text-cream outline-none cursor-pointer max-w-[10rem] sm:max-w-none"
            >
              <option value="" className="bg-white dark:bg-ink-900">
                All actions
              </option>
              {actionOptions.map((a) => (
                <option key={a} value={a} className="bg-white dark:bg-ink-900">
                  {formatActivityAction(a)}
                </option>
              ))}
            </select>
            <ChevronDown
              size={12}
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400"
            />
          </div>

          <RowsPerPageSelect value={pageSize} onChange={setPageSize} />
        </div>
      </div>

      {loading ? (
        <div className="p-10 flex justify-center">
          <Loader2 size={20} strokeWidth={1.5} className="animate-spin text-ink-400 dark:text-ink-300" />
        </div>
      ) : rows.length === 0 ? (
        <div className="p-10 text-center">
          <Activity
            size={28}
            strokeWidth={1.5}
            className="mx-auto mb-3 text-ink-400 dark:text-ink-300 opacity-40"
          />
          <p className="font-body text-sm text-ink-400 dark:text-ink-300">
            {search || category || action
              ? "Nothing matches those filters."
              : "No activity recorded yet."}
          </p>
        </div>
      ) : (
        <>
          <ul>
            {rows.map((row) => (
              <LogRow key={row.id} row={row} />
            ))}
          </ul>
          <div className="px-4 sm:px-5 pb-5 border-t border-black/5 dark:border-white/5">
            <Pagination
              page={page}
              totalPages={totalPages}
              onChange={setPage}
              summary={
                <>
                  {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of{" "}
                  {total.toLocaleString()}
                </>
              }
            />
          </div>
        </>
      )}

      <AdminConfirmModal
        open={confirmPrune}
        title="Prune the activity log?"
        description="Removes every entry that is past its retention window. Entries still inside the window are kept. This cannot be undone."
        confirmLabel="Prune"
        onConfirm={() => void runPrune()}
        onCancel={() => setConfirmPrune(false)}
      />
    </div>
  );
}
