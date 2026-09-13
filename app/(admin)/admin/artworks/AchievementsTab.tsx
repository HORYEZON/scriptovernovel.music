"use client";

// app/(admin)/admin/artworks/AchievementsTab.tsx
//
// Digital Museum Achievements admin — the master/HUD toggles (both live
// on DigitalMuseum, patched by the parent same as ChaseCompanionSection)
// plus full CRUD over MuseumAchievement rows, self-fetched here via
// app/api/digital-museum/achievements/route.ts rather than threaded down
// from DigitalMuseumPanel.tsx's own museum-config fetch, since these are
// a separate resource with their own list/create/edit/delete lifecycle —
// same reasoning as RoomsTab.tsx managing its own artwork-picker state
// independently of the parent's museum-wide fields.
import { useEffect, useState } from "react";
import { Trophy, Plus, Pencil, Trash2, Footprints, Eye, Heart, Clock } from "lucide-react";
import toast from "@/lib/toast";
import { toggleSaved } from "@/lib/admin/toggleToast";
import { getErrorMessage } from "@/lib/utils";
import { Toggle } from "./museum-ui";
import { AdminConfirmModal } from "@/components/admin/AdminConfirmModal";
import type { MuseumAchievementCategory } from "@/types";

export interface AchievementsConfigValue {
  achievementsEnabled: boolean;
  achievementsHudEnabled: boolean;
}

interface Achievement {
  id: string;
  category: MuseumAchievementCategory;
  threshold: number;
  reward: string;
  enabled: boolean;
  _count: { claims: number };
}

const CATEGORY_META: Record<MuseumAchievementCategory, { label: string; unit: string; icon: typeof Footprints }> = {
  steps: { label: "Steps Walked", unit: "steps", icon: Footprints },
  views: { label: "Artworks Viewed", unit: "views", icon: Eye },
  wishlist: { label: "Artworks Wishlisted", unit: "wishlist adds", icon: Heart },
  time: { label: "Time in Museum", unit: "minutes", icon: Clock },
};
const CATEGORY_ORDER: MuseumAchievementCategory[] = ["time", "views", "wishlist", "steps"];

