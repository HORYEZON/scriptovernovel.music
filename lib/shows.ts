// lib/shows.ts
//
// Single source for the Shows module — the gig side of Event, as /shows, the
// homepage's Upcoming shows and the admin's Events editor all read it: the
// status list and labels, the ticket-link rule, the field limits, and the
// sanitizer the API routes and the form share. Client-safe (no Prisma) —
// mirrors lib/releases.ts.
//
// Event itself predates this module: it started as a map pin for About's
// timeline, so the coordinates are required and everything a *listing* needs
// (ticket link, who else played, whether the night is still on) is optional
// and lives here.

export const SHOW_STATUSES = ["SCHEDULED", "SOLD_OUT", "CANCELLED", "POSTPONED"] as const;
export type ShowStatus = (typeof SHOW_STATUSES)[number];

export const SHOW_STATUS_LABELS: Record<ShowStatus, string> = {
  SCHEDULED: "Scheduled",
  SOLD_OUT: "Sold out",
  CANCELLED: "Cancelled",
  POSTPONED: "Postponed",
};

/** The badge a status earns on a show row. `null` = the normal case, which
 *  says nothing: a scheduled show is just a show. */
export const SHOW_STATUS_BADGES: Record<ShowStatus, string | null> = {
  SCHEDULED: null,
  SOLD_OUT: "Sold out",
  CANCELLED: "Cancelled",
  POSTPONED: "Postponed",
};

export function isShowStatus(value: unknown): value is ShowStatus {
  return typeof value === "string" && (SHOW_STATUSES as readonly string[]).includes(value);
}

export const MAX_SHOW_CITY = 80;
export const MAX_SHOW_LINEUP = 600;
export const MAX_SHOW_TICKET_NOTE = 120;
export const MAX_SHOW_TICKET_URL = 500;
/** Higher than any gig will ever cost, and low enough that a mistyped
 *  figure ("25000000") is caught at the form rather than on the page. */
export const MAX_SHOW_TICKET_PRICE = 100_000;

/**
 * http(s) only. This URL becomes an href on a public page, so an unvalidated
 * string would let `javascript:` (or `data:`) through from the admin form
 * into a visitor's browser. Checked on write *and* before render, since a row
 * could predate the check — the same rule as lib/stories.ts' continue link.
 */
export function isValidTicketUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (trimmed.length > MAX_SHOW_TICKET_URL) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export interface PublicShowMedia {
  id: string;
  url: string;
  type: "IMAGE" | "VIDEO";
  /** Already sorted by this, and kept on the shape only because
   *  GET /api/events/public has always returned it. */
  order: number;
}

/**
 * One show as every public reader gets it — /shows' list, the homepage strip
 * and the map pin — with the Dates already ISO strings so it can cross the
 * server/client boundary.
 *
 * Deliberately a superset of EventsMap's `PublicEvent`: the map needs the
 * coordinates and media, the list needs the gig fields, and /shows shows both
 * from one query. Structurally assignable to `PublicEvent`, so it can be
 * handed straight to <EventsMap> with no re-mapping.
 */
export interface PublicShow {
  id: string;
  title: string;
  description: string | null;
  venueName: string | null;
  city: string | null;
  lineup: string | null;
  latitude: number;
  longitude: number;
  eventDate: string | null;
  createdAt: string;
  ticketUrl: string | null;
  ticketPrice: number | null;
  ticketNote: string | null;
  status: ShowStatus;
  isNextEvent: boolean;
  media: PublicShowMedia[];
}

/** The gig fields, as the admin form posts them and the API stores them. */
export interface ShowGigFields {
  city: string | null;
  lineup: string | null;
  ticketUrl: string | null;
  ticketPrice: number | null;
  ticketNote: string | null;
  status: ShowStatus;
}

/**
 * Gig fields from a request body → validated values (null = clear), or an
 * error naming the bad one. Keys absent from the body are left out of the
 * result, so a PATCH stays partial — the same contract as
 * sanitizeReleaseLinks.
 */
