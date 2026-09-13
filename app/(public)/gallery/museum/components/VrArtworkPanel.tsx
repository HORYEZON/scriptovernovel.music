"use client";

// The in-world mirror of ArtworkInfoPanel.tsx — same content, same state
// (MuseumScene.tsx's panelArtwork/panelIsListing), rendered as meshes and
// troika text inside the WebXR canvas instead of DOM the headset never
// shows. See VrUi.tsx's header for why the DOM panels are mirrored at all.
//
// Laid out like the DOM panel's `landscape` arrangement (image beside the
// text) rather than its stacked desktop one: a headset's field of view is
// much wider than it is tall, so the wide-and-short shape sits inside it
// where a tall stacked panel would run off the top and bottom.
//
// Two things can't be mirrored in a headset and degrade in place instead of
// vanishing: the "View in Gallery"/"View in Shop" links open a new tab,
// which would tear down the XR session, so pressing either shows a hint to
// remove the headset; the timelapse <video> has no in-world player, so it
// becomes one line saying so. Wishlist is real: it's a localStorage store
// (lib/wishlist-store.ts), so saving from VR shows up in the 2D wishlist.
import { useState } from "react";
import { useWishlistStore } from "@/lib/wishlist-store";
import { formatPrice, formatPriceRange } from "@/lib/utils";
import type { MuseumArtwork } from "@/types";
import {
  VrModal,
  VrButton,
  VrImage,
  VrLabel,
  VrBar,
  VrChip,
  VR_COLORS,
  VR_FONT_TITLE,
  labelHeight,
} from "./VrUi";

const W = 1.4;
// The panel grows past this only when the Services Room's price block and
// a timelapse line both need the room — see the layout pass below.
const MIN_H = 0.82;
const PAD = 0.06;
const IMAGE_W = 0.52;
// Text column: right of the image, up to the padding.
const TEXT_X = -W / 2 + PAD + IMAGE_W + 0.07;
const TEXT_W = W / 2 - PAD - TEXT_X;

const TITLE_SIZE = 0.042;
const META_SIZE = 0.026;
const BODY_SIZE = 0.03;
const DESC_LINES = 4;

