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
        "Booking a show, writing about us, or just want to say hello — we read everything."
      }
      commissionHeading={profile?.commissionHeading || "Booking"}
      commissionIntro={
        profile?.commissionIntro ||
        "For gigs, festivals and private shows, tell us the date, the venue and the set length you have in mind. We usually reply within a few days."
      }
      callingCardFront={profile?.callingCardFront ?? null}
      callingCardBack={profile?.callingCardBack ?? null}
    />
  );
}
