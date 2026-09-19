"use client";

// ServicesRoomContents.tsx
//
// The Services Room's own layer, on top of the ordinary artwork frames.
//
// The products themselves are *not* drawn here: they're real
// MuseumRoomArtwork rows (see lib/museum/servicesRoom.ts), so MuseumScene
// hangs them with the same ArtworkFrame + framePlacement.ts perimeter walk
// every other room uses — which is exactly what makes them draggable,
// re-wallable and resizable in the Museum Scene Editor. All this component
// adds is what a shop wall needs and a gallery wall doesn't:
//
//   • a price plaque under each frame, so a visitor sees the price without
//     having to walk up and press [E]
//   • an empty-state message when nothing is listed, so the room reads as
//     "no products yet" rather than "this room is broken"
//
// Takes the same shouldLoad gate as AboutRoomContents/FreedomWallRoomContents
// — its Text objects only mount when the visitor is in or near this room.

import { Text } from "@react-three/drei";
import { ROOM_HEIGHT, FRAME_WALL_OFFSET } from "./roomConstants";
import { BannerPanel, BANNER_TEXT_Z } from "./BannerPanel";
import {
  DEFAULT_ROOM_BANNER_STYLE,
  type RoomBannerStyle,
} from "@/lib/museum/roomBanner";

const FONT_REGULAR = "/fonts/DMSans-Regular.woff";

// Plaque geometry, in world units (metres).
const TAG_H = 0.26;
const TAG_PAD_X = 0.16;
// Roughly the advance width of one character at TAG_FONT_SIZE in DM Sans
// Bold — drei's Text can't be measured before it lays out, so the backing
// plate is sized from the string length instead of the rendered glyphs. A
// small over-estimate is fine (the plate just gets slightly wider than it
// strictly needs); an under-estimate would clip the price.
const TAG_CHAR_W = 0.085;
const TAG_FONT_SIZE = 0.135;

// How far below a frame's *center* the plaque hangs. A frame is at most
// FRAME_HEIGHT (2.2) tall, so half of that plus a small gap clears the
// bottom edge of every frame; a frame shrunk to fit a wide/panoramic image
// just gets a slightly larger gap rather than an overlap.
const TAG_DROP = 1.34;

export interface ServicesPriceTag {
  id: string;
  /** Pre-formatted price string (see lib/utils' formatPrice). */
  label: string;
  /** The frame's own world-space placement position — this plaque applies
   * the same FRAME_WALL_OFFSET the frame does, so both sit on the same
   * plane off the wall surface. */
  position: [number, number, number];
  /** Wall normal [x, y, z] from the frame's placement. */
  wallNormal: [number, number, number];
  rotationY: number;
}

/** Exported for the Museum Scene Editor, which draws each product frame's
 *  plaque under the frame as it is dragged, so the Room Label Style card's
 *  finish can be judged on the plaques themselves. */
export function PriceTag({
  tag,
  banner,
  active,
}: {
  tag: ServicesPriceTag;
  banner: RoomBannerStyle;
  active: boolean;
}) {
  const [px, py, pz] = tag.position;
  const [nx, , nz] = tag.wallNormal;
  // Both the plate and the glyphs scale off the admin's font scale, so a price
  // set larger gets a plate that still fits it rather than one it overflows.
  const fontSize = TAG_FONT_SIZE * banner.fontScale;
  const width = tag.label.length * TAG_CHAR_W * banner.fontScale + TAG_PAD_X * 2;
  const height = TAG_H * banner.fontScale;

  return (
    <group
      // The designed drop, plus the room's Price Gap (Room Label Style card)
      // — pushed further down, or pulled closer when negative.
      position={[px + nx * FRAME_WALL_OFFSET, py - TAG_DROP - banner.priceGap, pz + nz * FRAME_WALL_OFFSET]}
      rotation={[0, tag.rotationY, 0]}
    >
      {/* Backing plate — the room's shared plaque style (lib/museum/roomBanner
          .ts). Its default is the dark tone this was hardcoded to, the same as
          ArtworkFrame's border, so a frame and its price still read as one
          object rather than two until an admin says otherwise. */}
      <BannerPanel width={width} height={height} style={banner} active={active}>
        <Text
          position={[0, 0, BANNER_TEXT_Z]}
          fontSize={fontSize}
          color={banner.textColor}
          anchorX="center"
          anchorY="middle"
          font={banner.fontFamily}
        >
          {tag.label}
        </Text>
      </BannerPanel>
    </group>
  );
}

export function ServicesRoomContents({
  tags,
  depth,
  centerZ,
  baseY = 0,
  isEmpty,
  shouldLoad = true,
  banner = DEFAULT_ROOM_BANNER_STYLE,
}: {
  tags: ServicesPriceTag[];
  depth: number;
  centerZ: number;
  /** The room's shared plaque style — see lib/museum/roomBanner.ts. */
  banner?: RoomBannerStyle;
  /** This room's own floor Y (roomLayout.ts's floorYSouth) — non-zero only
   * when the Services Room has been moved to the Second Floor. */
  baseY?: number;
  /** True when no product is currently listed — shows the message below
   * instead of leaving four blank walls. */
  isEmpty: boolean;
  shouldLoad?: boolean;
}) {
  if (!shouldLoad) return null;

  // North wall surface Z in room-local space, same convention as
  // FreedomWallRoomContents.
  const northWallZ = -depth / 2 + FRAME_WALL_OFFSET;

  return (
    <>
      {tags.map((tag) => (
        <PriceTag key={tag.id} tag={tag} banner={banner} active={shouldLoad} />
      ))}

      {isEmpty && (
        <group position={[0, baseY, centerZ]}>
          {/* Deliberately high on the wall (above DOORWAY_HEIGHT) so it's
              never sitting inside the doorway gap when the next room's
              opening is cut into this wall. */}
          <Text
            position={[0, ROOM_HEIGHT * 0.76, northWallZ + 0.01]}
            fontSize={0.16}
            color="#c9c0ad"
            anchorX="center"
            anchorY="middle"
            textAlign="center"
            font={FONT_REGULAR}
          >
            {"Nothing listed right now.\nCheck back soon."}
          </Text>
        </group>
      )}
    </>
  );
}
