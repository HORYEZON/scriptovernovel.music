// app/(admin)/admin/about/page.tsx
import type { Metadata } from "next";
import { User } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { AboutClient } from "./AboutClient";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminGoToMenu } from "@/components/admin/AdminGoToMenu";
import {
  getMuseumRoomStatus,
  museumEditorLink,
  museumRoomLink,
} from "@/lib/museum/roomStatus";

export const metadata: Metadata = { title: "About" };
export const dynamic = "force-dynamic";

export default async function AdminAboutPage() {
  const [profile, socialLinks, certificates, artistSkills, museumRooms] =
    await Promise.all([
      prisma.profile.findFirst(),
      prisma.socialLink.findMany({ orderBy: { sortOrder: "asc" } }),
      prisma.certificateAward.findMany({ orderBy: { displayOrder: "asc" } }),
      prisma.artistSkill.findMany({ orderBy: { sortOrder: "asc" } }),
      getMuseumRoomStatus(),
    ]);

  return (
    <div>
      <AdminPageHeader
        title="About / Profile"
        description="Edit the artist bio and profile details shown on the public About page and in the Digital Museum's About ScriptOverNovel Room."
        action={
          <AdminGoToMenu
            icon={<User size={16} />}
            links={[
              { label: "Public / About Page", href: "/about" },
              museumRoomLink(museumRooms, "about", "Digital Museum / About ScriptOverNovel Room"),
              museumEditorLink(museumRooms, "about", "Scene Editor / About ScriptOverNovel Room"),
            ]}
          />
        }
      />
      <AboutClient
        initialProfile={profile}
        initialSocialLinks={socialLinks}
        initialCertificates={certificates}
        initialArtistSkills={artistSkills}
      />
    </div>
  );
}
