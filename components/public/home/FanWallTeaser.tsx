// components/public/home/FanWallTeaser.tsx
//
// A glimpse of the Freedom Wall — the newest few notes, tilted like they
// are on the wall — and the door to it. Same activity gate as the wall page
// itself (an active, unarchived event), so this hides whenever the wall is
// closed.
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { SectionHeading } from "@/components/public/system/SectionHeading";
import { GlassPanel } from "@/components/public/system/GlassPanel";
import { Reveal } from "@/components/public/system/Reveal";
import { CtaButton } from "@/components/public/system/CtaButton";

export async function FanWallTeaser() {
  const settings = await prisma.freedomWallSettings
    .findUnique({
      where: { id: "singleton" },
      select: { isActive: true, activeEvent: { select: { id: true, title: true, isArchived: true } } },
    })
    .catch(() => null);
  if (!settings?.isActive || !settings.activeEvent || settings.activeEvent.isArchived) return null;

  const notes = await prisma.freedomWallNote
    .findMany({
      where: { eventId: settings.activeEvent.id, isArchived: false, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { id: true, nickname: true, content: true, color: true, rotation: true },
    })
    .catch(() => []);

  return (
    <Reveal as="section" className="section-padding">
      <GlassPanel padding="page">
        <SectionHeading
          eyebrow="Fan wall"
          title={settings.activeEvent.title}
          description="Leave a note on the wall — everyone who visits sees it."
          action={{ label: "Open the wall", href: "/wall" }}
        />
        {notes.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {notes.map((note, i) => (
              <Link
                key={note.id}
                href="/wall"
                className="group block"
                style={{ transform: `rotate(${Math.max(-6, Math.min(6, note.rotation || (i - 1) * 2.5))}deg)` }}
              >
                <div
                  className="aspect-square rounded-sm p-5 font-caveat text-2xl leading-snug text-ink shadow-[0_12px_30px_-10px_rgba(0,0,0,0.6)] transition-transform duration-300 group-hover:-translate-y-1 group-hover:rotate-0"
                  style={{ backgroundColor: note.color }}
                >
                  <p className="line-clamp-5">{note.content}</p>
                  <p className="mt-3 font-body text-[11px] uppercase tracking-[0.2em] text-ink/60">— {note.nickname}</p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="font-body text-sm text-cream/60">The wall is up and empty — be the first to write on it.</p>
        )}
        <div className="mt-10">
          <CtaButton href="/wall" variant="ghost">
            Leave a note
          </CtaButton>
        </div>
      </GlassPanel>
    </Reveal>
  );
}
