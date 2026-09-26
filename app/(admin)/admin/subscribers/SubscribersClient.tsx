"use client";

// app/(admin)/admin/subscribers/SubscribersClient.tsx
//
// The mailing list: who's on it, who hasn't confirmed, who's left, and the CSV
// export that is the point of the whole module — nothing here sends campaigns,
// so the export is how the list gets used.
//
// Read-only apart from removing a row. There is deliberately no "add
// subscriber" button: an address that didn't confirm for itself has no business
// on this list, and typing one in by hand is exactly what double opt-in exists
// to prevent.
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Mail, Search, Trash2 } from "lucide-react";
import toast from "@/lib/toast";
import { cn, getErrorMessage } from "@/lib/utils";
import { AdminConfirmModal } from "@/components/admin/AdminConfirmModal";
import { AdminSelect } from "@/components/admin/AdminSelect";
import { downloadCsv, timestampedFilename, toCsv } from "@/lib/csv";
import {
  SUBSCRIBER_STATUS_LABELS,
  subscriberSourceLabel,
  subscriberStatus,
  type SubscriberStatus,
} from "@/lib/subscribers";

export interface SubscriberRow {
  id: string;
  email: string;
  source: string | null;
  confirmedAt: string | null;
  confirmSentAt: string | null;
  unsubscribedAt: string | null;
  createdAt: string;
}

const STATUS_PILL: Record<SubscriberStatus, string> = {
  confirmed: "border-emerald-500/40 text-emerald-600 dark:text-emerald-300",
  pending: "border-amber-500/40 text-amber-600 dark:text-amber-300",
  unsubscribed: "border-black/15 dark:border-white/15 text-ink-400 dark:text-ink-300",
};

function formatWhen(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "Asia/Manila",
  });
}