export function sanitizeShowFields(
  body: Record<string, unknown>
): { fields: Partial<ShowGigFields> } | { error: string } {
  const fields: Partial<ShowGigFields> = {};

  const text = (
    key: "city" | "lineup" | "ticketNote",
    max: number,
    label: string
  ): string | null | undefined => {
    if (!(key in body)) return undefined;
    const raw = body[key];
    if (raw === null || raw === undefined) return null;
    if (typeof raw !== "string") return null;
    // Lineups are typed one act per line; \r\n would show up as a blank
    // line on the page.
    const clean = raw.replace(/\r\n/g, "\n").trim();
    if (!clean) return null;
    if (clean.length > max) throw new Error(`${label} is at most ${max} characters.`);
    return clean;
  };

  try {
    const city = text("city", MAX_SHOW_CITY, "City");
    if (city !== undefined) fields.city = city;
    const lineup = text("lineup", MAX_SHOW_LINEUP, "Lineup");
    if (lineup !== undefined) fields.lineup = lineup;
    const note = text("ticketNote", MAX_SHOW_TICKET_NOTE, "Ticket note");
    if (note !== undefined) fields.ticketNote = note;
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Invalid field." };
  }

  if ("ticketUrl" in body) {
    const raw = body.ticketUrl;
    if (raw === null || raw === undefined || raw === "") {
      fields.ticketUrl = null;
    } else if (typeof raw === "string" && isValidTicketUrl(raw)) {
      fields.ticketUrl = raw.trim();
    } else {
      return { error: "The ticket link must be a full http(s) URL." };
    }
  }

  if ("ticketPrice" in body) {
    const raw = body.ticketPrice;
    if (raw === null || raw === undefined || raw === "") {
      fields.ticketPrice = null;
    } else {
      const n = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isFinite(n) || n < 0 || n > MAX_SHOW_TICKET_PRICE) {
        return { error: `The ticket price must be a number between 0 and ${MAX_SHOW_TICKET_PRICE}.` };
      }
      // Two decimals: it is money, and a float from a text input can arrive
      // as 249.99000000000001.
      fields.ticketPrice = Math.round(n * 100) / 100;
    }
  }

  if ("status" in body) {
    const raw = body.status;
    if (raw === null || raw === undefined || raw === "") fields.status = "SCHEDULED";
    else if (isShowStatus(raw)) fields.status = raw;
    else return { error: "Unknown show status." };
  }

  return { fields };
}

/** A lineup textarea → one act per line, blanks dropped. */
export function lineupActs(lineup: string | null | undefined): string[] {
  if (!lineup) return [];
  return lineup
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * Is this show still ahead of us?
 *
 * An undated show ("TBA") counts as upcoming — it is announced but not yet
 * scheduled, so it belongs with what's coming rather than in the archive.
 * A cancelled show does not: it stays listed, but under the past, so the
 * upcoming list never promises a night that isn't happening.
 */
export function isUpcomingShow(show: { eventDate: string | Date | null; status?: ShowStatus }): boolean {
  if (show.status === "CANCELLED") return false;
  if (!show.eventDate) return true;
  const d = new Date(show.eventDate);
  if (Number.isNaN(d.getTime())) return true;
  return d.getTime() >= Date.now();
}

/**
 * What a ticket costs, in one short string, or null when there is nothing to
 * say. The admin's note wins over the number — "Free entry" and "₱250 at the
 * door" are both truer than a bare figure, and that is why the note exists.
 */
export function formatTicketPrice(price: number | null | undefined, note?: string | null): string | null {
  if (note && note.trim()) return note.trim();
  if (price === null || price === undefined || !Number.isFinite(price)) return null;
  if (price === 0) return "Free";
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(price);
}

/**
 * Does this show have a start time, or only a date?
 *
 * Events were date-only until /shows landed: the admin's picker had no time
 * field, so the API stored `new Date("2026-09-26")` — midnight *UTC*. Rendered
 * in Asia/Manila that is 8:00 AM, which is how every show on the old About
 * timeline came to claim it started at eight in the morning.
 *
 * So exactly-00:00Z means "no time recorded" and the time is left off the row.
 * A show genuinely booked for 8:00 AM Manila lands on the same instant and
 * loses its time label; that is the one case this gets wrong, and it costs a
 * label rather than a wrong one.
 */
export function hasShowTime(iso: string | Date | null | undefined): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return !(d.getUTCHours() === 0 && d.getUTCMinutes() === 0);
}

/** "Mow Bar · Quezon City", skipping whichever half is missing. */
export function showVenueLine(venueName: string | null | undefined, city: string | null | undefined): string {
  return [venueName?.trim(), city?.trim()].filter(Boolean).join(" · ");
}
