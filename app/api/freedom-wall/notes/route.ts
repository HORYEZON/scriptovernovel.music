// app/api/freedom-wall/notes/route.ts
// GET  — public, returns non-archived notes for the active event.
// POST — public (no auth), creates a note in the active event.
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log-server";

export const dynamic = "force-dynamic";

// Pastel sticky-note colors cycled/randomised on the server so every viewer
// sees the same colour for each note.
const NOTE_COLORS = ["yellow", "pink", "blue", "green", "purple", "orange"];

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// GET /api/freedom-wall/notes
export async function GET() {
  try {
    const settings = await prisma.freedomWallSettings.findUnique({
      where: { id: "singleton" },
      select: { isActive: true, activeEventId: true },
    });

    if (!settings?.isActive || !settings.activeEventId) {
      return NextResponse.json([]);
    }

    const notes = await prisma.freedomWallNote.findMany({
      where: { eventId: settings.activeEventId, isArchived: false, deletedAt: null },
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
        wall: true,
        createdAt: true,
      },
    });

    return NextResponse.json(notes);
  } catch {
    return NextResponse.json({ error: "Failed to fetch notes" }, { status: 500 });
  }
}

// POST /api/freedom-wall/notes
export async function POST(request: NextRequest) {
  try {
    const settings = await prisma.freedomWallSettings.findUnique({
      where: { id: "singleton" },
      select: { isActive: true, activeEventId: true },
    });

    if (!settings?.isActive) {
      return NextResponse.json({ error: "Freedom Wall is not currently active" }, { status: 403 });
    }

    if (!settings.activeEventId) {
      return NextResponse.json(
        { error: "No active event configured — ask the admin to set one up" },
        { status: 422 }
      );
    }

    const body = await request.json().catch(() => ({}));

    // reCAPTCHA v3 verification — same pattern as /api/contact/route.ts.
    // Score threshold 0.5: bots typically score 0.0–0.3; human interactions
    // score 0.7–1.0. We intentionally use the same threshold site-wide so
    // tuning is in one place.
    const captchaToken = typeof body.captchaToken === "string" ? body.captchaToken : "";
    if (!captchaToken) {
      return NextResponse.json({ error: "reCAPTCHA token missing" }, { status: 400 });
    }
    const verifyRes = await fetch(
      `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${captchaToken}`,
      { method: "POST" }
    );
    const verifyData = await verifyRes.json();
    if (!verifyData.success || verifyData.score < 0.5) {
      return NextResponse.json({ error: "reCAPTCHA verification failed. Please try again." }, { status: 403 });
    }

    const nickname = (typeof body.nickname === "string" ? body.nickname.trim() : "") || "Anonymous";
    const content = typeof body.content === "string" ? body.content.trim() : "";

    if (!content) {
      return NextResponse.json({ error: "Note content is required" }, { status: 400 });
    }
    if (content.length > 500) {
      return NextResponse.json({ error: "Note content must be 500 characters or fewer" }, { status: 400 });
    }
    if (nickname.length > 50) {
      return NextResponse.json({ error: "Nickname must be 50 characters or fewer" }, { status: 400 });
    }

    // Accept visitor's chosen colour if it's in the palette; fall back to
    // a random one so any malformed value is silently corrected server-side.
    const requestedColor = typeof body.color === "string" ? body.color : "";
    const color = NOTE_COLORS.includes(requestedColor) ? requestedColor : randomItem(NOTE_COLORS);

    // Random placement across the wall (leaving a small margin so notes don't
    // clip the edges). Rotation adds a natural "pinned paper" feel.
    const positionX = 5 + Math.random() * 85;  // 5–90 %
    const positionY = 5 + Math.random() * 75;  // 5–80 %
    const rotation = (Math.random() - 0.5) * 20; // −10 … +10 °

    const note = await prisma.freedomWallNote.create({
      data: {
        nickname,
        content,
        eventId: settings.activeEventId,
        positionX,
        positionY,
        color,
        rotation,
      },
      select: {
        id: true,
        nickname: true,
        content: true,
        positionX: true,
        positionY: true,
        color: true,
        rotation: true,
        scale: true,
        wall: true,
        createdAt: true,
      },
    });

    revalidatePath("/gallery/freedom-wall");

    // `anonymous: true` — a Freedom Wall poster is a museum visitor by
    // definition, so skipping the session lookup here saves a round-trip on
    // a public, rate-limited path. The nickname they chose is the only
    // identity there is, and it goes in the summary rather than the actor.
    void logActivity({
      category: "VISITOR",
      action: "freedom-wall.note.posted",
      summary: `${note.nickname || "Someone"} posted a note on the Freedom Wall.`,
      entityType: "freedom-wall-note",
      entityId: note.id,
      anonymous: true,
      request,
    });

    return NextResponse.json(note, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create note" }, { status: 500 });
  }
}
