"use client";

// components/admin/BackupJobCard.tsx
//
// The floating progress card for a running backup or restore — bottom-right,
// over every admin screen, the way a file manager shows an upload.
//
// It exists because the job no longer belongs to the page that started it (see
// BackupJobProvider): an admin can leave Settings → Backup & Restore mid-run,
// and without this there would be nothing anywhere on screen saying the site
// is still busy writing to itself.
//
// Renders nothing at all when idle — no placeholder, no empty shell — so it
// costs nothing on the screens where no backup is running, which is all of
// them nearly all of the time.
import { Loader2, Archive, Upload } from "lucide-react";
import { useBackupJob } from "./BackupJobProvider";

export function BackupJobCard() {
  const { job } = useBackupJob();
  if (!job) return null;

  const restoring = job.kind === "restore";
  // Null during the phases with nothing countable — the initial database read,
  // the final zip — which render as an indeterminate sweep rather than a
  // frozen "0%" that looks stalled.
  const pct = job.progress
    ? Math.round((job.progress.done / Math.max(1, job.progress.total)) * 100)
    : null;

  return (
    <div
      role="status"
      aria-live="polite"
      // Sits above the sidebar and the back-to-top button, below toasts —
      // a toast is a couple of seconds and this can run for minutes, so the
      // transient thing wins the overlap.
      className="fixed z-40 bottom-4 right-4 md:bottom-6 md:right-6 w-[min(20rem,calc(100vw-2rem))]"
    >
      <div
        className={`admin-card border rounded-2xl backdrop-blur-md shadow-lg p-4 space-y-3 ${
          restoring ? "border-red-500/40" : "border-sepia/40"
        }`}
      >
        <div className="flex items-center gap-2.5">
          <span
            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
              restoring ? "bg-red-500/10 text-red-500" : "bg-sepia/10 text-sepia"
            }`}
          >
            {restoring ? <Upload size={15} /> : <Archive size={15} />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-jakarta text-sm font-semibold text-ink dark:text-cream truncate">
              {restoring ? "Restoring backup" : "Preparing backup"}
            </p>
            <p className="font-body text-[11px] text-ink-400 dark:text-ink-300 truncate">
              {job.label}
              {job.progress && ` ${job.progress.done} / ${job.progress.total}`}
            </p>
          </div>
          {pct === null ? (
            <Loader2
              size={15}
              className={`shrink-0 animate-spin ${restoring ? "text-red-500" : "text-sepia"}`}
            />
          ) : (
            <span className="font-jakarta text-sm font-semibold tabular-nums shrink-0 text-ink dark:text-cream">
              {pct}%
            </span>
          )}
        </div>

        <div className="h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
          {pct === null ? (
            // No total to divide by yet. A sweeping sliver reads as "working"
            // where a 0%-wide bar reads as "stuck".
            <div
              className={`h-full w-1/3 rounded-full animate-shimmer ${
                restoring ? "bg-red-500/60" : "bg-sepia/60"
              }`}
            />
          ) : (
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                restoring ? "bg-red-500" : "bg-sepia"
              }`}
              style={{ width: `${pct}%` }}
            />
          )}
        </div>

        <p className="font-body text-[11px] leading-relaxed text-ink-400 dark:text-ink-300">
          {restoring ? (
            <>
              Keep this tab open — rows are being written now. You can carry on
              using the admin panel; only closing or reloading stops it.
            </>
          ) : (
            <>
              Keep this tab open — the archive is built here, not on the server.
              You can carry on using the admin panel meanwhile.
            </>
          )}
        </p>
      </div>
    </div>
  );
}
