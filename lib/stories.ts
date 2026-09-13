// lib/stories.ts
//
// Single source of truth for the Story publication kinds, shared by the admin
// module (app/(admin)/admin/stories), the public grid (app/(public)/stories)
// and the API routes' payload validation. Mirrors the StoryType enum in
// prisma/schema.prisma — adding a kind there means adding it here (and
// nowhere else: every select/filter/badge renders from STORY_TYPES).

export const STORY_TYPES = [
  "BOOK",
  "NOVEL",
  "COMIC",
  "MANGA",
  "ANTHOLOGY",
  "ARTBOOK",
  "ZINE",
  "WEBTOON",
] as const;

export type StoryType = (typeof STORY_TYPES)[number];

export const STORY_TYPE_LABELS: Record<StoryType, string> = {
  BOOK: "Book",
  NOVEL: "Novel",
  COMIC: "Comic",
  MANGA: "Manga",
  ANTHOLOGY: "Anthology",
  ARTBOOK: "Art Book",
  ZINE: "Zine",
  WEBTOON: "Webtoon",
};

export function isStoryType(value: unknown): value is StoryType {
  return typeof value === "string" && (STORY_TYPES as readonly string[]).includes(value);
}

export function storyTypeLabel(type: string): string {
  return isStoryType(type) ? STORY_TYPE_LABELS[type] : type;
}

// Page images only — the admin file inputs advertise jpg/png (what the brief
// asked for) even though POST /api/upload itself also accepts WebP/GIF.
export const STORY_IMAGE_ACCEPT = "image/jpeg,image/png";
export const STORY_IMAGE_HINT = "JPG or PNG (max 10 MB)";

// ── "Continue Reading" hand-off ─────────────────────────────────────────────
// A story here is often a teaser: only the opening pages are uploaded, and
// the last page sends the reader wherever the full thing lives. See the
// continue* fields on Story in prisma/schema.prisma.

export const CONTINUE_READING_DEFAULT_LABEL = "Continue Reading";

/**
 * Whether a story's hand-off should actually render.
 *
 * The toggle alone isn't enough — an admin can switch it on before pasting
 * the URL, and a button that goes nowhere is worse than no button. Both the
 * reader and the admin's own warning read this one predicate so they can
 * never disagree about it.
 */
export function hasContinueLink(story: {
  continueEnabled?: boolean;
  continueUrl?: string | null;
}): boolean {
  return Boolean(story.continueEnabled) && isValidContinueUrl(story.continueUrl);
}

/**
 * http(s) only. This URL is rendered as an href in a public modal, so an
 * unvalidated string would let `javascript:` (or `data:`) through from the
 * admin form straight into a visitor's browser. Checked on write in the API
 * *and* before render, since a row could predate the check.
 */
export function isValidContinueUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") return false;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function continueReadingLabel(label: string | null | undefined): string {
  const trimmed = label?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : CONTINUE_READING_DEFAULT_LABEL;
}
