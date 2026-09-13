"use client";

// app/(admin)/admin/artworks/MuseumPreviewSidebar.tsx
//
// Museum Preview panel — room picker, Light/Dark toggle, brightness sliders
// for both modes, and a read-only 3D canvas. Embedded inside the General
// Settings tab (see DigitalMuseumPanel.tsx) as a full-width section.
//
// Brightness (0-100, 50 = baseline as designed) is both:
//   - applied live to the preview canvas as the slider moves
//   - saved to the API on mouseup/touchend (same optimistic-patch pattern
//     as the rest of DigitalMuseumPanel)
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Sun, Moon, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RoomConfig, AboutRoomVisuals, FreedomWallRoomVisuals } from "./RoomsTab";
import type { PreviewRoomShell, PreviewArtworkEntry } from "./MuseumPreviewCanvas";
import type { MuseumAboutData, FreedomWallNotePublic } from "@/types";
import {
  DEFAULT_WALL_COLOR,
  DEFAULT_FLOOR_COLOR,
  DEFAULT_CEILING_COLOR,
} from "@/app/(public)/gallery/museum/components/roomConstants";

const MuseumPreviewCanvas = dynamic(
  () => import("./MuseumPreviewCanvas").then((m) => m.MuseumPreviewCanvas),
  { ssr: false }
);

const ABOUT_ID = "__about__";
const FREEDOM_WALL_ID = "__freedom-wall__";

interface SidebarRoom {
  id: string;
  label: string;
  shell: PreviewRoomShell;
  artworks: PreviewArtworkEntry[];
}

