"use client";

// components/admin/BackupJobProvider.tsx
//
// Owns the two long-running Backup & Restore jobs, and outlives the page that
// starts them.
//
// They used to live inside BackupClient.tsx, which meant navigating anywhere
// else in the admin panel unmounted the component mid-run: the promises kept
// going, but their setState calls landed on a dead component, so the progress
// vanished and an export finished into nothing. Hoisting them into a provider
// mounted in app/(admin)/layout.tsx — above the route being rendered — means a
// route change no longer touches them. The admin can start a restore, go read
// their notifications, and come back to a finished job.
//
// Both jobs genuinely run in the browser rather than on the server (see
// lib/backup/zip.ts for why), so "keep it mounted" is the whole mechanism.
// There is no server-side job to reconnect to: close the tab and the work is
// gone, which is what the beforeunload guard below is for.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import toast from "@/lib/toast";
import { makeZip, MEDIA_DIR, MEDIA_INDEX, DATA_FILE } from "@/lib/backup/zip";
import { collectMediaUrls, type BackupFile } from "@/lib/backup/groups";
import { useLeaveBlocker } from "@/components/admin/AdminLeaveGuard";

/** How many files to fetch (or re-upload) at once. High enough to saturate a
 *  normal connection, low enough not to have a thousand sockets open at a
 *  gallery site's worth of photos. */
const CONCURRENCY = 6;

/** Runs `worker` over `items`, CONCURRENCY at a time, reporting after each. */
async function pooled<T>(
  items: T[],
  worker: (item: T) => Promise<void>,
  onProgress: (done: number) => void
) {
  let index = 0;
  let done = 0;
  const runners = Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (index < items.length) {
      const item = items[index++];
      try {
        await worker(item);
      } catch {
        // A single unreachable file must not abandon the whole backup — the
        // summary counts what actually made it.
      }
      onProgress(++done);
    }
  });
  await Promise.all(runners);
}

/**
 * The name a downloaded file gets inside the archive.
 *
 * Its own storage filename, not a serial number. Uploads already arrive
 * uniquely named (`1786970368313-ywr9nd.jpg`), so the collisions that numbering
 * was avoiding are rare in practice — and the cost was an archive nobody could
 * read. Opening `media/` and seeing the same names as the storage bucket is the
 * difference between a backup you can spot-check by eye and an opaque blob you
 * have to trust.
 *
 * Restoring never depended on these names: `media/index.json` maps each entry
 * back to the URL its rows reference, so this is purely what a human sees.
 *
 * Collisions are still handled, just after the fact — `-2`, `-3` — and matched
 * case-insensitively, because Windows and macOS extract that way and two
 * entries differing only in case would silently overwrite each other.
 */
function mediaEntryName(url: string, used: Set<string>): string {
  const last = url.split("?")[0].split("/").pop() ?? "";
  let raw = last;
  try {
    raw = decodeURIComponent(last);
  } catch {
    // A malformed escape sequence is not worth failing an export over.
  }

  // Anything outside this set becomes "_": no slashes (so an entry can never
  // climb out of media/), no characters Windows refuses, no leading dots that
  // would hide the file on extraction.
  const cleaned = raw
    .replace(/[^A-Za-z0-9._-]/g, "_")
    .replace(/^\.+/, "")
    .slice(-120);
  const safe = cleaned || "file.bin";

  const dot = safe.lastIndexOf(".");
  const stem = dot > 0 ? safe.slice(0, dot) : safe;
  const ext = dot > 0 ? safe.slice(dot) : "";

  let name = safe;
  let n = 2;
  while (used.has(name.toLowerCase())) name = `${stem}-${n++}${ext}`;
  used.add(name.toLowerCase());
  return name;
}

/** Rewrites every stored media URL to wherever the file was just re-uploaded.
 *  A blind walk of the rows rather than a list of image columns, for the same
 *  reason collectMediaUrls is: any string field can hold one. */
function remapMediaUrls(
  data: Record<string, unknown[]>,
  remap: Map<string, string>
): Record<string, unknown[]> {
  const walk = (node: unknown): unknown => {
    if (typeof node === "string") return remap.get(node) ?? node;
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === "object") {
      return Object.fromEntries(
        Object.entries(node as Record<string, unknown>).map(([k, v]) => [k, walk(v)])
      );
    }
    return node;
  };
  return walk(data) as Record<string, unknown[]>;
}

