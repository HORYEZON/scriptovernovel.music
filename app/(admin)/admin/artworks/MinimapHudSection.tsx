// app/(admin)/admin/artworks/MinimapHudSection.tsx
"use client";

// Artworks ▸ Digital Museum ▸ General Settings ▸ Minimap HUD — the size,
// colours and counter icons of the radar card a visitor reads in the
// bottom-left corner of the museum.
//
// The preview is the real components, not a drawing of them: MiniMapHud.tsx
// and AchievementHud.tsx are both fed a hand-made frame here and rendered on
// the same dark card the museum wraps them in. That is deliberate and it is
// the whole value of this section — a mock would drift from the thing it
// stands for the first time either component changed, and the one question
// an admin is actually asking ("what will this look like?") is exactly the
// question a mock can't answer honestly. The sample room, its dots and the
// walking player below exist only so there is something on the map to judge
// the colours by.
import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { MiniMapHud } from "@/app/(public)/gallery/museum/components/MiniMapHud";
import {
  AchievementHud,
  minimapCounterIcon,
} from "@/app/(public)/gallery/museum/components/AchievementHud";
import type { MiniMapFrameState } from "@/app/(public)/gallery/museum/components/MiniMapTracker";
import {
  MINIMAP_HUD_DEFAULTS,
  MINIMAP_ICON_NAMES,
  MINIMAP_MIN_WIDTH,
  MINIMAP_MAX_WIDTH,
  MINIMAP_MIN_HEIGHT,
  MINIMAP_MAX_HEIGHT,
  MINIMAP_MIN_COUNTER_SCALE,
  MINIMAP_MAX_COUNTER_SCALE,
  type MinimapHudConfig,
  type MinimapIconName,
} from "@/lib/museum/minimapHud";
import { ColorField } from "./museum-ui";

/** A stand-in room for the preview: a plain 10×8 m gallery with a doorway at
 *  each end, some art on the walls, two props on the floor and a companion
 *  wandering — enough of each kind of mark that every colour below has
 *  something on the map to be judged against. */
const SAMPLE_ROOM = { width: 10, depth: 8 };

const SAMPLE_ARTWORKS: { x: number; z: number; active: boolean }[] = [
  { x: -3.2, z: -3.8, active: false },
  { x: -1, z: -3.8, active: false },
  { x: 1.2, z: -3.8, active: true },
  { x: 3.4, z: -3.8, active: false },
  { x: -4.8, z: -1, active: false },
  { x: -4.8, z: 1.4, active: false },
  { x: 4.8, z: 0, active: false },
  { x: 4.8, z: 2.2, active: false },
];

const SAMPLE_OBJECTS: { x: number; z: number; active: boolean }[] = [
  { x: -2, z: 1.6, active: false },
  { x: 2.4, z: 2, active: false },
  { x: 0, z: -0.6, active: false },
];

const SAMPLE_NOTES: { x: number; z: number }[] = [
  { x: -3.6, z: 3.6 },
  { x: -2.6, z: 3.6 },
];

const ICON_LABELS: Record<MinimapIconName, string> = {
  footprints: "Footprints",
  eye: "Eye",
  clock: "Clock",
  heart: "Heart",
  star: "Star",
  sparkles: "Sparkles",
  "map-pin": "Map Pin",
  compass: "Compass",
  flag: "Flag",
  trophy: "Trophy",
  bookmark: "Bookmark",
  activity: "Activity",
};

/** The player walks a slow lap of the sample room so the wedge shows its
 *  colour *and* its facing, which a parked triangle doesn't. Drawn from the
 *  same ref the museum's own tracker writes, at the same frame rate, so this
 *  costs a canvas repaint and nothing else. */
