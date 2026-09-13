// app/(admin)/admin/settings/visitor-milestones/page.tsx
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { VisitorMilestonesClient } from "./VisitorMilestonesClient";

export const metadata: Metadata = { title: "Visitor Milestones" };
export const dynamic = "force-dynamic";

export default async function VisitorMilestonesPage() {
  const [counter, milestones] = await Promise.all([
    prisma.siteVisitCounter.findUnique({ where: { id: "singleton" } }).catch(() => null),
    prisma.visitorMilestone
      .findMany({
        orderBy: { threshold: "asc" },
        include: { _count: { select: { claims: true } } },
      })
      .catch(() => []),
  ]);

  return (
    <div>
      <AdminPageHeader
        breadcrumbs={[
          { label: "Settings", href: "/admin/settings" },
          { label: "Visitor Milestones" },
        ]}
        title="Visitor Milestones"
        description="Reward visitors once the site's running visitor count crosses a threshold you set"
      />

      <VisitorMilestonesClient
        initialCount={counter?.count ?? 0}
        initialMilestones={JSON.parse(JSON.stringify(milestones))}
      />
    </div>
  );
}
