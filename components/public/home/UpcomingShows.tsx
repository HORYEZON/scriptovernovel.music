// components/public/home/UpcomingShows.tsx
//
// The next few dated (or TBA) shows, as a show list with ticket links.
// Renders nothing when there is nothing upcoming — the homepage composes only
// the sections that have something to say. The full calendar, the archive and
// the map live on /shows.
import { getUpcomingShows } from "@/lib/shows-server";
import { SectionHeading } from "@/components/public/system/SectionHeading";
import { GlassPanel } from "@/components/public/system/GlassPanel";
import { Reveal } from "@/components/public/system/Reveal";
import { ShowRow } from "@/components/public/ShowRow";

export async function UpcomingShows() {
  const shows = await getUpcomingShows();
  if (shows.length === 0) return null;
  return (
    <Reveal as="section" className="section-padding">
      <GlassPanel padding="page">
        <SectionHeading eyebrow="Live" title="Upcoming shows" action={{ label: "All shows", href: "/shows" }} />
        <ul className="divide-y divide-white/10">
          {shows.map((show) => (
            <ShowRow key={show.id} show={show} />
          ))}
        </ul>
      </GlassPanel>
    </Reveal>
  );
}
