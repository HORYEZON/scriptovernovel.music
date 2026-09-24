// app/(admin)/admin/artworks/museum-ui.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { ToggleLeft, ToggleRight, RotateCcw, ImagePlus, X, Film } from "lucide-react";
import Image from "@/components/ui/SafeImage";
import { cn, getErrorMessage } from "@/lib/utils";
import toast from "@/lib/toast";
import { uploadArtworkVideo } from "@/lib/artwork-video-upload";
import { ALLOWED_VIDEO_TYPES, MAX_VIDEO_DURATION_SEC } from "@/lib/artwork-video";
import { parseYouTube } from "@/lib/embeds";

// Small presentational pieces shared across DigitalMuseumPanel.tsx's
// General tab and RoomsTab.tsx (per-room enabled toggle, wall/floor/
// ceiling colors + textures, Themed Exhibition toggle) — split out once a
// second consumer needed them rather than copy-pasting.

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "shrink-0 p-1.5 rounded-lg transition-colors",
        checked
          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
          : "bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:bg-black/10 dark:hover:bg-white/10"
      )}
    >
      {checked ? <ToggleRight size={26} /> : <ToggleLeft size={26} />}
    </button>
  );
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export function ColorField({
  label,
  value,
  defaultValue,
  onChange,
}: {
  label: string;
  value: string;
  defaultValue: string;
  onChange: (value: string) => void;
}) {
  // Local text mirrors `value` but doesn't fight the admin's typing —
  // synced on prop change (e.g. after a reset), not on every keystroke.
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);

  function commitText(next: string) {
    setText(next);
    if (HEX_COLOR.test(next)) onChange(next);
  }

  return (
    <div>
      <label className="font-body text-xs text-ink-400 dark:text-ink-300 mb-1.5 block">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={HEX_COLOR.test(text) ? text : value}
          onChange={(e) => commitText(e.target.value)}
          className="shrink-0 w-9 h-9 rounded-lg border border-black/10 dark:border-white/10 bg-transparent cursor-pointer p-0.5"
          aria-label={`${label} swatch`}
        />
        <input
          type="text"
          value={text}
          onChange={(e) => commitText(e.target.value)}
          placeholder={defaultValue}
          spellCheck={false}
          className="admin-input flex-1 min-w-0 px-3 py-2 rounded-xl text-sm font-mono lowercase"
          aria-label={`${label} hex value`}
        />
        {value !== defaultValue && (
          <button
            type="button"
            onClick={() => commitText(defaultValue)}
            className="shrink-0 p-2 rounded-lg text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            title="Reset to default"
          >
            <RotateCcw size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

// A room's wall/floor/ceiling *texture* — an image (concrete, wood, ...)
// that MuseumRoom.tsx tiles across the matching surface, overriding its
// plain ColorField above when set. Same "upload or revert" mental model as
// BackgroundUploader.tsx (Settings ▸ Preferences), just a compact chip
// layout rather than that component's full dropzone — three of these
// stacked in a row would be too tall otherwise.
// Cursor-following hover preview — the small 36x36 thumbnail below is too
// small to actually judge a texture by. Same mechanics as ArtworkPicker.tsx's
// showPreview/movePreview/hidePreview (fixed-position, follows the cursor,
// clamped to the viewport, cleared on mouse-leave); duplicated in miniature
// here rather than shared, since ArtworkPicker's version is keyed to a whole
// list of artworks (title + id) where this only ever has the one image.
const TEXTURE_PREVIEW_SIZE = 224;
const TEXTURE_PREVIEW_OFFSET = 20;

export function TextureField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (url: string | null) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<{ x: number; y: number } | null>(null);

  function showPreview(e: React.MouseEvent) {
    setPreview({ x: e.clientX, y: e.clientY });
  }
  function movePreview(e: React.MouseEvent) {
    setPreview((p) => (p ? { x: e.clientX, y: e.clientY } : p));
  }
  function hidePreview() {
    setPreview(null);
  }

  let previewLeft = 0;
  let previewTop = 0;
  if (preview) {
    previewLeft = preview.x + TEXTURE_PREVIEW_OFFSET;
    previewTop = preview.y - TEXTURE_PREVIEW_SIZE / 2;
    if (typeof window !== "undefined") {
      previewLeft = Math.min(previewLeft, window.innerWidth - TEXTURE_PREVIEW_SIZE - 12);
      previewTop = Math.max(12, Math.min(previewTop, window.innerHeight - TEXTURE_PREVIEW_SIZE - 44));
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      onChange(data.url);
    } catch (err) {
      toast.error(getErrorMessage(err, "Upload failed"));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <label className="font-body text-xs text-ink-400 dark:text-ink-300 mb-1.5 block">
        {label}
      </label>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleUpload}
      />
      {value ? (
        <div className="flex items-center gap-2.5 p-1.5 rounded-xl admin-input border">
          <div
            className="relative w-9 h-9 rounded-lg overflow-hidden shrink-0 bg-black/5 dark:bg-white/5 cursor-zoom-in"
            onMouseEnter={showPreview}
            onMouseMove={movePreview}
            onMouseLeave={hidePreview}
          >
            <Image src={value} alt="" fill className="object-cover" sizes="36px" />
          </div>
          <p className="flex-1 min-w-0 font-body text-xs text-ink-400 dark:text-ink-300 truncate">
            Texture applied
          </p>
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="px-2 py-1 rounded-lg font-body text-xs text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/5 dark:hover:bg-white/5 transition-colors shrink-0 disabled:opacity-50"
          >
            {uploading ? "…" : "Change"}
          </button>
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label={`Remove ${label}`}
            className="p-1.5 rounded-lg text-ink-400 hover:text-vermillion hover:bg-vermillion/10 transition-colors shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-black/15 dark:border-white/15 text-ink-400 dark:text-ink-300 hover:border-sepia/50 hover:text-sepia transition-colors font-body text-sm disabled:opacity-60"
        >
          {uploading ? (
            <>
              <div className="w-3.5 h-3.5 border border-ink-300 dark:border-ink-500 border-t-sepia dark:border-t-cream rounded-full animate-spin" />
              Uploading…
            </>
          ) : (
            <>
              <ImagePlus size={14} />
              Upload texture
            </>
          )}
        </button>
      )}

      {/* Floating hover preview — see showPreview/movePreview above. Fixed
          positioning so it floats over the rest of the edit form instead of
          being clipped by this field's own small container. */}
      {preview && value && (
        <div
          className="fixed z-[100] pointer-events-none rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-ink-900 shadow-2xl overflow-hidden"
          style={{ left: previewLeft, top: previewTop, width: TEXTURE_PREVIEW_SIZE }}
        >
          <div className="relative w-full aspect-square bg-black/5 dark:bg-white/5">
            <Image src={value} alt={label} fill className="object-cover" sizes={`${TEXTURE_PREVIEW_SIZE}px`} />
          </div>
          <p className="px-3 py-2 font-body text-xs text-ink dark:text-cream truncate border-t border-black/5 dark:border-white/5">
            {label}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * TextureField's video sibling: the same compact row, for a clip rather than
 * an image. Goes through uploadArtworkVideo, so it gets the site's one video
 * policy for free — MP4/MOV/WebM, anything longer than MAX_VIDEO_DURATION_SEC
 * cropped client-side before upload (which is also what keeps R2 egress for a
 * looping wall clip in check).
 */
export function VideoField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (url: string | null) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [trimmed, setTrimmed] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setTrimmed(null);
    const url = await uploadArtworkVideo(file, (sec) => setTrimmed(sec));
    if (url) onChange(url);
    setUploading(false);
    setTrimmed(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div>
      <label className="font-body text-xs text-ink-400 dark:text-ink-300 mb-1.5 block">{label}</label>
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_VIDEO_TYPES.join(",")}
        className="hidden"
        onChange={handleUpload}
      />
      {value && !uploading ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2.5 p-1.5 rounded-xl admin-input border">
            <div className="relative w-9 h-9 rounded-lg overflow-hidden shrink-0 bg-black">
              <video src={value} muted loop autoPlay playsInline className="h-full w-full object-cover" />
            </div>
            <p className="flex-1 min-w-0 font-body text-xs text-ink-400 dark:text-ink-300 truncate">
              {value.split("/").pop()}
            </p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="px-2 py-1 rounded-lg font-body text-xs text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/5 dark:hover:bg-white/5 transition-colors shrink-0"
            >
              Change
            </button>
            <button
              type="button"
              onClick={() => onChange(null)}
              aria-label={`Remove ${label}`}
              className="p-1.5 rounded-lg text-ink-400 hover:text-vermillion hover:bg-vermillion/10 transition-colors shrink-0"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-black/15 dark:border-white/15 text-ink-400 dark:text-ink-300 hover:border-sepia/50 hover:text-sepia transition-colors font-body text-sm disabled:opacity-60"
        >
          {uploading ? (
            <>
              <div className="w-3.5 h-3.5 border border-ink-300 dark:border-ink-500 border-t-sepia dark:border-t-cream rounded-full animate-spin" />
              {trimmed !== null ? `Cropping… ${Math.round(trimmed)}s` : "Uploading…"}
            </>
          ) : (
            <>
              <Film size={14} />
              Upload video
            </>
          )}
        </button>
      )}
      <p className="mt-1 font-body text-[10px] text-ink-400 dark:text-ink-300">
        MP4, MOV or WebM. Anything longer than {MAX_VIDEO_DURATION_SEC}s is cropped to its first{" "}
        {MAX_VIDEO_DURATION_SEC}s — it loops on the wall.
      </p>
    </div>
  );
}

/**
 * A YouTube link, committed on blur or Enter rather than per keystroke — a
 * half-typed URL is invalid by definition, and saving each character would
 * mean a save (and an error) per character. Anything parseYouTube accepts is
 * fine: watch, youtu.be, shorts, embed, with or without a start time.
 */
export function YoutubeUrlField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (url: string | null) => void;
}) {
  const [draft, setDraft] = useState(value ?? "");
  const [invalid, setInvalid] = useState(false);
  // Follow a change made elsewhere (undo, a reset) without clobbering typing.
  useEffect(() => {
    setDraft(value ?? "");
    setInvalid(false);
  }, [value]);

  const parsed = value ? parseYouTube(value) : null;

  function commit() {
    const next = draft.trim();
    if (next === (value ?? "")) return;
    if (!next) {
      setInvalid(false);
      onChange(null);
      return;
    }
    if (!parseYouTube(next)) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    onChange(next);
  }

  return (
    <div>
      <label className="font-body text-xs text-ink-400 dark:text-ink-300 mb-1.5 block">{label}</label>
      <div className="flex items-center gap-2">
        {parsed?.thumbnailUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={parsed.thumbnailUrl} alt="" className="h-9 w-16 shrink-0 rounded-lg object-cover bg-black" />
        )}
        <input
          type="url"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setInvalid(false);
          }}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
          }}
          placeholder="https://www.youtube.com/watch?v=…"
          className={cn(
            "admin-input w-full rounded-xl border px-3 py-2 font-body text-xs",
            invalid && "border-red-400 dark:border-red-500"
          )}
        />
      </div>
      {invalid && (
        <p className="mt-1 font-body text-[10px] text-red-500 dark:text-red-400">
          That doesn&apos;t look like a YouTube link — paste the video&apos;s page or share URL.
        </p>
      )}
    </div>
  );
}