export interface ImportReport {
  restored: Record<string, number>;
  skipped: { model: string; id: string; reason: string }[];
}

export interface BackupJob {
  /** Which half is running. Drives the progress card's wording and colour —
   *  losing an export costs a download, losing a restore leaves the database
   *  part-written, and the card says so. */
  kind: "export" | "restore";
  /** The current phase, e.g. "Downloading files…". Display text; never
   *  branched on. */
  label: string;
  /** Null during phases with nothing to count (the initial database read, the
   *  final zip), which the card renders as an indeterminate bar. */
  progress: { done: number; total: number } | null;
}

interface StartExportOptions {
  groups: string[];
  includeMedia: boolean;
  storageOrigin: string;
}

interface StartRestoreOptions {
  groups: string[];
  data: Record<string, unknown[]>;
  media: Map<string, Uint8Array>;
  restoreMedia: boolean;
}

interface BackupJobContextValue {
  job: BackupJob | null;
  /** The last restore's outcome, kept after the job ends so the Backup page
   *  can still show it when the admin navigates back to it. */
  report: ImportReport | null;
  clearReport: () => void;
  startExport: (options: StartExportOptions) => void;
  startRestore: (options: StartRestoreOptions) => void;
}

const BackupJobContext = createContext<BackupJobContextValue | null>(null);

export function useBackupJob(): BackupJobContextValue {
  const ctx = useContext(BackupJobContext);
  if (!ctx) throw new Error("useBackupJob must be used inside BackupJobProvider");
  return ctx;
}

