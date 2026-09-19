// lib/backup/groups.ts
//
// What a backup can contain, and in what order it has to be written back.
//
// The unit an admin picks is a *group* — "Gallery", "Digital Museum" — not a
// table, because tables are an implementation detail and half of them are join
// rows nobody would know to tick. Each group names its Prisma models in
// dependency order: restoring walks the groups in the order below and each
// group's models in the order listed, so a row's parent always exists before
// the row that points at it.
//
// Client-safe (no prisma import) — the admin UI reads the labels from here and
// the API routes read the model lists, so the checkbox an admin ticks and the
// tables that move can't drift apart.

/** A Prisma model name as it appears on the client (`prisma[modelKey]`). */
export type BackupModel = string;

export interface BackupGroup {
  id: string;
  label: string;
  description: string;
  /** Ticked by default in the export dialog. */
  defaultOn: boolean;
  /** Models, parents first. Restore order within the group. */
  models: BackupModel[];
}

/**
 * Groups in restore order. Site settings first (Profile/SiteTheme are
 * standalone), then the content modules, then the museum which points at
 * artworks, stories, games and cosplays, then everything visitor-generated.
 */
export const BACKUP_GROUPS: BackupGroup[] = [
  {
    id: "settings",
    label: "Site Settings",
    description:
      "Profile, theme, sound effects, social links, skills, FAQs, marquees, announcements and the blocked-email list.",
    defaultOn: true,
    models: [
      "profile",
      "siteTheme",
      "soundEffect",
      "socialLink",
      "artistSkill",
      "faq",
      "marqueeAnnouncement",
      "announcement",
      "blockedEmail",
    ],
  },
  {
    id: "gallery",
    label: "Gallery",
    description: "Artworks, the sections they're grouped into, and certificate awards.",
    defaultOn: true,
    models: ["section", "artwork", "certificateAward"],
  },
  {
    id: "stories",
    label: "Tales",
    description: "The tales library and every page of each one.",
    defaultOn: true,
    models: ["story", "storyPage"],
  },
  {
    id: "cosplays",
    label: "Cosplays",
    description: "Costume entries and both photos of each.",
    defaultOn: true,
    models: ["cosplay"],
  },
  {
    id: "events",
    label: "Events",
    description: "Events and their media galleries.",
    defaultOn: true,
    models: ["event", "eventMedia"],
  },
  {
    id: "shop",
    label: "Shop & Orders",
    description: "Products, their variants, and every customer order placed.",
    defaultOn: true,
    models: ["product", "productVariant", "order", "orderItem"],
  },
  {
    id: "minigames",
    label: "Mini Games",
    description: "Game configuration, played sessions, leaderboards and reward claims.",
    defaultOn: true,
    models: ["miniGame", "miniGameSession", "leaderboardEntry", "rewardClaim"],
  },
  {
    id: "museum",
    // Listed after the modules it mirrors: its join rows point at artworks,
    // stories, mini games and cosplays, so those have to land first.
    label: "Digital Museum",
    description:
      "The museum, its rooms, every scene object and placement, chase companions, achievements and the Freedom Wall.",
    defaultOn: true,
    models: [
      "digitalMuseum",
      "museumRoom",
      "museumSceneObject",
      "museumRoomArtwork",
      "museumRoomStory",
      "museumRoomMiniGame",
      "museumRoomCosplay",
      "chaseCompanion",
      "museumAchievement",
      "freedomWallSettings",
      "freedomWallEvent",
      "freedomWallNote",
    ],
  },
  {
    id: "visitors",
    label: "Visitors & Claims",
    description:
      "The visit counter, milestones and their claims, museum achievement claims, and admin notifications.",
    defaultOn: true,
    models: [
      "siteVisitCounter",
      "visitorMilestone",
      "visitorMilestoneClaim",
      "museumAchievementClaim",
      "notification",
    ],
  },
  {
    id: "accounts",
    label: "Admin Accounts",
    description:
      "Admin user rows, without passwords or two-factor secrets — a restore recreates the accounts but each one needs its password set again. Login sessions and reset tokens are never backed up; they expire on their own and a copy of them in a downloaded file is a liability, not a backup.",
    // Off by default: a backup is a file that gets emailed, synced and left in
    // a Downloads folder, and account rows are the one thing here that is
    // about a person rather than about the site.
    defaultOn: false,
    models: ["user"],
  },
];

/**
 * Columns stripped from every exported row of a model.
 *
 * Only credentials. A backup that couldn't recreate the admin list would be a
 * poor backup, but a password hash and a TOTP seed sitting in a JSON file in
 * someone's Downloads folder is a strictly worse trade than "set your password
 * again after a restore".
 */
export const REDACTED_FIELDS: Record<string, string[]> = {
  user: ["password", "totpSecret", "totpBackupCodes"],
};

export const BACKUP_GROUP_IDS = BACKUP_GROUPS.map((g) => g.id);

export function groupsFromIds(ids: string[]): BackupGroup[] {
  const wanted = new Set(ids);
  return BACKUP_GROUPS.filter((g) => wanted.has(g.id));
}

/** Format version, so a future import can tell what it's being handed. */
export const BACKUP_FORMAT_VERSION = 1;

export interface BackupManifest {
  version: number;
  /** ISO timestamp the export was taken. */
  exportedAt: string;
  /** Which groups the admin ticked. */
  groups: string[];
  /** model → row count, for the import screen's summary. */
  counts: Record<string, number>;
  /** Whether media files were bundled alongside. */
  includesMedia: boolean;
}

export interface BackupFile {
  manifest: BackupManifest;
  /** model name → its rows, exactly as Prisma returned them. */
  data: Record<string, unknown[]>;
}

/**
 * Every URL-shaped string anywhere in the backup's rows.
 *
 * Deliberately a blind walk of the JSON rather than a list of "the columns
 * that hold images": media URLs live in perhaps forty columns across the
 * schema (artwork images, story pages, cosplay photos, room textures, .glb
 * models, audio, calling cards, icon uploads…) and any hand-maintained list
 * would be missing whichever one was added last. A walk can only ever be
 * wrong by *including* something, and an extra file in a backup is harmless.
 */
export function collectMediaUrls(data: Record<string, unknown[]>, origins: string[]): string[] {
  const found = new Set<string>();
  const visit = (node: unknown) => {
    if (typeof node === "string") {
      if (origins.some((o) => o && node.startsWith(o))) found.add(node);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (node && typeof node === "object") {
      Object.values(node as Record<string, unknown>).forEach(visit);
    }
  };
  visit(data);
  return [...found];
}
