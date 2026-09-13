// lib/video-trim.ts
//
// Client-side "auto-crop" for artwork timelapse uploads. A video over
// MAX_VIDEO_DURATION_SEC (see lib/artwork-video.ts) gets physically cut down
// to its first 60 seconds in the browser — via HTMLVideoElement.captureStream()
// + MediaRecorder, both native browser APIs, no extra dependency — rather
// than uploading the full file and only limiting playback. This is real-time:
// recording a 60s clip takes ~60 wall-clock seconds, so callers should drive
// a progress UI off `onProgress` rather than treating this as instant.
//
// Browser support: captureStream()/MediaRecorder are solid in Chrome/Firefox/
// Edge but unreliable on Safari/iOS — check canTrimVideoClientSide() first
// and fall back to asking the admin to pre-trim the clip if it's false.

export function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.src = URL.createObjectURL(file);
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      resolve(video.duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      reject(new Error("Could not read video metadata"));
    };
  });
}

export function canTrimVideoClientSide(): boolean {
  if (typeof window === "undefined") return false;
  const proto = window.HTMLVideoElement?.prototype as
    | (HTMLVideoElement & { captureStream?: unknown; mozCaptureStream?: unknown })
    | undefined;
  const hasCaptureStream = !!proto && ("captureStream" in proto || "mozCaptureStream" in proto);
  const hasMediaRecorder = typeof window.MediaRecorder !== "undefined";
  return hasCaptureStream && hasMediaRecorder;
}

function pickMimeType(): string {
  // Prefer mp4 where the browser can record straight to it (broadest public
  // playback compatibility); webm is the reliable fallback everywhere else.
  const candidates = [
    "video/mp4",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  for (const type of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return "video/webm";
}

export function trimVideoToMaxDuration(
  file: File,
  maxSeconds: number,
  onProgress?: (elapsedSec: number) => void
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    // Some browsers only produce frames on a captured stream once the
    // element is actually in the render tree, even off-screen.
    video.style.position = "fixed";
    video.style.left = "-9999px";
    video.style.width = "1px";
    video.style.height = "1px";
    document.body.appendChild(video);

    let settled = false;
    const cleanup = () => {
      URL.revokeObjectURL(video.src);
      video.remove();
    };
    const fail = (err: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err instanceof Error ? err : new Error("Video trim failed"));
    };
    const succeed = (blob: Blob) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(blob);
    };

    video.src = URL.createObjectURL(file);

    video.onloadedmetadata = async () => {
      try {
        const captureStream =
          (video as HTMLVideoElement & { captureStream?: () => MediaStream }).captureStream ??
          (video as HTMLVideoElement & { mozCaptureStream?: () => MediaStream }).mozCaptureStream;
        if (!captureStream) throw new Error("This browser can't capture a video stream");

        const stream = captureStream.call(video);
        const mimeType = pickMimeType();
        const recorder = new MediaRecorder(stream, { mimeType });
        const chunks: BlobPart[] = [];

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };
        recorder.onerror = (e) => fail(e);
        recorder.onstop = () => succeed(new Blob(chunks, { type: mimeType }));

        video.currentTime = 0;
        await video.play();
        recorder.start();

        const stopAt = Date.now() + maxSeconds * 1000;
        const tick = () => {
          if (settled) return;
          const remainingMs = stopAt - Date.now();
          const elapsed = Math.min(maxSeconds, maxSeconds - Math.ceil(remainingMs / 1000));
          onProgress?.(Math.max(0, elapsed));
          if (remainingMs <= 0 || video.ended) {
            video.pause();
            if (recorder.state !== "inactive") recorder.stop();
            return;
          }
          requestAnimationFrame(tick);
        };
        tick();
      } catch (err) {
        fail(err);
      }
    };
    video.onerror = () => fail(new Error("Could not load video"));
  });
}
