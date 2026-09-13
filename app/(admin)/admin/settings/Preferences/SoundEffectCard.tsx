// app/(admin)/admin/settings/Preferences/SoundEffectCard.tsx
"use client";

import { useRef, useState } from "react";
import { ChevronDown, Play, Save, ToggleLeft, ToggleRight, Volume1, Volume2 } from "lucide-react";
import { toggleStaged } from "@/lib/admin/toggleToast";
import toast from "@/lib/toast";
import { cn, getErrorMessage } from "@/lib/utils";
import { ALLOWED_AUDIO_TYPES, MAX_AUDIO_FILE_SIZE_MB } from "@/lib/background-music";
import {
  MAX_SOUND_DURATION_MS,
  MAX_SOUND_FREQUENCY,
  MAX_SOUND_VOLUME,
  MIN_SOUND_DURATION_MS,
  MIN_SOUND_FREQUENCY,
  MIN_SOUND_VOLUME,
  SOUND_PRESETS,
  WAVEFORMS,
  type SoundEffectConfig,
  type SoundSource,
  type Waveform,
} from "@/lib/sound/types";
import { previewSoundEffect } from "@/lib/sound/engine";
import type { AdminSoundEffect } from "@/lib/sound/server";

const SOURCE_LABELS: Record<SoundSource, { label: string; description: string }> = {
  prebuilt: { label: "Prebuilt", description: "Pick from a small library of ready-made cues." },
  upload: { label: "Upload", description: "Use your own short audio clip." },
  synthesized: { label: "Synthesize", description: "Dial in your own tone by ear." },
};

const WAVEFORM_LABELS: Record<Waveform, string> = {
  sine: "Sine — smooth",
  triangle: "Triangle — soft",
  square: "Square — buzzy",
  sawtooth: "Sawtooth — harsh",
};

/**
 * One sound effect's editor — enable, source (prebuilt/upload/synthesize),
 * and volume, saved through PUT /api/sound-effects/config. Every category
 * tab in SoundClient renders one of these per registry key it owns.
 */
