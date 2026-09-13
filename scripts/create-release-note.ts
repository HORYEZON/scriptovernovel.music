// scripts/create-release-note.ts
//
// Files a Release Note (Settings ▸ Release Notes) from the command line, so a
// visitor-facing change can be written up in the same pass that ships it
// instead of being remembered afterwards.
//
// Why a script rather than the API route: POST /api/release-notes is behind
// requireAdmin(), which needs a browser session. This runs as the deploying
// developer against the same database and reuses that route's own sanitizers
// (lib/release-notes.ts), so a note filed here is validated exactly like one
// typed into the admin form — the two can't drift.
//
// **Drafts by default.** A note created here is `isPublished: false`: it shows
// up in Settings ▸ Release Notes for the admin to read, reword and publish, and
// no visitor sees it until they do. That is deliberate — the wording on this
// panel is meant to be plain rather than technical (see lib/release-notes.ts's
// scope note), and the person who writes the code is not the best judge of
// whether their own sentence reads that way. Pass --publish to skip the review
// step when you are certain.
//
// Note DATABASE_URL points at the hosted database, so this writes to the live
// site's data even in a draft state.
//
// Usage:
//   npx tsx scripts/create-release-note.ts \
//     --title "Tales, with a squid for the A" \
//     --body  "The Stories page is now called Tales…" \
//     --category "Stories" \
//     --version "v6.26"
//
//   Optional: --publish            file it live instead of as a draft
//             --date 2026-09-07    backdate it (the panel orders by this)
import "dotenv/config";
import { prisma } from "@/lib/prisma";
import {
  RELEASE_NOTE_CATEGORIES,
  MAX_RELEASE_NOTE_TITLE,
  MAX_RELEASE_NOTE_BODY,
  sanitizeReleaseNoteTitle,
  sanitizeReleaseNoteBody,
  sanitizeReleaseNoteCategory,
  sanitizeReleaseNoteVersion,
  sanitizeReleaseNoteDate,
} from "@/lib/release-notes";

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

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const title = sanitizeReleaseNoteTitle(args.title);
  const body = sanitizeReleaseNoteBody(args.body);

  if (!title || !body) {
    console.error(
      "Both --title and --body are required.\n\n" +
        `  --title     max ${MAX_RELEASE_NOTE_TITLE} chars\n` +
        `  --body      max ${MAX_RELEASE_NOTE_BODY} chars\n` +
        `  --category  one of: ${RELEASE_NOTE_CATEGORIES.join(", ")} (default General)\n` +
        "  --version   e.g. v6.26 (optional)\n" +
        "  --date      e.g. 2026-09-07 (optional; defaults to now)\n" +
        "  --publish   file it live instead of as a draft"
    );
    process.exitCode = 1;
    return;
  }

  // Only an explicit --publish goes live; anything else is a draft the admin
  // reviews. See the header for why that is the default and not the option.
  const isPublished = args.publish === "true";
  const publishedAt = sanitizeReleaseNoteDate(args.date) ?? new Date();

  const note = await prisma.releaseNote.create({
    data: {
      title,
      body,
      category: sanitizeReleaseNoteCategory(args.category),
      version: sanitizeReleaseNoteVersion(args.version),
      isPublished,
      publishedAt,
    },
  });

  console.log(
    `${isPublished ? "Published" : "Drafted"} release note ${note.id}\n` +
      `  ${note.category}${note.version ? ` · ${note.version}` : ""}\n` +
      `  ${note.title}\n` +
      (isPublished
        ? "  Live now on the public Release Notes panel."
        : "  Waiting in Settings ▸ Release Notes — publish it there when the wording reads right.")
  );
}

main()
  .catch((error) => {
    console.error("Failed to create the release note:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
