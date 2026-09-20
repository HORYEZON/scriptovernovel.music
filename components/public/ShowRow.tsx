// components/public/ShowRow.tsx
//
// One gig in a list: a date block on the left, title and venue beside it,
// a "Next show" tag when the admin has flagged it. Shared by the homepage's
// Upcoming shows and About's show history. Server-safe.
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ShowRowData {
  id: string;
  title: string;
  venueName: string | null;
  eventDate: string | null;
  isNextEvent: boolean;
}

function dateParts(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return {
    day: d.toLocaleDateString("en-PH", { day: "2-digit", timeZone: "Asia/Manila" }),
    month: d.toLocaleDateString("en-PH", { month: "short", timeZone: "Asia/Manila" }).toUpperCase(),
    year: d.toLocaleDateString("en-PH", { year: "numeric", timeZone: "Asia/Manila" }),
    time: d.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" }),
  };
}

export function ShowRow({ show, muted = false }: { show: ShowRowData; muted?: boolean }) {
  const date = dateParts(show.eventDate);
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
        <p className="truncate font-fraunces text-xl font-light text-cream md:text-2xl">{show.title}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-body text-xs tracking-wide text-cream/60">
          {show.venueName && (
            <span className="inline-flex items-center gap-1">
              <MapPin size={12} /> {show.venueName}
            </span>
          )}
          {date && (
            <span>
              {date.year} · {date.time}
            </span>
          )}
        </p>
      </div>
      {show.isNextEvent && (
        <span className="hidden shrink-0 rounded-full border border-sepia/60 px-3 py-1 font-body text-[10px] uppercase tracking-[0.25em] text-sepia-light sm:inline-block">
          Next show
        </span>
      )}
    </li>
  );
}
