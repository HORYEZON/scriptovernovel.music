"use client";

// In-world mirror of CertificateInfoPanel.tsx (the About room's certificate
// strip) — see VrUi.tsx's header for why the DOM panels are mirrored.
import type { MuseumAboutCertificate } from "@/types";
import { VrModal, VrImage, VrLabel, VrRule, VR_COLORS, VR_FONT_ITALIC, labelHeight } from "./VrUi";

const PAD = 0.06;
const IMAGE_W = 0.5;
const TITLE_SIZE = 0.042;
const META_SIZE = 0.026;
const BODY_SIZE = 0.03;

export function VrCertificatePanel({
  certificate,
  onClose,
}: {
  certificate: MuseumAboutCertificate;
  onClose: () => void;
}) {
  const hasImage = Boolean(certificate.imageUrl);
  // Same shape as ArtworkInfoPanel's: image beside text when there is one,
  // a narrower text-only card when there isn't.
  const W = hasImage ? 1.3 : 0.9;
  const H = 0.72;
  const textX = hasImage ? -W / 2 + PAD + IMAGE_W + 0.07 : -W / 2 + PAD;
  const textW = W / 2 - PAD - textX;
  const top = H / 2 - PAD;

  const metaLine = [
    certificate.issuer,
    certificate.dateAwarded
      ? new Date(certificate.dateAwarded).toLocaleDateString("en-PH", { year: "numeric", month: "long" })
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  let y = top;
  const titleY = y;
  y -= labelHeight(TITLE_SIZE, 2) + 0.012;
  const metaY = y;
  if (metaLine) y -= labelHeight(META_SIZE, 1) + 0.02;
  const ruleY = y;
  y -= 0.03;
  const descY = y;

  return (
    <VrModal width={W} height={H} onClose={onClose} distance={1.3}>
      {hasImage && (
        <VrImage
          url={certificate.imageUrl as string}
          width={IMAGE_W}
          height={H - PAD * 2}
          position={[-W / 2 + PAD + IMAGE_W / 2, 0, 0]}
        />
      )}
      {/* The DOM's font-display italic title. */}
      <VrLabel position={[textX, titleY, 0]} width={textW} fontSize={TITLE_SIZE} font={VR_FONT_ITALIC} color={VR_COLORS.text} maxLines={2}>
        {certificate.title}
      </VrLabel>
      {metaLine && (
        <VrLabel position={[textX, metaY, 0]} width={textW} fontSize={META_SIZE} color={VR_COLORS.textFaint}>
          {metaLine}
        </VrLabel>
      )}
      <VrRule position={[textX + textW / 2, ruleY, 0]} width={textW} />
      {certificate.description && (
        <VrLabel position={[textX, descY, 0]} width={textW} fontSize={BODY_SIZE} maxLines={7}>
          {certificate.description}
        </VrLabel>
      )}
    </VrModal>
  );
}
