// app/api/site-design/route.ts
//
// GET  — the resolved Site Design singleton + ordered menu rows (public;
//        the admin editor also refreshes from it after a save).
// PUT  — admin-only. Body: { settings?: Partial<SiteDesignSettings>,
//        menuItems?: SiteMenuItem[] }. When `menuItems` is present it is the
//        complete new list: rows are upserted by id in the given order and
//        any row not in the list is deleted, all in one transaction, so the
//        editor's single Save is atomic and the public menu never shows a
//        half-applied reorder.
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { logContentChange } from "@/lib/activity-log-server";
import {
  DEFAULT_SITE_DESIGN,
  resolveSiteDesign,
  resolveMenuItems,
  sanitizeSiteDesignInput,
  rejectedSiteDesignFields,
  sanitizeMenuItem,
  MAX_LABEL_LENGTH,
} from "@/lib/site-design";

const MAX_MENU_ITEMS = 20;

async function readAll() {
  const [record, rows] = await Promise.all([
    prisma.siteDesign.findUnique({ where: { id: "singleton" } }),
    prisma.siteMenuItem.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  return { settings: resolveSiteDesign(record), menuItems: resolveMenuItems(rows) };
}

export async function GET() {
  try {
    return NextResponse.json(await readAll());
  } catch {
    return NextResponse.json({ settings: DEFAULT_SITE_DESIGN, menuItems: resolveMenuItems([]) });
  }
}

export async function PUT(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const body = (await request.json()) as { settings?: unknown; menuItems?: unknown };

    // ── Settings ─────────────────────────────────────────────────────────
    const rawSettings =
      body.settings && typeof body.settings === "object"
        ? (body.settings as Record<string, unknown>)
        : {};
    const rejected = rejectedSiteDesignFields(rawSettings);
    if (rejected.length > 0) {
      return NextResponse.json(
        { error: `Invalid value(s) for: ${rejected.join(", ")}` },
        { status: 400 }
      );
    }
    const cleanSettings = sanitizeSiteDesignInput(rawSettings);

    // ── Menu items ───────────────────────────────────────────────────────
    let cleanItems: ReturnType<typeof sanitizeMenuItem>[] | null = null;
    if (body.menuItems !== undefined) {
      if (!Array.isArray(body.menuItems)) {
        return NextResponse.json({ error: "menuItems must be an array" }, { status: 400 });
      }
      if (body.menuItems.length > MAX_MENU_ITEMS) {
        return NextResponse.json(
          { error: `At most ${MAX_MENU_ITEMS} menu items` },
          { status: 400 }
        );
      }
      cleanItems = body.menuItems.map((row, i) => sanitizeMenuItem(row, i));
      const badIndex = cleanItems.findIndex((item) => item === null);
      if (badIndex !== -1) {
        return NextResponse.json(
          {
            error: `Menu item #${badIndex + 1} needs a label (max ${MAX_LABEL_LENGTH} chars) and a link that starts with "/", "http(s)://" or "mailto:"`,
          },
          { status: 400 }
        );
      }
    }

    if (Object.keys(cleanSettings).length === 0 && cleanItems === null) {
      return NextResponse.json({ error: "Nothing to save" }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      if (Object.keys(cleanSettings).length > 0) {
        await tx.siteDesign.upsert({
          where: { id: "singleton" },
          update: cleanSettings,
          create: { id: "singleton", ...DEFAULT_SITE_DESIGN, ...cleanSettings },
        });
      }
      if (cleanItems) {
        const items = cleanItems as NonNullable<(typeof cleanItems)[number]>[];
        const existing = await tx.siteMenuItem.findMany({ select: { id: true } });
        const existingIds = new Set(existing.map((r) => r.id));
        const keptIds = new Set<string>();
        for (const item of items) {
          const { id, ...data } = item;
          if (id && existingIds.has(id)) {
            await tx.siteMenuItem.update({ where: { id }, data });
            keptIds.add(id);
          } else {
            // New row, or a client temp id / built-in default id we never
            // persisted — let Prisma mint the cuid.
            const created = await tx.siteMenuItem.create({ data });
            keptIds.add(created.id);
          }
        }
        const stale = existing.filter((r) => !keptIds.has(r.id)).map((r) => r.id);
        if (stale.length > 0) {
          await tx.siteMenuItem.deleteMany({ where: { id: { in: stale } } });
        }
      }
    });

    logContentChange("updated", "site-design", { id: "singleton", name: "Site Design" }, {
      request,
      changed: [
        ...Object.keys(cleanSettings),
        ...(cleanItems ? ["menuItems"] : []),
      ],
    });

    revalidatePath("/", "layout");
    return NextResponse.json(await readAll());
  } catch (err) {
    console.error("[PUT /api/site-design]", err);
    return NextResponse.json({ error: "Failed to save site design" }, { status: 500 });
  }
}
