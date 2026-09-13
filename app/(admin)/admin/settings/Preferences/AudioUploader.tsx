// app/(admin)/admin/settings/Preferences/AudioUploader.tsx
"use client";

import { useRef, useState } from "react";
import { Upload, X, Music } from "lucide-react";
import toast from "@/lib/toast";
import { ALLOWED_AUDIO_TYPES, MAX_AUDIO_FILE_SIZE, MAX_AUDIO_FILE_SIZE_MB } from "@/lib/background-music";
import { getErrorMessage } from "@/lib/utils";
import { uploadAudioViaSignedUrl } from "@/lib/supabase/browser-storage";

// Same drag-free "click to upload" card pattern as BackgroundUploader.tsx /
// LogoUploader.tsx, adapted for audio — a native <audio controls> preview
// instead of an <Image>.
export function AudioUploader({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side gate — catches oversized files before any network round-trip.
    if (file.size > MAX_AUDIO_FILE_SIZE) {
      toast.error(`File too large — max ${MAX_AUDIO_FILE_SIZE_MB} MB`);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setUploading(true);
    try {
      // Two-step signed-URL upload (same as the 3D model uploader):
      //   1. Ask the server to mint a signed Supabase upload URL.
      //   2. Upload the file directly from the browser to Supabase.
      // This bypasses the ~4.5MB Vercel serverless function body cap that
      // the old single-POST approach hit for files larger than ~4 MB.
      const signRes = await fetch("/api/upload/audio/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, mimeType: file.type }),
      });
      const signData = await signRes.json().catch(() => ({})) as { path?: string; token?: string; publicUrl?: string; error?: string };
      if (!signRes.ok) throw new Error(signData.error || "Failed to prepare upload");

      await uploadAudioViaSignedUrl(file, signData.path!, signData.token!);
      onChange(signData.publicUrl!);
      toast.success("Track uploaded");
    } catch (err) {
      toast.error(getErrorMessage(err, "Upload failed"));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <label className="label">Music File</label>
      <p className="font-body text-xs text-ink-400 dark:text-ink-300 mb-3">
        The track that plays on loop when a visitor turns music on.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_AUDIO_TYPES.join(",")}
        className="hidden"
        onChange={handleUpload}
      />

      {value && !uploading ? (
        <div className="rounded-xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 p-4 space-y-3">
          <div className="flex items-center gap-2 font-body text-xs text-ink-400 dark:text-ink-300">
            <Music size={14} className="text-sepia shrink-0" />
            <span className="truncate">{value.split("/").pop()}</span>
          </div>
          <audio src={value} controls className="w-full h-10" />
          <div className="flex items-center gap-4 pt-1">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="font-body text-xs text-sepia hover:text-sepia-dark transition-colors"
            >
              Replace track
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
                <div className="w-8 h-8 border-2 border-ink-300 dark:border-ink-500 border-t-sepia dark:border-t-cream rounded-full animate-spin" />
                <span className="font-body text-sm text-ink-500 dark:text-ink-300">
                  Uploading…
                </span>
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
                    MP3, WAV, OGG, AAC or M4A — max {MAX_AUDIO_FILE_SIZE_MB} MB
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
