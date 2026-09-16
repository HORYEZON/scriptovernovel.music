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
  MINIMAP_LABEL_FONT_OPTIONS,
  MINIMAP_LABEL_POSITIONS,
  MINIMAP_LABEL_STYLES,
  MINIMAP_MAX_LABEL_LENGTH,
  MINIMAP_MIN_WIDTH,
  MINIMAP_MAX_WIDTH,
  MINIMAP_MIN_HEIGHT,
  MINIMAP_MAX_HEIGHT,
  MINIMAP_MIN_COUNTER_SCALE,
  MINIMAP_MAX_COUNTER_SCALE,
  MINIMAP_MIN_LABEL_SIZE,
  MINIMAP_MAX_LABEL_SIZE,
  type MinimapHudConfig,
  type MinimapIconName,
  type MinimapLabelPosition,
  type MinimapLabelStyle,
} from "@/lib/museum/minimapHud";
import { AdminSelect } from "@/components/admin/AdminSelect";
import { ColorField, Toggle } from "./museum-ui";

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

/** Which room the preview pretends to be, for the floor label's sake — the
 *  three texts an admin can set each show on a different kind of room, so
 *  the preview lets them flip between all three rather than only ever
 *  showing the ground floor's. */
type PreviewFloor = "ground" | "upper" | "stairs";
const PREVIEW_FLOORS: { value: PreviewFloor; label: string; floor: number; roomType: string }[] = [
  { value: "ground", label: "Ground floor", floor: 0, roomType: "GALLERY" },
  { value: "upper", label: "Second floor", floor: 1, roomType: "GALLERY" },
  { value: "stairs", label: "Stairs", floor: 0, roomType: "STAIRS" },
];

const LABEL_STYLE_NAMES: Record<MinimapLabelStyle, string> = {
  normal: "Regular",
  bold: "Bold",
  italic: "Italic",
  "bold-italic": "Bold Italic",
};

const LABEL_POSITION_NAMES: Record<MinimapLabelPosition, string> = {
  "top-left": "Top left",
  "top-center": "Top centre",
  "top-right": "Top right",
  "bottom-left": "Bottom left",
  "bottom-center": "Bottom centre",
  "bottom-right": "Bottom right",
};

/** The player walks a slow lap of the sample room so the wedge shows its
 *  colour *and* its facing, which a parked triangle doesn't. Drawn from the
 *  same ref the museum's own tracker writes, at the same frame rate, so this
 *  costs a canvas repaint and nothing else. */
