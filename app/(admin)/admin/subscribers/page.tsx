// app/(admin)/admin/subscribers/page.tsx
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { SUBSCRIBER_SELECT } from "@/lib/subscribers-server";
import { SubscribersClient } from "./SubscribersClient";

export const metadata: Metadata = { title: "Mailing List" };
export const dynamic = "force-dynamic";

export default async function AdminSubscribersPage() {
  // SUBSCRIBER_SELECT deliberately omits both tokens — they are bearer
  // credentials for confirming and unsubscribing, and nothing in the admin
  // needs them, so they never reach the browser.
  const subscribers = await prisma.subscriber
    .findMany({ select: SUBSCRIBER_SELECT, orderBy: { createdAt: "desc" } })
    .catch(() => []);

  return (
    <div>
      <AdminPageHeader
        breadcrumbs={[{ label: "Band" }, { label: "Mailing List" }]}
        title="Mailing List"
        description="Everyone who asked to hear about new releases and shows. Confirmed addresses are the list — export those and send from your mail provider; nothing here sends campaigns."
      />
      <SubscribersClient initialSubscribers={JSON.parse(JSON.stringify(subscribers))} />
    </div>
  );
}
