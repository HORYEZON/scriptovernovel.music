// lib/artwork-video.ts
//
// Shared constants for the optional "making of" timelapse video on an
// Artwork — same "small sanitizer module" pattern as lib/background-music.ts,
// used by both the admin upload/trim flow (ArtworkVideoUploader.tsx,
// lib/video-trim.ts) and the /api/upload/video route.
export const MAX_VIDEO_DURATION_SEC = 60;

// Cap on the file actually sent to the server — by the time we get here the
// clip has already been trimmed to MAX_VIDEO_DURATION_SEC client-side (or
// was already under it), so this only needs to guard against a very long,
// very high-bitrate 60s clip, not arbitrary raw uploads.
export const MAX_VIDEO_UPLOAD_FILE_SIZE_MB = 30;
export const MAX_VIDEO_UPLOAD_FILE_SIZE = MAX_VIDEO_UPLOAD_FILE_SIZE_MB * 1024 * 1024;

// Kept in sync with app/api/upload/video/route.ts's ALLOWED_TYPES.
export const ALLOWED_VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-m4v",
];
