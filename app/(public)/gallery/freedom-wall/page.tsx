// app/(public)/gallery/freedom-wall/page.tsx
// Server-rendered entry point for the public Freedom Wall room.
// Fetches room status + current notes in one pass; the client component
// handles new submissions optimistically without a page refresh.

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, MessageSquareOff } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { FreedomWallClient } from "./components/FreedomWallClient";
import type { NoteData } from "./components/StickyNote";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Freedom Wall",
  description: "Leave an anonymous sticky note on the wall.",
};

async function getRoomData() {
  const settings = await prisma.freedomWallSettings
    .findUnique({
      where: { id: "singleton" },
      select: {
        isActive: true,
        activeEvent: {
          select: { id: true, title: true, isArchived: true },
        },
      },
    })
    .catch(() => null);

  if (!settings?.isActive || !settings.activeEvent || settings.activeEvent.isArchived) {
    return { active: false, eventTitle: "", eventId: "", notes: [] as NoteData[] };
  }

  const rawNotes = await prisma.freedomWallNote.findMany({
    where: { eventId: settings.activeEvent.id, isArchived: false, deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      nickname: true,
      content: true,
      positionX: true,
      positionY: true,
      color: true,
      rotation: true,
      scale: true,
      createdAt: true,
    },
  });

  const notes: NoteData[] = rawNotes.map((n) => ({
    ...n,
    createdAt: n.createdAt.toISOString(),
  }));

  return { active: true, eventTitle: settings.activeEvent.title, eventId: settings.activeEvent.id, notes };
}

export default async function FreedomWallPage() {
  const { active, eventTitle, eventId, notes } = await getRoomData();

  // pt-16 md:pt-20 — account for the site's fixed Navbar (h-16/h-20).
  // The <main> in layout.tsx only pads for the marquee ticker height via
  // --marquee-h; every full-bleed page must add its own navbar offset on top.
  return (
    <div className="min-h-[calc(100vh-var(--marquee-h,0px))] flex flex-col bg-[#faf8f3] dark:bg-zinc-900 pt-16 md:pt-20">
      {/* Header — sticks just below the fixed site Navbar */}
      <header className="sticky top-16 md:top-20 z-20 flex items-center gap-3 px-4 py-3 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-black/10 dark:border-white/10">
        {/* "/" not "/gallery": the gallery is the homepage and /gallery is a
            redirect stub — soft-navigating there blanks the page until a
            refresh (see gallery/museum/MuseumClient.tsx's Back link). */}
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
        >
          <ArrowLeft size={16} /> Back
        </Link>
        <span className="text-zinc-300 dark:text-zinc-600">|</span>
        <h1 className="font-semibold text-sm tracking-wide">🧱 Freedom Wall</h1>
      </header>

      {/* Content */}
      {!active ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-zinc-400 px-6 text-center">
          <MessageSquareOff size={40} className="opacity-40" />
          <p className="font-medium">The Freedom Wall is currently closed.</p>
          <p className="text-sm opacity-70">Check back later — the admin will open it for the next event.</p>
        </div>
      ) : (
        <FreedomWallClient initialNotes={notes} eventTitle={eventTitle} eventId={eventId} />
      )}
    </div>
  );
}
