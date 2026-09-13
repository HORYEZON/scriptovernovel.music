// app/(admin)/admin/settings/Preferences/MusicClient.tsx
"use client";

import { useRef, useState } from "react";
import { Save, ToggleLeft, ToggleRight, Volume1, Volume2 } from "lucide-react";
import { toggleStaged } from "@/lib/admin/toggleToast";
import toast from "@/lib/toast";
import { AudioUploader } from "./AudioUploader";
import { UnsavedChangesBar } from "@/components/admin/UnsavedChangesBar";
import {
  MIN_MUSIC_VOLUME,
  MAX_MUSIC_VOLUME,
} from "@/lib/background-music";

interface MusicForm {
  musicUrl: string;
  musicEnabled: boolean;
  musicVolume: number;
}

export function MusicClient({
  initialMusicUrl,
  initialMusicEnabled,
  initialMusicVolume,
}: {
  initialMusicUrl: string;
  initialMusicEnabled: boolean;
  initialMusicVolume: number;
}) {
  const formInit: MusicForm = {
    musicUrl: initialMusicUrl,
    musicEnabled: initialMusicEnabled,
    musicVolume: initialMusicVolume,
  };
  const [form, setForm] = useState<MusicForm>(formInit);
  const savedFormRef = useRef(formInit);
  const [saving, setSaving] = useState(false);
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
      toast.success(
        form.musicEnabled ? "Background music is live" : "Background music turned off"
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
      <div className="admin-card border rounded-2xl backdrop-blur-md shadow-sm p-4 sm:p-6 space-y-6">
        <p className="font-body text-xs tracking-widest uppercase text-ink-400 dark:text-ink-300 border-b border-black/10 dark:border-white/10 pb-4">
          Music Settings
        </p>

        {/* Toggle */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-jakarta text-sm font-medium text-ink dark:text-cream">
              Enable background music
            </p>
            <p className="font-body text-xs text-ink-400 dark:text-ink-300 mt-1 max-w-md">
              Adds a floating speaker button to every public page. Music
              never plays automatically — visitors choose to turn it on.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setForm((f) => ({ ...f, musicEnabled: !f.musicEnabled }));
              toggleStaged("Background music", !form.musicEnabled);
            }}
            title={form.musicEnabled ? "Turn music off" : "Turn music on"}
            className={`shrink-0 p-1.5 rounded-lg transition-colors ${
              form.musicEnabled
                ? "bg-sepia/10 text-sepia hover:bg-sepia/20"
                : "bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:bg-black/10 dark:hover:bg-white/10"
            }`}
          >
            {form.musicEnabled ? (
              <ToggleRight size={26} />
            ) : (
              <ToggleLeft size={26} />
            )}
          </button>
        </div>

        <AudioUploader
          value={form.musicUrl}
          onChange={(url) => setForm((f) => ({ ...f, musicUrl: url }))}
        />

        {/* Volume */}
        <div>
          <label
            htmlFor="music-volume"
            className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2"
          >
            Default Volume —{" "}
            <span className="font-mono normal-case tracking-normal text-ink dark:text-cream">
              {form.musicVolume}%
            </span>
          </label>
          <div className="flex items-center gap-3">
            <Volume1 size={16} className="text-ink-400 dark:text-ink-300 shrink-0" />
            <input
              id="music-volume"
              type="range"
              min={MIN_MUSIC_VOLUME}
              max={MAX_MUSIC_VOLUME}
              value={form.musicVolume}
              onChange={(e) =>
                setForm((f) => ({ ...f, musicVolume: Number(e.target.value) }))
              }
              className="flex-1 accent-sepia cursor-pointer"
            />
            <Volume2 size={18} className="text-ink-400 dark:text-ink-300 shrink-0" />
          </div>
        </div>

        {form.musicEnabled && !form.musicUrl && (
          <p className="font-body text-xs text-vermillion">
            Upload a track above — music won&apos;t appear on the site until one is set.
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving || !isDirty}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-jakarta text-sm font-medium transition-all duration-200 shadow-md disabled:opacity-50 bg-sepia hover:bg-sepia-dark"
        >
          {saving ? (
            <>
              <div className="w-4 h-4 border border-white/30 border-t-white rounded-full animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Save size={16} />
              Save Changes
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
        what="music"
        saving={saving}
        onSave={save}
        onReset={reset}
        saveLabel="Save Music"
      />
    </div>
  );
}
