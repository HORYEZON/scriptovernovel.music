// app/(public)/videos/page.tsx
//
// The Videos page: every published video as a click-to-play tile, with a
// kind filter (Music videos · Live · Behind the scenes). The featured
// video's poster is the hazy backdrop.
import type { Metadata } from "next";
import { getPublicVideos } from "@/lib/videos-server";
import { youtubeThumbnail } from "@/lib/videos";
import { PageHero } from "@/components/public/system/PageHero";
import { VideosClient } from "./VideosClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Videos",
  description: "ScriptOverNovel music videos, live recordings and behind-the-scenes footage.",
};

export default async function VideosPage() {
  const videos = await getPublicVideos().catch(() => []);
  const lead = videos[0] ?? null;
  return (
    <div className="pb-24">
      <PageHero
        image={lead ? youtubeThumbnail(lead.youtubeId, "max") : null}
        blur="lg"
        eyebrow="Watch"
        title="Videos"
        subtitle={lead ? lead.title : "Music videos, live sets and what happens in between."}
      />
      <VideosClient videos={videos} />
    </div>
  );
}