export function MuseumPreviewSidebar({
  rooms,
  aboutVisuals,
  freedomWallVisuals,
  freedomWallRoomId,
  brightnessLight,
  brightnessDark,
  onBrightnessChange,
}: {
  rooms: RoomConfig[];
  aboutVisuals: AboutRoomVisuals | null;
  /** Null until the initial fetch resolves or if the FW room doesn't exist yet. */
  freedomWallVisuals?: FreedomWallRoomVisuals | null;
  /** Used to conditionally include the Freedom Wall entry in the dropdown. */
  freedomWallRoomId?: string | null;
  brightnessLight: number;
  brightnessDark: number;
  /** Called on slider mouseup/touchend to save to the API. */
  onBrightnessChange: (patch: { brightnessLight?: number; brightnessDark?: number }) => void;
}) {
  const [selectedId, setSelectedId] = useState<string>(
    rooms[0]?.id ?? ABOUT_ID
  );
  const [darkMode, setDarkMode] = useState(false);

  // Lazy-loaded preview content — fetched once when the admin picks the
  // special room type so the canvas can show real 3D content.
  const [previewAboutData, setPreviewAboutData] = useState<MuseumAboutData | null>(null);
  const [previewNotes, setPreviewNotes] = useState<FreedomWallNotePublic[]>([]);

  // Preload About data immediately on mount so the preview canvas is ready
  // by the time the admin first clicks "About ScriptOverNovel" — previously this
  // only fetched on tab-select, causing the room to appear empty until the
  // async response arrived.
  useEffect(() => {
    fetch("/api/digital-museum/preview-about")
      .then((r) => r.json())
      .then((data: MuseumAboutData) => setPreviewAboutData(data))
      .catch(console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Preload Freedom Wall notes on mount (when FW room exists) and re-fetch
  // whenever the admin switches to that tab to catch notes added since the
  // panel was opened.
  useEffect(() => {
    if (freedomWallRoomId) {
      fetch("/api/freedom-wall/notes")
        .then((r) => r.json())
        .then((data: unknown) => setPreviewNotes(Array.isArray(data) ? (data as FreedomWallNotePublic[]) : []))
        .catch(console.error);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedId === FREEDOM_WALL_ID) {
      fetch("/api/freedom-wall/notes")
        .then((r) => r.json())
        .then((data: unknown) => setPreviewNotes(Array.isArray(data) ? (data as FreedomWallNotePublic[]) : []))
        .catch(console.error);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // Local slider state — updates the preview instantly while dragging.
  // onBrightnessChange (saves to API) is only called on commit (mouseup).
  const [localBrightnessLight, setLocalBrightnessLight] = useState(brightnessLight);
  const [localBrightnessDark, setLocalBrightnessDark] = useState(brightnessDark);

  const activeBrightness = darkMode ? localBrightnessDark : localBrightnessLight;

  const allOptions: SidebarRoom[] = [
    ...rooms.map((r) => ({
      id: r.id,
      label: r.name,
      shell: {
        roomType: r.roomType,
        wallColor: r.wallColor,
        floorColor: r.floorColor,
        ceilingColor: r.ceilingColor,
        wallTexture: r.wallTexture,
        floorTexture: r.floorTexture,
        ceilingTexture: r.ceilingTexture,
      } satisfies PreviewRoomShell,
      artworks: r.artworks
        .filter((e) => e.artwork.published)
        .map((e) => ({
          id: e.artwork.id,
          title: e.artwork.title,
          imageUrl: e.artwork.imageUrl,
        })),
    })),
    // Freedom Wall — only shown when the room has been provisioned (freedomWallRoomId
    // is set) and visuals are loaded. Order matches the real corridor: FW is just
    // before About ScriptOverNovel (displayOrder 999_998 vs 999_999).
    ...(freedomWallRoomId && freedomWallVisuals
      ? [
          {
            id: FREEDOM_WALL_ID,
            label: "Freedom Wall",
            shell: {
              roomType: "FREEDOM_WALL",
              wallColor: freedomWallVisuals.wallColor,
              floorColor: freedomWallVisuals.floorColor,
              ceilingColor: freedomWallVisuals.ceilingColor,
              wallTexture: freedomWallVisuals.wallTexture,
              floorTexture: freedomWallVisuals.floorTexture,
              ceilingTexture: freedomWallVisuals.ceilingTexture,
            } satisfies PreviewRoomShell,
            artworks: [],
          },
        ]
      : []),
    {
      id: ABOUT_ID,
      label: "About ScriptOverNovel",
      shell: {
        roomType: "ABOUT",
        wallColor: aboutVisuals?.aboutWallColor ?? DEFAULT_WALL_COLOR,
        floorColor: aboutVisuals?.aboutFloorColor ?? DEFAULT_FLOOR_COLOR,
        ceilingColor: aboutVisuals?.aboutCeilingColor ?? DEFAULT_CEILING_COLOR,
        wallTexture: aboutVisuals?.aboutWallTexture ?? null,
        floorTexture: aboutVisuals?.aboutFloorTexture ?? null,
        ceilingTexture: aboutVisuals?.aboutCeilingTexture ?? null,
      } satisfies PreviewRoomShell,
      artworks: [],
    },
  ];

  const active = allOptions.find((o) => o.id === selectedId) ?? allOptions[0];

  return (
    <div className="space-y-4">
      {/* Top controls row — room picker + Light/Dark toggle */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[180px]">
          <label className="font-body text-xs text-ink-400 dark:text-ink-300 mb-1.5 block">
            Room
          </label>
          <div className="relative">
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="admin-input w-full pl-3 pr-9 py-2 rounded-xl text-sm appearance-none cursor-pointer"
            >
              {allOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-400"
            />
          </div>
        </div>

        {/* Light / Dark scene toggle */}
        <div className="flex items-center rounded-lg border border-black/10 dark:border-white/10 overflow-hidden shrink-0">
          <button
            type="button"
            onClick={() => setDarkMode(false)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-2 font-jakarta text-xs font-medium transition-colors",
              !darkMode
                ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                : "text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream"
            )}
          >
            <Sun size={12} />
            Light
          </button>
          <button
            type="button"
            onClick={() => setDarkMode(true)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-2 font-jakarta text-xs font-medium transition-colors",
              darkMode
                ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400"
                : "text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream"
            )}
          >
            <Moon size={12} />
            Dark
          </button>
        </div>
      </div>

      {/* 3D Preview canvas — 16:9, big */}
      <div
        className="relative w-full rounded-xl overflow-hidden border border-black/10 dark:border-white/10 bg-[#141210]"
        style={{ aspectRatio: "16/9" }}
      >
        {active ? (
          <MuseumPreviewCanvas
            room={active.shell}
            artworks={active.artworks}
            darkMode={darkMode}
            brightness={activeBrightness}
            aboutData={active.id === ABOUT_ID ? previewAboutData : undefined}
            freedomWallNotes={active.id === FREEDOM_WALL_ID ? previewNotes : undefined}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="font-body text-xs text-white/40">Loading…</p>
          </div>
        )}

        {active?.id === ABOUT_ID && (
          <div className="absolute bottom-2 inset-x-2 text-center pointer-events-none">
            <span className="inline-block px-2 py-1 rounded-md bg-black/60 backdrop-blur-sm font-body text-[10px] text-white/60">
              About room content comes from your Profile settings
            </span>
          </div>
        )}
        {active?.id === FREEDOM_WALL_ID && (
          <div className="absolute bottom-2 inset-x-2 text-center pointer-events-none">
            <span className="inline-block px-2 py-1 rounded-md bg-black/60 backdrop-blur-sm font-body text-[10px] text-white/60">
              Freedom Wall — sticky notes added by visitors appear here
            </span>
          </div>
        )}
      </div>

      {/* Brightness sliders — two independent sliders, one per mode */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Light mode brightness */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="font-body text-xs text-ink-400 dark:text-ink-300 flex items-center gap-1.5">
              <Sun size={12} className="text-amber-500 shrink-0" />
              Light Brightness
            </label>
            <span className="font-body text-xs tabular-nums text-ink-400 dark:text-ink-300">
              {localBrightnessLight}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={localBrightnessLight}
            onChange={(e) => setLocalBrightnessLight(Number(e.target.value))}
            onMouseUp={(e) => onBrightnessChange({ brightnessLight: Number((e.target as HTMLInputElement).value) })}
            onTouchEnd={(e) => onBrightnessChange({ brightnessLight: Number((e.target as HTMLInputElement).value) })}
            className="w-full accent-amber-500"
          />
        </div>

        {/* Dark mode brightness */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="font-body text-xs text-ink-400 dark:text-ink-300 flex items-center gap-1.5">
              <Moon size={12} className="text-indigo-400 shrink-0" />
              Dark Brightness
            </label>
            <span className="font-body text-xs tabular-nums text-ink-400 dark:text-ink-300">
              {localBrightnessDark}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={localBrightnessDark}
            onChange={(e) => setLocalBrightnessDark(Number(e.target.value))}
            onMouseUp={(e) => onBrightnessChange({ brightnessDark: Number((e.target as HTMLInputElement).value) })}
            onTouchEnd={(e) => onBrightnessChange({ brightnessDark: Number((e.target as HTMLInputElement).value) })}
            className="w-full accent-indigo-500"
          />
        </div>
      </div>

      <p className="font-body text-[11px] text-ink-400 dark:text-ink-300">
        Drag to orbit · Scroll to zoom. Brightness changes apply to the live museum immediately.
        Sliding all the way to 0% will make the room completely black.
      </p>
    </div>
  );
}
