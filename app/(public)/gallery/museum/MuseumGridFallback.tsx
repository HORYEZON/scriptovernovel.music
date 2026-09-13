"use client";

import { useState } from "react";
import Masonry from "react-masonry-css";
import { motion } from "framer-motion";
import Image from "@/components/ui/SafeImage";
import type { MuseumArtwork, MuseumRoomPublic } from "@/types";
import { ArtworkInfoPanel } from "./components/ArtworkInfoPanel";
import { MuseumDoor } from "./components/MuseumDoor";
import { imageVariantUrl } from "@/lib/images/variants";

// Same breakpoints as the main gallery's masonry (GalleryClient.tsx) so this
// reads as the same visual language, not a bolted-on second grid system.
const MASONRY_BREAKPOINTS = { default: 4, 1279: 3, 1023: 2, 639: 1 };

// Non-3D presentation of the same museum-curated rooms — not a separate
// content system, just another view of the same DigitalMuseum
// configuration (see app/(public)/gallery/museum/page.tsx). Shows whichever
// room is active (room switcher only appears when there's more than one),
// same artwork records the 3D room uses — no duplicated data source.
export function MuseumGridFallback({
  rooms,
  activeRoomId,
  onSelectRoom,
}: {
  rooms: MuseumRoomPublic[];
  activeRoomId: string;
  onSelectRoom: (roomId: string) => void;
}) {
  const [selected, setSelected] = useState<MuseumArtwork | null>(null);
  const activeRoom = rooms.find((r) => r.id === activeRoomId) ?? rooms[0];

  // Separate About room so it gets the featured treatment in the door strip.
  const standardRooms = rooms.filter((r) => r.roomType !== "ABOUT");
  const aboutRoom = rooms.find((r) => r.roomType === "ABOUT") ?? null;
  // Ordered list for display: standard rooms first (with ordinals), then About.
  const orderedRooms = [...standardRooms, ...(aboutRoom ? [aboutRoom] : [])];

  return (
    <>
      {/* Room door strip — only shown when there is more than one room so a
          single-room museum isn't burdened with an empty navigation bar.
          Horizontally scrollable on narrow viewports so no door is cut off. */}
      {rooms.length > 1 && (
        <div
          className="mb-8 -mx-4 px-4 sm:-mx-8 sm:px-8"
          style={{ overflowX: "auto" }}
        >
          <div
            className="flex gap-3 min-w-0"
            // Allow the strip to be wider than the viewport on mobile without
            // forcing the page to scroll horizontally — the overflow is
            // clipped at this container, not the body.
            style={{ width: "max-content", paddingBottom: "4px" }}
          >
            {orderedRooms.map((room, i) => {
              const isAbout = room.roomType === "ABOUT";
              const isActive = room.id === activeRoom.id;

              return (
                <MuseumDoor
                  key={room.id}
                  title={room.name}
                  // Only label ordinals for the standard rooms; the About
                  // door announces its own identity through the featured badge.
                  roomNumber={isAbout ? undefined : i + 1}
                  roomType={room.roomType}
                  isFeatured={isAbout}
                  isCurrent={isActive}
                  artworkCount={room.artworks.length}
                  // Portrait variant throughout — compact fixed size that
                  // keeps the strip scannable without pushing content below
                  // the fold on most screens.
                  layout="portrait"
                  onClick={() => onSelectRoom(room.id)}
                  // Fixed dimensions: 96px wide, 128px tall.
                  // Tall enough for the glass panel + footer to read clearly;
                  // narrow enough that 3–4 doors fit at once on a typical
                  // mobile viewport (360px wide).
                  className="shrink-0 w-24 h-32"
                />
              );
            })}
          </div>
        </div>
      )}

      {activeRoom.artworks.length === 0 ? (
        <p className="font-body text-sm text-white/50 text-center py-16">
          No artworks in this room yet.
        </p>
      ) : (
        <Masonry
          breakpointCols={MASONRY_BREAKPOINTS}
          className="flex w-auto -ml-4 md:-ml-6 max-w-6xl mx-auto"
          columnClassName="pl-4 md:pl-6"
        >
          {activeRoom.artworks.map((artwork, i) => (
            <motion.div
              key={artwork.id}
              className="mb-4 md:mb-6 group cursor-pointer"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: (i % 12) * 0.04 }}
              onClick={() => setSelected(artwork)}
            >
              <div className="relative overflow-hidden rounded-lg">
                <Image
                  src={imageVariantUrl(artwork.imageUrl, "thumb")}
                  alt={artwork.title}
                  width={600}
                  height={800}
                  className="w-full h-auto object-cover transition-transform duration-700 group-hover:scale-105"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                  <p className="font-body text-sm text-white truncate">{artwork.title}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </Masonry>
      )}

      <ArtworkInfoPanel artwork={selected} onClose={() => setSelected(null)} />
    </>
  );
}
