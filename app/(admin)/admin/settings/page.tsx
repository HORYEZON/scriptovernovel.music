// app/(admin)/admin/settings/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import {
  ChevronRight,
  Palette,
  PowerOff,
  ShieldCheck,
  Ban,
  Trophy,
  BookOpen,
  DatabaseBackup,
  Sparkles,
} from "lucide-react";
import { auth } from "@/lib/auth";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

// FAQ Chatbox, Background Music, Mini Games, and Sound used to have their
// own cards here — they're tabs on other modules' pages now (Announcements,
// Preferences, Artworks respectively), not standalone Settings pages, so
// they no longer belong in this grid. Reach them from their new homes
// (AdminSidebar.tsx) or GlobalSearch.tsx's quick-nav.
export default async function AdminSettingsPage() {
  const session = await auth();
  const [profile, currentUser, blockedEmailCount, milestoneCount, releaseNoteCount] =
    await Promise.all([
    prisma.profile.findFirst().catch(() => null),
    prisma.user
      .findUnique({
        where: { id: (session!.user as { id: string }).id },
        select: { totpEnabled: true },
      })
      .catch(() => null),
    prisma.blockedEmail.count().catch(() => 0),
    prisma.visitorMilestone.count({ where: { enabled: true } }).catch(() => 0),
    prisma.releaseNote.count({ where: { isPublished: true, deletedAt: null } }).catch(() => 0),
  ]);
  const totpEnabled = Boolean(currentUser?.totpEnabled);
  const isDown = Boolean(profile?.maintenanceMode);

  return (
    <div>
      <AdminPageHeader
        title="Settings"
        description="Manage site-wide configuration and content modules"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <Link
          href="/admin/settings/Preferences"
          className="group admin-card border rounded-2xl p-5 backdrop-blur-md shadow-sm hover:shadow-lg hover:border-sepia/40 transition-all flex flex-col gap-4"
        >
          <div className="flex items-center justify-between">
            <div className="w-11 h-11 rounded-xl bg-sepia/10 text-sepia flex items-center justify-center">
              <Palette size={20} />
            </div>
            <ChevronRight
              size={18}
              className="text-ink-400 dark:text-ink-300 group-hover:translate-x-1 group-hover:text-sepia transition-all"
            />
          </div>
          <div>
            <h3 className="font-jakarta text-base font-semibold text-ink dark:text-cream">
              Preferences
            </h3>
            <p className="font-body text-xs text-ink-400 dark:text-ink-300 mt-1">
              Branding, theme customizer, background music, and sound effects
            </p>
          </div>
          <div className="font-body text-xs text-ink-400 dark:text-ink-300 pt-3 border-t border-black/5 dark:border-white/5">
            Branding &middot; Theme &middot; Music &middot; Sound
          </div>
        </Link>

        <Link
          href="/admin/settings/security"
          className="group admin-card border rounded-2xl p-5 backdrop-blur-md shadow-sm hover:shadow-lg hover:border-sepia/40 transition-all flex flex-col gap-4"
        >
          <div className="flex items-center justify-between">
            <div className="w-11 h-11 rounded-xl bg-sepia/10 text-sepia flex items-center justify-center">
              <ShieldCheck size={20} />
            </div>
            <ChevronRight
              size={18}
              className="text-ink-400 dark:text-ink-300 group-hover:translate-x-1 group-hover:text-sepia transition-all"
            />
          </div>
          <div>
            <h3 className="font-jakarta text-base font-semibold text-ink dark:text-cream">
              Security
            </h3>
            <p className="font-body text-xs text-ink-400 dark:text-ink-300 mt-1">
              Two-factor authentication for your admin account
            </p>
          </div>
          <div className="font-body text-xs text-ink-400 dark:text-ink-300 pt-3 border-t border-black/5 dark:border-white/5 flex items-center gap-1.5">
            {totpEnabled ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Two-factor is on
              </>
            ) : (
              "Two-factor is off"
            )}
          </div>
        </Link>

        <Link
          href="/admin/settings/blocked-emails"
          className="group admin-card border rounded-2xl p-5 backdrop-blur-md shadow-sm hover:shadow-lg hover:border-sepia/40 transition-all flex flex-col gap-4"
        >
          <div className="flex items-center justify-between">
            <div className="w-11 h-11 rounded-xl bg-sepia/10 text-sepia flex items-center justify-center">
              <Ban size={20} />
            </div>
            <ChevronRight
              size={18}
              className="text-ink-400 dark:text-ink-300 group-hover:translate-x-1 group-hover:text-sepia transition-all"
            />
          </div>
          <div>
            <h3 className="font-jakarta text-base font-semibold text-ink dark:text-cream">
              Blocked Emails
            </h3>
            <p className="font-body text-xs text-ink-400 dark:text-ink-300 mt-1">
              Addresses blocked from the public contact form
            </p>
          </div>
          <div className="font-body text-xs text-ink-400 dark:text-ink-300 pt-3 border-t border-black/5 dark:border-white/5">
            <strong className="text-ink dark:text-cream">{blockedEmailCount}</strong> blocked
            email{blockedEmailCount !== 1 ? "s" : ""}
          </div>
        </Link>

        <Link
          href="/admin/settings/visitor-milestones"
          className="group admin-card border rounded-2xl p-5 backdrop-blur-md shadow-sm hover:shadow-lg hover:border-sepia/40 transition-all flex flex-col gap-4"
        >
          <div className="flex items-center justify-between">
            <div className="w-11 h-11 rounded-xl bg-sepia/10 text-sepia flex items-center justify-center">
              <Trophy size={20} />
            </div>
            <ChevronRight
              size={18}
              className="text-ink-400 dark:text-ink-300 group-hover:translate-x-1 group-hover:text-sepia transition-all"
            />
          </div>
          <div>
            <h3 className="font-jakarta text-base font-semibold text-ink dark:text-cream">
              Visitor Milestones
            </h3>
            <p className="font-body text-xs text-ink-400 dark:text-ink-300 mt-1">
              Reward visitors once the site&apos;s running visitor count crosses a threshold
            </p>
          </div>
          <div className="font-body text-xs text-ink-400 dark:text-ink-300 pt-3 border-t border-black/5 dark:border-white/5">
            <strong className="text-ink dark:text-cream">{milestoneCount}</strong> active milestone
            {milestoneCount !== 1 ? "s" : ""}
          </div>
        </Link>

        <Link
          href="/admin/settings/release-notes"
          className="group admin-card border rounded-2xl p-5 backdrop-blur-md shadow-sm hover:shadow-lg hover:border-sepia/40 transition-all flex flex-col gap-4"
        >
          <div className="flex items-center justify-between">
            <div className="w-11 h-11 rounded-xl bg-sepia/10 text-sepia flex items-center justify-center">
              <Sparkles size={20} />
            </div>
            <ChevronRight
              size={18}
              className="text-ink-400 dark:text-ink-300 group-hover:translate-x-1 group-hover:text-sepia transition-all"
            />
          </div>
          <div>
            <h3 className="font-jakarta text-base font-semibold text-ink dark:text-cream">
              Release Notes
            </h3>
            <p className="font-body text-xs text-ink-400 dark:text-ink-300 mt-1">
              What&apos;s-new entries behind the sparkle icon in the site navbar
            </p>
          </div>
          <div className="font-body text-xs text-ink-400 dark:text-ink-300 pt-3 border-t border-black/5 dark:border-white/5">
            <strong className="text-ink dark:text-cream">{releaseNoteCount}</strong> published note
            {releaseNoteCount !== 1 ? "s" : ""}
            {profile?.releaseNotesEnabled === false && " \u00b7 hidden from visitors"}
          </div>
        </Link>

        <Link
          href="/admin/settings/maintenance"
          className={`group rounded-2xl p-5 backdrop-blur-md shadow-sm transition-all flex flex-col gap-4 ${
            isDown
              ? "bg-vermillion/5 border border-vermillion/40 hover:border-vermillion/60 hover:shadow-lg"
              : "admin-card border hover:shadow-lg hover:border-sepia/40"
          }`}
        >
          <div className="flex items-center justify-between">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                isDown
                  ? "bg-vermillion/10 text-vermillion"
                  : "bg-sepia/10 text-sepia"
              }`}
            >
              <PowerOff size={20} />
            </div>
            <ChevronRight
              size={18}
              className={`transition-all group-hover:translate-x-1 ${
                isDown
                  ? "text-vermillion/70 group-hover:text-vermillion"
                  : "text-ink-400 dark:text-ink-300 group-hover:text-sepia"
              }`}
            />
          </div>
          <div>
            <h3 className="font-jakarta text-base font-semibold text-ink dark:text-cream">
              Maintenance Mode
            </h3>
            <p className="font-body text-xs text-ink-400 dark:text-ink-300 mt-1">
              Take the public site offline behind a branded &quot;we&apos;ll be
              right back&quot; page
            </p>
          </div>
          <div
            className={`font-body text-xs pt-3 border-t flex items-center gap-1.5 ${
              isDown
                ? "border-vermillion/20 text-vermillion font-medium"
                : "border-black/5 dark:border-white/5 text-ink-400 dark:text-ink-300"
            }`}
          >
            {isDown ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-vermillion animate-pulse" />
                Site is currently down
              </>
            ) : (
              "Site is live"
            )}
          </div>
        </Link>

        <Link
          href="/admin/settings/backup"
          className="group admin-card border rounded-2xl p-5 backdrop-blur-md shadow-sm hover:shadow-lg hover:border-sepia/40 transition-all flex flex-col gap-4"
        >
          <div className="flex items-center justify-between">
            <div className="w-11 h-11 rounded-xl bg-sepia/10 text-sepia flex items-center justify-center">
              <DatabaseBackup size={20} />
            </div>
            <ChevronRight
              size={18}
              className="text-ink-400 dark:text-ink-300 group-hover:translate-x-1 group-hover:text-sepia transition-all"
            />
          </div>
          <div>
            <h3 className="font-jakarta text-base font-semibold text-ink dark:text-cream">
              Backup &amp; Restore
            </h3>
            <p className="font-body text-xs text-ink-400 dark:text-ink-300 mt-1">
              Download the whole site as one archive — every row, and every
              uploaded file — or put one back
            </p>
          </div>
          <div className="font-body text-xs text-ink-400 dark:text-ink-300 pt-3 border-t border-black/5 dark:border-white/5">
            Export &middot; Import &middot; Pick what&apos;s included
          </div>
        </Link>

        <Link
          href="/admin/api-docs"
          className="group admin-card border rounded-2xl p-5 backdrop-blur-md shadow-sm hover:shadow-lg hover:border-sepia/40 transition-all flex flex-col gap-4"
        >
          <div className="flex items-center justify-between">
            <div className="w-11 h-11 rounded-xl bg-sepia/10 text-sepia flex items-center justify-center">
              <BookOpen size={20} />
            </div>
            <ChevronRight
              size={18}
              className="text-ink-400 dark:text-ink-300 group-hover:translate-x-1 group-hover:text-sepia transition-all"
            />
          </div>
          <div>
            <h3 className="font-jakarta text-base font-semibold text-ink dark:text-cream">
              API Docs
            </h3>
            <p className="font-body text-xs text-ink-400 dark:text-ink-300 mt-1">
              Interactive OpenAPI reference for all ~130 API endpoints
            </p>
          </div>
          <div className="font-body text-xs text-ink-400 dark:text-ink-300 pt-3 border-t border-black/5 dark:border-white/5">
            OpenAPI 3.0 &middot; Swagger UI &middot; Try it out
          </div>
        </Link>
      </div>
    </div>
  );
}
