// app/api/admin/notifications/route.ts
//
// GET   — notifications, newest first, plus the site-wide unread count.
//         Always excludes deletedAt (trashed — see app/api/trash/) and,
//         unless explicitly requested, isSpam/isArchived rows too — all
//         three are opt-in views, never part of the default list or the
//         bell's badge count.
//         No query params (the sidebar bell's call): the 20 most recent —
//         same shape as before this route grew pagination/filtering for the
//         full /admin/notifications page.
//         ?type=ORDER|HIGHSCORE|CONTACT|MUSEUM — restrict to one category (tabs).
//         ?subject=purchase|commission|... — further restrict CONTACT rows
//         by the contact form's subject (the Gmail tab's sub-filter — see
//         lib/contact.ts for the key list). Matched via a JSON path filter
//         against metadata.subject, so it only ever matches CONTACT rows
//         regardless of what `type` is set to.
//         ?spam=1 — show only isSpam rows instead of hiding them (the Gmail
//         tab's "Spam" chip). ?archived=1 — show only isArchived rows
//         instead of hiding them (the "Archived" toggle, available on every
//         tab, not just Gmail). If both are passed, ?archived=1 wins — an
//         archived row is filtered on isArchived regardless of isSpam.
//         ?page=1&pageSize=20 — server-side pagination; `total` in the
//         response reflects the current filters, `unreadCount` never does
//         (it's the bell's badge count, always site-wide/unfiltered).
// PATCH — mark one notification read ({ id }) or every unread one ({ all }).
import { NextRequest, NextResponse } from "next/server";
import type { NotificationType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { isContactSubjectKey } from "@/lib/contact";

export const dynamic = "force-dynamic";

const NOTIFICATION_TYPES: NotificationType[] = ["ORDER", "HIGHSCORE", "CONTACT", "MUSEUM"];
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

export async function GET(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const params = request.nextUrl.searchParams;

    const typeParam = params.get("type");
    const type =
      typeParam && NOTIFICATION_TYPES.includes(typeParam as NotificationType)
        ? (typeParam as NotificationType)
        : null;

    const subjectParam = params.get("subject");
    const subject = isContactSubjectKey(subjectParam) ? subjectParam : null;

    const spamOnly = params.get("spam") === "1";
    const archivedOnly = params.get("archived") === "1";

    const page = Math.max(1, parseInt(params.get("page") ?? "1", 10) || 1);
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, parseInt(params.get("pageSize") ?? "", 10) || DEFAULT_PAGE_SIZE)
    );

    const where: Prisma.NotificationWhereInput = {
      deletedAt: null,
      ...(archivedOnly
        ? { isArchived: true }
        : spamOnly
          ? { isSpam: true }
          : { isSpam: false, isArchived: false }),
      ...(type ? { type } : {}),
      ...(subject ? { metadata: { path: ["subject"], equals: subject } } : {}),
    };

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({
        where: { readAt: null, deletedAt: null, isSpam: false, isArchived: false },
      }),
    ]);

    return NextResponse.json({ notifications, unreadCount, total, page, pageSize });
  } catch (error) {
    console.error("[notifications] failed to list notifications", error);
    return NextResponse.json(
      { error: "Could not load notifications." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = (await request.json().catch(() => null)) as {
      id?: unknown;
      all?: unknown;
    } | null;

    if (body?.all === true) {
      await prisma.notification.updateMany({
        where: { readAt: null, deletedAt: null },
        data: { readAt: new Date() },
      });
      return NextResponse.json({ success: true });
    }

    const id = typeof body?.id === "string" ? body.id : null;
    if (!id) {
      return NextResponse.json({ error: "Malformed request." }, { status: 400 });
    }

    await prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[notifications] failed to mark notification read", error);
    return NextResponse.json(
      { error: "Could not update that notification." },
      { status: 500 }
    );
  }
}
