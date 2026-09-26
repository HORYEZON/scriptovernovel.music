// components/public/ShowRow.tsx
//
// One gig in a list: a date block on the left, the show beside it, and on the
// right whatever the visitor can act on — a price and a Tickets button. Shared
// by /shows (upcoming and the archive) and the homepage's Upcoming shows.
// Server-safe, no client hooks.
//
// A cancelled or postponed show is *listed*, struck through and badged, rather
// than hidden: someone holding a ticket has to be able to find out, and a show
// that quietly vanishes reads as a site bug. The ticket button drops off those
// rows — the only row that offers a sale is one that can be attended.
import { MapPin, Ticket, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  SHOW_STATUS_BADGES,
  formatTicketPrice,
  hasShowTime,
  isValidTicketUrl,
  lineupActs,
  showVenueLine,
  type PublicShow,
} from "@/lib/shows";

function dateParts(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return {
    day: d.toLocaleDateString("en-PH", { day: "2-digit", timeZone: "Asia/Manila" }),
    month: d.toLocaleDateString("en-PH", { month: "short", timeZone: "Asia/Manila" }).toUpperCase(),
    year: d.toLocaleDateString("en-PH", { year: "numeric", timeZone: "Asia/Manila" }),
    // Null when the admin only recorded a date — see hasShowTime.
    time: hasShowTime(d)
      ? d.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" })
      : null,
  };
}

export function ShowRow({ show, muted = false }: { show: PublicShow; muted?: boolean }) {
  const date = dateParts(show.eventDate);
  const venue = showVenueLine(show.venueName, show.city);
  const acts = lineupActs(show.lineup);
  const badge = SHOW_STATUS_BADGES[show.status];
  const price = formatTicketPrice(show.ticketPrice, show.ticketNote);
  const off = show.status === "CANCELLED" || show.status === "POSTPONED";
  // Validated again here, not only on write: a row could predate the check.
  const ticketable = !off && show.status !== "SOLD_OUT" && isValidTicketUrl(show.ticketUrl);

  return (
    <li className={cn("flex items-center gap-5 py-5 md:gap-8", muted && "opacity-60")}>
      <div className="flex w-16 shrink-0 flex-col items-center rounded-xl border border-white/10 bg-white/5 py-2 font-body leading-none">
        {date ? (
          <>
            <span className="font-fraunces text-2xl font-light text-cream">{date.day}</span>
            <span className="mt-1 text-[10px] tracking-[0.25em] text-sepia-light">{date.month}</span>
          </>
        ) : (
          <span className="text-[10px] tracking-[0.25em] text-cream/50">TBA</span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate font-fraunces text-xl font-light text-cream md:text-2xl",
            off && "line-through decoration-cream/40"
          )}
        >
          {show.title}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-body text-xs tracking-wide text-cream/60">
          {venue && (
            <span className="inline-flex items-center gap-1">
              <MapPin size={12} /> {venue}
            </span>
          )}
          {date && <span>{date.time ? `${date.year} · ${date.time}` : date.year}</span>}
        </p>
        {acts.length > 0 && (
          <p className="mt-1.5 flex items-start gap-1.5 font-body text-xs leading-relaxed text-cream/45">
            <Users size={12} className="mt-0.5 shrink-0" />
            <span className="min-w-0">with {acts.join(" · ")}</span>
          </p>
        )}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-2">
        {badge ? (
          <span
            className={cn(
              "rounded-full border px-3 py-1 font-body text-[10px] uppercase tracking-[0.25em]",
              show.status === "SOLD_OUT" && "border-cream/25 text-cream/60",
              off && "border-vermillion/50 text-vermillion"
            )}
          >
            {badge}
          </span>
        ) : (
          show.isNextEvent && (
            <span className="hidden rounded-full border border-sepia/60 px-3 py-1 font-body text-[10px] uppercase tracking-[0.25em] text-sepia-light sm:inline-block">
              Next show
            </span>
          )
        )}
        {price && !off && (
          <span className="font-body text-xs text-cream/50">{price}</span>
        )}
        {ticketable && (
          <a
            href={show.ticketUrl!}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-cream/30 px-3.5 py-1.5 font-body text-[10px] uppercase tracking-[0.2em] text-cream transition-colors hover:border-cream/70 hover:text-cream"
          >
            <Ticket size={11} /> Tickets
          </a>
        )}
      </div>
    </li>
  );
}