export function BackupJobProvider({ children }: { children: React.ReactNode }) {
  const [job, setJob] = useState<BackupJob | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  // Read by the start functions to refuse a second job, without making them
  // depend on `job` — a stale closure there would let two runs overlap.
  const running = useRef(false);

  const clearReport = useCallback(() => setReport(null), []);

  // Signing out is worse here than a plain interruption: it invalidates the
  // session these requests authenticate with, so a restore would start
  // collecting 401s partway through writing rows. The browser can't warn about
  // it — Sign Out never unloads the page — so this does.
  //
  // No `onNavigate`: switching modules is explicitly fine here. The job lives
  // in this provider, above the router, so a route change doesn't touch it —
  // asking about that would be a warning about nothing.
  useLeaveBlocker({
    onSignOut: job
      ? job.kind === "restore"
        ? "A restore is still running. Signing out now stops it partway through writing, leaving some rows restored and others not.\n\nSign out anyway?"
        : "A backup is still being prepared. Signing out now cancels it and you won't get the file.\n\nSign out anyway?"
      : null,
  });

  // Block a close/reload while a job is running. This is the one interruption
  // that actually loses work now: an in-app route change no longer does,
  // since this provider is mounted above the router's children.
  //
  // The browser shows its own generic dialog and ignores any message set here
  // — custom wording has been unavailable since Chrome 51 — which is why the
  // consequence is spelled out in BackupJobCard instead. Same idiom as
  // MuseumEditorClient.tsx's unsaved-changes guard.
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!job) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [job]);

  const startExport = useCallback(
    ({ groups, includeMedia, storageOrigin }: StartExportOptions) => {
      if (running.current) return;
      running.current = true;
      setJob({ kind: "export", label: "Reading the database…", progress: null });

      void (async () => {
        try {
          const res = await fetch("/api/backup/export", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ groups }),
          });
          const payload = (await res.json()) as BackupFile & { error?: string };
          if (!res.ok) throw new Error(payload.error || "Export failed");

          const entries: { name: string; bytes: Uint8Array }[] = [];
          const index: Record<string, string> = {};

          if (includeMedia) {
            // Blind walk of the rows for anything pointing at our own storage
            // — see collectMediaUrls on why this isn't a list of image columns.
            const urls = collectMediaUrls(payload.data, [storageOrigin]);
            setJob({
              kind: "export",
              label: "Downloading files…",
              progress: { done: 0, total: urls.length },
            });
            // Shared across the pool so two files that sanitise to the same
            // name still get distinct entries. Writes happen from several
            // concurrent workers, but JS is single-threaded between awaits and
            // mediaEntryName has none, so the check-then-add can't interleave.
            const usedNames = new Set<string>();
            await pooled(
              urls,
              async (url) => {
                const fileRes = await fetch(url);
                if (!fileRes.ok) throw new Error("unreachable");
                const bytes = new Uint8Array(await fileRes.arrayBuffer());
                const name = `${MEDIA_DIR}${mediaEntryName(url, usedNames)}`;
                index[name] = url;
                entries.push({ name, bytes });
              },
              (done) =>
                setJob({
                  kind: "export",
                  label: "Downloading files…",
                  progress: { done, total: urls.length },
                })
            );
            entries.push({
              name: MEDIA_INDEX,
              bytes: new TextEncoder().encode(JSON.stringify(index, null, 2)),
            });
            payload.manifest.includesMedia = true;
          }

          setJob({ kind: "export", label: "Building the archive…", progress: null });
          entries.unshift({
            name: DATA_FILE,
            bytes: new TextEncoder().encode(JSON.stringify(payload, null, 2)),
          });

          const blob = makeZip(entries);
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `scriptovernovel-backup-${new Date().toISOString().slice(0, 10)}.zip`;
          a.click();
          URL.revokeObjectURL(url);

          const totalRows = Object.values(payload.manifest.counts).reduce((n, c) => n + c, 0);
          toast.success(
            `Backed up ${totalRows.toLocaleString()} rows${
              includeMedia ? ` and ${Object.keys(index).length} files` : ""
            }`
          );
        } catch (err: unknown) {
          toast.error(err instanceof Error ? err.message : "Export failed");
        } finally {
          running.current = false;
          setJob(null);
        }
      })();
    },
    []
  );

  const startRestore = useCallback(
    ({ groups, data: archiveData, media, restoreMedia }: StartRestoreOptions) => {
      if (running.current) return;
      running.current = true;
      setJob({ kind: "restore", label: "Restoring…", progress: null });
      setReport(null);

      void (async () => {
        try {
          let data = archiveData;

          if (restoreMedia && media.size > 0) {
            // Each file goes back into storage as a *new* object, so every row
            // that referenced the old URL has to be rewritten to the new one
            // before it is written — otherwise a restore into a fresh bucket
            // would put back rows pointing at files that no longer exist.
            const urls = [...media.keys()];
            setJob({
              kind: "restore",
              label: "Uploading files…",
              progress: { done: 0, total: urls.length },
            });
            const remap = new Map<string, string>();
            await pooled(
              urls,
              async (originalUrl) => {
                const bytes = media.get(originalUrl)!;
                const name = originalUrl.split("?")[0].split("/").pop() || "file.bin";
                const form = new FormData();
                form.append("file", new File([new Uint8Array(bytes)], name));
                const res = await fetch("/api/backup/media", { method: "POST", body: form });
                if (!res.ok) throw new Error("upload failed");
                const { url } = await res.json();
                remap.set(originalUrl, url);
              },
              (done) =>
                setJob({
                  kind: "restore",
                  label: "Uploading files…",
                  progress: { done, total: urls.length },
                })
            );
            data = remapMediaUrls(data, remap);
            setJob({ kind: "restore", label: "Restoring…", progress: null });
          }

          const res = await fetch("/api/backup/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ groups, data }),
          });
          const result = (await res.json()) as ImportReport & { error?: string };
          if (!res.ok) throw new Error(result.error || "Restore failed");

          setReport(result);
          const total = Object.values(result.restored).reduce((n, c) => n + c, 0);
          toast.success(`Restored ${total.toLocaleString()} rows`);
        } catch (err: unknown) {
          toast.error(err instanceof Error ? err.message : "Restore failed");
        } finally {
          running.current = false;
          setJob(null);
        }
      })();
    },
    []
  );

  const value = useMemo(
    () => ({ job, report, clearReport, startExport, startRestore }),
    [job, report, clearReport, startExport, startRestore]
  );

  return <BackupJobContext.Provider value={value}>{children}</BackupJobContext.Provider>;
}
