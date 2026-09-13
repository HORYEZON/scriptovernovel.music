"use client";

// In-world mirror of CosplayInfoPanel.tsx — the standee's story, credits,
// and both photos (standee / backdrop, switchable when both exist). See
// VrUi.tsx's header for why the DOM panels are mirrored.
import { useState } from "react";
import type { MuseumCosplay } from "@/types";
import { VrModal, VrButton, VrImage, VrLabel, VrBar, VR_COLORS, VR_FONT_TITLE, VR_FONT_BODY_BOLD, labelHeight } from "./VrUi";

const W = 1.4;
const H = 0.86;
const PAD = 0.06;
const IMAGE_W = 0.52;
const TEXT_X = -W / 2 + PAD + IMAGE_W + 0.07;
const TEXT_W = W / 2 - PAD - TEXT_X;
const TOP = H / 2 - PAD;

const TITLE_SIZE = 0.042;
const META_SIZE = 0.026;
const BODY_SIZE = 0.03;

export function VrCosplayPanel({ cosplay, onClose }: { cosplay: MuseumCosplay; onClose: () => void }) {
  const [showBackdrop, setShowBackdrop] = useState(false);
  const hasBackdrop = Boolean(cosplay.backdropImageUrl);
  const imageUrl = showBackdrop && cosplay.backdropImageUrl ? cosplay.backdropImageUrl : cosplay.standeeImageUrl;
  // The photo toggle takes a row under the image when there are two.
  const imageH = H - PAD * 2 - (hasBackdrop ? 0.1 : 0);

  const heading = cosplay.character || cosplay.title;
  const metaLine = [cosplay.series, cosplay.event, cosplay.year].filter(Boolean).join(" · ");
  const credits = [
    cosplay.cosplayer ? { label: "Cosplayer", value: cosplay.cosplayer } : null,
    cosplay.photographer ? { label: "Photo", value: cosplay.photographer } : null,
  ].filter((c): c is { label: string; value: string } => c != null);

  let y = TOP;
  const titleY = y;
  y -= labelHeight(TITLE_SIZE, 2) + 0.012;
  const metaY = y;
  if (metaLine) y -= labelHeight(META_SIZE, 1) + 0.008;
  const plaqueBottom = y;
  y -= 0.025;
  const descY = y;
  const descLines = 5;
  if (cosplay.description) y -= labelHeight(BODY_SIZE, descLines) + 0.03;
  const creditsY = y;

  return (
    <VrModal width={W} height={H} onClose={onClose} distance={1.3}>
      <VrImage
        url={imageUrl}
        width={IMAGE_W}
        height={imageH}
        position={[-W / 2 + PAD + IMAGE_W / 2, hasBackdrop ? 0.05 : 0, 0]}
      />
      {hasBackdrop && (
        <group position={[-W / 2 + PAD + IMAGE_W / 2, -H / 2 + PAD + 0.04, 0]}>
          <VrButton
            label="Standee photo"
            width={0.24}
            height={0.065}
            fontSize={0.024}
            position={[-0.13, 0, 0]}
            variant={showBackdrop ? "outline" : "primary"}
            onClick={() => setShowBackdrop(false)}
          />
          <VrButton
            label="Backdrop photo"
            width={0.24}
            height={0.065}
            fontSize={0.024}
            position={[0.13, 0, 0]}
            variant={showBackdrop ? "primary" : "outline"}
            onClick={() => setShowBackdrop(true)}
          />
        </group>
      )}

      <VrBar position={[TEXT_X - 0.028, (titleY + plaqueBottom) / 2, 0]} height={titleY - plaqueBottom} />
      <VrLabel position={[TEXT_X, titleY, 0]} width={TEXT_W} fontSize={TITLE_SIZE} font={VR_FONT_TITLE} color={VR_COLORS.text} maxLines={2} uppercase letterSpacing={0.04}>
        {heading}
      </VrLabel>
      {metaLine && (
        <VrLabel position={[TEXT_X, metaY, 0]} width={TEXT_W} fontSize={META_SIZE} color={VR_COLORS.textFaint}>
          {metaLine}
        </VrLabel>
      )}
      {cosplay.description && (
        <VrLabel position={[TEXT_X, descY, 0]} width={TEXT_W} fontSize={BODY_SIZE} maxLines={descLines}>
          {cosplay.description}
        </VrLabel>
      )}
      {credits.map((credit, i) => (
        <group key={credit.label} position={[TEXT_X, creditsY - i * 0.045, 0]}>
          <VrLabel position={[0, 0, 0]} width={0.16} fontSize={0.022} color={VR_COLORS.textFaint} uppercase letterSpacing={0.08}>
            {credit.label}
          </VrLabel>
          <VrLabel position={[0.16, 0, 0]} width={TEXT_W - 0.16} fontSize={0.028} font={VR_FONT_BODY_BOLD} color={VR_COLORS.text} maxLines={1}>
            {credit.value}
          </VrLabel>
        </group>
      ))}
    </VrModal>
  );
}
