// app/api/visitor-count/route.ts
//
// POST — called once per browser (see components/VisitorCounter.tsx) to
// register a visit against the server-authoritative SiteVisitCounter and
// report back the running total plus any milestone(s) newly reached.
// Reuses the exact same anonymous signed-cookie identity as the Mini
// Games feature (lib/minigames/player.ts) instead of a second parallel
// cookie — an existing cookie already means "we've seen this browser
// before," so the counter only increments the very first time a given
// browser is seen; every call after that (page revisits, tab reopens,
// simple refreshes) is a no-op read. Rate-limited per IP on top of that,
// mainly to blunt a script hammering this endpoint with cookies stripped
// each time — see lib/minigames/rate-limit.ts's own doc comment on why a
// per-instance in-memory limiter is the right trade for a feature whose
// worst case is an inflated fun-fact counter, not a real vulnerability.
//
// GET — read-only: current count + achieved milestones, no cookie writes.
// Not currently called by anything (POST's response already covers every
// page that pings), kept for a future "just show the count" widget that
// shouldn't also count itself as a visit.
//
// PATCH — admin-only recalibration (Settings ▸ Visitor Milestones), e.g.
// to seed the counter from the site's existing Vercel Analytics history
// instead of starting over from zero.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { readPlayerId, ensurePlayerId } from "@/lib/minigames/player";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/minigames/rate-limit";

export const dynamic = "force-dynamic";

const COUNTER_ID = "singleton";
// Generous — a legitimate browser only ever needs this once, but a few
// retries (slow network, multiple tabs opening at once) shouldn't trip it.
const PING_LIMIT = { limit: 20, windowMs: 60_000 };

async function achievedMilestonesPublic() {
  return prisma.visitorMilestone.findMany({
    where: { enabled: true, achievedAt: { not: null } },
    orderBy: { threshold: "asc" },
    select: { id: true, threshold: true, reward: true },
  });
}

// Any threshold the current count has now reached gets stamped achieved —
// intentionally a `lte` sweep rather than an exact-match check, since a
// burst of concurrent first-time visitors (or an admin's manual
// recalibration below) can cross more than one milestone in a single
// increment. Never clears an existing achievedAt — once earned, a
// milestone stays earned even if the count is later reduced.
async function markNewlyAchieved(count: number) {
  await prisma.visitorMilestone.updateMany({
    where: { enabled: true, achievedAt: null, threshold: { lte: count } },
    data: { achievedAt: new Date() },
  });
}

export async function GET() {
  const counter = await prisma.siteVisitCounter.findUnique({ where: { id: COUNTER_ID } });
  return NextResponse.json({ count: counter?.count ?? 0, achievedMilestones: await achievedMilestonesPublic() });
}

export async function POST(request: NextRequest) {
  const limit = rateLimit(`visit-count:${clientIp(request)}`, PING_LIMIT.limit, PING_LIMIT.windowMs);
  if (!limit.ok) return tooManyRequests(limit.retryAfterSec);

  try {
    const existing = await readPlayerId();
    if (existing) {
      const counter = await prisma.siteVisitCounter.findUnique({ where: { id: COUNTER_ID } });
      return NextResponse.json({ count: counter?.count ?? 0, achievedMilestones: await achievedMilestonesPublic() });
    }

    // First time this browser has ever been seen (by this feature or Mini
    // Games) — mint its identity cookie and count the visit. Two tabs from
    // the same brand-new browser opened in the same instant could both
    // reach here before either cookie is set, double-counting that one
    // visitor by at most one — an accepted, documented trade-off for a fun
    // counter, not a guarantee this needs to be airtight against.
    await ensurePlayerId();
    const counter = await prisma.siteVisitCounter.upsert({
      where: { id: COUNTER_ID },
      update: { count: { increment: 1 } },
      create: { id: COUNTER_ID, count: 1 },
    });

    await markNewlyAchieved(counter.count);

    return NextResponse.json({ count: counter.count, achievedMilestones: await achievedMilestonesPublic() });
  } catch {
    return NextResponse.json({ error: "Failed to record visit" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = await request.json();
    const count = Number(body.count);
    if (!Number.isInteger(count) || count < 0) {
      return NextResponse.json({ error: "Count must be a non-negative whole number" }, { status: 400 });
    }

    const counter = await prisma.siteVisitCounter.upsert({
      where: { id: COUNTER_ID },
      update: { count },
      create: { id: COUNTER_ID, count },
    });

    await markNewlyAchieved(counter.count);

    return NextResponse.json({ count: counter.count });
  } catch {
    return NextResponse.json({ error: "Failed to update visitor count" }, { status: 500 });
  }
}
