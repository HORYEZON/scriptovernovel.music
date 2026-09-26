// lib/press.ts
//
// Single source for the press kit (/press): the field limits, the press-quote
// shape and its sanitizer, and the small formatters the page and the admin form
// share. Client-safe (no Prisma) — mirrors lib/shows.ts.
//
// Most of /press is built from data the site already holds (bio, members,
// photos, releases, shows). What lives here is only the part a press kit needs
// and the rest of the site has no reason to store.

export const MAX_PRESS_SHORT_BIO = 600;
export const MAX_PRESS_TECH_RIDER = 4000;
export const MAX_PRESS_BOOKING_NAME = 120;
export const MAX_PRESS_PHOTO_CREDIT = 160;
export const MAX_PRESS_QUOTE = 400;
export const MAX_PRESS_QUOTE_SOURCE = 120;
export const MAX_PRESS_QUOTES = 8;

/** One pull-quote: what was said, who said it, and where to read it. */
export interface PressQuote {
  quote: string;
  source: string;
  sourceUrl: string | null;
}

/**
 * http(s) only — a quote's source link is rendered as an href on a public page,
 * so an unvalidated string would let `javascript:` through from the admin form.
 * The same rule as lib/shows.ts's ticket link.
 */
export function isValidQuoteUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") return false;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * The `pressQuotes` Json column → a clean list.
 *
 * Whole-value sanitize, like `sanitizeHoverShimmer`: the column is written as
 * one value, so a bad entry inside it is dropped rather than rejecting the
 * save. A quote with no text or no source is not a quote, so those go; a bad
 * source URL loses only the link.
 */
export function sanitizePressQuotes(input: unknown): PressQuote[] {
  if (!Array.isArray(input)) return [];
  const out: PressQuote[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const quote = typeof r.quote === "string" ? r.quote.replace(/\r\n/g, "\n").trim() : "";
    const source = typeof r.source === "string" ? r.source.trim() : "";
    if (!quote || !source) continue;
    const url = typeof r.sourceUrl === "string" ? r.sourceUrl.trim() : "";
    out.push({
      quote: quote.slice(0, MAX_PRESS_QUOTE),
      source: source.slice(0, MAX_PRESS_QUOTE_SOURCE),
      sourceUrl: isValidQuoteUrl(url) ? url : null,
    });
    if (out.length >= MAX_PRESS_QUOTES) break;
  }
  return out;
}

/** The stored Json (or null, on every row from before this shipped) → a list. */
export function resolvePressQuotes(value: unknown): PressQuote[] {
  return sanitizePressQuotes(value);
}

/** Trim to a limit, or null when there's nothing left. Used for every press
 *  text field on write — a field cleared in the form has to store as null, not
 *  as "". */
export function pressText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const clean = value.replace(/\r\n/g, "\n").trim();
  if (!clean) return null;
  return clean.slice(0, max);
}

// The stage plot is an uploaded *image*, through the same /api/upload route and
// ImageField every other picture on the site uses — each media kind here has its
// own upload route and allowlist, and a PDF uploader would be a new one plus a
// widened allowlist for the sake of one field. The page's own print sheet is
// what answers "send me a PDF": /press prints as a one-sheet.