export function SubscribersClient({ initialSubscribers }: { initialSubscribers: SubscriberRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initialSubscribers);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<SubscriberStatus | "ALL">("ALL");
  const [deleteTarget, setDeleteTarget] = useState<SubscriberRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const counts = useMemo(() => {
    const out = { confirmed: 0, pending: 0, unsubscribed: 0 };
    for (const r of rows) out[subscriberStatus(r)]++;
    return out;
  }, [rows]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== "ALL" && subscriberStatus(r) !== status) return false;
      if (q && !r.email.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, query, status]);

  // Exports what's on screen, and always carries the status column — so a file
  // that happens to include unconfirmed or unsubscribed rows says so, rather
  // than looking like a clean mailing list.
  function exportCsv() {
    if (shown.length === 0) return toast.error("Nothing to export.");
    const csv = toCsv(
      ["Email", "Status", "Source", "Signed up", "Confirmed", "Unsubscribed"],
      shown.map((r) => [
        r.email,
        SUBSCRIBER_STATUS_LABELS[subscriberStatus(r)],
        subscriberSourceLabel(r.source),
        formatWhen(r.createdAt),
        formatWhen(r.confirmedAt),
        formatWhen(r.unsubscribedAt),
      ])
    );
    downloadCsv(timestampedFilename("subscribers"), csv);
    toast.success(`Exported ${shown.length} row${shown.length === 1 ? "" : "s"}`);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/subscribers/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to remove");
      }
      setRows((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      toast.success("Subscriber removed");
      setDeleteTarget(null);
      router.refresh();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to remove"));
    } finally {
      setDeleting(false);
    }
  }

  const mixedExport = shown.some((r) => subscriberStatus(r) !== "confirmed");

  return (
    <div>
      {/* Counts */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {(
          [
            ["confirmed", "On the list", counts.confirmed],
            ["pending", "Waiting to confirm", counts.pending],
            ["unsubscribed", "Left", counts.unsubscribed],
          ] as const
        ).map(([key, label, value]) => (
          <button
            key={key}
            type="button"
            onClick={() => setStatus(status === key ? "ALL" : key)}
            className={cn(
              "rounded-2xl border p-4 text-left transition-colors",
              status === key
                ? "border-sepia bg-sepia/10"
                : "border-black/10 bg-black/5 hover:border-sepia/50 dark:border-white/10 dark:bg-white/5"
            )}
          >
            <p className="font-body text-[11px] uppercase tracking-wider text-ink-400 dark:text-ink-300">{label}</p>
            <p className="mt-1 font-fraunces text-3xl font-light text-ink dark:text-cream">{value}</p>
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by email…"
            className="w-full rounded-xl admin-input border py-1.5 pl-8 pr-3 font-body text-xs text-ink placeholder-ink-400 transition-colors focus:border-sepia focus:outline-none dark:text-cream"
          />
        </div>
        <AdminSelect
          value={status}
          onChange={(e) => setStatus(e.target.value as SubscriberStatus | "ALL")}
          wrapperClassName="sm:w-52"
          className="py-1.5 text-xs"
          aria-label="Filter by status"
        >
          <option value="ALL" className="bg-white dark:bg-ink-900">
            All statuses
          </option>
          {(Object.keys(SUBSCRIBER_STATUS_LABELS) as SubscriberStatus[]).map((s) => (
            <option key={s} value={s} className="bg-white dark:bg-ink-900">
              {SUBSCRIBER_STATUS_LABELS[s]}
            </option>
          ))}
        </AdminSelect>
        <button
          type="button"
          onClick={exportCsv}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-sepia/40 bg-sepia/10 px-4 py-1.5 font-body text-xs text-ink transition-colors hover:border-sepia dark:text-cream"
        >
          <Download size={13} /> Export {shown.length} shown
        </button>
      </div>

      {mixedExport && (
        <p className="mb-4 font-body text-[11px] leading-relaxed text-ink-400 dark:text-ink-300">
          The rows shown include addresses that haven&apos;t confirmed or have unsubscribed. Only
          <span className="text-ink dark:text-cream"> Confirmed </span> addresses may be emailed — filter to
          those before exporting a list to send to.
        </p>
      )}

      {/* List */}
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-black/10 bg-black/5 p-12 text-center dark:border-white/10 dark:bg-white/5">
          <Mail size={28} className="mx-auto mb-3 text-ink-400" />
          <h3 className="mb-1 text-lg font-medium text-ink dark:text-cream">No one on the list yet</h3>
          <p className="mx-auto max-w-md text-sm text-ink-400 dark:text-ink-300">
            The signup form is in the site footer, on <span className="font-mono text-xs">/subscribe</span>, and on
            the Shows page whenever there are no dates booked.
          </p>
        </div>
      ) : shown.length === 0 ? (
        <p className="py-12 text-center text-sm text-ink-400 dark:text-ink-300">Nothing matches that.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-black/10 dark:border-white/10">
          <table className="w-full text-left">
            <thead className="bg-black/5 dark:bg-white/5">
              <tr className="font-body text-[10px] uppercase tracking-wider text-ink-400 dark:text-ink-300">
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">Source</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">Signed up</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/5">
              {shown.map((r) => {
                const s = subscriberStatus(r);
                return (
                  <tr key={r.id} className="transition-colors hover:bg-black/5 dark:hover:bg-white/5">
                    <td className="px-4 py-3">
                      <span className="font-body text-sm text-ink dark:text-cream">{r.email}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-block rounded-full border px-2.5 py-0.5 font-body text-[10px] uppercase tracking-wider",
                          STATUS_PILL[s]
                        )}
                      >
                        {SUBSCRIBER_STATUS_LABELS[s]}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 font-body text-xs text-ink-400 dark:text-ink-300 sm:table-cell">
                      {subscriberSourceLabel(r.source)}
                    </td>
                    <td className="hidden px-4 py-3 font-body text-xs text-ink-400 dark:text-ink-300 md:table-cell">
                      {formatWhen(r.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(r)}
                        aria-label={`Remove ${r.email}`}
                        className="rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-red-500/10 hover:text-red-500"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <AdminConfirmModal
        open={Boolean(deleteTarget)}
        title="Remove this address?"
        description={
          <>
            <span className="text-ink dark:text-cream">{deleteTarget?.email}</span> will be deleted outright —
            this is not a Trash, and it can&apos;t be undone. If they only want to stop hearing from you, the
            unsubscribe link in their email does that and keeps the record.
          </>
        }
        confirmLabel="Remove"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