function useSampleFrame(previewFloor: PreviewFloor): React.MutableRefObject<MiniMapFrameState | null> {
  const ref = useRef<MiniMapFrameState | null>(null);
  // Read inside the rAF loop through a ref so flipping the preview floor
  // doesn't restart the lap from the top.
  const floorRef = useRef(previewFloor);
  floorRef.current = previewFloor;
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
      const previewRoom = PREVIEW_FLOORS.find((f) => f.value === floorRef.current) ?? PREVIEW_FLOORS[0];
      ref.current = {
        roomId: "preview",
        roomFloor: previewRoom.floor,
        roomType: previewRoom.roomType,
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

/** One floor's label text. Capped at the same length the sanitizer keeps, so
 *  what the admin types is what gets saved rather than being cut on the way
 *  through. Blank is allowed while editing and falls back to the placeholder
 *  on save (see sanitizeMinimapHudConfig). */
function LabelTextField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="font-body text-xs text-ink-400 dark:text-ink-300 mb-1.5 block">{label}</label>
      <input
        type="text"
        value={value}
        maxLength={MINIMAP_MAX_LABEL_LENGTH}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="admin-input w-full px-3 py-2 rounded-xl text-sm"
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
  const [previewFloor, setPreviewFloor] = useState<PreviewFloor>("ground");
  const frameRef = useSampleFrame(previewFloor);
  // Sample counters, held still rather than ticking: the numbers are here to
  // show the icons and the size, and a running clock in a settings panel
  // reads as something the admin is supposed to be watching.
  const [sample] = useState({ steps: 1284, views: 12, elapsedSeconds: 372, wishlistAdds: 3 });
  const isDefault = JSON.stringify(value) === JSON.stringify(MINIMAP_HUD_DEFAULTS);
  const labelControlsDisabled = !value.floorLabelEnabled;

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
          {/* Which floor the sample room is on — only matters for the label,
              so it hides along with it. */}
          {value.floorLabelEnabled && (
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              <span className="font-body text-[11px] text-ink-400 dark:text-ink-300 mr-1">
                Preview as
              </span>
              {PREVIEW_FLOORS.map((f) => {
                const active = f.value === previewFloor;
                return (
                  <button
                    key={f.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setPreviewFloor(f.value)}
                    className={`px-2.5 py-1 rounded-lg border font-jakarta text-[11px] font-medium transition-colors ${
                      active
                        ? "border-sepia bg-sepia/10 text-sepia"
                        : "border-black/10 dark:border-white/10 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream hover:bg-black/5 dark:hover:bg-white/5"
                    }`}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          )}
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
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-body text-[11px] uppercase tracking-widest text-ink-400 dark:text-ink-300">
                  Floor label
                </p>
                <p className="font-body text-[11px] text-ink-400 dark:text-ink-300 mt-0.5">
                  Names the floor the visitor is on, painted on the map itself.
                </p>
              </div>
              <Toggle
                checked={value.floorLabelEnabled}
                onChange={(floorLabelEnabled) => onChange({ floorLabelEnabled })}
                label="Show the floor label"
              />
            </div>
            <div
              className={`space-y-3 transition-opacity ${labelControlsDisabled ? "opacity-40 pointer-events-none" : ""}`}
              aria-disabled={labelControlsDisabled}
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <LabelTextField
                  label="Ground floor"
                  value={value.floorLabelGround}
                  placeholder={MINIMAP_HUD_DEFAULTS.floorLabelGround}
                  onChange={(floorLabelGround) => onChange({ floorLabelGround })}
                />
                <LabelTextField
                  label="Second floor"
                  value={value.floorLabelUpper}
                  placeholder={MINIMAP_HUD_DEFAULTS.floorLabelUpper}
                  onChange={(floorLabelUpper) => onChange({ floorLabelUpper })}
                />
                <LabelTextField
                  label="Stairs"
                  value={value.floorLabelStairs}
                  placeholder={MINIMAP_HUD_DEFAULTS.floorLabelStairs}
                  onChange={(floorLabelStairs) => onChange({ floorLabelStairs })}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="minimap-label-font"
                    className="font-body text-xs text-ink-400 dark:text-ink-300 mb-1.5 block"
                  >
                    Font
                  </label>
                  <AdminSelect
                    id="minimap-label-font"
                    value={value.floorLabelFont}
                    onChange={(e) => onChange({ floorLabelFont: e.target.value })}
                    className="py-2 text-sm"
                  >
                    {MINIMAP_LABEL_FONT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value} className="bg-white dark:bg-ink-900">
                        {opt.label}
                      </option>
                    ))}
                  </AdminSelect>
                </div>
                <div>
                  <label
                    htmlFor="minimap-label-style"
                    className="font-body text-xs text-ink-400 dark:text-ink-300 mb-1.5 block"
                  >
                    Style
                  </label>
                  <AdminSelect
                    id="minimap-label-style"
                    value={value.floorLabelStyle}
                    onChange={(e) => onChange({ floorLabelStyle: e.target.value as MinimapLabelStyle })}
                    className="py-2 text-sm"
                  >
                    {MINIMAP_LABEL_STYLES.map((style) => (
                      <option key={style} value={style} className="bg-white dark:bg-ink-900">
                        {LABEL_STYLE_NAMES[style]}
                      </option>
                    ))}
                  </AdminSelect>
                </div>
                <div>
                  <label
                    htmlFor="minimap-label-position"
                    className="font-body text-xs text-ink-400 dark:text-ink-300 mb-1.5 block"
                  >
                    Position
                  </label>
                  <AdminSelect
                    id="minimap-label-position"
                    value={value.floorLabelPosition}
                    onChange={(e) =>
                      onChange({ floorLabelPosition: e.target.value as MinimapLabelPosition })
                    }
                    className="py-2 text-sm"
                  >
                    {MINIMAP_LABEL_POSITIONS.map((pos) => (
                      <option key={pos} value={pos} className="bg-white dark:bg-ink-900">
                        {LABEL_POSITION_NAMES[pos]}
                      </option>
                    ))}
                  </AdminSelect>
                </div>
                <ColorField
                  label="Colour"
                  value={value.floorLabelColor}
                  defaultValue={MINIMAP_HUD_DEFAULTS.floorLabelColor}
                  onChange={(floorLabelColor) => onChange({ floorLabelColor })}
                />
              </div>
              <SizeSlider
                label="Size"
                value={value.floorLabelSize}
                min={MINIMAP_MIN_LABEL_SIZE}
                max={MINIMAP_MAX_LABEL_SIZE}
                suffix="px"
                onChange={(floorLabelSize) => onChange({ floorLabelSize })}
              />
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={value.floorLabelUppercase}
                  onChange={(e) => onChange({ floorLabelUppercase: e.target.checked })}
                  className="accent-sepia"
                />
                <span className="font-body text-xs text-ink-400 dark:text-ink-300">
                  Capitals with letter spacing (signage style)
                </span>
              </label>
            </div>
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
