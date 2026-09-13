// app/(admin)/admin/dashboard/page.tsx
import { Fragment, Suspense } from "react";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { formatPrice, formatDate, ORDER_STATUS_COLORS } from "@/lib/utils";
import { REVENUE_STATUSES } from "@/lib/sales";
import {
  Package,
  Image as ImageIcon,
  ShoppingBag,
  TrendingUp,
  Settings,
  ArrowUpRight,
} from "lucide-react";
import Link from "next/link";
import Image from "@/components/ui/SafeImage";
import LiveClock from "@/components/admin/LiveClock";
import { WebsiteAnalytics, WebsiteAnalyticsSkeleton } from "@/components/admin/WebsiteAnalytics";
import { SystemHealth, SystemHealthSkeleton } from "@/components/admin/SystemHealth";
import { ActivityLogPanel } from "@/components/admin/ActivityLogPanel";
import { DashboardTabs } from "./DashboardTabs";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

export const metadata: Metadata = { title: "Dashboard" };

// Icon-badge accent colors per stat, matching the status-chip convention
// used across the other admin modules (color/10 background + color text).
const STAT_ACCENTS: Record<string, string> = {
  sepia: "bg-sepia/10 text-sepia",
  indigo: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
};

export default async function AdminDashboard() {
  const session = await auth();

  const [artworkCount, productCount, orderCount, revenueAgg, orders] = await Promise.all([
    prisma.artwork.count({ where: { deletedAt: null } }),
    prisma.product.count({ where: { deletedAt: null } }),
    // Total order count across the whole table — the `orders` list below is
    // capped to the 10 most recent for the "Recent Orders" panel, so it
    // can't be reused for this stat once there are more than 10 orders.
    prisma.order.count(),
    // Same reasoning for revenue: sum collected orders across all time, not
    // just whatever happens to be in the last 10. REVENUE_STATUSES rather than
    // a bare `status: "PAID"` — status is a single column, so a paid order
    // that's since been marked SHIPPED no longer reads "PAID" and would drop
    // out of the total the moment it was fulfilled. Same definition the Sales
    // Dashboard uses (lib/sales.ts).
    prisma.order.aggregate({
      where: { status: { in: REVENUE_STATUSES } },
      _sum: { total: true },
    }),
    prisma.order.findMany({
      include: { items: { include: { product: { include: { artwork: true } } } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const totalRevenue = revenueAgg._sum.total ?? 0;

  const stats = [
    { label: "Total Artworks", value: artworkCount, icon: ImageIcon, href: "/admin/artworks", color: "sepia" },
    { label: "Products Listed", value: productCount, icon: ShoppingBag, href: "/admin/products", color: "indigo" },
    { label: "Orders", value: orderCount, icon: Package, href: "/admin/orders", color: "blue" },
    { label: "Revenue", value: formatPrice(totalRevenue), icon: TrendingUp, href: "/admin/sales", color: "emerald" },
  ];

  const quickActions = [
    { label: "Add Artwork", href: "/admin/artworks", icon: ImageIcon },
    { label: "Manage Products", href: "/admin/products", icon: ShoppingBag },
    { label: "Edit Profile", href: "/admin/about", icon: Settings },
  ];

  return (
    <div className="px-3 sm:px-0">
      <AdminPageHeader
        title={
          session?.user?.name
            ? `Welcome back, ${session.user.name.split(" ")[0]}!`
            : "Dashboard"
        }
        description={
          <>
            Here&apos;s what&apos;s happening with ScriptOverNovel today.
            <LiveClock />
          </>
        }
      />

      <DashboardTabs
        overview={
          <Fragment key="overview">
            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8 sm:mb-10">
              {stats.map((stat) => (
                <Link
                  key={stat.label}
                  href={stat.href}
                  className="admin-card border rounded-2xl p-4 sm:p-6 backdrop-blur-md shadow-sm hover:shadow-lg hover:border-sepia/30 dark:hover:border-sepia/30 transition-all duration-200 group"
                >
                  <div className="flex items-center justify-between">
                    <div
                      className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center shrink-0 ${STAT_ACCENTS[stat.color]}`}
                    >
                      <stat.icon size={18} strokeWidth={1.75} className="sm:w-5 sm:h-5" />
                    </div>
                    <ArrowUpRight
                      size={14}
                      className="text-ink-300 dark:text-ink-600 opacity-0 group-hover:opacity-100 group-hover:text-sepia transition-all"
                    />
                  </div>
                  <p className="font-jakarta text-lg sm:text-3xl font-semibold tracking-tight text-ink dark:text-cream truncate mt-3 sm:mt-4">
                    {stat.value}
                  </p>
                  <p className="font-body text-[10px] sm:text-xs text-ink-400 dark:text-ink-300 uppercase tracking-widest mt-1">
                    {stat.label}
                  </p>
                </Link>
              ))}
            </div>

            {/* Recent Orders */}
            <div className="admin-card border rounded-2xl overflow-hidden backdrop-blur-md shadow-xl">
              <div className="px-5 sm:px-6 py-4 sm:py-5 border-b border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 flex items-center justify-between">
                <h2 className="font-jakarta text-sm sm:text-base font-semibold text-ink dark:text-cream flex items-center gap-2">
                  <Package size={16} className="text-sepia" />
                  Recent Orders
                </h2>
                <Link
                  href="/admin/orders"
                  className="font-body text-xs text-sepia hover:underline inline-flex items-center gap-1 transition-colors"
                >
                  View all <ArrowUpRight size={12} />
                </Link>
              </div>
              <div className="divide-y divide-black/5 dark:divide-white/5">
                {orders.length === 0 ? (
                  <div className="p-12 text-center">
                    <ShoppingBag className="w-10 h-10 text-ink-400 dark:text-ink-300 mx-auto mb-3 opacity-50" />
                    <p className="font-body text-sm text-ink-400 dark:text-ink-300">
                      No orders yet — new orders will show up here.
                    </p>
                  </div>
                ) : (
                  orders.map((order) => {
                    const firstItem = order.items[0];
                    return (
                      <Link
                        key={order.id}
                        href="/admin/orders"
                        className="flex flex-wrap sm:flex-nowrap items-center gap-x-3 gap-y-1 px-4 sm:px-6 py-3 sm:py-4 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
                      >
                        {/* Thumbnail */}
                        <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-black/10 dark:border-white/10 bg-black/5 dark:bg-black/50 shrink-0 order-1">
                          {firstItem ? (
                            <Image
                              src={firstItem.product.artwork.imageUrl}
                              alt={firstItem.product.artwork.title}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-ink-400 dark:text-ink-300">
                              <ShoppingBag size={14} />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0 basis-full sm:basis-auto order-2">
                          <p className="font-body text-sm text-ink dark:text-cream truncate">
                            {order.customerName}
                          </p>
                          <p className="hidden sm:block font-body text-xs text-ink-400 dark:text-ink-300 truncate">
                            {order.items.length} item{order.items.length !== 1 ? "s" : ""} · {formatDate(order.createdAt)}
                          </p>
                        </div>

                        <div className="text-right shrink-0 order-4 sm:order-3">
                          <p className="font-jakarta text-sm font-semibold tabular-nums text-ink dark:text-cream">
                            {formatPrice(order.total)}
                          </p>
                          <p className="hidden sm:block font-body text-[10px] text-ink-400 dark:text-ink-300 mt-0.5">
                            {formatDate(order.createdAt)}
                          </p>
                        </div>

                        <span
                          className={`font-body text-[9px] sm:text-[10px] font-medium tracking-widest uppercase px-2 py-1 rounded-md shrink-0 order-3 sm:order-4 ${ORDER_STATUS_COLORS[order.status]}`}
                        >
                          {order.status}
                        </span>
                      </Link>
                    );
                  })
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="mt-6 sm:mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              {quickActions.map((action) => (
                <Link
                  key={action.label}
                  href={action.href}
                  className="admin-card border rounded-2xl p-5 sm:p-6 text-center backdrop-blur-md shadow-sm hover:shadow-lg hover:border-sepia/40 dark:hover:border-sepia/40 transition-all duration-200 group"
                >
                  <div className="w-11 h-11 rounded-xl bg-sepia/10 text-sepia flex items-center justify-center mx-auto mb-3 group-hover:bg-sepia group-hover:text-white transition-colors">
                    <action.icon size={20} strokeWidth={1.75} />
                  </div>
                  <p className="font-jakarta text-xs sm:text-sm font-medium tracking-widest uppercase text-ink dark:text-cream group-hover:text-sepia dark:group-hover:text-sepia transition-colors">
                    {action.label}
                  </p>
                </Link>
              ))}
            </div>
          </Fragment>
        }
        analytics={
          // Suspense-isolated so a slow/unreachable Vercel Analytics API call
          // never blocks this panel from eventually painting — it streams in
          // independently of the tab switch above. `key` here (and on the
          // Fragment above) is required, not stylistic — Next.js serializes
          // sibling JSX-valued props passed from a Server Component into a
          // Client Component (DashboardTabs) as an implicit list for
          // streaming, and each slot's root element needs its own identity.
          <Suspense key="analytics" fallback={<WebsiteAnalyticsSkeleton />}>
            <WebsiteAnalytics />
          </Suspense>
        }
        activity={
          // No Suspense wrapper: ActivityLogPanel is a client component that
          // fetches its own first page, precisely because every view of it is
          // a filtered one (see that file's header). There is nothing for the
          // server to await here.
          <ActivityLogPanel key="activity" />
        }
        health={
          // Suspense-isolated for the same reason as analytics, and more so —
          // this panel probes Vercel, Postgres and Supabase Storage, so it is
          // the slowest slot on the page.
          <Suspense key="health" fallback={<SystemHealthSkeleton />}>
            <SystemHealth />
          </Suspense>
        }
      />
    </div>
  );
}
