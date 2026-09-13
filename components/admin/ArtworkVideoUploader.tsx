// components/admin/ArtworkVideoUploader.tsx
"use client";

import { useRef, useState } from "react";
import { Upload, X, Film, Scissors } from "lucide-react";
import { ALLOWED_VIDEO_TYPES, MAX_VIDEO_DURATION_SEC } from "@/lib/artwork-video";
import { uploadArtworkVideo } from "@/lib/artwork-video-upload";

// Same "click to upload" card pattern as AudioUploader.tsx / BackgroundUploader.tsx
// / LogoUploader.tsx, adapted for the optional artwork timelapse video —
// native <video controls> preview, plus a client-side auto-crop step for
// anything over MAX_VIDEO_DURATION_SEC before the file ever reaches the server.
export function ArtworkVideoUploader({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [trimProgress, setTrimProgress] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setTrimProgress(null);
    const url = await uploadArtworkVideo(file, (elapsed) => setTrimProgress(elapsed));
    if (url) onChange(url);
    setUploading(false);
    setTrimProgress(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">
        Timelapse Video (optional)
      </label>
      <p className="font-body text-xs text-ink-400 dark:text-ink-300 mb-3">
        MP4, MOV, or WebM — max {MAX_VIDEO_DURATION_SEC}s. Longer clips are automatically
        cropped to the first {MAX_VIDEO_DURATION_SEC} seconds. Shown on the artwork&apos;s
        gallery card and detail view.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_VIDEO_TYPES.join(",")}
        className="hidden"
        onChange={handleSelect}
      />

      {value && !uploading ? (
        <div className="rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 p-4 space-y-3">
          <div className="flex items-center gap-2 font-body text-xs text-ink-400 dark:text-ink-300">
            <Film size={14} className="text-sepia shrink-0" />
            <span className="truncate">{value.split("/").pop()}</span>
          </div>
          <video src={value} controls loop playsInline className="w-full rounded-lg max-h-64 bg-black" />
          <div className="flex items-center gap-4 pt-1">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="font-body text-xs text-sepia hover:text-sepia-dark transition-colors"
            >
              Replace video
            </button>
            <button
              type="button"
              onClick={() => onChange("")}
              className="flex items-center gap-1.5 font-body text-xs text-ink-400 dark:text-ink-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
            >
              <X size={13} />
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="w-full group relative flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-ink-200 dark:border-ink-600 bg-ink-50 dark:bg-ink-800 px-4 py-7 sm:py-10 overflow-hidden transition-colors hover:border-sepia dark:hover:border-cream hover:bg-ink-100 dark:hover:bg-ink-700 disabled:pointer-events-none disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sepia"
        >
          <div className="relative z-10 flex flex-col items-center gap-3">
            {uploading ? (
              <>
                {trimProgress !== null ? (
                  <>
                    <Scissors size={22} className="text-sepia animate-pulse" />
                    <span className="font-body text-sm text-ink-500 dark:text-ink-300">
                      Trimming video… {trimProgress} / {MAX_VIDEO_DURATION_SEC}s
                    </span>
                    <div className="w-40 h-1.5 rounded-full bg-ink-200 dark:bg-ink-600 overflow-hidden">
                      <div
                        className="h-full bg-sepia transition-all duration-300"
                        style={{ width: `${(trimProgress / MAX_VIDEO_DURATION_SEC) * 100}%` }}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-8 h-8 border-2 border-ink-300 dark:border-ink-500 border-t-sepia dark:border-t-cream rounded-full animate-spin" />
                    <span className="font-body text-sm text-ink-500 dark:text-ink-300">
                      Uploading…
                    </span>
                  </>
                )}
              </>
            ) : (
              <>
                <div className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-ink-100 dark:bg-ink-700 group-hover:bg-ink-200 dark:group-hover:bg-ink-600 transition-colors">
                  <Upload
                    size={20}
                    className="text-ink-400 dark:text-ink-300 group-hover:text-sepia dark:group-hover:text-cream transition-colors sm:w-[22px] sm:h-[22px]"
                  />
                </div>
                <div className="text-center">
                  <p className="font-body text-sm font-medium text-ink-600 dark:text-ink-200">
                    Click to upload
                  </p>
                  <p className="font-body text-xs text-ink-400 dark:text-ink-400 mt-0.5">
                    MP4, MOV or WebM — max {MAX_VIDEO_DURATION_SEC}s (auto-cropped if longer)
                  </p>
                </div>
              </>
            )}
          </div>
        </button>
      )}
    </div>
  );
}
