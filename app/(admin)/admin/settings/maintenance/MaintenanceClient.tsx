// app/(admin)/admin/settings/maintenance/MaintenanceClient.tsx
"use client";

import { useRef, useState } from "react";
import { AlertTriangle, Save, ToggleLeft, ToggleRight } from "lucide-react";
import { toggleStaged } from "@/lib/admin/toggleToast";
import toast from "@/lib/toast";
import { MaintenancePage } from "@/components/public/MaintenancePage";
import { DEFAULT_MAINTENANCE_MESSAGE } from "@/lib/maintenance";
import { UnsavedChangesBar } from "@/components/admin/UnsavedChangesBar";

interface MaintenanceForm {
  maintenanceMode: boolean;
  maintenanceMessage: string;
}

const MAX_MESSAGE_LENGTH = 400;

export function MaintenanceClient({
  initialMaintenanceMode,
  initialMaintenanceMessage,
  maintenanceIcon,
}: {
  initialMaintenanceMode: boolean;
  initialMaintenanceMessage: string;
  // Not part of `form`/this page's own save flow — edited from Branding →
  // Icons instead, just read here so the preview below isn't stale.
  maintenanceIcon?: string;
}) {
  const formInit: MaintenanceForm = {
    maintenanceMode: initialMaintenanceMode,
    maintenanceMessage: initialMaintenanceMessage,
  };
  const [form, setForm] = useState<MaintenanceForm>(formInit);
  const savedFormRef = useRef(formInit);
  const [saving, setSaving] = useState(false);
  // Whether the *live* (already-saved) site is down right now — separate
  // from `form.maintenanceMode`, which may just be a pending, unsaved edit.
  const [isLive, setIsLive] = useState(initialMaintenanceMode);
  const isDirty = JSON.stringify(form) !== JSON.stringify(savedFormRef.current);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      savedFormRef.current = { ...form };
      setIsLive(form.maintenanceMode);
      toast.success(
        form.maintenanceMode
          ? "Site is now in maintenance mode"
          : "Site is live again"
      );
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setForm({ ...savedFormRef.current });
  }

  return (
    <div className="space-y-5">
      {/* Persistent warning while the live site is actually down */}
      {isLive && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-vermillion/10 border border-vermillion/30">
          <AlertTriangle size={20} className="text-vermillion shrink-0" />
          <p className="font-body text-sm text-vermillion">
            <strong>Your site is currently down.</strong> Every visitor sees
            the page below instead of the real site.
          </p>
        </div>
      )}

      <div className="admin-card border rounded-2xl backdrop-blur-md shadow-sm p-4 sm:p-6 space-y-6">
        <p className="font-body text-xs tracking-widest uppercase text-ink-400 dark:text-ink-300 border-b border-black/10 dark:border-white/10 pb-4">
          Site Status
        </p>

        {/* Toggle */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-jakarta text-sm font-medium text-ink dark:text-cream">
              Take the site offline
            </p>
            <p className="font-body text-xs text-ink-400 dark:text-ink-300 mt-1 max-w-md">
              While on, every visitor to the public site sees the branded
              page below instead. The Admin panel keeps working normally so
              you can always come back and turn it off.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setForm((f) => ({ ...f, maintenanceMode: !f.maintenanceMode }));
              toggleStaged("Maintenance mode", !form.maintenanceMode, { on: "on", off: "off" });
            }}
            title={
              form.maintenanceMode ? "Turn maintenance mode off" : "Turn maintenance mode on"
            }
            className={`shrink-0 p-1.5 rounded-lg transition-colors ${
              form.maintenanceMode
                ? "bg-vermillion/10 text-vermillion hover:bg-vermillion/20"
                : "bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:bg-black/10 dark:hover:bg-white/10"
            }`}
          >
            {form.maintenanceMode ? (
              <ToggleRight size={26} />
            ) : (
              <ToggleLeft size={26} />
            )}
          </button>
        </div>

        {/* Message */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">
            Message shown to visitors
          </label>
          <textarea
            rows={3}
            value={form.maintenanceMessage}
            onChange={(e) =>
              setForm((f) => ({ ...f, maintenanceMessage: e.target.value }))
            }
            placeholder={DEFAULT_MAINTENANCE_MESSAGE}
            maxLength={MAX_MESSAGE_LENGTH}
            className="w-full px-4 py-2.5 rounded-xl admin-input border text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors text-sm resize-none"
          />
          <p className="font-body text-xs text-ink-400 dark:text-ink-300 mt-1">
            {form.maintenanceMessage.length}/{MAX_MESSAGE_LENGTH} — leave
            blank to use the default message.
          </p>
        </div>

        {/* Live preview — the exact component visitors would see */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">
            Preview
          </label>
          <div className="rounded-xl overflow-hidden border border-black/10 dark:border-white/15">
            <MaintenancePage
              message={form.maintenanceMessage}
              icon={maintenanceIcon}
              fullScreen={false}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving || !isDirty}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-jakarta text-sm font-medium transition-all duration-200 shadow-md disabled:opacity-50 ${
            form.maintenanceMode
              ? "bg-vermillion hover:bg-vermillion/90"
              : "bg-sepia hover:bg-sepia-dark"
          }`}
        >
          {saving ? (
            <>
              <div className="w-4 h-4 border border-white/30 border-t-white rounded-full animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Save size={16} />
              {form.maintenanceMode ? "Take Site Offline" : "Save Changes"}
            </>
          )}
        </button>
        {isDirty && !saving && (
          <button
            type="button"
            onClick={reset}
            className="font-body text-xs text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream transition-colors"
          >
            Discard changes
          </button>
        )}
      </div>

      <UnsavedChangesBar
        dirty={isDirty}
        what="maintenance"
        saving={saving}
        onSave={save}
        onReset={reset}
      />
    </div>
  );
}