export function VrArtworkPanel({
  artwork,
  isListing,
  onClose,
}: {
  artwork: MuseumArtwork;
  /** Services Room only — see ArtworkInfoPanel.tsx's same prop. */
  isListing: boolean;
  onClose: () => void;
}) {
  const listing = isListing ? artwork.product ?? null : null;
  const inWishlist = useWishlistStore((s) => s.isInWishlist(artwork.id));
  const toggleItem = useWishlistStore((s) => s.toggleItem);
  // "Remove headset" hint for the two new-tab links — shown under the
  // buttons after a press, since nothing else can happen in-headset.
  const [linkHint, setLinkHint] = useState(false);

  const metaLine = [artwork.medium, artwork.year].filter(Boolean).join(" · ");

  // Variant chips, sized from their label length, wrapped by hand across
  // the column — troika lays out text, not rows of boxes. Computed before
  // the column layout below so the rows they take can be reserved.
  const chips: { label: string; x: number; y: number; width: number; strike: boolean }[] = [];
  let chipRows = 0;
  if (listing && listing.variants.length > 0) {
    let cx = 0;
    let cy = 0;
    chipRows = 1;
    for (const v of listing.variants) {
      const label = `${v.label} · ${formatPrice(v.price)}`;
      const width = 0.02 + label.length * 0.0155;
      if (cx + width > TEXT_W && cx > 0) {
        cx = 0;
        cy -= 0.06;
        chipRows += 1;
      }
      chips.push({ label, x: cx, y: cy, width, strike: v.stock === 0 });
      cx += width + 0.012;
    }
  }

  // Stack the text column top-down from y = 0, tracking the running offset
  // like a flow layout would — each block advances `y` by its own height
  // plus a gap. The panel's height comes out of this total, so a Services
  // Room listing with several sizes gets a taller panel rather than its
  // buttons pushed off the bottom edge.
  let y = 0;
  const titleY = y;
  const titleLines = 2;
  y -= labelHeight(TITLE_SIZE, titleLines) + 0.012;
  const metaY = y;
  if (metaLine) y -= labelHeight(META_SIZE, 1) + 0.008;
  const plaqueBottom = y;
  y -= 0.025;
  const descY = y;
  y -= labelHeight(BODY_SIZE, DESC_LINES) + 0.035;
  const listingY = y;
  if (listing) {
    y -= 0.06; // price line
    y -= chipRows * 0.06 + (chipRows > 0 ? 0.01 : 0);
    y -= 0.02;
  }
  const videoY = y;
  if (artwork.videoUrl) y -= labelHeight(META_SIZE, 1) + 0.025;
  const actionsY = y - 0.04;
  // Button half-height, plus the hint line that can appear under the row.
  const contentBottom = actionsY - 0.0375 - 0.09;

  const H = Math.max(MIN_H, PAD - contentBottom + PAD);
  const TOP = H / 2 - PAD;
  const IMAGE_H = H - PAD * 2;

  return (
    <VrModal width={W} height={H} onClose={onClose} distance={1.3}>
      <VrImage
        url={artwork.imageUrl}
        width={IMAGE_W}
        height={IMAGE_H}
        position={[-W / 2 + PAD + IMAGE_W / 2, 0, 0]}
      />
      <group position={[0, TOP, 0]}>

      {/* Museum-style plaque — the DOM's border-l-2 emerald bar, title,
          then medium · year, whatever of that exists. */}
      <VrBar position={[TEXT_X - 0.028, (titleY + plaqueBottom) / 2, 0]} height={titleY - plaqueBottom} />
      <VrLabel
        position={[TEXT_X, titleY, 0]}
        width={TEXT_W}
        fontSize={TITLE_SIZE}
        font={VR_FONT_TITLE}
        color={VR_COLORS.text}
        maxLines={titleLines}
        uppercase
        letterSpacing={0.04}
      >
        {artwork.title}
      </VrLabel>
      {metaLine && (
        <VrLabel position={[TEXT_X, metaY, 0]} width={TEXT_W} fontSize={META_SIZE} color={VR_COLORS.textFaint}>
          {metaLine}
        </VrLabel>
      )}

      <VrLabel position={[TEXT_X, descY, 0]} width={TEXT_W} fontSize={BODY_SIZE} maxLines={DESC_LINES}>
        {artwork.description}
      </VrLabel>

      {/* Services Room — the price and its sizes, read-only chips exactly
          like the DOM panel (choosing one stays on /shop). */}
      {listing && (
        <group position={[TEXT_X, listingY, 0]}>
          <VrLabel position={[0, 0, 0]} width={TEXT_W} fontSize={0.044} font={VR_FONT_TITLE} color={VR_COLORS.text}>
            {formatPriceRange(listing.price, listing.variants.map((v) => v.price))}
          </VrLabel>
          <VrLabel
            position={[0, -0.05, 0]}
            width={TEXT_W}
            fontSize={0.02}
            color={VR_COLORS.textFaint}
            uppercase
            letterSpacing={0.08}
          >
            {listing.variants.length > 0
              ? `${listing.variants.length} size${listing.variants.length === 1 ? "" : "s"} in the shop`
              : "Available in the shop"}
          </VrLabel>
          {chips.map((chip) => (
            <VrChip
              key={chip.label}
              label={chip.label}
              position={[chip.x + chip.width / 2, -0.11 + chip.y, 0]}
              width={chip.width}
              strike={chip.strike}
            />
          ))}
        </group>
      )}

      {artwork.videoUrl && (
        <VrLabel position={[TEXT_X, videoY, 0]} width={TEXT_W} fontSize={META_SIZE} color={VR_COLORS.textFaint}>
          Timelapse video — remove headset to play
        </VrLabel>
      )}

      {/* Actions — same order and treatment as the DOM: in the shop wall the
          shop link leads and is filled, "View in Gallery" is secondary;
          elsewhere Gallery is the filled primary. */}
      <group position={[TEXT_X, actionsY, 0]}>
        {(() => {
          const buttons: { label: string; width: number; variant: "primary" | "sepia" | "outline"; onClick: () => void }[] = [];
          if (isListing) {
            buttons.push({ label: "View in Shop", width: 0.2, variant: "sepia", onClick: () => setLinkHint(true) });
          }
          if (artwork.slug) {
            buttons.push({
              label: "View in Gallery",
              width: 0.23,
              variant: isListing ? "outline" : "primary",
              onClick: () => setLinkHint(true),
            });
          }
          buttons.push({
            label: inWishlist ? "Saved to wishlist" : "Save to wishlist",
            width: 0.24,
            variant: "outline",
            onClick: () =>
              toggleItem({
                artworkId: artwork.id,
                slug: artwork.slug,
                title: artwork.title,
                imageUrl: artwork.imageUrl,
                price: artwork.product?.price ?? null,
                status: artwork.status,
              }),
          });
          let x = 0;
          return buttons.map((b) => {
            const cx = x + b.width / 2;
            x += b.width + 0.02;
            return (
              <VrButton
                key={b.label}
                label={b.label}
                width={b.width}
                height={0.075}
                fontSize={0.026}
                position={[cx, 0, 0]}
                variant={b.variant}
                onClick={b.onClick}
              />
            );
          });
        })()}
        {linkHint && (
          <VrLabel position={[0, -0.06, 0]} width={TEXT_W} fontSize={0.022} color={VR_COLORS.textFaint}>
            Opens in a new tab — remove your headset to view it on screen.
          </VrLabel>
        )}
      </group>
      </group>
    </VrModal>
  );
}
