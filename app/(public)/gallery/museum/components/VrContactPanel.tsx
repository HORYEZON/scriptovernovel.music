"use client";

// In-world mirror of ContactPanel.tsx (the About room's Contact Desk). The
// DOM panel is a form — name, email, message — and there is no keyboard in
// a headset, so this carries the desk's own title and subtitle and says
// where the form actually is. See VrUi.tsx's header for why the DOM panels
// are mirrored even where they can't be fully followed.
import { VrModal, VrLabel, VrRule, VR_COLORS, VR_FONT_TITLE } from "./VrUi";

const W = 0.95;
const H = 0.44;
const PAD = 0.06;
const TEXT_X = -W / 2 + PAD;
const TEXT_W = W - PAD * 2;
const TOP = H / 2 - PAD;

export function VrContactPanel({ title, subtitle, onClose }: { title: string; subtitle: string; onClose: () => void }) {
  const hasSubtitle = subtitle.trim().length > 0;
  return (
    <VrModal width={W} height={H} onClose={onClose} distance={1.2}>
      <VrLabel position={[TEXT_X, TOP, 0]} width={TEXT_W - 0.08} fontSize={0.036} font={VR_FONT_TITLE} color={VR_COLORS.text} maxLines={1}>
        {title}
      </VrLabel>
      {hasSubtitle && (
        <VrLabel position={[TEXT_X, TOP - 0.055, 0]} width={TEXT_W} fontSize={0.024} color={VR_COLORS.textFaint} maxLines={1}>
          {subtitle}
        </VrLabel>
      )}
      <VrRule position={[0, TOP - (hasSubtitle ? 0.1 : 0.065), 0]} width={TEXT_W} />
      <VrLabel position={[TEXT_X, TOP - (hasSubtitle ? 0.14 : 0.105), 0]} width={TEXT_W} fontSize={0.03} maxLines={3}>
        {"Sending an email needs a keyboard. Remove your headset and press the desk's prompt again to open the form on screen."}
      </VrLabel>
    </VrModal>
  );
}
