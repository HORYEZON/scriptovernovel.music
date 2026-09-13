// lib/share.ts
//
// Share-intent URL builders for ShareButton.tsx. Each of these is just a
// platform's own "share this URL" deep link — no SDK/API key needed, so
// this stays a plain data file with zero runtime dependencies.

export type SharePlatform = "facebook" | "twitter" | "threads" | "copy";

export const SHARE_PLATFORMS: { id: SharePlatform; label: string }[] = [
  { id: "facebook", label: "Facebook" },
  { id: "twitter", label: "X (Twitter)" },
  { id: "threads", label: "Threads" },
  { id: "copy", label: "Copy Link" },
];

/** Intent URL for a given platform — `copy` isn't a link, handled separately by the caller. */
export function buildShareIntentUrl(
  platform: Exclude<SharePlatform, "copy">,
  url: string,
  text?: string
): string {
  const encodedUrl = encodeURIComponent(url);
  const encodedText = encodeURIComponent(text || "");
  switch (platform) {
    case "facebook":
      return `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
    case "twitter":
      return `https://twitter.com/intent/tweet?url=${encodedUrl}${text ? `&text=${encodedText}` : ""}`;
    case "threads":
      return `https://www.threads.net/intent/post?url=${encodedUrl}${text ? `&text=${encodedText}` : ""}`;
  }
}
