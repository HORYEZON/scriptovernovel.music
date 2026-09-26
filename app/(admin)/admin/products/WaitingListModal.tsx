"use client";

// app/(admin)/admin/products/WaitingListModal.tsx
//
// Who is waiting on one product, and a CSV of them.
//
// There is no "email them now" button on purpose: the alert fires when the
// product actually becomes buyable (see lib/store/notify-server.ts), because an
// alert that says "it's available" has to be true when it lands. A manual send
// would be a way to tell forty people something that isn't so yet.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, Download, Loader2, Trash2, X } from "lucide-react";
import toast from "@/lib/toast";
import { cn, getErrorMessage } from "@/lib/utils";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";
import { downloadCsv, timestampedFilename, toCsv } from "@/lib/csv";

interface WaitingRow {
  id: string;
  email: string;
  variantId: string | null;
  notifiedAt: string | null;
  createdAt: string;
  variant: { label: string } | null;
}

function formatWhen(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "Asia/Manila",
  });
}

export function WaitingListModal({
  productId,
  productTitle,
  onClose,
}: {
  productId: string | null;
  productTitle: string;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<WaitingRow[] | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  useLockBodyScroll(productId !== null);

  useEffect(() => {
    if (!productId) {
      setRows(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/stock-notifications?productId=${encodeURIComponent(productId)}`);
        const data = await res.json();
        if (!cancelled) setRows(res.ok ? data : []);
      } catch {
        if (!cancelled) setRows([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [productId]);

  async function remove(id: string) {
    setRemoving(id);
    try {
      const res = await fetch(`/api/stock-notifications/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove");
      setRows((prev) => (prev ? prev.filter((r) => r.id !== id) : prev));
      toast.success("Removed from the waiting list");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to remove"));
    } finally {
      setRemoving(null);
    }
  }

  function exportCsv() {
    if (!rows || rows.length === 0) return toast.error("Nothing to export.");
    const csv = toCsv(
      ["Email", "Size / format", "Asked on", "Emailed on"],
      rows.map((r) => [r.email, r.variant?.label ?? "Any", formatWhen(r.createdAt), formatWhen(r.notifiedAt)])
    );
    downloadCsv(timestampedFilename("waiting-list"), csv);
  }

  if (!productId) return null;

  const pending = rows?.filter((r) => !r.notifiedAt) ?? [];

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-6">
      <div className="flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl dark:bg-ink-900 sm:rounded-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-black/10 p-5 dark:border-white/10">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 font-fraunces text-xl font-light text-ink dark:text-cream">
              <Bell size={16} /> Waiting list
            </h2>
            <p className="mt-0.5 truncate font-body text-xs text-ink-400 dark:text-ink-300">{productTitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-black/5 dark:hover:bg-white/10"
          >
            <X size={18} />
          </button>
        </div>

        {rows === null ? (
          <div className="flex items-center justify-center gap-2 p-10 font-body text-sm text-ink-400">
            <Loader2 size={14} className="animate-spin" /> Loading
          </div>
        ) : rows.length === 0 ? (
          <p className="p-10 text-center font-body text-sm text-ink-400 dark:text-ink-300">Nobody waiting on this one.</p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 border-b border-black/10 px-5 py-3 dark:border-white/10">
              <p className="font-body text-xs text-ink-400 dark:text-ink-300">
                {pending.length} waiting{rows.length !== pending.length && ` · ${rows.length - pending.length} already emailed`}
              </p>
              <button
                type="button"
                onClick={exportCsv}
                className="inline-flex items-center gap-1.5 rounded-lg border border-sepia/40 bg-sepia/10 px-2.5 py-1 font-body text-xs text-ink transition-colors hover:border-sepia dark:text-cream"
              >
                <Download size={12} /> CSV
              </button>
            </div>
            <ul className="min-h-0 flex-1 divide-y divide-black/5 overflow-y-auto dark:divide-white/5">
              {rows.map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className={cn("truncate font-body text-sm", r.notifiedAt ? "text-ink-400 dark:text-ink-300" : "text-ink dark:text-cream")}>
                      {r.email}
                    </p>
                    <p className="font-body text-[11px] text-ink-400 dark:text-ink-300">
                      {r.variant?.label ?? "Any size"} · asked {formatWhen(r.createdAt)}
                      {r.notifiedAt && ` · emailed ${formatWhen(r.notifiedAt)}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(r.id)}
                    disabled={removing === r.id}
                    aria-label={`Remove ${r.email}`}
                    className="shrink-0 rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-red-500/10 hover:text-red-500 disabled:opacity-40"
                  >
                    {removing === r.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="border-t border-black/10 p-5 dark:border-white/10">
          <p className="font-body text-[11px] leading-relaxed text-ink-400 dark:text-ink-300">
            Everyone here is emailed once, automatically, the moment this product becomes buyable — when you turn
            <span className="text-ink dark:text-cream"> Coming soon </span>off, or put stock back on it. There is no
            send button, because the email says &ldquo;it&apos;s available&rdquo; and that has to be true when it arrives.
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}
