"use client";

// In-world mirror of GigsPanel.tsx (the About room's Timeline & Gigs board).
// The DOM panel is mostly a Leaflet map with the events pinned on it; there
// is no in-world map, so this is the same events as a list — title, venue,
// date, and which one is next — paged five at a time. See VrUi.tsx's header
// for why the DOM panels are mirrored.
import { useState } from "react";
import type { MuseumAboutGig } from "@/types";
import { VrModal, VrButton, VrLabel, VrRule, VrChip, VR_COLORS, VR_FONT_TITLE, VR_FONT_BODY_BOLD } from "./VrUi";

const W = 1.1;
const H = 0.9;
const PAD = 0.06;
const TEXT_X = -W / 2 + PAD;
const TEXT_W = W - PAD * 2;
const TOP = H / 2 - PAD;
const PER_PAGE = 5;
const ROW_H = 0.105;

function formatEventDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export function VrGigsPanel({ gigs, onClose }: { gigs: MuseumAboutGig[]; onClose: () => void }) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(gigs.length / PER_PAGE));
  const visible = gigs.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);
  const listTop = TOP - 0.1;

  return (
    <VrModal width={W} height={H} onClose={onClose} distance={1.3}>
      <VrLabel position={[TEXT_X, TOP, 0]} width={TEXT_W} fontSize={0.036} font={VR_FONT_TITLE} color={VR_COLORS.text} uppercase letterSpacing={0.06}>
        Timeline & Gigs
      </VrLabel>
      <VrRule position={[0, TOP - 0.06, 0]} width={TEXT_W} />

      {gigs.length === 0 && (
        <VrLabel position={[TEXT_X, listTop, 0]} width={TEXT_W} fontSize={0.03} color={VR_COLORS.textSoft}>
          No events yet — check back soon.
        </VrLabel>
      )}

      {visible.map((gig, i) => {
        const rowY = listTop - i * ROW_H;
        const meta = [gig.venueName, formatEventDate(gig.eventDate)].filter(Boolean).join(" · ");
        return (
          <group key={gig.id} position={[TEXT_X, rowY, 0]}>
            <VrLabel position={[0, 0, 0]} width={TEXT_W - (gig.isNextEvent ? 0.14 : 0)} fontSize={0.03} font={VR_FONT_BODY_BOLD} color={VR_COLORS.text} maxLines={1}>
              {gig.title}
            </VrLabel>
            {meta && (
              <VrLabel position={[0, -0.042, 0]} width={TEXT_W} fontSize={0.024} color={VR_COLORS.textFaint} maxLines={1}>
                {meta}
              </VrLabel>
            )}
            {gig.isNextEvent && <VrChip label="Next" position={[TEXT_W - 0.05, -0.012, 0]} width={0.09} height={0.042} fontSize={0.02} accent />}
            {i < visible.length - 1 && <VrRule position={[TEXT_W / 2, -ROW_H + 0.02, 0]} width={TEXT_W} />}
          </group>
        );
      })}

      <group position={[TEXT_X, -H / 2 + PAD + 0.04, 0]}>
        {pageCount > 1 && (
          <>
            <VrButton label="Previous" width={0.18} height={0.07} fontSize={0.024} position={[0.09, 0, 0]} variant="outline" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} />
            <VrButton label="Next" width={0.18} height={0.07} fontSize={0.024} position={[0.29, 0, 0]} variant="outline" disabled={page >= pageCount - 1} onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} />
            <VrLabel position={[0.42, 0.014, 0]} width={0.3} fontSize={0.022} color={VR_COLORS.textFaint}>
              {`${page + 1} / ${pageCount}`}
            </VrLabel>
          </>
        )}
        <VrLabel position={[pageCount > 1 ? 0.56 : 0, 0.014, 0]} width={pageCount > 1 ? TEXT_W - 0.56 : TEXT_W} fontSize={0.022} color={VR_COLORS.textFaint} maxLines={2}>
          The map view opens on the 2D screen — remove your headset for it.
        </VrLabel>
      </group>
    </VrModal>
  );
}
