// components/public/home/UpcomingShows.tsx
//
// The next few dated, enabled Events, as a show list (date block · title ·
// venue). Renders nothing when there is nothing upcoming — the homepage
// composes only the sections that have something to say. The full history
// and map live on About (#shows).
import { prisma } from "@/lib/prisma";
import { SectionHeading } from "@/components/public/system/SectionHeading";
import { GlassPanel } from "@/components/public/system/GlassPanel";
import { Reveal } from "@/components/public/system/Reveal";
import { ShowRow, type ShowRowData } from "@/components/public/ShowRow";

export async function getUpcomingShows(take = 3): Promise<ShowRowData[]> {
  const rows = await prisma.event
    .findMany({
      where: { enabled: true, deletedAt: null, eventDate: { gte: new Date() } },
      orderBy: { eventDate: "asc" },
      take,
      select: { id: true, title: true, venueName: true, eventDate: true, isNextEvent: true },
    })
    .catch(() => []);
  return rows.map((r) => ({ ...r, eventDate: r.eventDate ? r.eventDate.toISOString() : null }));
}

export async function UpcomingShows() {
  const shows = await getUpcomingShows();
  if (shows.length === 0) return null;
  return (
    <Reveal as="section" className="section-padding">
      <GlassPanel padding="page">
        <SectionHeading eyebrow="Live" title="Upcoming shows" action={{ label: "All shows", href: "/about#shows" }} />
        <ul className="divide-y divide-white/10">
          {shows.map((show) => (
            <ShowRow key={show.id} show={show} />
          ))}
        </ul>
      </GlassPanel>
    </Reveal>
  );
}
