// app/(admin)/admin/press/page.tsx
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { resolvePressQuotes } from "@/lib/press";
import { PressClient } from "./PressClient";

export const metadata: Metadata = { title: "Press Kit" };
export const dynamic = "force-dynamic";

export default async function AdminPressPage() {
  const profile = await prisma.profile
    .findFirst({
      select: {
        pressShortBio: true,
        pressBookingName: true,
        pressBookingEmail: true,
        pressTechRider: true,
        pressStagePlot: true,
        pressPhotoCredit: true,
        pressQuotes: true,
      },
    })
    .catch(() => null);

  return (
    <div>
      <AdminPageHeader
        breadcrumbs={[{ label: "Band" }, { label: "Press Kit" }]}
        title="Press Kit"
        description="What bookers, blogs and festivals ask for — a short bio, a booking address, press quotes and what you need on stage. The public page is /press, and it prints as a one-sheet."
      />
      <PressClient
        initial={{
          // The form works in strings; null in the column is an empty field,
          // and pressText turns an empty field back into null on save.
          pressShortBio: profile?.pressShortBio ?? "",
          pressBookingName: profile?.pressBookingName ?? "",
          pressBookingEmail: profile?.pressBookingEmail ?? "",
          pressTechRider: profile?.pressTechRider ?? "",
          pressStagePlot: profile?.pressStagePlot ?? null,
          pressPhotoCredit: profile?.pressPhotoCredit ?? "",
          pressQuotes: resolvePressQuotes(profile?.pressQuotes),
        }}
      />
    </div>
  );
}
