// components/public/home/VideosStrip.tsx
//
// The newest few videos (featured first) as click-to-play tiles, linking
// into /videos. Hidden until a video is published.
import { getPublicVideos } from "@/lib/videos-server";
import { SectionHeading } from "@/components/public/system/SectionHeading";
import { Reveal } from "@/components/public/system/Reveal";
import { VideoCard } from "@/components/public/VideoCard";

export async function VideosStrip() {
  const videos = await getPublicVideos(4).catch(() => []);
  if (videos.length === 0) return null;
  return (
    <Reveal as="section" className="section-padding">
      <SectionHeading eyebrow="Watch" title="Videos" action={{ label: "All videos", href: "/videos" }} />
      <div className={`grid grid-cols-1 gap-8 ${videos.length > 1 ? "md:grid-cols-2" : ""}`}>
        {videos.map((v) => (
          <VideoCard key={v.id} video={v} />
        ))}
      </div>
    </Reveal>
  );
}
