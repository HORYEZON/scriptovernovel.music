"use client";

// app/(admin)/admin/artworks/ChaseCompanionsSection.tsx
//
// Settings for "Chase Companions" (Digital Museum ▸ General — see
// prisma/schema.prisma's ChaseCompanion comment and the public
// ChaseCompanion.tsx for the actual drift-toward-the-visitor behavior).
// Up to 5 independent companions, each with its own on/off toggle and
// upload slot accepting either a .glb model (same signed-URL flow as the
// Museum Scene Editor's custom decorative objects) or a flat image (the
// same /api/upload every other admin image goes through) — assetType is
// inferred from which kind of file was picked, same as the single-
// companion version this replaced. Self-fetches its own list via
// app/api/chase-companions/route.ts rather than being threaded down from
// DigitalMuseumPanel.tsx's museum-config fetch, since these are now a
// separate resource with their own list/create/edit/delete lifecycle —
// same reasoning as AchievementsTab.tsx.
import { useEffect, useRef, useState } from "react";
import Image from "@/components/ui/SafeImage";
import { PawPrint, ImagePlus, Box, Trash2, Plus, AlertTriangle } from "lucide-react";
import toast from "@/lib/toast";
import { getErrorMessage } from "@/lib/utils";
import { uploadModelViaSignedUrl } from "@/lib/supabase/browser-storage";
import { playSoundEffect } from "@/lib/sound/engine";
import { Toggle } from "./museum-ui";

const MAX_COMPANIONS = 5;
// Same cap as the Museum Scene Editor's own .glb uploads — see
// MuseumEditorClient.tsx's MAX_MODEL_SIZE and lib/supabase/storage.ts's
// createModelUploadUrl for why this needs the signed-URL flow at all
// (Vercel's ~4.5MB serverless request-body cap).
const MAX_MODEL_SIZE = 100 * 1024 * 1024;

interface Companion {
  id: string;
  assetType: "model" | "image";
  assetUrl: string;
  enabled: boolean;
}

async function uploadAsset(file: File): Promise<{ assetType: "model" | "image"; assetUrl: string }> {
  if (file.name.toLowerCase().endsWith(".glb")) {
    if (file.size > MAX_MODEL_SIZE) throw new Error("File too large — 100MB max");
    const signRes = await fetch("/api/upload/model/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: file.name }),
    });
    const signData = await signRes.json().catch(() => ({}));
    if (!signRes.ok) throw new Error(signData.error || "Failed to prepare upload");
    // Returns the compressed copy's URL, which is a different path from
    // signData.publicUrl — see uploadModelViaSignedUrl.
    const assetUrl = await uploadModelViaSignedUrl(file, signData.path, signData.token, signData.publicUrl);
    return { assetType: "model", assetUrl };
  }
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Upload failed");
  return { assetType: "image", assetUrl: data.url };
}

const PREVIEW_SIZE = 224;
const PREVIEW_OFFSET = 20;

