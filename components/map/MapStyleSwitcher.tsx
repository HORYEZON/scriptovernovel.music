// components/map/MapStyleSwitcher.tsx
"use client";

// Top-right pill + dropdown to swap the active TILE_STYLES key. Shared by
// the public Timeline map (components/public/EventsMapLeaflet.tsx) and the
// admin location picker (app/(admin)/admin/events/EventLocationPickerLeaflet.tsx)
// — see lib/map-tile-styles.ts for the actual tile source list.
import { useState } from "react";
import { Layers } from "lucide-react";
import { TILE_STYLES, type TileStyleKey } from "@/lib/map-tile-styles";

export function MapStyleSwitcher({
  style,
  onChange,
}: {
  style: TileStyleKey;
  onChange: (key: TileStyleKey) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="absolute right-3 top-3 z-[500]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 bg-black/70 backdrop-blur-sm rounded-full pl-3 pr-2.5 py-2 border border-white/10 text-white/90 text-xs font-medium hover:bg-black/80 transition-colors"
      >
        <Layers size={13} />
        {TILE_STYLES[style].label}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 bg-black/85 backdrop-blur-md rounded-xl border border-white/10 overflow-hidden shadow-xl min-w-[140px]">
          {(Object.keys(TILE_STYLES) as TileStyleKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                onChange(key);
                setOpen(false);
              }}
              className={`w-full text-left px-3.5 py-2 text-xs font-medium transition-colors ${
                key === style ? "bg-white/10 text-[#FFE135]" : "text-white/80 hover:bg-white/5 hover:text-white"
              }`}
            >
              {TILE_STYLES[key].label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
