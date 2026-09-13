// app/(admin)/admin/settings/Preferences/LogoUploader.tsx
"use client";

import { useRef, useState } from "react";
import Image from "@/components/ui/SafeImage";
import { Upload, X } from "lucide-react";
import toast from "@/lib/toast";
import { getErrorMessage } from "@/lib/utils";

// Extracted from the old "Navbar Logo" block in AboutClient.tsx — replaces
// the default logo in the Navbar and Admin Sidebar (see Profile.logoImage).
export function LogoUploader({
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
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      onChange(data.url);
      toast.success("Logo uploaded");
    } catch (err) {
      toast.error(getErrorMessage(err, "Upload failed"));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <label className="label">Navbar Logo</label>
      <p className="font-body text-xs text-ink-400 dark:text-ink-300 mb-3">
        Replaces the default logo in the Navbar, Admin Sidebar, Email Layout
        Header.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
        className="hidden"
        onChange={handleUpload}
      />
      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className="w-full group relative flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-ink-200 dark:border-ink-600 bg-ink-50 dark:bg-ink-800 px-4 py-5 sm:py-6 overflow-hidden transition-colors hover:border-sepia dark:hover:border-cream hover:bg-ink-100 dark:hover:bg-ink-700 disabled:pointer-events-none disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sepia"
      >
        <div className="relative z-10 flex flex-col items-center gap-3">
          {uploading ? (
            <>
              <div className="w-8 h-8 border-2 border-ink-300 dark:border-ink-500 border-t-sepia dark:border-t-cream rounded-full animate-spin" />
              <span className="font-body text-sm text-ink-500 dark:text-ink-300">
                Uploading…
              </span>
            </>
          ) : value ? (
            <>
              <Image
                src={value}
                alt="Current logo"
                width={160}
                height={48}
                className="object-contain max-h-12 sm:max-h-14"
              />
              <span className="font-body text-xs text-ink-600 dark:text-ink-200 group-hover:text-sepia dark:group-hover:text-cream transition-colors text-center">
                Click to replace logo
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
                  PNG, SVG, WebP or GIF — max 10 MB
                </p>
              </div>
            </>
          )}
        </div>
      </button>
      {value && !uploading && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="mt-2 flex items-center gap-1.5 font-body text-xs text-ink-400 dark:text-ink-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
        >
          <X size={13} />
          Revert to default logo
        </button>
      )}
    </div>
  );
}