function useSampleFrame(): React.MutableRefObject<MiniMapFrameState | null> {
  const ref = useRef<MiniMapFrameState | null>(null);
  useEffect(() => {
    let raf: number;
    const start = performance.now();
    function tick(now: number) {
      const t = ((now - start) / 9000) % 1;
      const angle = t * Math.PI * 2;
      // An ellipse inset from the walls, with the wedge pointing along the
      // direction of travel. Yaw is measured the way MiniMapHud paints it:
      // 0 = due north (-Z), increasing clockwise.
      const x = Math.sin(angle) * 3;
      const z = -Math.cos(angle) * 2.2;
      const dx = Math.cos(angle) * 3;
      const dz = Math.sin(angle) * 2.2;
      ref.current = {
        roomId: "preview",
        roomWidth: SAMPLE_ROOM.width,
        roomDepth: SAMPLE_ROOM.depth,
        hasNorthOpening: true,
        hasSouthOpening: true,
        localX: x,
        localZ: z,
        yaw: Math.atan2(dx, -dz),
        artworkPositions: SAMPLE_ARTWORKS,
        objectPositions: SAMPLE_OBJECTS,
        stickyNotePositions: SAMPLE_NOTES,
        companionPositions: [{ x: -Math.sin(angle) * 2.4, z: Math.cos(angle) * 1.6 }],
      };
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return ref;
}

function SizeSlider({
  label,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="font-body text-xs text-ink-400 dark:text-ink-300">{label}</label>
        <span className="font-body text-[11px] tabular-nums text-ink-400 dark:text-ink-300">
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-sepia"
      />
    </div>
  );
}

/** One counter's icon picker — the icons themselves, not their names, since
 *  what an admin is choosing is a shape they'll see on the card. */
function IconPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: MinimapIconName;
  onChange: (value: MinimapIconName) => void;
}) {
  return (
    <div>
      <label className="font-body text-xs text-ink-400 dark:text-ink-300 mb-1.5 block">{label}</label>
      <div className="flex flex-wrap gap-1">
        {MINIMAP_ICON_NAMES.map((name) => {
          const Icon = minimapCounterIcon(name);
          const active = name === value;
          return (
            <button
              key={name}
              type="button"
              title={ICON_LABELS[name]}
              aria-label={`${label}: ${ICON_LABELS[name]}`}
              aria-pressed={active}
              onClick={() => onChange(name)}
              className={`p-1.5 rounded-lg border transition-colors ${
                active
                  ? "border-sepia bg-sepia/10 text-sepia"
                  : "border-black/10 dark:border-white/10 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/5 dark:hover:bg-white/5"
              }`}
            >
              <Icon size={15} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function MinimapHudSection({
  value,
  onChange,
}: {
  value: MinimapHudConfig;
  onChange: (patch: Partial<MinimapHudConfig>) => void;
}) {
  const frameRef = useSampleFrame();
  // Sample counters, held still rather than ticking: the numbers are here to
  // show the icons and the size, and a running clock in a settings panel
  // reads as something the admin is supposed to be watching.
  const [sample] = useState({ steps: 1284, views: 12, elapsedSeconds: 372, wishlistAdds: 3 });
  const isDefault = JSON.stringify(value) === JSON.stringify(MINIMAP_HUD_DEFAULTS);

  return (
    <div className="admin-card border rounded-2xl p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-jakarta text-sm font-medium text-ink dark:text-cream">Minimap HUD</p>
          <p className="font-body text-xs text-ink-400 dark:text-ink-300 mt-0.5">
            The radar card in the museum&apos;s bottom-left corner — its size, the colour of every
            mark on it, and the counters underneath. Applies to every room.
          </p>
        </div>
        <button
          type="button"
          disabled={isDefault}
          onClick={() => onChange({ ...MINIMAP_HUD_DEFAULTS })}
          className="shrink-0 inline-flex items-center gap-1.5 font-jakarta text-[11px] font-medium text-sepia hover:underline disabled:opacity-40 disabled:no-underline"
        >
          <RotateCcw size={13} />
          Reset to defaults
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* --- Preview ------------------------------------------------
            On the same near-black ground the museum draws it over, at the
            same 0.78 scale MuseumClient.tsx renders the desktop card at, so
            the size sliders read in the units the admin will actually see. */}
        <div className="order-first lg:order-last">
          <p className="font-body text-xs text-ink-400 dark:text-ink-300 mb-1.5">Preview</p>
          <div className="rounded-2xl bg-[#141414] border border-white/10 p-4 flex items-end justify-center min-h-[240px] overflow-hidden">
            <div className="flex flex-col items-stretch gap-2 rounded-2xl bg-black/50 backdrop-blur-md border border-white/10 p-2 origin-bottom scale-[0.78]">
              <MiniMapHud frameStateRef={frameRef} config={value} />
              <AchievementHud
                bare
                config={value}
                steps={sample.steps}
                views={sample.views}
                elapsedSeconds={sample.elapsedSeconds}
                wishlistAdds={sample.wishlistAdds}
              />
            </div>
          </div>
          <p className="font-body text-[11px] text-ink-400 dark:text-ink-300 mt-1.5">
            A sample room with the player walking a lap. The counters only appear in the museum
            when Badges &amp; Trophies and its HUD card are both switched on.
          </p>
        </div>

        {/* --- Controls ----------------------------------------------- */}
        <div className="space-y-4">
          <div className="space-y-2.5">
            <p className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300">
              Size
            </p>
            <SizeSlider
              label="Map width"
              value={value.width}
              min={MINIMAP_MIN_WIDTH}
              max={MINIMAP_MAX_WIDTH}
              suffix="px"
              onChange={(width) => onChange({ width })}
            />
            <SizeSlider
              label="Map height"
              value={value.height}
              min={MINIMAP_MIN_HEIGHT}
              max={MINIMAP_MAX_HEIGHT}
              suffix="px"
              onChange={(height) => onChange({ height })}
            />
            <SizeSlider
              label="Counter size"
              value={value.counterScale}
              min={MINIMAP_MIN_COUNTER_SCALE}
              max={MINIMAP_MAX_COUNTER_SCALE}
              suffix="%"
              onChange={(counterScale) => onChange({ counterScale })}
            />
            <p className="font-body text-[11px] text-ink-400 dark:text-ink-300">
              Phones keep their own smaller map — it opens out of the counter card rather than
              sitting on screen permanently, so a desktop-sized one would take the whole view.
              Colours and counter size apply there too.
            </p>
          </div>

          <div className="space-y-2.5 pt-1 border-t border-black/5 dark:border-white/5">
            <p className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300">
              Colours
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ColorField
                label="Player pointer"
                value={value.playerColor}
                defaultValue={MINIMAP_HUD_DEFAULTS.playerColor}
                onChange={(playerColor) => onChange({ playerColor })}
              />
              <ColorField
                label="Artwork dots"
                value={value.artworkColor}
                defaultValue={MINIMAP_HUD_DEFAULTS.artworkColor}
                onChange={(artworkColor) => onChange({ artworkColor })}
              />
              <ColorField
                label="Object dots"
                value={value.objectColor}
                defaultValue={MINIMAP_HUD_DEFAULTS.objectColor}
                onChange={(objectColor) => onChange({ objectColor })}
              />
              <ColorField
                label="Nearby glow"
                value={value.activeColor}
                defaultValue={MINIMAP_HUD_DEFAULTS.activeColor}
                onChange={(activeColor) => onChange({ activeColor })}
              />
              <ColorField
                label="Companion dots"
                value={value.companionColor}
                defaultValue={MINIMAP_HUD_DEFAULTS.companionColor}
                onChange={(companionColor) => onChange({ companionColor })}
              />
              <ColorField
                label="Room outline"
                value={value.roomColor}
                defaultValue={MINIMAP_HUD_DEFAULTS.roomColor}
                onChange={(roomColor) => onChange({ roomColor })}
              />
              <ColorField
                label="Doorways"
                value={value.doorColor}
                defaultValue={MINIMAP_HUD_DEFAULTS.doorColor}
                onChange={(doorColor) => onChange({ doorColor })}
              />
            </div>
            <p className="font-body text-[11px] text-ink-400 dark:text-ink-300">
              <strong className="font-medium">Nearby glow</strong> is the highlight on whatever the
              visitor is standing close enough to open — an artwork, a sticky note, the Contact
              Desk. Artwork and object dots keep their different weights so the pieces stay the
              louder mark even in one colour.
            </p>
          </div>

          <div className="space-y-2.5 pt-1 border-t border-black/5 dark:border-white/5">
            <p className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300">
              Counter icons
            </p>
            <IconPicker
              label="Steps walked"
              value={value.stepsIcon}
              onChange={(stepsIcon) => onChange({ stepsIcon })}
            />
            <IconPicker
              label="Artworks viewed"
              value={value.viewsIcon}
              onChange={(viewsIcon) => onChange({ viewsIcon })}
            />
            <IconPicker
              label="Time inside"
              value={value.timeIcon}
              onChange={(timeIcon) => onChange({ timeIcon })}
            />
            <IconPicker
              label="Wishlisted"
              value={value.wishlistIcon}
              onChange={(wishlistIcon) => onChange({ wishlistIcon })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
