// app/(public)/contact/page.tsx
import type { Metadata } from "next";
import { getProfile } from "@/lib/public-data";
import ContactClient from "./ContactClient";

export const metadata: Metadata = { title: "Contact" };
export const dynamic = "force-dynamic";

export default async function ContactPage() {
  const profile = await getProfile();

  return (
    <ContactClient
      phone={profile?.phone || "0945 350 0983"}
      email={profile?.email || "scriptovernovel.music@gmail.com"}
      address={profile?.address || "NCR, Philippines"}
      contactHeading={profile?.contactHeading || "Get in Touch"}
      contactIntro={
        profile?.contactIntro ||
        "Whether you're interested in acquiring a piece, commissioning an original work, or simply want to say hello — I'd love to hear from you."
      }
      commissionHeading={profile?.commissionHeading || "Commission Inquiries"}
      commissionIntro={
        profile?.commissionIntro ||
        "Commission turnaround is typically 1-2 weeks depending on size and complexity. All commissions include a preliminary sketch and progress updates."
      }
      callingCardFront={profile?.callingCardFront ?? null}
      callingCardBack={profile?.callingCardBack ?? null}
    />
  );
}
