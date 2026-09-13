// components/public/ShareButton.tsx
//
// Used both in ArtworkDetailModal.tsx and the dedicated /artwork/[slug]
// page — same button, same behavior, wherever an artwork can be shared
// from. Prefers the native share sheet (navigator.share, mostly mobile);
// falls back to a small platform-picker popover on desktop.
"use client";

import { useEffect, useRef, useState } from "react";
import { Share2, Facebook, Twitter, AtSign, Link2, Check } from "lucide-react";
import { buildShareIntentUrl, type SharePlatform } from "@/lib/share";

const PLATFORM_ICONS: Record<Exclude<SharePlatform, "copy">, typeof Facebook> = {
  facebook: Facebook,
  twitter: Twitter,
  threads: AtSign, // lucide has no dedicated Threads glyph — its logo is an "@"-like knot, this is the closest stand-in.
};

const PLATFORM_LABELS: Record<Exclude<SharePlatform, "copy">, string> = {
  facebook: "Facebook",
  twitter: "X (Twitter)",
  threads: "Threads",
};

export function ShareButton({
  artworkId,
  url,
  title,
  className,
}: {
  artworkId: string;
  url: string;
  title: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  function recordShare() {
    // Fire-and-forget — a failed count bump shouldn't block or error out
    // the actual share the visitor just completed.
    fetch(`/api/artworks/${artworkId}/share`, { method: "POST" }).catch(() => {});
  }

  async function handleShareClick() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, url });
        recordShare();
      } catch {
        // Cancelled the native share sheet — not an error, don't record it.
      }
      return;
    }
    setOpen((o) => !o);
  }

  function handlePlatformClick(platform: Exclude<SharePlatform, "copy">) {
    window.open(
      buildShareIntentUrl(platform, url, title),
      "_blank",
      "noopener,noreferrer,width=600,height=500"
    );
    recordShare();
    setOpen(false);
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      recordShare();
      setTimeout(() => setOpen(false), 900);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard permission denied/unavailable — nothing more to do here.
    }
  }

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={handleShareClick}
        title="Share this artwork"
        aria-label="Share this artwork"
        className={
          className ??
          "inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-black/10 dark:border-white/15 text-ink dark:text-cream hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-sm font-medium"
        }
      >
        <Share2 size={16} />
        Share
      </button>

      {open && (
        <div className="absolute z-20 top-full mt-2 left-0 w-48 rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-[#121212] shadow-2xl overflow-hidden py-1">
          {(Object.keys(PLATFORM_ICONS) as Exclude<SharePlatform, "copy">[]).map((platform) => {
            const Icon = PLATFORM_ICONS[platform];
            return (
              <button
                key={platform}
                type="button"
                onClick={() => handlePlatformClick(platform)}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-ink dark:text-cream hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-left"
              >
                <Icon size={15} />
                {PLATFORM_LABELS[platform]}
              </button>
            );
          })}
          <div className="h-px bg-black/10 dark:bg-white/10 my-1" />
          <button
            type="button"
            onClick={handleCopyLink}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-ink dark:text-cream hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-left"
          >
            {copied ? <Check size={15} className="text-emerald-500" /> : <Link2 size={15} />}
            {copied ? "Copied!" : "Copy Link"}
          </button>
        </div>
      )}
    </div>
  );
}
