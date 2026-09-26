// app/(public)/shows/page.tsx
//
// The band's live page: what's coming (with ticket links), then the archive of
// everything played, by year, then the map of every place they've played.
//
// This block used to be a section on About (`/about#shows`), which meant the
// gigs — the one thing on the site with a deadline — sat three screens below a
// bio, with no address of their own to post, and nothing for Google to read as
// an event. About now carries the next few and links here; the full history,
// the ticket links and the MusicEvent structured data live on this page.
import type { Metadata } from "next";
import { getProfile } from "@/lib/public-data";
import { getPublicShows, groupShowsByYear, splitShows } from "@/lib/shows-server";
import { isValidTicketUrl, showVenueLine } from "@/lib/shows";
import { SITE_URL } from "@/lib/site-url";
import { JsonLd } from "@/components/public/JsonLd";
import { PageHero } from "@/components/public/system/PageHero";
import { GlassPanel } from "@/components/public/system/GlassPanel";
import { SectionHeading } from "@/components/public/system/SectionHeading";
import { CtaButton } from "@/components/public/system/CtaButton";
import { Reveal } from "@/components/public/system/Reveal";
import { EventsMap } from "@/components/public/EventsMap";
import { ShowRow } from "@/components/public/ShowRow";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shows",
  description: "ScriptOverNovel live — upcoming gigs, tickets, and every stage we've played.",
};

export default async function ShowsPage() {
  const [shows, profile] = await Promise.all([
    getPublicShows(),
    getProfile().catch(() => null),
  ]);
  const { upcoming, past } = splitShows(shows);
  const pastByYear = groupShowsByYear(past);
  const bandName = profile?.displayName || "ScriptOverNovel";
  const next = upcoming[0] ?? null;

  // The hero photo is the next show's own first picture (a poster, usually);
  // failing that, the most recent one that has any. A gig page opening on a
  // stock glow when there is a poster sitting in the admin is a waste.
  const heroImage =
    [...upcoming, ...past].find((s) => s.media.some((m) => m.type === "IMAGE"))?.media.find((m) => m.type === "IMAGE")?.url ??
    null;

  const subtitle = next
    ? `Next: ${next.title}${showVenueLine(next.venueName, next.city) ? ` · ${showVenueLine(next.venueName, next.city)}` : ""}`
    : past.length > 0
      ? "No dates on the books right now — the archive of everything we've played is below."
      : "No dates announced yet.";

  return (
    <div className="pb-24">
      {/* One ItemList of MusicEvents for the upcoming shows, so a gig can turn
          up in search with its date, venue and ticket link attached. Past
          shows are left out: an event result for a night that already
          happened helps nobody. */}
      {upcoming.length > 0 && (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "ItemList",
            itemListElement: upcoming.map((show, i) => ({
              "@type": "ListItem",
              position: i + 1,
              item: {
                "@type": "MusicEvent",
                name: show.title,
                url: `${SITE_URL}/shows`,
                ...(show.eventDate && { startDate: show.eventDate }),
                eventStatus:
                  show.status === "CANCELLED"
                    ? "https://schema.org/EventCancelled"
                    : show.status === "POSTPONED"
                      ? "https://schema.org/EventPostponed"
                      : "https://schema.org/EventScheduled",
                eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
                performer: { "@type": "MusicGroup", name: bandName },
                ...(show.description && { description: show.description }),
                location: {
                  "@type": "Place",
                  name: show.venueName || show.city || "Venue to be announced",
                  ...(show.city && { address: { "@type": "PostalAddress", addressLocality: show.city } }),
                  geo: { "@type": "GeoCoordinates", latitude: show.latitude, longitude: show.longitude },
                },
                ...(isValidTicketUrl(show.ticketUrl) && {
                  offers: {
                    "@type": "Offer",
                    url: show.ticketUrl,
                    availability:
                      show.status === "SOLD_OUT"
                        ? "https://schema.org/SoldOut"
                        : "https://schema.org/InStock",
                    ...(show.ticketPrice !== null && { price: show.ticketPrice, priceCurrency: "PHP" }),
                  },
                }),
              },
            })),
          }}
        />
      )}

      <PageHero
        image={heroImage}
        blur="lg"
        eyebrow="Live"
        title="Shows"
        subtitle={subtitle}
      >
        {next && isValidTicketUrl(next.ticketUrl) && next.status !== "SOLD_OUT" && (
          <CtaButton href={next.ticketUrl!} external>
            Get tickets
          </CtaButton>
        )}
        <CtaButton href="/contact" variant="ghost">
          Book us
        </CtaButton>
      </PageHero>

      <div className="mt-12 space-y-16 md:mt-16 md:space-y-24">
        <Reveal as="section" className="section-padding">
          <GlassPanel padding="page">
            <SectionHeading
              eyebrow="Upcoming"
              title={upcoming.length > 0 ? "On the calendar" : "Nothing booked yet"}
              description={
                upcoming.length > 0
                  ? `${upcoming.length} date${upcoming.length === 1 ? "" : "s"} ahead`
                  : "We're between dates. If you're putting on a show, the contact page reaches us."
              }
            />
            {upcoming.length > 0 ? (
              <ul className="divide-y divide-white/10">
                {upcoming.map((show) => (
                  <ShowRow key={show.id} show={show} />
                ))}
              </ul>
            ) : (
              <CtaButton href="/contact" variant="ghost">
                Get in touch
              </CtaButton>
            )}
          </GlassPanel>
        </Reveal>

        {past.length > 0 && (
          <Reveal as="section" className="section-padding">
            <GlassPanel padding="page">
              <SectionHeading
                eyebrow="Archive"
                title="Where we've played"
                description={`${past.length} show${past.length === 1 ? "" : "s"} so far`}
              />
              {Array.from(pastByYear.entries()).map(([year, yearShows]) => (
                <div key={year} className="mb-8 last:mb-0">
                  <p className="mb-2 font-body text-[10px] uppercase tracking-[0.3em] text-cream/50">{year}</p>
                  <ul className="divide-y divide-white/10">
                    {yearShows.map((show) => (
                      <ShowRow key={show.id} show={show} muted />
                    ))}
                  </ul>
                </div>
              ))}
            </GlassPanel>
          </Reveal>
        )}

        {shows.length > 0 && (
          <Reveal as="section" className="section-padding">
            <GlassPanel padding="page">
              <SectionHeading
                eyebrow="Map"
                title="Every stage"
                description="One pin per place we've played. The glowing one is the next show."
              />
              <EventsMap events={shows} />
            </GlassPanel>
          </Reveal>
        )}
      </div>
    </div>
  );
}
