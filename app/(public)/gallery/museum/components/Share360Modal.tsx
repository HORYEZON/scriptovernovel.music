"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Download, Link2, Share2, X } from "lucide-react";
import toast from "@/lib/toast";
import { useFocusTrap } from "@/components/public/minigames/hooks";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";
import {
  canShareFile,
  downloadPanorama,
  shareViaSheet,
  type Panorama360Result,
} from "@/lib/museum/panorama360";

interface Share360ModalProps {
  result: Panorama360Result;
  roomName: string;
  /** The room's `?room=` deep link — copied alongside the photo so the
   *  caption can point people back into the museum. */
  shareUrl: string;
  onClose: () => void;
  /**
   * "museum": `absolute` against MuseumClient's root, for the same reason
   * ExitConfirmModal.tsx is — that root is rotated under forced landscape
   * and becomes the containing block anyway. Body scroll is already
   * pinned there.
   * "admin": a normal `fixed` overlay over the scrolling editor page, which
   * therefore also locks body scroll while open.
   */
  variant: "museum" | "admin";
}

/**
 * Hands a freshly rendered 360° photo to the visitor (or admin). Three
 * ways out, in order of how close each gets to "it's on Facebook":
 *
 *   Share…    — the OS share sheet, with the JPEG as a file. The Facebook
 *               app takes a photo this way and keeps its XMP, so the post
 *               is a real draggable 360°. Only offered where the browser
 *               can share files at all (phones; some desktops).
 *   Download  — the same JPEG, saved. Uploading it as a *photo* on Facebook
 *               (not attaching it to a link) gives the same 360° post; the
 *               note under the preview says so, because nothing about a
 *               .jpg tells anyone it's special.
 *   Copy link — the room's deep link, for the caption.
 *
 * The preview is the raw equirectangular strip. It looks stretched — that
 * is what a 360° looks like flat, and showing it honestly beats a fake
 * viewer that would then have to be built and kept in step with Facebook's.
 *
 * Sized for the shortest box it is ever drawn into — a phone under the
 * museum's forced landscape, where the height available is the phone's
 * *width* (~390px) while Tailwind's `sm:` still measures the unrotated
 * viewport and so never applies there (ExitConfirmModal.tsx has the same
 * note). Hence: the preview capped to a share of the viewport height, the
 * buttons always in one row and never stacked, and one-word labels.
 */
export function Share360Modal({ result, roomName, shareUrl, onClose, variant }: Share360ModalProps) {
  const containerRef = useFocusTrap(true);
  useLockBodyScroll(variant === "admin");
  const [sharing, setSharing] = useState(false);
  const shareable = useMemo(() => canShareFile(result.blob, result.fileName), [result]);

  // The object URL is the modal's to release — nothing else holds it once
  // this closes, and a 4096×2048 JPEG is several MB of memory per capture.
  useEffect(() => () => URL.revokeObjectURL(result.previewUrl), [result.previewUrl]);

  const share = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const outcome = await shareViaSheet(
        result,
        `${roomName} — ScriptOverNovel Digital Museum`,
        `Step inside ${roomName} in 360°: ${shareUrl}`
      );
      if (outcome === "shared") {
        toast.success("Shared");
        onClose();
      }
    } catch {
      toast.error("Couldn't open the share sheet — download the photo instead");
    } finally {
      setSharing(false);
    }
  };

  const download = () => {
    downloadPanorama(result);
    toast.success("360° photo saved — upload it to Facebook as a photo");
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Room link copied");
    } catch {
      toast.error("Couldn't copy — the link is " + shareUrl);
    }
  };

  const overlayPosition = variant === "admin" ? "fixed" : "absolute";

  return (
    <motion.div
      className={`${overlayPosition} inset-0 z-[95] bg-ink/90 backdrop-blur-sm flex items-center justify-center overflow-hidden p-3 sm:p-4 pointer-events-auto`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={onClose}
      // Same key discipline as ExitConfirmModal.tsx — PlayerControls listens
      // on `window`, so anything not stopped here walks the visitor around
      // behind the dialog.
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Escape") onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="museum-share360-title"
    >
      <motion.div
        ref={containerRef}
        className="w-full max-w-lg max-h-full overflow-y-auto rounded-2xl border border-white/10 bg-black/80 backdrop-blur-md shadow-2xl p-4 sm:p-5"
        initial={{ opacity: 0, y: 8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2
              id="museum-share360-title"
              className="font-grotesk text-base font-semibold tracking-widest uppercase text-cream"
            >
              Share in 360°
            </h2>
            <p className="font-body text-sm text-sepia/90 mt-0.5 truncate">{roomName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 -mr-1 -mt-1 p-1.5 rounded-lg text-white/50 hover:text-cream hover:bg-white/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sepia"
          >
            <X size={16} />
          </button>
        </div>

        {/* eslint-disable-next-line @next/next/no-img-element -- blob: URL, not a remote asset */}
        <img
          src={result.previewUrl}
          alt={`${roomName}, as a flat 360° panorama`}
          width={result.width}
          height={result.height}
          className="mt-3 w-full h-auto max-h-[38vh] object-contain rounded-lg border border-white/10 bg-ink"
        />
        <p className="font-body text-xs text-white/45 mt-2 leading-snug">
          Looks stretched here — that&apos;s a 360° laid flat. Post it on Facebook as a{" "}
          <span className="text-white/70">photo</span> and it becomes a drag-to-look-around post.
        </p>

        <div className="flex flex-row gap-2 mt-3">
          {shareable && (
            <button
              type="button"
              onClick={share}
              disabled={sharing}
              autoFocus
              className="flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 px-2 sm:px-4 py-2.5 rounded-lg bg-sepia text-ink font-body text-sm font-medium whitespace-nowrap hover:bg-sepia-light disabled:opacity-60 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sepia focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              <Share2 size={14} className="shrink-0" />
              {sharing ? "Opening…" : "Share…"}
            </button>
          )}
          <button
            type="button"
            onClick={download}
            autoFocus={!shareable}
            title="Download the 360° photo"
            className={`flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 px-2 sm:px-4 py-2.5 rounded-lg font-body text-sm whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sepia focus-visible:ring-offset-2 focus-visible:ring-offset-black ${
              shareable
                ? "border border-white/15 text-white/70 hover:text-cream hover:border-white/30"
                : "bg-sepia text-ink font-medium hover:bg-sepia-light"
            }`}
          >
            <Download size={14} className="shrink-0" />
            Download
          </button>
          <button
            type="button"
            onClick={copyLink}
            title="Copy the link to this room"
            className="flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 px-2 sm:px-4 py-2.5 rounded-lg border border-white/15 text-white/70 font-body text-sm whitespace-nowrap hover:text-cream hover:border-white/30 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sepia"
          >
            <Link2 size={14} className="shrink-0" />
            Copy link
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
