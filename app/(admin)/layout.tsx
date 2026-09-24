// app/(admin)/layout.tsx
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminQueryProvider } from "@/components/admin/AdminQueryProvider";
import { NotificationBell } from "@/components/admin/NotificationBell";
import { GlobalSearch } from "@/components/admin/GlobalSearch";
import { AdminThemeStyle } from "@/components/admin/AdminThemeStyle";
import { AdminBackToTop } from "@/components/admin/AdminBackToTop";
import { AdminLeaveGuard } from "@/components/admin/AdminLeaveGuard";
import { InactivityTimeout } from "@/components/admin/InactivityTimeout";
import { BackupJobProvider } from "@/components/admin/BackupJobProvider";
import { BackupJobCard } from "@/components/admin/BackupJobCard";
import { Toaster } from "react-hot-toast";
import { prisma } from "@/lib/prisma";
import { TOAST_OPTIONS } from "@/lib/toast-config";
import { getSiteLogoUrl } from "@/lib/site-logo";

// Overrides the root layout's "%s | ScriptOverNovel" template for every page under
// this group — previously none of these pages set a title at all, so every
// admin tab (Dashboard, Artworks, Orders, ...) showed the same generic
// "ScriptOverNovel — House of Arts" tab title. Each admin page now
// exports just its short label (e.g. "Artworks") which renders here as
// "Artworks | ScriptOverNovel Admin", clearly distinct from the public site's tabs.
export const metadata: Metadata = {
  title: {
    template: "%s | ScriptOverNovel Admin",
    default: "ScriptOverNovel Admin",
  },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user || (session.user as { role?: string }).role !== "ADMIN") {
    redirect("/login");
  }

  // Independent of each other, so run together instead of sequentially.
  const [profile, theme, securityPrefs] = await Promise.all([
    prisma.profile.findFirst().catch(() => null),
    prisma.siteTheme.findFirst().catch(() => null),
    // The signed-in admin's own auto sign-out setting (Settings ▸ Security).
    // Read here rather than in the guard component so the timer is running
    // from first paint — a client fetch would leave a window, however short,
    // in which an idle screen is not being watched at all.
    prisma.user
      .findUnique({
        where: { id: (session.user as { id: string }).id },
        select: { inactivityLogoutEnabled: true, inactivityLogoutMinutes: true },
      })
      .catch(() => null),
  ]);
  const siteLogo = await getSiteLogoUrl(profile?.logoImage);

  return (
    <AdminQueryProvider>
      {/* Outside BackupJobProvider because that provider is one of the things
          that registers a blocker with it — see AdminLeaveGuard's header for
          why Sign Out needs asking about at all. */}
      <AdminLeaveGuard>
      {/* Wraps the whole group rather than the Backup page, which is the
          entire point: an export or restore runs in the browser, so it has to
          outlive the route that started it. Mounted here, a navigation to any
          other admin screen never unmounts the job. */}
      <BackupJobProvider>
      <AdminThemeStyle theme={theme} />
      {/* admin-shell (globals.css) paints the dashboard's own background —
          today's plain ink-50/ink-900 look by default, or
          SiteTheme.adminBackgroundImage once the admin uploads one (see
          Preferences → Branding). Replaces the old inline bg-ink-50
          dark:bg-ink-900 classes, which painted an opaque color directly on
          this div and could never show a background image through it. */}
      <div className="admin-shell min-h-screen flex">
        <AdminSidebar
          // Site Design → Header's logo — the one logo upload the admin has
          // (see lib/site-logo.ts for why this no longer reads Profile.logoImage).
          logoImage={siteLogo}
          sidebarIcon={profile?.sidebarIcon}
          sidebarMobileIcon={profile?.sidebarMobileIcon}
        />
        {/* Mounted once here (not per-page) so the pair floats over every
            admin screen consistently, top-right, regardless of sidebar
            collapse state or which page is active. Both buttons share this
            wrapper's fixed positioning/gap rather than positioning
            themselves, so they always line up as a matched pair — mobile
            sits inside AdminSidebar's own top bar, desktop floats as its own
            row of cards. */}
        <div className="fixed z-40 flex items-center gap-2 top-2.5 right-3 md:top-4 md:right-6 md:gap-3">
          <GlobalSearch />
          <NotificationBell />
        </div>
        <main className="flex-1 min-w-0 overflow-auto pt-14 md:pt-0">
          <div className="p-4 sm:p-6 md:p-10">{children}</div>
        </main>
        {/* Only becomes visible once the window is actually scrolled past
            the threshold, so short module pages that fit without scrolling
            never show it. */}
        <AdminBackToTop />
        {/* Renders nothing unless a backup or restore is actually running. */}
        <BackupJobCard />
        {/* Renders nothing while the setting is off. Inside AdminLeaveGuard
            on purpose — it asks the same blockers Sign Out does before ending
            a session out from under an in-flight backup. */}
        <InactivityTimeout
          enabled={securityPrefs?.inactivityLogoutEnabled ?? false}
          minutes={securityPrefs?.inactivityLogoutMinutes ?? 30}
        />
        <Toaster position="bottom-right" toastOptions={TOAST_OPTIONS} />
      </div>
      </BackupJobProvider>
      </AdminLeaveGuard>
    </AdminQueryProvider>
  );
}