export function AchievementsTab({
  value,
  onChange,
}: {
  value: AchievementsConfigValue;
  onChange: (patch: Partial<AchievementsConfigValue>) => void;
}) {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingFor, setCreatingFor] = useState<MuseumAchievementCategory | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ threshold: "", reward: "" });
  const [saving, setSaving] = useState(false);
  // The badge awaiting the delete confirmation — the in-app dialog every
  // other admin module uses, in place of the browser's confirm().
  const [pendingDelete, setPendingDelete] = useState<Achievement | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/digital-museum/achievements")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data)) setAchievements(data);
      })
      .catch(() => toast.error("Failed to load achievements"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  function startCreate(category: MuseumAchievementCategory) {
    setForm({ threshold: "", reward: "" });
    setEditingId(null);
    setCreatingFor(category);
  }

  function startEdit(a: Achievement) {
    setForm({ threshold: String(a.threshold), reward: a.reward });
    setEditingId(a.id);
    setCreatingFor(a.category);
  }

  function cancelForm() {
    setCreatingFor(null);
    setEditingId(null);
  }

  async function submitForm() {
    if (!creatingFor) return;
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
      const url = editingId ? `/api/digital-museum/achievements/${editingId}` : "/api/digital-museum/achievements";
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingId ? { threshold, reward } : { category: creatingFor, threshold, reward }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save achievement");

      if (editingId) {
        setAchievements((prev) => prev.map((a) => (a.id === editingId ? { ...a, ...data } : a)));
        toast.success("Achievement updated");
      } else {
        setAchievements((prev) => [...prev, { ...data, _count: { claims: 0 } }]);
        toast.success("Achievement created");
      }
      cancelForm();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to save achievement"));
    } finally {
      setSaving(false);
    }
  }

  async function toggleAchievement(a: Achievement, enabled: boolean) {
    const previous = achievements;
    setAchievements((prev) => prev.map((x) => (x.id === a.id ? { ...x, enabled } : x)));
    try {
      const res = await fetch(`/api/digital-museum/achievements/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error();
      toggleSaved(`${a.threshold.toLocaleString()} ${CATEGORY_META[a.category].unit} badge`, enabled);
    } catch {
      setAchievements(previous);
      toast.error("Failed to update achievement");
    }
  }

  async function deleteAchievement(a: Achievement) {
    setPendingDelete(null);
    const previous = achievements;
    setAchievements((prev) => prev.filter((x) => x.id !== a.id));
    try {
      const res = await fetch(`/api/digital-museum/achievements/${a.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Achievement deleted");
    } catch {
      setAchievements(previous);
      toast.error("Failed to delete achievement");
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="admin-card border rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-jakarta text-sm font-medium text-ink dark:text-cream">Badges &amp; Trophies</p>
            <p className="font-body text-xs text-ink-400 dark:text-ink-300 mt-0.5">
              Master switch for the whole feature — banners, claims, and the HUD all stay off while
              this is off.
            </p>
          </div>
          <Toggle
            checked={value.achievementsEnabled}
            onChange={(enabled) => {
              onChange({ achievementsEnabled: enabled });
              toggleSaved("Badges & Trophies", enabled);
            }}
            label="Toggle Achievements"
          />
        </div>
        <div className="flex items-center justify-between gap-3 pt-3 border-t border-black/5 dark:border-white/5">
          <div>
            <p className="font-jakarta text-sm font-medium text-ink dark:text-cream">Steps/Views/Time HUD</p>
            <p className="font-body text-xs text-ink-400 dark:text-ink-300 mt-0.5">
              The persistent on-screen stats card — independent of the master switch above, so
              banners can still fire with this hidden.
            </p>
          </div>
          <Toggle
            checked={value.achievementsHudEnabled}
            onChange={(enabled) => {
              onChange({ achievementsHudEnabled: enabled });
              toggleSaved("Steps/Views/Time HUD", enabled);
            }}
            label="Toggle Achievements HUD"
          />
        </div>
      </div>

      {loading ? (
        <p className="font-body text-sm text-ink-400 dark:text-ink-300">Loading…</p>
      ) : (
        CATEGORY_ORDER.map((category) => {
          const meta = CATEGORY_META[category];
          const Icon = meta.icon;
          const items = achievements.filter((a) => a.category === category).sort((a, b) => a.threshold - b.threshold);

          return (
            <div key={category} className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 font-jakarta text-sm font-semibold text-ink dark:text-cream">
                  <Icon size={15} />
                  {meta.label}
                </h3>
                <button
                  onClick={() => startCreate(category)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-sepia hover:bg-sepia/10 transition-colors"
                >
                  <Plus size={13} />
                  Add
                </button>
              </div>

              {creatingFor === category && (
                <div className="admin-card border rounded-2xl p-4 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_2fr] gap-3">
                    <div>
                      <label className="font-body text-xs text-ink-400 dark:text-ink-300 mb-1.5 block">
                        Threshold ({meta.unit})
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={form.threshold}
                        onChange={(e) => setForm((f) => ({ ...f, threshold: e.target.value }))}
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
                        placeholder="e.g. 10% off your next order — email us to claim"
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
                      {editingId ? "Save Changes" : "Create Badge"}
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

              {items.length === 0 && creatingFor !== category ? (
                <p className="font-body text-xs text-ink-400 dark:text-ink-300 pl-1">No badges yet.</p>
              ) : (
                items.map((a) => (
                  <div key={a.id} className="admin-card border rounded-2xl p-3.5 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                      <Trophy size={15} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-jakarta text-sm font-medium text-ink dark:text-cream">
                        {a.threshold.toLocaleString()} {meta.unit}
                      </p>
                      <p className="font-body text-xs text-ink-400 dark:text-ink-300 truncate">{a.reward}</p>
                      <p className="font-body text-[11px] text-ink-400 dark:text-ink-300 mt-0.5">
                        {a._count.claims} claim{a._count.claims !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <Toggle checked={a.enabled} onChange={(enabled) => toggleAchievement(a, enabled)} label={`Toggle ${a.threshold} ${meta.unit} badge`} />
                    <button
                      onClick={() => startEdit(a)}
                      className="p-1.5 rounded-lg text-ink-400 hover:text-ink dark:hover:text-cream hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                      title="Edit"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => setPendingDelete(a)}
                      className="p-1.5 rounded-lg text-red-500/70 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))
              )}
            </div>
          );
        })
      )}

      <AdminConfirmModal
        open={pendingDelete !== null}
        title={
          pendingDelete
            ? `Delete the ${pendingDelete.threshold.toLocaleString()}-${CATEGORY_META[pendingDelete.category].unit} badge?`
            : ""
        }
        description="This cannot be undone."
        onConfirm={() => pendingDelete && deleteAchievement(pendingDelete)}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
