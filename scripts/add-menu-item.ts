// scripts/add-menu-item.ts
//
// Adds one row to the site's menu bar (Site Design ▸ Menu Items) from the
// command line, so a new public page can be reachable in the same pass that
// ships it.
//
// Why a script rather than the admin form: DEFAULT_MENU_ITEMS in
// lib/site-design.ts is only a *fallback* for an empty SiteMenuItem table. On
// a site whose menu has ever been saved, adding a page to that list changes
// nothing — the live bar is rows in the database. A page nobody can navigate
// to is not shipped, and a new page's menu row is part of the feature rather
// than a thing to remember afterwards.
//
// Idempotent: a row whose href already exists is left exactly as it is
// (including any colours or photo the admin has since chosen), so re-running
// this is safe. It appends to the end of the bar; reorder in the admin.
//
// Note DATABASE_URL points at the hosted database, so this writes to the live
// site's menu immediately. Nothing is deleted or overwritten — remove an
// unwanted row in Site Design ▸ Menu Items.
//
// Usage:
//   npx tsx scripts/add-menu-item.ts --label "Shows" --href "/shows"
//
//   Optional: --bg "#FDA063"         panel colour while hovered
//             --underline "#F5D480"  underline colour
//             --style straight       scribble | wave | straight | none
//             --after /music         insert right after this href instead of
//                                    at the end of the bar
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_MENU_ITEMS,
  MAX_LABEL_LENGTH,
  UNDERLINE_STYLE_OPTIONS,
  isValidHref,
  isValidUnderlineStyle,
} from "@/lib/site-design";
import { isValidThemeColor } from "@/lib/theme";

/** `--key value` pairs plus bare `--flag`s, which read as "true". */
function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      out[key] = next;
      i++;
    } else {
      out[key] = "true";
    }
  }
  return out;
}

const USAGE =
  "Usage: npx tsx scripts/add-menu-item.ts --label \"Shows\" --href \"/shows\"\n\n" +
  `  --label      max ${MAX_LABEL_LENGTH} chars\n` +
  "  --href       an internal path (/shows) or a full http(s) URL\n" +
  "  --bg         hover panel colour, e.g. \"#FDA063\" (optional)\n" +
  "  --underline  underline colour (optional)\n" +
  `  --style      ${UNDERLINE_STYLE_OPTIONS.map((o) => o.value).join(" | ")} (optional)\n` +
  "  --after      insert after this href instead of at the end (optional)";

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const label = args.label?.trim();
  const href = args.href?.trim();

  if (!label || label.length > MAX_LABEL_LENGTH || !isValidHref(href)) {
    console.error(`Both --label and --href are required, and --href must be a path or http(s) URL.\n\n${USAGE}`);
    process.exitCode = 1;
    return;
  }

  const existing = await prisma.siteMenuItem.findFirst({ where: { href } });
  if (existing) {
    console.log(
      `Menu already has a row for ${href} — "${existing.label}" at position ${existing.sortOrder}. Nothing changed.`
    );
    return;
  }

  const rows = await prisma.siteMenuItem.findMany({ orderBy: { sortOrder: "asc" } });

  // An empty table means the bar is still showing DEFAULT_MENU_ITEMS. Adding
  // one row would replace that whole fallback with a one-item menu, so the
  // defaults are written out first and the new row joins them.
  if (rows.length === 0) {
    await prisma.siteMenuItem.createMany({
      data: DEFAULT_MENU_ITEMS.map(({ id: _id, ...item }) => item),
    });
    console.log(`Menu was empty (showing the built-in defaults) — wrote those ${DEFAULT_MENU_ITEMS.length} rows first.`);
    // DEFAULT_MENU_ITEMS already contains this href on a fresh install.
    const nowExists = await prisma.siteMenuItem.findFirst({ where: { href } });
    if (nowExists) {
      console.log(`  …and "${nowExists.label}" (${href}) was one of them. Nothing else to do.`);
      return;
    }
  }

  const after = args.after?.trim();
  const current = await prisma.siteMenuItem.findMany({ orderBy: { sortOrder: "asc" } });
  const anchor = after ? current.find((r) => r.href === after) : undefined;
  const sortOrder = anchor ? anchor.sortOrder + 1 : (current.at(-1)?.sortOrder ?? -1) + 1;

  // Shift everything at or after the insertion point down one, so sortOrder
  // stays a dense sequence the admin's drag-reorder can work with.
  if (anchor) {
    await prisma.siteMenuItem.updateMany({
      where: { sortOrder: { gte: sortOrder } },
      data: { sortOrder: { increment: 1 } },
    });
  }

  const item = await prisma.siteMenuItem.create({
    data: {
      label,
      href,
      sortOrder,
      ...(isValidThemeColor(args.bg) ? { bgColor: args.bg.trim() } : {}),
      ...(isValidThemeColor(args.underline) ? { underlineColor: args.underline.trim() } : {}),
      ...(isValidUnderlineStyle(args.style) ? { underlineStyle: args.style } : {}),
    },
  });

  console.log(
    `Added "${item.label}" → ${item.href} at position ${item.sortOrder}.\n` +
      "  Live on the menu bar now. Colours and order are editable in Site Design ▸ Menu Items."
  );
}

main()
  .catch((error) => {
    console.error("Failed to add the menu item:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
