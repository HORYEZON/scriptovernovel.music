"use client";

// app/(admin)/admin/settings/backup/BackupClient.tsx
//
// Export and restore the whole site, as one .zip.
//
// The archive is `backup.json` — every row of the groups an admin ticked — plus
// an optional `media/` folder holding the actual uploaded files. Both halves
// are assembled here in the browser rather than by a serverless function, for
// the reason lib/backup/zip.ts explains: the media half can run to hundreds of
// megabytes, which is the wrong thing to stream through a function that has a
// memory ceiling and a timeout. Here it is just fetches from the storage CDN,
// with a progress line while they run.
//
// Restore upserts by id and never deletes (see the import route). So it adds
// back what's missing and overwrites what's there, and leaves anything created
// since the backup alone — the one behaviour that can't lose work.
//
// This file is only the *form*: which groups are ticked, and reading a chosen
// archive so its contents can be listed. The two long-running jobs live in
// components/admin/BackupJobProvider.tsx, mounted in the admin layout, so they
// survive the admin navigating to another module mid-run — progress follows
// them there as a floating card (BackupJobCard).
import { useCallback, useMemo, useRef, useState } from "react";
import { Download, Upload, Archive, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import toast from "@/lib/toast";
import { readZip, MEDIA_INDEX, DATA_FILE } from "@/lib/backup/zip";
import { BACKUP_GROUPS, type BackupFile } from "@/lib/backup/groups";
import { useBackupJob } from "@/components/admin/BackupJobProvider";

export function BackupClient({ storageOrigin }: { storageOrigin: string }) {
  const [selected, setSelected] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(BACKUP_GROUPS.map((g) => [g.id, g.defaultOn]))
  );
  const [includeMedia, setIncludeMedia] = useState(true);

  // The running job and its outcome are the provider's, not this page's — see
  // the file header. `job` here is only used to disable the buttons; the
  // progress itself is drawn by BackupJobCard, which is visible from every
  // admin screen rather than just this one.
  const { job, report, clearReport, startExport, startRestore } = useBackupJob();

  // Reading a chosen .zip stays local: it is fast, it touches nothing, and it
  // only makes sense on this page — there is nothing to follow the admin
  // around for.
  const [opening, setOpening] = useState(false);

  // Restore side
  const [archive, setArchive] = useState<{
    file: BackupFile;
    media: Map<string, Uint8Array>;
    name: string;
  } | null>(null);
  const [restoreGroups, setRestoreGroups] = useState<Record<string, boolean>>({});
  const [restoreMedia, setRestoreMedia] = useState(true);
  const fileInput = useRef<HTMLInputElement>(null);

  const chosenIds = useMemo(
    () => BACKUP_GROUPS.filter((g) => selected[g.id]).map((g) => g.id),
    [selected]
  );

  // ── Export ─────────────────────────────────────────────────────────────
  // Hands the job to the provider and returns immediately. Everything after
  // this point — the database read, fetching each file, zipping, the download
  // — happens above the router, so leaving this page doesn't stop it.
  const runExport = useCallback(() => {
    if (chosenIds.length === 0) {
      toast.error("Tick at least one thing to back up");
      return;
    }
    startExport({ groups: chosenIds, includeMedia, storageOrigin });
  }, [chosenIds, includeMedia, storageOrigin, startExport]);

  // ── Restore ────────────────────────────────────────────────────────────
  const openArchive = useCallback(async (file: File) => {
    setOpening(true);
    clearReport();
    try {
      const entries = await readZip(file);
      const dataEntry = entries.find((e) => e.name === DATA_FILE);
      if (!dataEntry) throw new Error(`That archive has no ${DATA_FILE} in it.`);
      const parsed = JSON.parse(new TextDecoder().decode(dataEntry.bytes)) as BackupFile;
      if (!parsed?.manifest || !parsed?.data) throw new Error("That backup file is malformed.");

      const indexEntry = entries.find((e) => e.name === MEDIA_INDEX);
      const media = new Map<string, Uint8Array>();
      if (indexEntry) {
        const index = JSON.parse(new TextDecoder().decode(indexEntry.bytes)) as Record<
          string,
          string
        >;
        for (const entry of entries) {
          const originalUrl = index[entry.name];
          if (originalUrl) media.set(originalUrl, entry.bytes);
        }
      }

      setArchive({ file: parsed, media, name: file.name });
      // Everything the archive actually has, ticked — an admin who wanted a
      // subset ticked it at export time; making them tick it twice is a
      // second chance to get it wrong.
      setRestoreGroups(Object.fromEntries(parsed.manifest.groups.map((g) => [g, true])));
      setRestoreMedia(media.size > 0);
    } catch (err: unknown) {
      setArchive(null);
      toast.error(err instanceof Error ? err.message : "Couldn't read that archive");
    } finally {
      setOpening(false);
    }
  }, [clearReport]);

  // Same hand-off as the export: validate here, then let the provider run it
  // so the admin isn't pinned to this page while rows are being written.
  const runRestore = useCallback(() => {
    if (!archive) return;
    const groups = Object.keys(restoreGroups).filter((id) => restoreGroups[id]);
    if (groups.length === 0) {
      toast.error("Tick at least one thing to restore");
      return;
    }
    startRestore({
      groups,
      data: archive.file.data,
      media: archive.media,
      restoreMedia,
    });
  }, [archive, restoreGroups, restoreMedia, startRestore]);

  const archivedGroups = archive
    ? BACKUP_GROUPS.filter((g) => archive.file.manifest.groups.includes(g.id))
    : [];

  return (
    <div className="space-y-5">

      {/* ── Export ──────────────────────────────────────────────────────── */}
      <div className="admin-card border rounded-2xl backdrop-blur-md shadow-sm p-4 sm:p-6 space-y-5">
        <div className="border-b border-black/10 dark:border-white/10 pb-4">
          <p className="font-body text-xs tracking-widest uppercase text-ink-400 dark:text-ink-300">
            Export a backup
          </p>
          <p className="font-body text-xs text-ink-400 dark:text-ink-300 mt-1">
            Downloads one .zip holding every row of whatever you tick, and
            optionally every uploaded file those rows point at. Nothing on the
            site changes — this only reads.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {BACKUP_GROUPS.map((group) => (
            <label
              key={group.id}
              className="flex gap-3 p-3 rounded-xl border border-black/10 dark:border-white/10 hover:border-black/30 dark:hover:border-white/30 transition-colors cursor-pointer"
            >
              <input
                type="checkbox"
                checked={Boolean(selected[group.id])}
                onChange={(e) =>
                  setSelected((prev) => ({ ...prev, [group.id]: e.target.checked }))
                }
                className="mt-0.5 accent-sepia shrink-0"
              />
              <span className="min-w-0">
                <span className="block font-jakarta text-sm font-medium text-ink dark:text-cream">
                  {group.label}
                </span>
                <span className="block font-body text-[11px] text-ink-400 dark:text-ink-300 mt-0.5">
                  {group.description}
                </span>
              </span>
            </label>
          ))}
        </div>

        <label className="flex gap-3 p-3 rounded-xl border border-sepia/30 bg-sepia/5 cursor-pointer">
          <input
            type="checkbox"
            checked={includeMedia}
            onChange={(e) => setIncludeMedia(e.target.checked)}
            className="mt-0.5 accent-sepia shrink-0"
          />
          <span className="min-w-0">
            <span className="block font-jakarta text-sm font-medium text-ink dark:text-cream">
              Include the uploaded files
            </span>
            <span className="block font-body text-[11px] text-ink-400 dark:text-ink-300 mt-0.5">
              Every photo, audio track, video and 3D model the ticked rows point
              at, downloaded into the archive. This is what makes the backup
              survive losing the storage bucket — and what makes it large and
              slow, since your browser fetches each file itself.
            </span>
          </span>
        </label>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="button"
            onClick={runExport}
            disabled={Boolean(job) || opening}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sepia text-white font-jakarta text-sm font-medium hover:bg-sepia-dark transition-colors disabled:opacity-50"
          >
            {job ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            Download backup
          </button>
          {/* Deliberately terse: the phase and percentage are on the floating
              card, which is on screen here too and stays there if the admin
              wanders off. Repeating it in full would just be two copies of the
              same progress a few centimetres apart. */}
          {job && (
            <span className="font-body text-xs text-ink-400 dark:text-ink-300">
              {job.kind === "export"
                ? "Backup in progress — see the card in the corner."
                : "A restore is running — see the card in the corner."}
            </span>
          )}
        </div>
      </div>

      {/* ── Restore ─────────────────────────────────────────────────────── */}
      <div className="admin-card border rounded-2xl backdrop-blur-md shadow-sm p-4 sm:p-6 space-y-5">
        <div className="border-b border-black/10 dark:border-white/10 pb-4">
          <p className="font-body text-xs tracking-widest uppercase text-ink-400 dark:text-ink-300">
            Restore from a backup
          </p>
          <p className="font-body text-xs text-ink-400 dark:text-ink-300 mt-1">
            Open a .zip exported above, then pick what to put back.
          </p>
        </div>

        {/* Said before the file is even chosen, not in a confirm dialog after
            the fact — what a restore does to existing rows is the thing an
            admin needs to know before they start, not after. */}
        <div className="flex gap-3 p-3 rounded-xl border border-amber-500/30 bg-amber-500/5">
          <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-500" />
          <p className="font-body text-xs text-ink-400 dark:text-ink-300">
            A restore <strong className="text-ink dark:text-cream">overwrites</strong> any
            row that shares an id with one in the backup, and{" "}
            <strong className="text-ink dark:text-cream">adds back</strong> any that are
            missing. It never deletes: anything created since the backup was
            taken is left exactly as it is.
          </p>
        </div>

        <input
          ref={fileInput}
          type="file"
          accept=".zip"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) openArchive(file);
            e.target.value = "";
          }}
        />

        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={Boolean(job) || opening}
          className="w-full flex flex-col items-center justify-center gap-2 p-8 rounded-xl border border-dashed border-black/15 dark:border-white/15 hover:border-sepia transition-colors disabled:opacity-50"
        >
          <Archive size={22} className="text-ink-400 dark:text-ink-300" />
          <span className="font-jakarta text-sm text-ink dark:text-cream">
            {archive ? archive.name : "Choose a backup .zip"}
          </span>
          {archive && (
            <span className="font-body text-[11px] text-ink-400 dark:text-ink-300">
              Taken {new Date(archive.file.manifest.exportedAt).toLocaleString()} ·{" "}
              {Object.values(archive.file.manifest.counts)
                .reduce((n, c) => n + c, 0)
                .toLocaleString()}{" "}
              rows
              {archive.media.size > 0 && ` · ${archive.media.size} files`}
            </span>
          )}
        </button>

        {archive && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {archivedGroups.map((group) => {
                const rows = group.models.reduce(
                  (n, m) => n + (archive.file.manifest.counts[m] ?? 0),
                  0
                );
                return (
                  <label
                    key={group.id}
                    className="flex gap-3 p-3 rounded-xl border border-black/10 dark:border-white/10 hover:border-black/30 dark:hover:border-white/30 transition-colors cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(restoreGroups[group.id])}
                      onChange={(e) =>
                        setRestoreGroups((prev) => ({ ...prev, [group.id]: e.target.checked }))
                      }
                      className="mt-0.5 accent-sepia shrink-0"
                    />
                    <span className="min-w-0">
                      <span className="block font-jakarta text-sm font-medium text-ink dark:text-cream">
                        {group.label}
                      </span>
                      <span className="block font-body text-[11px] text-ink-400 dark:text-ink-300 mt-0.5">
                        {rows.toLocaleString()} row{rows === 1 ? "" : "s"} in this backup
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>

            {archive.media.size > 0 && (
              <label className="flex gap-3 p-3 rounded-xl border border-sepia/30 bg-sepia/5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={restoreMedia}
                  onChange={(e) => setRestoreMedia(e.target.checked)}
                  className="mt-0.5 accent-sepia shrink-0"
                />
                <span className="min-w-0">
                  <span className="block font-jakarta text-sm font-medium text-ink dark:text-cream">
                    Put the {archive.media.size} files back into storage
                  </span>
                  <span className="block font-body text-[11px] text-ink-400 dark:text-ink-300 mt-0.5">
                    Each one is uploaded again and the restored rows are pointed
                    at its new address. Leave this off if the originals are
                    still in storage — the rows already point at them, and
                    re-uploading would just make a second copy of every file.
                  </span>
                </span>
              </label>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={runRestore}
                disabled={Boolean(job) || opening}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sepia text-white font-jakarta text-sm font-medium hover:bg-sepia-dark transition-colors disabled:opacity-50"
              >
                {job ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                Restore
              </button>
              {job && (
                <span className="font-body text-xs text-ink-400 dark:text-ink-300">
                  Running — see the card in the corner.
                </span>
              )}
            </div>
          </>
        )}

        {report && (
          <div className="rounded-xl border border-black/10 dark:border-white/10 p-4 space-y-2">
            <p className="flex items-center gap-2 font-jakarta text-sm font-medium text-ink dark:text-cream">
              <CheckCircle2 size={15} className="text-emerald-500" />
              Restore finished
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {Object.entries(report.restored)
                .filter(([, n]) => n > 0)
                .map(([model, n]) => (
                  <span
                    key={model}
                    className="font-body text-[11px] text-ink-400 dark:text-ink-300"
                  >
                    {model} <strong className="text-ink dark:text-cream">{n}</strong>
                  </span>
                ))}
            </div>
            {report.skipped.length > 0 && (
              <details className="pt-2">
                <summary className="font-body text-xs text-amber-600 dark:text-amber-400 cursor-pointer">
                  {report.skipped.length} row{report.skipped.length === 1 ? "" : "s"} skipped
                </summary>
                <ul className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                  {report.skipped.map((s, i) => (
                    <li
                      key={`${s.model}-${s.id}-${i}`}
                      className="font-mono text-[10px] text-ink-400 dark:text-ink-300"
                    >
                      {s.model} · {s.id} — {s.reason}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