export function SoundEffectCard({ effect }: { effect: AdminSoundEffect }) {
  const initial: SoundEffectConfig = effect;
  const [form, setForm] = useState<SoundEffectConfig>(initial);
  const savedRef = useRef<SoundEffectConfig>(initial);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isDirty = JSON.stringify(form) !== JSON.stringify(savedRef.current);
  const update = <K extends keyof SoundEffectConfig>(key: K, value: SoundEffectConfig[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/sound-effects/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: effect.key, ...form }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error);
      savedRef.current = { ...form };
      toast.success(`${effect.label} saved`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to save"));
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setForm({ ...savedRef.current });
  }

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload/audio", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      update("url", data.url as string);
      toast.success("Sound uploaded");
    } catch (err) {
      toast.error(getErrorMessage(err, "Upload failed"));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="admin-card border rounded-2xl backdrop-blur-md shadow-sm p-4 sm:p-6 space-y-6">
      <div className="flex items-start justify-between gap-4 border-b border-black/10 dark:border-white/10 pb-4">
        <div>
          <p className="font-jakarta text-sm font-semibold text-ink dark:text-cream">
            {effect.label}
          </p>
          <p className="font-body text-xs text-ink-400 dark:text-ink-300 mt-1 max-w-md">
            {effect.description}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={form.enabled}
          aria-label={form.enabled ? `Turn off ${effect.label}` : `Turn on ${effect.label}`}
          title={form.enabled ? "Turn off" : "Turn on"}
          onClick={() => {
            update("enabled", !form.enabled);
            toggleStaged(effect.label, !form.enabled);
          }}
          className={cn(
            "shrink-0 p-1.5 rounded-lg transition-colors",
            form.enabled
              ? "bg-sepia/10 text-sepia hover:bg-sepia/20"
              : "bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:bg-black/10 dark:hover:bg-white/10"
          )}
        >
          {form.enabled ? <ToggleRight size={26} /> : <ToggleLeft size={26} />}
        </button>
      </div>

      {/* ── Source ── */}
      <div>
        <p className="font-body text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">
          Source
        </p>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(SOURCE_LABELS) as SoundSource[]).map((source) => {
            const active = form.source === source;
            return (
              <button
                key={source}
                type="button"
                onClick={() => update("source", source)}
                aria-pressed={active}
                className={cn(
                  "rounded-xl border px-3 py-2.5 text-left transition-colors",
                  active
                    ? "border-sepia bg-sepia/10"
                    : "border-black/10 dark:border-white/10 hover:border-sepia/40"
                )}
              >
                <span className="block font-jakarta text-sm font-medium text-ink dark:text-cream">
                  {SOURCE_LABELS[source].label}
                </span>
                <span className="block font-body text-[11px] text-ink-400 dark:text-ink-300 mt-0.5">
                  {SOURCE_LABELS[source].description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Prebuilt ── */}
      {form.source === "prebuilt" && (
        <div>
          <label
            htmlFor={`${effect.key}-preset`}
            className="block font-body text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2"
          >
            Preset
          </label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <select
                id={`${effect.key}-preset`}
                value={form.preset}
                onChange={(event) => update("preset", event.target.value)}
                className="w-full px-4 py-2.5 pr-10 rounded-xl admin-input border text-ink dark:text-cream focus:outline-none focus:border-sepia transition-colors text-sm cursor-pointer appearance-none"
              >
                {SOUND_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-ink-400"
              />
            </div>
            <PreviewButton onClick={() => previewSoundEffect(form)} />
          </div>
        </div>
      )}

      {/* ── Upload ── */}
      {form.source === "upload" && (
        <div>
          <label className="block font-body text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">
            Sound file
          </label>
          <input
            ref={inputRef}
            type="file"
            accept={ALLOWED_AUDIO_TYPES.join(",")}
            className="hidden"
            onChange={handleUpload}
          />
          {form.url && !uploading ? (
            <div className="flex items-center gap-2">
              <audio src={form.url} controls className="flex-1 h-10" />
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className="font-body text-xs text-sepia hover:text-sepia-dark transition-colors shrink-0"
              >
                Replace
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-xl border border-dashed border-black/15 dark:border-white/15 text-ink-400 dark:text-ink-300 hover:border-sepia/50 hover:text-sepia transition-colors font-body text-sm disabled:opacity-60"
            >
              {uploading
                ? "Uploading…"
                : `Click to upload — MP3, WAV, OGG, AAC or M4A, max ${MAX_AUDIO_FILE_SIZE_MB} MB`}
            </button>
          )}
          {!form.url && !uploading && (
            <p className="font-body text-xs text-vermillion mt-2">
              Upload a clip above — this source won&apos;t play anything until one is set.
            </p>
          )}
        </div>
      )}

      {/* ── Synthesize ── */}
      {form.source === "synthesized" && (
        <div className="space-y-4">
          <div>
            <label
              htmlFor={`${effect.key}-waveform`}
              className="block font-body text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2"
            >
              Waveform
            </label>
            <div className="relative">
              <select
                id={`${effect.key}-waveform`}
                value={form.waveform}
                onChange={(event) => update("waveform", event.target.value as Waveform)}
                className="w-full px-4 py-2.5 pr-10 rounded-xl admin-input border text-ink dark:text-cream focus:outline-none focus:border-sepia transition-colors text-sm cursor-pointer appearance-none"
              >
                {WAVEFORMS.map((waveform) => (
                  <option key={waveform} value={waveform}>
                    {WAVEFORM_LABELS[waveform]}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-ink-400"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor={`${effect.key}-frequency`}
                className="block font-body text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2"
              >
                Pitch — {form.frequency} Hz
              </label>
              <input
                id={`${effect.key}-frequency`}
                type="range"
                min={MIN_SOUND_FREQUENCY}
                max={MAX_SOUND_FREQUENCY}
                value={form.frequency}
                onChange={(event) => update("frequency", Number(event.target.value))}
                className="w-full accent-sepia"
              />
            </div>
            <div>
              <label
                htmlFor={`${effect.key}-duration`}
                className="block font-body text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2"
              >
                Length — {form.durationMs} ms
              </label>
              <input
                id={`${effect.key}-duration`}
                type="range"
                min={MIN_SOUND_DURATION_MS}
                max={MAX_SOUND_DURATION_MS}
                value={form.durationMs}
                onChange={(event) => update("durationMs", Number(event.target.value))}
                className="w-full accent-sepia"
              />
            </div>
          </div>

          <PreviewButton onClick={() => previewSoundEffect(form)} full />
        </div>
      )}

      {/* ── Volume ── */}
      <div>
        <label
          htmlFor={`${effect.key}-volume`}
          className="block font-body text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2"
        >
          Volume —{" "}
          <span className="font-mono normal-case tracking-normal text-ink dark:text-cream">
            {form.volume}%
          </span>
        </label>
        <div className="flex items-center gap-3">
          <Volume1 size={16} className="text-ink-400 dark:text-ink-300 shrink-0" />
          <input
            id={`${effect.key}-volume`}
            type="range"
            min={MIN_SOUND_VOLUME}
            max={MAX_SOUND_VOLUME}
            value={form.volume}
            onChange={(event) => update("volume", Number(event.target.value))}
            className="flex-1 accent-sepia cursor-pointer"
          />
          <Volume2 size={18} className="text-ink-400 dark:text-ink-300 shrink-0" />
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={save}
          disabled={saving || !isDirty}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sepia hover:bg-sepia-dark text-white font-jakarta text-sm font-medium transition-all duration-200 shadow-md disabled:opacity-50"
        >
          {saving ? (
            <>
              <span className="w-4 h-4 border border-white/30 border-t-white rounded-full animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Save size={16} />
              Save
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
    </div>
  );
}

function PreviewButton({ onClick, full }: { onClick: () => void; full?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-black/10 dark:border-white/10 text-ink-500 dark:text-ink-300 hover:text-sepia hover:border-sepia/40 transition-colors font-body text-xs shrink-0",
        full && "w-full"
      )}
    >
      <Play size={13} />
      Preview
    </button>
  );
}