export function ChaseCompanionsSection() {
  const [companions, setCompanions] = useState<Companion[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState<string | "new" | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Companion | null>(null);
  const [deleting, setDeleting] = useState(false);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const newInputRef = useRef<HTMLInputElement>(null);

  // Cursor-following hover preview — same pattern as ArtworkPicker.tsx's
  // Room Order list so the full image floats next to the cursor rather than
  // popping above the tiny 36×36 thumbnail.
  const [hoverPreview, setHoverPreview] = useState<{
    url: string;
    label: string;
    x: number;
    y: number;
  } | null>(null);

  function showPreview(e: React.MouseEvent, companion: Companion, label: string) {
    if (companion.assetType !== "image") return;
    setHoverPreview({ url: companion.assetUrl, label, x: e.clientX, y: e.clientY });
  }
  function movePreview(e: React.MouseEvent) {
    setHoverPreview((p) => (p ? { ...p, x: e.clientX, y: e.clientY } : p));
  }
  function hidePreview() {
    setHoverPreview(null);
  }

  let previewLeft = 0;
  let previewTop = 0;
  if (hoverPreview) {
    previewLeft = hoverPreview.x + PREVIEW_OFFSET;
    previewTop = hoverPreview.y - PREVIEW_SIZE / 2;
    if (typeof window !== "undefined") {
      previewLeft = Math.min(previewLeft, window.innerWidth - PREVIEW_SIZE - 12);
      previewTop = Math.max(12, Math.min(previewTop, window.innerHeight - PREVIEW_SIZE - 44));
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/chase-companions")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data)) setCompanions(data);
      })
      .catch(() => toast.error("Failed to load Chase Companions"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggleCompanion(companion: Companion, enabled: boolean) {
    const previous = companions;
    setCompanions((prev) => prev.map((c) => (c.id === companion.id ? { ...c, enabled } : c)));
    try {
      const res = await fetch(`/api/chase-companions/${companion.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error();
      toast.success(enabled ? "Companion enabled" : "Companion disabled");
    } catch {
      setCompanions(previous);
      toast.error("Failed to update companion");
    }
  }

  async function replaceAsset(companion: Companion, file: File) {
    setUploadingId(companion.id);
    try {
      const asset = await uploadAsset(file);
      const res = await fetch(`/api/chase-companions/${companion.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(asset),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update companion");
      setCompanions((prev) => prev.map((c) => (c.id === companion.id ? data : c)));
      toast.success("Companion updated");
    } catch (err) {
      toast.error(getErrorMessage(err, "Upload failed"));
    } finally {
      setUploadingId(null);
    }
  }

  async function confirmRemoveCompanion() {
    if (!deleteConfirm) return;
    const companion = deleteConfirm;
    setDeleting(true);
    const previous = companions;
    setCompanions((prev) => prev.filter((c) => c.id !== companion.id));
    try {
      const res = await fetch(`/api/chase-companions/${companion.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Companion removed");
      setDeleteConfirm(null);
    } catch {
      setCompanions(previous);
      toast.error("Failed to remove companion");
    } finally {
      setDeleting(false);
    }
  }

  async function addCompanion(file: File) {
    setUploadingId("new");
    try {
      const asset = await uploadAsset(file);
      const res = await fetch("/api/chase-companions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(asset),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add companion");
      setCompanions((prev) => [...prev, data]);
      toast.success("Companion added");
    } catch (err) {
      toast.error(getErrorMessage(err, "Upload failed"));
    } finally {
      setUploadingId(null);
    }
  }

  return (
    <>
    <div className="admin-card border rounded-2xl p-4 space-y-3 h-full">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
          <PawPrint size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-jakarta text-sm font-medium text-ink dark:text-cream">
            Chase Companions ({companions.length}/{MAX_COMPANIONS})
          </p>
          <p className="font-body text-xs text-ink-400 dark:text-ink-300 mt-0.5">
            Playful easter eggs — each idles near the entrance and drifts toward a visitor who
            wanders close, then settles back once they move away. Purely decorative, never blocks
            movement. Up to {MAX_COMPANIONS}, each toggled independently.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="font-body text-sm text-ink-400 dark:text-ink-300">Loading…</p>
      ) : (
        <div className="space-y-2">
          {companions.map((companion, idx) => {
            const label = `Companion ${idx + 1}`;
            return (
            <div key={companion.id} className="flex items-center gap-2.5 p-1.5 pl-3 rounded-xl admin-input border">
              <input
                ref={(el) => {
                  inputRefs.current[companion.id] = el;
                }}
                type="file"
                accept=".glb,image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) replaceAsset(companion, file);
                  e.target.value = "";
                }}
              />
              {companion.assetType === "image" ? (
                <div
                  className="relative w-9 h-9 rounded-lg overflow-hidden shrink-0 bg-black/5 dark:bg-white/5 cursor-zoom-in"
                  onMouseEnter={(e) => showPreview(e, companion, label)}
                  onMouseMove={movePreview}
                  onMouseLeave={hidePreview}
                >
                  <Image src={companion.assetUrl} alt="" fill className="object-cover" sizes="36px" />
                </div>
              ) : (
                <div className="w-9 h-9 rounded-lg shrink-0 bg-black/5 dark:bg-white/5 flex items-center justify-center">
                  <Box size={16} className="text-ink-400 dark:text-ink-300" />
                </div>
              )}
              <p className="flex-1 min-w-0 font-body text-xs text-ink-400 dark:text-ink-300 truncate">
                {companion.assetType === "image" ? "Image" : ".glb model"}
              </p>
              <Toggle
                checked={companion.enabled}
                onChange={(enabled) => toggleCompanion(companion, enabled)}
                label="Toggle companion"
              />
              <button
                type="button"
                disabled={uploadingId === companion.id}
                onClick={() => inputRefs.current[companion.id]?.click()}
                className="px-2 py-1 rounded-lg font-body text-xs text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/5 dark:hover:bg-white/5 transition-colors shrink-0 disabled:opacity-50"
              >
                {uploadingId === companion.id ? "…" : "Change"}
              </button>
              <button
                type="button"
                onClick={() => {
                  playSoundEffect("admin.deleteConfirm");
                  setDeleteConfirm(companion);
                }}
                aria-label="Remove companion"
                className="p-1.5 rounded-lg text-ink-400 hover:text-vermillion hover:bg-vermillion/10 transition-colors shrink-0"
              >
                <Trash2 size={14} />
              </button>
            </div>
          );})}

          {/* Cursor-following hover preview — fixed so it escapes the
              card's scroll container, same pattern as ArtworkPicker.tsx. */}
          {hoverPreview && (
            <div
              className="fixed z-[100] pointer-events-none rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-ink-900 shadow-2xl overflow-hidden"
              style={{ left: previewLeft, top: previewTop, width: PREVIEW_SIZE }}
            >
              <div className="relative w-full aspect-square bg-black/5 dark:bg-white/5">
                <Image
                  src={hoverPreview.url}
                  alt={hoverPreview.label}
                  fill
                  className="object-contain"
                  sizes={`${PREVIEW_SIZE}px`}
                />
              </div>
              <p className="px-3 py-2 font-body text-xs text-ink dark:text-cream truncate border-t border-black/5 dark:border-white/5">
                {hoverPreview.label}
              </p>
            </div>
          )}

          {companions.length < MAX_COMPANIONS && (
            <>
              <input
                ref={newInputRef}
                type="file"
                accept=".glb,image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) addCompanion(file);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                disabled={uploadingId === "new"}
                onClick={() => newInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-black/15 dark:border-white/15 text-ink-400 dark:text-ink-300 hover:border-sepia/50 hover:text-sepia transition-colors font-body text-sm disabled:opacity-60"
              >
                {uploadingId === "new" ? (
                  <>
                    <div className="w-3.5 h-3.5 border border-ink-300 dark:border-ink-500 border-t-sepia dark:border-t-cream rounded-full animate-spin" />
                    Uploading…
                  </>
                ) : (
                  <>
                    <Plus size={14} />
                    <ImagePlus size={14} />
                    Add Companion (.glb or image)
                  </>
                )}
              </button>
            </>
          )}
        </div>
      )}
    </div>

    {/* Remove companion confirm modal — no Trash/undo here (unlike the
        Museum Scene Editor's object removal), it's a straightforward
        permanent delete, so this asks plainly rather than promising a
        restore that doesn't exist. */}
    {deleteConfirm && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
        <div className="bg-white dark:bg-[#121212] border border-black/10 dark:border-white/15 rounded-2xl w-full max-w-md p-6 shadow-2xl">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 rounded-full bg-vermillion/10 flex items-center justify-center">
              <AlertTriangle size={24} className="text-vermillion" />
            </div>
          </div>
          <p className="font-jakarta text-xl font-semibold mb-2 text-ink dark:text-cream text-center">
            Remove this companion?
          </p>
          <p className="font-body text-sm text-ink-400 dark:text-ink-300 mb-6 text-center">
            This cannot be undone — its upload will need to be redone from scratch if you change
            your mind.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <button
              type="button"
              onClick={confirmRemoveCompanion}
              disabled={deleting}
              className="px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              {deleting ? "Removing…" : "Remove"}
            </button>
            <button
              type="button"
              onClick={() => setDeleteConfirm(null)}
              disabled={deleting}
              className="px-4 py-2 rounded-xl bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream text-sm font-medium transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
