"use client";

// app/(admin)/admin/settings/blocked-emails/BlockedEmailsClient.tsx
//
// The unblock half of the Block Sender feature (NotificationsClient.tsx's
// Gmail tab has the block half) — a plain list with Add and Remove, same
// shape as other small admin lists (Social Links, Artist Skills) rather
// than the soft-delete/Trash pattern, since a block list has no "undo the
// undo" need.
import { useState } from "react";
import { Ban, ShieldOff } from "lucide-react";
import toast from "@/lib/toast";
import { formatDate } from "@/lib/utils";
import { AdminConfirmModal } from "@/components/admin/AdminConfirmModal";

interface BlockedEmail {
  id: string;
  email: string;
  reason: string | null;
  createdAt: string;
}

export function BlockedEmailsClient({
  initialBlockedEmails,
}: {
  initialBlockedEmails: BlockedEmail[];
}) {
  const [blockedEmails, setBlockedEmails] = useState(initialBlockedEmails);
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  // The row awaiting the unblock confirmation — the in-app dialog every
  // other admin module uses, in place of the browser's confirm().
  const [pendingUnblock, setPendingUnblock] = useState<BlockedEmail | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/admin/blocked-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), reason: reason.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data?.error ?? "Could not block that email.");
        return;
      }
      setBlockedEmails((rows) => [
        data.blocked,
        ...rows.filter((r) => r.email !== data.blocked.email),
      ]);
      setEmail("");
      setReason("");
      toast.success(`${data.blocked.email} blocked`);
    } catch {
      toast.error("Could not reach the server.");
    } finally {
      setAdding(false);
    }
  }

  async function handleUnblock(row: BlockedEmail) {
    setRemovingId(row.id);
    try {
      const res = await fetch(`/api/admin/blocked-emails/${row.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setBlockedEmails((rows) => rows.filter((r) => r.id !== row.id));
      toast.success(`${row.email} unblocked`);
    } catch {
      toast.error("Could not unblock that email.");
    } finally {
      setRemovingId(null);
      setPendingUnblock(null);
    }
  }

  return (
    <div className="space-y-5">
      {/* Add form */}
      <form
        onSubmit={handleAdd}
        className="admin-card border rounded-2xl backdrop-blur-md shadow-sm p-4 sm:p-5 flex flex-col sm:flex-row gap-3"
      >
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="spammer@example.com"
          className="flex-1 px-4 py-2.5 rounded-xl admin-input border text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors text-sm"
        />
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (optional)"
          className="flex-1 px-4 py-2.5 rounded-xl admin-input border text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors text-sm"
        />
        <button
          type="submit"
          disabled={adding || !email.trim()}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-sepia hover:bg-sepia-dark text-white font-jakarta text-sm font-medium transition-all duration-200 shadow-md disabled:opacity-50 shrink-0"
        >
          <Ban size={15} /> {adding ? "Blocking…" : "Block Email"}
        </button>
      </form>

      {/* List */}
      <div className="admin-card border rounded-2xl backdrop-blur-md shadow-sm overflow-hidden">
        {blockedEmails.length === 0 ? (
          <div className="p-12 text-center">
            <Ban className="w-10 h-10 text-ink-400 dark:text-ink-300 mx-auto mb-3 opacity-50" />
            <p className="font-jakarta text-sm font-medium text-ink dark:text-cream">
              No blocked emails
            </p>
            <p className="font-body text-xs text-ink-400 dark:text-ink-300 mt-1">
              Blocked senders — from here or from a Gmail notification — show up in this list.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-black/5 dark:divide-white/5">
            {blockedEmails.map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5"
              >
                <div className="min-w-0">
                  <p className="font-jakarta text-sm font-medium text-ink dark:text-cream truncate">
                    {row.email}
                  </p>
                  <p className="font-body text-xs text-ink-400 dark:text-ink-300 mt-0.5">
                    {row.reason ? `${row.reason} · ` : ""}Blocked {formatDate(row.createdAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPendingUnblock(row)}
                  disabled={removingId === row.id}
                  title="Unblock"
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-black/10 dark:border-white/10 text-ink-400 dark:text-ink-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-500/30 hover:bg-emerald-500/10 transition-colors text-xs font-medium disabled:opacity-50"
                >
                  <ShieldOff size={13} /> Unblock
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <AdminConfirmModal
        open={pendingUnblock !== null}
        title={pendingUnblock ? `Unblock ${pendingUnblock.email}?` : ""}
        description="They'll be able to use the contact form again."
        confirmLabel="Unblock"
        danger={false}
        loading={removingId !== null}
        onConfirm={() => pendingUnblock && handleUnblock(pendingUnblock)}
        onCancel={() => setPendingUnblock(null)}
      />
    </div>
  );
}
