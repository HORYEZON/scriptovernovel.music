"use client";

// In-world mirror of components/public/StoryReader.tsx, the reader the
// Stories Room's podiums open — cover first, then the pages one at a time
// with Prev/Next, the page's caption beside it. See VrUi.tsx's header for
// why the DOM panels are mirrored.
//
// The "continue reading" link (an external URL) can't be followed from
// inside a headset without ending the session, so pressing it shows a
// remove-headset hint in place — same treatment as VrArtworkPanel's links.
import { useState } from "react";
import { storyTypeLabel, hasContinueLink, continueReadingLabel } from "@/lib/stories";
import type { MuseumStory } from "@/types";
import { VrModal, VrButton, VrImage, VrLabel, VrRule, VR_COLORS, VR_FONT_TITLE, labelHeight } from "./VrUi";

const W = 1.5;
const H = 0.92;
const PAD = 0.06;
// Pages are usually portrait, so the image column is taller than wide.
const IMAGE_W = 0.62;
const IMAGE_H = H - PAD * 2;
const TEXT_X = -W / 2 + PAD + IMAGE_W + 0.07;
const TEXT_W = W / 2 - PAD - TEXT_X;
const TOP = H / 2 - PAD;

export function VrStoryPanel({ story, onClose }: { story: MuseumStory; onClose: () => void }) {
  // -1 is the cover; 0..n-1 index into story.pages (already in page order —
  // see page.tsx's STORY_SELECT).
  const [index, setIndex] = useState(-1);
  const [linkHint, setLinkHint] = useState(false);
  const pages = story.pages;
  const onCover = index < 0;
  const page = onCover ? null : pages[index];
  const imageUrl = page ? page.imageUrl : story.coverImageUrl;
  const kicker = [storyTypeLabel(story.type), story.author].filter(Boolean).join(" · ");
  const canContinue = hasContinueLink(story);
  const lastPage = index >= pages.length - 1;

  let y = TOP;
  const kickerY = y;
  y -= labelHeight(0.022, 1) + 0.012;
  const titleY = y;
  y -= labelHeight(0.042, 2) + 0.02;
  const ruleY = y;
  y -= 0.03;
  const bodyY = y;

  return (
    <VrModal width={W} height={H} onClose={onClose} distance={1.35}>
      <VrImage url={imageUrl} width={IMAGE_W} height={IMAGE_H} position={[-W / 2 + PAD + IMAGE_W / 2, 0, 0]} />

      <VrLabel position={[TEXT_X, kickerY, 0]} width={TEXT_W} fontSize={0.022} color={VR_COLORS.textFaint} uppercase letterSpacing={0.1}>
        {kicker}
      </VrLabel>
      <VrLabel position={[TEXT_X, titleY, 0]} width={TEXT_W} fontSize={0.042} font={VR_FONT_TITLE} color={VR_COLORS.text} maxLines={2}>
        {story.title}
      </VrLabel>
      <VrRule position={[TEXT_X + TEXT_W / 2, ruleY, 0]} width={TEXT_W} />

      {/* The cover shows the blurb; a page shows its own caption (or the
          page number alone when it has none). */}
      <VrLabel position={[TEXT_X, bodyY, 0]} width={TEXT_W} fontSize={0.03} maxLines={7}>
        {onCover ? story.description : page?.caption ?? ""}
      </VrLabel>

      {/* Pager — pinned to the bottom of the text column. */}
      <group position={[TEXT_X, -H / 2 + PAD + 0.04, 0]}>
        <VrLabel position={[0, 0.075, 0]} width={TEXT_W} fontSize={0.022} color={VR_COLORS.textFaint} uppercase letterSpacing={0.08}>
          {onCover ? `Cover · ${pages.length} page${pages.length === 1 ? "" : "s"}` : `Page ${index + 1} of ${pages.length}`}
        </VrLabel>
        <VrButton
          label="Previous"
          width={0.2}
          height={0.075}
          fontSize={0.026}
          position={[0.1, 0, 0]}
          variant="outline"
          disabled={onCover}
          onClick={() => setIndex((i) => Math.max(-1, i - 1))}
        />
        <VrButton
          label={onCover ? "Start reading" : "Next"}
          width={0.2}
          height={0.075}
          fontSize={0.026}
          position={[0.32, 0, 0]}
          variant="primary"
          disabled={pages.length === 0 || (!onCover && lastPage)}
          onClick={() => setIndex((i) => Math.min(pages.length - 1, i + 1))}
        />
        {canContinue && (
          <VrButton
            label={continueReadingLabel(story.continueLabel)}
            width={0.26}
            height={0.075}
            fontSize={0.024}
            position={[0.57, 0, 0]}
            variant="outline"
            onClick={() => setLinkHint(true)}
          />
        )}
        {linkHint && (
          <VrLabel position={[0, -0.06, 0]} width={TEXT_W} fontSize={0.022} color={VR_COLORS.textFaint}>
            Opens in a new tab — remove your headset to continue there.
          </VrLabel>
        )}
      </group>
    </VrModal>
  );
}
