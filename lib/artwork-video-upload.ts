// lib/artwork-video-upload.ts
//
// Shared "validate → auto-trim if over the cap → upload" pipeline behind
// every artwork video slot — the single primary timelapse in
// ArtworkVideoUploader.tsx and the additional-videos list in
// ArtworksClient.tsx — so they all trim/validate/toast identically instead
// of duplicating the client-side ffmpeg trim dance per call site.
import toast from "@/lib/toast";
import { ALLOWED_VIDEO_TYPES, MAX_VIDEO_DURATION_SEC } from "@/lib/artwork-video";
import { canTrimVideoClientSide, getVideoDuration, trimVideoToMaxDuration } from "@/lib/video-trim";
import { getErrorMessage } from "@/lib/utils";

async function uploadFile(file: File | Blob, name: string) {
  const fd = new FormData();
  fd.append("file", file, name);
  const res = await fetch("/api/upload/video", { method: "POST", body: fd });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Upload failed");
  return data.url as string;
}

// Returns the uploaded URL, or null if the upload was rejected/failed — in
// which case an explanatory toast has already been shown, so callers only
// need to branch on truthiness.
export async function uploadArtworkVideo(
  file: File,
  onTrimProgress?: (elapsedSec: number) => void
): Promise<string | null> {
  if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
    toast.error("Please upload an MP4, MOV, or WebM video");
    return null;
  }

  try {
    const duration = await getVideoDuration(file);

    if (duration <= MAX_VIDEO_DURATION_SEC) {
      const url = await uploadFile(file, file.name);
      toast.success("Video uploaded");
      return url;
    }

    if (!canTrimVideoClientSide()) {
      toast.error(
        `This browser can't auto-trim video — please trim it to under ${MAX_VIDEO_DURATION_SEC}s yourself (e.g. in Photos or QuickTime) and re-upload.`
      );
      return null;
    }

    onTrimProgress?.(0);
    const trimmed = await trimVideoToMaxDuration(file, MAX_VIDEO_DURATION_SEC, (elapsed) =>
      onTrimProgress?.(elapsed)
    );
    const ext = trimmed.type.includes("mp4") ? "mp4" : "webm";
    const url = await uploadFile(trimmed, `timelapse-trimmed.${ext}`);
    toast.success(`Trimmed to the first ${MAX_VIDEO_DURATION_SEC}s and uploaded`);
    return url;
  } catch (err) {
    toast.error(getErrorMessage(err, "Upload failed"));
    return null;
  }
}
