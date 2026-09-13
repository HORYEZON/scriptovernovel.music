// app/api/admin/inactivity/route.ts
//
// GET   — the signed-in admin's inactivity auto sign-out setting.
// PATCH — { enabled?, minutes? } — change it.
//
// Backs the "Automatic Sign-Out" card in Settings ▸ Security. Always scoped
// to the caller's own account: this is a per-user preference about the
// machine they sign in from (see the schema comment on
// User.inactivityLogoutEnabled), so there is deliberately no way to address
// another user's setting through this route.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";
import { auth } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log-server";
import { isValidInactivityMinutes, INACTIVITY_OPTIONS } from "@/lib/inactivity";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  // requireAdmin also accepts an x-api-key caller, which has no session and
  // therefore no "own account" for this setting to be about.
  if (!userId) {
    return NextResponse.json({ error: "This setting is per-account." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { inactivityLogoutEnabled: true, inactivityLogoutMinutes: true },
  });

  return NextResponse.json({
    enabled: user?.inactivityLogoutEnabled ?? false,
    minutes: user?.inactivityLogoutMinutes ?? 30,
  });
}

export async function PATCH(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "This setting is per-account." }, { status: 400 });
  }

  try {
    const body = (await request.json().catch(() => null)) as
      | { enabled?: unknown; minutes?: unknown }
      | null;

    const data: { inactivityLogoutEnabled?: boolean; inactivityLogoutMinutes?: number } = {};

    if (body?.enabled !== undefined) {
      if (typeof body.enabled !== "boolean") {
        return NextResponse.json({ error: "`enabled` must be true or false." }, { status: 400 });
      }
      data.inactivityLogoutEnabled = body.enabled;
    }

    if (body?.minutes !== undefined) {
      // Validated against the offered list rather than a numeric range: the
      // guard's warning countdown assumes an interval comfortably longer than
      // INACTIVITY_WARNING_SECONDS, and "2 minutes" would make the warning
      // most of the timeout.
      if (!isValidInactivityMinutes(body.minutes)) {
        return NextResponse.json(
          {
            error: `\`minutes\` must be one of ${INACTIVITY_OPTIONS.map((o) => o.minutes).join(", ")}.`,
          },
          { status: 400 }
        );
      }
      data.inactivityLogoutMinutes = body.minutes;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "Nothing to update — send `enabled` and/or `minutes`." },
        { status: 400 }
      );
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        name: true,
        email: true,
        inactivityLogoutEnabled: true,
        inactivityLogoutMinutes: true,
      },
    });

    void logActivity({
      category: "AUTH",
      action: "auth.inactivity-timeout.updated",
      summary: user.inactivityLogoutEnabled
        ? `${user.name || user.email} set automatic sign-out to ${user.inactivityLogoutMinutes} minutes of inactivity.`
        : `${user.name || user.email} turned off automatic sign-out.`,
      entityType: "user",
      entityId: userId,
      metadata: {
        enabled: user.inactivityLogoutEnabled,
        minutes: user.inactivityLogoutMinutes,
      },
      request,
    });

    return NextResponse.json({
      enabled: user.inactivityLogoutEnabled,
      minutes: user.inactivityLogoutMinutes,
    });
  } catch (error) {
    console.error("[inactivity] failed to update", error);
    return NextResponse.json({ error: "Could not save that setting." }, { status: 500 });
  }
}
