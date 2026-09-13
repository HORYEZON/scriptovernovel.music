// components/public/EventsMap.tsx
"use client";

// Public "Timeline / Gigs" map on the About page — one pin per place Kyla
// has performed/exhibited at. Red pin = a regular past/upcoming event;
// yellow + shimmering pin = whichever event is currently flagged
// isNextEvent (admin: Timeline/Events → the star toggle). Clicking a pin
// opens a bottom-sheet-style modal (full-width on mobile, centered dialog
// on desktop) with that event's title/date/venue/description and media.
//
// Uses OpenStreetMap tiles via react-leaflet/Leaflet — no API key, no
// billing account, nothing to configure. Same "own the pins ourselves"
// approach as the admin's LocationPicker (EventsClient.tsx): a plain
// L.divIcon rendering our own SVG/CSS instead of Leaflet's default marker
// image, so the pulsing "Next Event" treatment is just CSS, not a second
// icon asset to ship.
import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { X, Calendar, MapPin as MapPinIcon, Star, Film, ImageIcon } from "lucide-react";
import Image from "@/components/ui/SafeImage";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";

export interface PublicEventMedia {
  id: string;
  url: string;
  type: "IMAGE" | "VIDEO";
}

export interface PublicEvent {
  id: string;
  title: string;
  description: string | null;
  venueName: string | null;
  latitude: number;
  longitude: number;
  eventDate: string | null;
  isNextEvent: boolean;
  createdAt: string;
  media: PublicEventMedia[];
}

// Loaded as ONE dynamic(..., { ssr: false }) component rather than
// dynamic-importing MapContainer/TileLayer/Marker individually — see
// EventsMapLeaflet.tsx's header comment for why that split caused the map
// to render full-bleed over the rest of the page instead of staying inside
// this section.
const EventsMapLeaflet = dynamic(() => import("./EventsMapLeaflet"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-ink-900/60 text-white/40 font-body text-xs">
      Loading map…
    </div>
  ),
});

function formatEventDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function EventModal({ event, onClose }: { event: PublicEvent; onClose: () => void }) {
  // Full-image lightbox on click — same pattern as the admin's
  // TrashClient.tsx (setPreviewImage), adapted for the public site's dark
  // theme. Video tiles already have their own native controls/fullscreen,
  // so only IMAGE media opens this.
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  useLockBodyScroll(true);
  const dateLabel = formatEventDate(event.eventDate);

  return (
    <div
      // Leaflet's own panes/controls use z-index up to 1000 (see its
      // default CSS) — this modal has to clear that or the map behind it
      // renders on top instead of staying tucked behind the backdrop.
      className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        // min(…vh, 100%) rather than a bare vh: this map also runs inside the
        // museum's Timeline & Gigs panel, where a CSS rotate means the overlay
        // above fills the pre-rotation box (as tall as the phone is *wide*)
        // while `vh` keeps measuring the phone's full height. `100%` is the
        // overlay's own height, so it caps the panel to what's actually drawn
        // there and changes nothing on an unrotated page.
        className="w-full sm:max-w-lg max-h-[min(85vh,100%)] sm:max-h-[min(80vh,100%)] bg-ink-900 border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col"
      >
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-white/10 shrink-0">
          <div className="min-w-0">
            <h3 className="font-grotesk font-bold text-lg uppercase tracking-wide text-white flex items-center gap-2">
              <span className="truncate">{event.title}</span>
              {event.isNextEvent && (
                <span className="inline-flex items-center gap-1 shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#FFE135]/15 text-[#FFE135] border border-[#FFE135]/30">
                  <Star size={10} className="fill-current" /> Next Event
                </span>
              )}
            </h3>
            {(event.venueName || dateLabel) && (
              <p className="mt-1 font-body text-xs text-white/60 flex items-center gap-3 flex-wrap">
                {event.venueName && (
                  <span className="inline-flex items-center gap-1">
                    <MapPinIcon size={12} /> {event.venueName}
                  </span>
                )}
                {dateLabel && (
                  <span className="inline-flex items-center gap-1">
                    <Calendar size={12} /> {dateLabel}
                  </span>
                )}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* min-h-0 overrides the flex item default of min-height:auto —
            without it, a flex child with overflow-y-auto never actually
            scrolls; it just grows to fit its content instead, which is
            what was pushing this modal (and the page under it) taller and
            taller as an event's photo count grew instead of capping at
            max-h-[85vh]/[80vh] above and scrolling internally. */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-6 space-y-5">
          {event.description && (
            <p className="font-body text-sm text-white/75 leading-relaxed whitespace-pre-line">
              {event.description}
            </p>
          )}

          {event.media.length > 0 && (
            <div className="grid grid-cols-3 gap-2.5">
              {event.media.map((m) => (
                <div
                  key={m.id}
                  className={`relative aspect-square rounded-lg overflow-hidden bg-black/30 ${m.type === "IMAGE" ? "group cursor-pointer" : ""}`}
                  onClick={m.type === "IMAGE" ? () => setPreviewImage(m.url) : undefined}
                >
                  {m.type === "IMAGE" ? (
                    <Image
                      src={m.url}
                      alt={event.title}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <video src={m.url} controls className="w-full h-full object-cover" />
                  )}
                  <div className="absolute top-1.5 left-1.5 p-1 rounded bg-black/60 text-white/80">
                    {m.type === "IMAGE" ? <ImageIcon size={10} /> : <Film size={10} />}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!event.description && event.media.length === 0 && (
            <p className="font-body text-sm text-white/40 italic">More details coming soon.</p>
          )}
        </div>
      </div>

      {/* FULL IMAGE PREVIEW LIGHTBOX — above this modal's own z-[2000].
          Sized down from a near-edge-to-edge fit (max-w-4xl h-[80vh], no
          margin) to leave real breathing room on all sides, with a
          stronger backdrop-blur (xl vs md) and lower opacity (/80 vs /90)
          so the page behind visibly blurs through instead of reading as
          flat black. */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[3000] flex items-center justify-center p-6 sm:p-10 md:p-16 bg-black/80 backdrop-blur-xl"
          onClick={(e) => {
            e.stopPropagation();
            setPreviewImage(null);
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setPreviewImage(null);
            }}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            aria-label="Close"
          >
            <X size={22} />
          </button>
          <div
            // min(…vh, 100%) for the same forced-landscape reason as the modal
            // above — a bare vh here is the phone's full height, roughly twice
            // what the rotated overlay actually draws.
            className="relative w-full max-w-2xl h-[min(60vh,100%)] sm:h-[min(65vh,100%)] rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-black/40"
            onClick={(e) => e.stopPropagation()}
          >
            <Image src={previewImage} alt={event.title} fill className="object-contain" priority />
          </div>
        </div>
      )}
    </div>
  );
}

export function EventsMap({
  events,
  heightClass = "h-[300px] md:h-[500px]",
}: {
  events: PublicEvent[];
  /** Height of the (non-fullscreen) map box. Overridable because the museum's
   * Timeline & Gigs panel hosts this inside a modal on a forced-landscape
   * phone, where the whole panel is only as tall as the phone is wide — and
   * `md:` can't tell that apart from a desktop, since it measures the
   * pre-rotation viewport width (the phone's *height*). */
  heightClass?: string;
}) {
  const [selected, setSelected] = useState<PublicEvent | null>(null);
  // CSS-driven "pseudo-fullscreen" rather than the browser's native
  // Fullscreen API — see MapControlsBar.tsx's fullscreen button for why
  // (mainly: no native "Press Esc to exit" browser chrome we can't control,
  // and inconsistent mobile support). Locks page scroll while active so the
  // fixed-position map box doesn't leave the rest of the page scrollable
  // underneath it.
  const [isFullscreen, setIsFullscreen] = useState(false);
  useLockBodyScroll(isFullscreen);

  const center = useMemo((): [number, number] => {
    if (events.length === 0) return [12.8797, 121.774]; // Philippines, default framing
    const next = events.find((e) => e.isNextEvent) ?? events[0];
    return [next.latitude, next.longitude];
  }, [events]);

  if (events.length === 0) return null;

  return (
    <div className="relative">
      {/* isolate scoped to just the map box (not the whole component, and
          not the modal below) — it pins its own stacking context so
          Leaflet's internal panes/controls (z-index up to 1000 by default)
          can never compete with the site's navbar/marquee. Putting isolate
          on an ancestor of EventModal instead was a real bug: an isolated
          element with no z-index of its own paints in the page's "auto"
          bucket regardless of what z-index its descendants ask for, so the
          modal's z-[2000] was being silently capped there — losing to any
          other fixed, positive-z-index element elsewhere on the page (the
          FAQ chat bubble, background-music toggle, back-to-top button —
          all z-40/z-50, see their components) even though 2000 > 40 on
          paper. The modal needs to be a sibling of the isolated box, not a
          descendant of it, to actually compete in the real page stacking
          order.

          Fullscreen mode swaps the box's own sizing/position classes for a
          fixed, full-viewport ones — z-[1900] deliberately sits *below*
          EventModal's z-[2000] above, so opening a pin's details while
          already fullscreen still shows the modal on top instead of behind
          the fullscreen map.

          Sized by inset-0 alone, on purpose — no w-screen/h-screen. Those are
          100vw/100vh, and both lie exactly where this box is drawn on a
          phone: inside the museum's forced-landscape rotate they measure the
          *un-rotated* phone (so the box came out the wrong shape and ran off
          the edges), and in portrait mobile 100vh overshoots the visible
          viewport by the browser's own bar — which pushed MapControlsBar's
          bottom-3 row, and with it the only "exit full screen" button, out
          of reach. inset-0 fills whatever box actually contains it. */}
      <div
        className={
          isFullscreen
            ? "isolate fixed inset-0 z-[1900] [contain:layout_paint] [&_.leaflet-container]:bg-ink-900 [&_.leaflet-control-attribution]:!bg-black/60 [&_.leaflet-control-attribution]:!text-white/50 [&_.leaflet-control-attribution]:!text-[10px] [&_.leaflet-control-zoom_a]:!bg-black/70 [&_.leaflet-control-zoom_a]:!text-white [&_.leaflet-control-zoom_a]:!border-white/10"
            : `isolate w-full ${heightClass} rounded-xl overflow-hidden border border-white/10 [contain:layout_paint] [&_.leaflet-container]:bg-ink-900 [&_.leaflet-control-attribution]:!bg-black/60 [&_.leaflet-control-attribution]:!text-white/50 [&_.leaflet-control-attribution]:!text-[10px] [&_.leaflet-control-zoom_a]:!bg-black/70 [&_.leaflet-control-zoom_a]:!text-white [&_.leaflet-control-zoom_a]:!border-white/10`
        }
      >
        <EventsMapLeaflet
          events={events}
          center={center}
          zoom={events.length === 1 ? 11 : 5}
          onSelect={setSelected}
          isFullscreen={isFullscreen}
          onToggleFullscreen={() => setIsFullscreen((f) => !f)}
        />
      </div>

      {selected && <EventModal event={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
