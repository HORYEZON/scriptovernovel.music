// components/public/home/LatestRelease.tsx
//
// The lead release in full (player, tracklist, links) right under the
// hero — the same card /music uses. Hidden until something is published.
import { getLeadRelease } from "@/lib/releases-server";
import { SectionHeading } from "@/components/public/system/SectionHeading";
import { Reveal } from "@/components/public/system/Reveal";
import { ReleaseCard } from "@/components/public/ReleaseCard";

export async function LatestRelease() {
  const release = await getLeadRelease().catch(() => null);
  if (!release) return null;
  return (
    <Reveal as="section" className="section-padding">
      <SectionHeading eyebrow="Listen" title={release.featured ? "Out now" : "Latest release"} action={{ label: "All music", href: "/music" }} />
      <ReleaseCard release={JSON.parse(JSON.stringify(release))} />
    </Reveal>
  );
}
