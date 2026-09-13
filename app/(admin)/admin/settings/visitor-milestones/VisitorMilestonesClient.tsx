"use client";

// app/(admin)/admin/settings/visitor-milestones/VisitorMilestonesClient.tsx
//
// Admin CRUD for visitor-count reward milestones — see
// app/api/visitor-milestones/route.ts and prisma/schema.prisma's
// VisitorMilestone comment. The live running count is shown read-only
// (server-authoritative, incremented only by app/api/visitor-count/
// route.ts's cookie-gated ping) alongside a "Recalibrate" control for the
// one legitimate reason to hand-set it — seeding it from the site's
// existing Vercel Analytics history instead of starting over from zero.
import { useState } from "react";
import { Trophy, Plus, Pencil, Trash2, RefreshCw, X } from "lucide-react";
import toast from "@/lib/toast";
import { getErrorMessage } from "@/lib/utils";
import { Toggle } from "../../artworks/museum-ui";
import { AdminConfirmModal } from "@/components/admin/AdminConfirmModal";

interface Milestone {
  id: string;
  threshold: number;
  reward: string;
  enabled: boolean;
  achievedAt: string | null;
  _count: { claims: number };
}

export function VisitorMilestonesClient({
  initialCount,
  initialMilestones,
}: {
  initialCount: number;
  initialMilestones: Milestone[];
}) {
  const [count, setCount] = useState(initialCount);
  const [milestones, setMilestones] = useState<Milestone[]>(initialMilestones);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ threshold: "", reward: "" });
  const [recalibrating, setRecalibrating] = useState(false);
  const [newCount, setNewCount] = useState(String(initialCount));
  const [saving, setSaving] = useState(false);
  // The milestone awaiting the delete confirmation — the in-app dialog every
  // other admin module uses, in place of the browser's confirm().
  const [pendingDelete, setPendingDelete] = useState<Milestone | null>(null);

  function startCreate() {
    setForm({ threshold: "", reward: "" });
    setEditingId(null);
    setCreating(true);
  }

  function startEdit(m: Milestone) {
    setForm({ threshold: String(m.threshold), reward: m.reward });
    setEditingId(m.id);
    setCreating(true);
  }

  function cancelForm() {
    setCreating(false);
    setEditingId(null);
  }

  async function submitForm() {
    const threshold = Number(form.threshold);
    const reward = form.reward.trim();
    if (!Number.isInteger(threshold) || threshold <= 0) {
      toast.error("Threshold must be a positive whole number");
      return;
    }
    if (!reward) {
      toast.error("Reward description is required");
      return;
    }

    setSaving(true);
    try {
      const url = editingId ? `/api/visitor-milestones/${editingId}` : "/api/visitor-milestones";
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threshold, reward }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save milestone");

      if (editingId) {
        setMilestones((prev) => prev.map((m) => (m.id === editingId ? { ...m, ...data } : m)).sort((a, b) => a.threshold - b.threshold));
        toast.success("Milestone updated");
      } else {
        setMilestones((prev) => [...prev, { ...data, _count: { claims: 0 } }].sort((a, b) => a.threshold - b.threshold));
        toast.success("Milestone created");
      }
      cancelForm();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to save milestone"));
    } finally {
      setSaving(false);
    }
  }

  async function toggleEnabled(m: Milestone, enabled: boolean) {
    const previous = milestones;
    setMilestones((prev) => prev.map((x) => (x.id === m.id ? { ...x, enabled } : x)));
    try {
      const res = await fetch(`/api/visitor-milestones/${m.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setMilestones(previous);
      toast.error("Failed to update milestone");
    }
  }

  async function deleteMilestone(m: Milestone) {
    setPendingDelete(null);
    const previous = milestones;
    setMilestones((prev) => prev.filter((x) => x.id !== m.id));
    try {
      const res = await fetch(`/api/visitor-milestones/${m.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Milestone deleted");
    } catch {
      setMilestones(previous);
      toast.error("Failed to delete milestone");
    }
  }

  async function submitRecalibrate() {
    const value = Number(newCount);
    if (!Number.isInteger(value) || value < 0) {
      toast.error("Count must be a non-negative whole number");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/visitor-count", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update count");
      setCount(data.count);
      // A recalibration upward can itself cross thresholds — refetch so any
      // newly-achieved milestone's badge shows immediately.
      const refreshed = await fetch("/api/visitor-milestones").then((r) => r.json());
      if (refreshed?.milestones) setMilestones(refreshed.milestones);
      toast.success("Visitor count updated");
      setRecalibrating(false);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to update count"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="admin-card border rounded-2xl p-4 flex items-center justify-between gap-3">
        <div>
          <p className="font-body text-xs text-ink-400 dark:text-ink-300">Current visitor count</p>
          <p className="font-jakarta text-2xl font-semibold text-ink dark:text-cream">{count.toLocaleString()}</p>
        </div>
        {recalibrating ? (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              value={newCount}
              onChange={(e) => setNewCount(e.target.value)}
              className="admin-input w-32 px-3 py-2 rounded-xl text-sm"
            />
            <button
              onClick={submitRecalibrate}
              disabled={saving}
              className="px-3 py-2 rounded-xl bg-sepia text-white text-sm font-medium hover:bg-sepia-dark transition-colors disabled:opacity-50"
            >
              Save
            </button>
            <button
              onClick={() => {
                setRecalibrating(false);
                setNewCount(String(count));
              }}
              className="p-2 rounded-xl text-ink-400 hover:text-ink dark:hover:text-cream hover:bg-black/5 dark:hover:bg-white/5"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setRecalibrating(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <RefreshCw size={14} />
            Recalibrate
          </button>
        )}
      </div>

      <div className="flex items-center justify-between">
        <h3 className="font-jakarta text-sm font-semibold text-ink dark:text-cream">Milestones</h3>
        <button
          onClick={startCreate}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-sepia text-white text-sm font-medium hover:bg-sepia-dark transition-colors"
        >
          <Plus size={14} />
          Add Milestone
        </button>
      </div>

      {creating && (
        <div className="admin-card border rounded-2xl p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_2fr] gap-3">
            <div>
              <label className="font-body text-xs text-ink-400 dark:text-ink-300 mb-1.5 block">
                Visitor count threshold
              </label>
              <input
                type="number"
                min={1}
                value={form.threshold}
                onChange={(e) => setForm((f) => ({ ...f, threshold: e.target.value }))}
                placeholder="e.g. 10000"
                className="admin-input w-full px-3 py-2 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="font-body text-xs text-ink-400 dark:text-ink-300 mb-1.5 block">
                Reward description
              </label>
              <input
                type="text"
                value={form.reward}
                onChange={(e) => setForm((f) => ({ ...f, reward: e.target.value }))}
                placeholder="e.g. Free A5 portrait print — email us to claim"
                className="admin-input w-full px-3 py-2 rounded-xl text-sm"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={submitForm}
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-sepia text-white text-sm font-medium hover:bg-sepia-dark transition-colors disabled:opacity-50"
            >
              {editingId ? "Save Changes" : "Create Milestone"}
            </button>
            <button
              onClick={cancelForm}
              className="px-4 py-2 rounded-xl text-sm font-medium text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {milestones.length === 0 && !creating && (
        <div className="admin-card border rounded-2xl p-8 text-center">
          <Trophy size={28} className="mx-auto text-ink-400 dark:text-ink-300 mb-3" />
          <p className="font-body text-sm text-ink-400 dark:text-ink-300">
            No milestones yet — add one to start rewarding visitors as the site grows.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {milestones.map((m) => (
          <div key={m.id} className="admin-card border rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Trophy size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-jakarta text-sm font-medium text-ink dark:text-cream">
                  {m.threshold.toLocaleString()} visitors
                </p>
                {m.achievedAt ? (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    Achieved
                  </span>
                ) : (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] uppercase tracking-wider bg-black/5 dark:bg-white/10 text-ink-400 dark:text-ink-300 border border-black/10 dark:border-white/10">
                    Not yet reached
                  </span>
                )}
              </div>
              <p className="font-body text-xs text-ink-400 dark:text-ink-300 truncate">{m.reward}</p>
              <p className="font-body text-[11px] text-ink-400 dark:text-ink-300 mt-0.5">
                {m._count.claims} claim{m._count.claims !== 1 ? "s" : ""}
              </p>
            </div>
            <Toggle checked={m.enabled} onChange={(enabled) => toggleEnabled(m, enabled)} label={`Toggle ${m.threshold} milestone`} />
            <button
              onClick={() => startEdit(m)}
              className="p-1.5 rounded-lg text-ink-400 hover:text-ink dark:hover:text-cream hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              title="Edit"
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={() => setPendingDelete(m)}
              className="p-1.5 rounded-lg text-red-500/70 hover:text-red-500 hover:bg-red-500/10 transition-colors"
              title="Delete"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      <AdminConfirmModal
        open={pendingDelete !== null}
        title={
          pendingDelete
            ? `Delete the ${pendingDelete.threshold.toLocaleString()}-visitor milestone?`
            : ""
        }
        description="This cannot be undone."
        onConfirm={() => pendingDelete && deleteMilestone(pendingDelete)}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
