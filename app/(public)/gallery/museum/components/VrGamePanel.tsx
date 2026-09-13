"use client";

// In-world mirror of components/public/minigames/GamePreviewModal.tsx — the
// Arcade Room cabinet's preview: the game, how it's played, difficulty and
// time limit, the reward on offer. See VrUi.tsx's header for why the DOM
// panels are mirrored.
//
// The one thing that can't follow: playing. GameSession is a DOM canvas
// with its own keys, so the Start button here is replaced by the same
// "remove headset" line the old toast carried — the preview is the mirror,
// the round itself stays on the 2D screen.
import { DIFFICULTY_LABELS, type PublicGame } from "@/lib/minigames/types";
import { VrModal, VrButton, VrImage, VrLabel, VrRule, VrChip, VR_COLORS, VR_FONT_TITLE, labelHeight } from "./VrUi";

const PAD = 0.06;
const IMAGE_W = 0.46;

export function VrGamePanel({
  game,
  howToPlay,
  onClose,
}: {
  game: PublicGame;
  howToPlay: string;
  onClose: () => void;
}) {
  const imageUrl = game.artwork?.imageUrl ?? null;
  const W = imageUrl ? 1.3 : 0.95;
  const H = 0.8;
  const textX = imageUrl ? -W / 2 + PAD + IMAGE_W + 0.07 : -W / 2 + PAD;
  const textW = W / 2 - PAD - textX;
  const top = H / 2 - PAD;

  const facts: string[] = [DIFFICULTY_LABELS[game.difficulty]];
  if (game.timeLimitSec > 0) facts.push(`${Math.round(game.timeLimitSec / 60)} min limit`);
  if (game.bestScore !== null) facts.push(`Your best ${game.bestScore.toLocaleString()}`);

  let y = top;
  const titleY = y;
  y -= labelHeight(0.042, 1) + 0.008;
  const descY = y;
  y -= labelHeight(0.028, 2) + 0.02;
  const ruleY = y;
  y -= 0.03;
  const howY = y;
  y -= labelHeight(0.028, 4) + 0.03;
  const factsY = y;
  y -= 0.07;
  const rewardY = y;
  if (game.rewardEnabled && game.rewardDescription) y -= labelHeight(0.026, 2) + 0.02;

  let chipX = 0;

  return (
    <VrModal width={W} height={H} onClose={onClose} distance={1.3}>
      {imageUrl && <VrImage url={imageUrl} width={IMAGE_W} height={H - PAD * 2} position={[-W / 2 + PAD + IMAGE_W / 2, 0, 0]} />}

      <VrLabel position={[textX, titleY, 0]} width={textW} fontSize={0.042} font={VR_FONT_TITLE} color={VR_COLORS.text} maxLines={1}>
        {game.name}
      </VrLabel>
      <VrLabel position={[textX, descY, 0]} width={textW} fontSize={0.028} color={VR_COLORS.textSoft} maxLines={2}>
        {game.description}
      </VrLabel>
      <VrRule position={[textX + textW / 2, ruleY, 0]} width={textW} />
      <VrLabel position={[textX, howY, 0]} width={textW} fontSize={0.028} maxLines={4}>
        {howToPlay}
      </VrLabel>

      {facts.map((fact) => {
        const width = 0.03 + fact.length * 0.0145;
        const x = chipX + width / 2;
        chipX += width + 0.012;
        return <VrChip key={fact} label={fact} position={[textX + x, factsY - 0.025, 0]} width={width} />;
      })}

      {game.rewardEnabled && game.rewardDescription && (
        <VrLabel position={[textX, rewardY, 0]} width={textW} fontSize={0.026} color="#d9c9a8" maxLines={2}>
          {`Reach ${game.rewardThreshold.toLocaleString()} points to unlock ${game.rewardDescription}.`}
        </VrLabel>
      )}

      {/* Where the DOM's Start button sits. */}
      <group position={[textX, -H / 2 + PAD + 0.04, 0]}>
        <VrButton label="Start game" width={0.22} height={0.075} fontSize={0.026} position={[0.11, 0, 0]} variant="primary" disabled />
        <VrLabel position={[0.25, 0.014, 0]} width={textW - 0.25} fontSize={0.022} color={VR_COLORS.textFaint} maxLines={2}>
          Remove your headset to play — rounds run on the 2D screen.
        </VrLabel>
      </group>
    </VrModal>
  );
}
