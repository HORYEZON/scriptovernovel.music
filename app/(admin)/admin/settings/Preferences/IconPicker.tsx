// app/(admin)/admin/settings/Preferences/IconPicker.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Search, X, RotateCcw } from "lucide-react";
import {
  DynamicIcon,
  ICON_PLATFORMS,
  getIconNames,
  parseIconValue,
  toIconValue,
  type IconPlatform,
} from "@/components/ui/DynamicIcon";
import { IconHoverColorsEditor, DEFAULT_HOVER_COLORS } from "./IconHoverColorsEditor";

// A curated starting grid per platform (mascot / playful / brand-ish icons)
// shown before the admin types a search query. Typing searches that
// platform's full icon catalog — ~1500 for Lucide, and a ~1500-icon curated
// subset of Tabler's ~6200 (see scripts/generate-tabler-icon-map.mjs for
// why the full Tabler catalog isn't offered). Sorted alphabetically, same as
// the live search results below, so the grid always reads in one order.
const SUGGESTED: Record<IconPlatform, string[]> = {
  lucide: [
    "bot", "ghost", "sparkles", "bird", "cat", "dog", "fish", "rabbit",
    "squirrel", "bug", "feather", "paw-print", "shell", "turtle", "rat",
    "snail", "worm", "egg", "footprints", "leaf", "flame", "star", "smile",
    "heart", "gem", "crown", "wand-sparkles", "party-popper", "puzzle",
    "rocket", "shapes", "palette", "drama", "circle-user", "origami",
  ].sort(),
  tabler: [
    "robot", "ghost", "sparkles", "cat", "dog", "fish", "bug", "feather",
    "paw", "egg", "leaf", "flame", "star", "mood-smile", "heart", "diamond",
    "crown", "wand", "puzzle", "rocket", "shape", "palette", "user-circle",
    "confetti", "masks-theater",
  ].sort(),
};

const PAGE_SIZE = 96;

function toTitle(name: string) {
  return name.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}

export function IconPicker({
  label,
  helpText,
  value,
  onChange,
  defaultLabel = "Using the default icon",
  hoverColors,
  onHoverColorsChange,
  hoverColorsHelpText = "Colors this icon cycles through each time it's hovered.",
}: {
  label: string;
  helpText: string;
  value: string;
  onChange: (value: string) => void;
  defaultLabel?: string;
  /** This slot's own hover-color cycle (Profile.<slot>IconColors) — independent per picker. */
  hoverColors?: string[];
  /** Presence of this is what opts the picker into the whole hover-colors feature (trigger badge cycling + the swatch editor in the modal) — omit both props entirely for slots that shouldn't have it (FAQ Chat Icon, Server Error Icon). */
  onHoverColorsChange?: (colors: string[]) => void;
  /** Overridable per slot — the Favicon picker's colors drive a real live
   * animation (components/AnimatedFavicon.tsx), not just this dialog's own
   * hover preview, so its wording differs from the other five slots. */
  hoverColorsHelpText?: string;
}) {
  const parsed = parseIconValue(value);
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<IconPlatform>(parsed?.platform ?? "lucide");
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [hoveredName, setHoveredName] = useState<string | null>(null);

  const hoverEnabled = !!onHoverColorsChange;
  const cycleColors = hoverColors && hoverColors.length > 0 ? hoverColors : DEFAULT_HOVER_COLORS;
  // Cycles the trigger badge's icon color on hover — same mechanics as
  // AdminSidebar.tsx's own collapsed-icon cycle, just local to this picker's
  // own trigger instead of the sidebar.
  const [colorIndex, setColorIndex] = useState(0);

  useEffect(() => {
    if (!open) return;
    setPlatform(parsed?.platform ?? "lucide");
    setQuery("");
    setVisibleCount(PAGE_SIZE);
    setHoveredName(null);
    // Only re-sync when the picker opens, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Lock background scroll while the picker is open (same approach as
  // ImagePreviewModal.tsx).
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    // SUGGESTED is pre-sorted at module scope; search results are sorted
    // here so both paths land in the same alphabetical order.
    if (!q) return SUGGESTED[platform];
    return getIconNames(platform).filter((n) => n.includes(q)).sort();
  }, [platform, query]);

  function select(name: string) {
    onChange(toIconValue(platform, name));
    setOpen(false);
  }

  const statusText = parsed
    ? `${toTitle(parsed.name)} · ${ICON_PLATFORMS.find((p) => p.id === parsed.platform)?.label}`
    : defaultLabel;

  return (
    <div className="relative group">
      {/* Whole tile is the trigger — matches the Transition Effect picker's
          card language (text-left p-3 rounded-xl border) instead of each
          icon slot being its own full-width drop-zone row, so a page with
          several of these (Branding → Icons) reads as one compact grid
          instead of a long stack. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={helpText}
        className={`w-full text-left p-3 ${value ? "pr-8" : ""} rounded-xl border transition-all flex items-center gap-3 ${
          value
            ? "border-sepia bg-sepia/10"
            : "border-black/10 dark:border-white/10 hover:border-black/30 dark:hover:border-white/30"
        }`}
      >
        <span
          className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
            value
              ? "bg-sepia/15 text-sepia"
              : "bg-black/5 dark:bg-white/10 text-ink-500 dark:text-ink-200"
          }`}
          // Cycles this slot's own hover colors on the trigger badge — only
          // wired when the picker was opted into the feature (see the
          // hoverEnabled/onHoverColorsChange doc comment above).
          onMouseEnter={
            hoverEnabled && parsed
              ? () => setColorIndex((i) => (i + 1) % cycleColors.length)
              : undefined
          }
        >
          {parsed ? (
            <DynamicIcon
              platform={parsed.platform}
              name={parsed.name}
              size={18}
              style={hoverEnabled ? { color: cycleColors[colorIndex] } : undefined}
            />
          ) : (
            <Search size={14} className="opacity-40" />
          )}
        </span>
        <span className="flex-1 min-w-0">
          <span
            className={`block font-body text-sm font-medium truncate ${
              value ? "text-sepia" : "text-ink dark:text-cream"
            }`}
          >
            {label}
          </span>
          <span className="block font-body text-[11px] text-ink-400 dark:text-ink-300 truncate">
            {statusText}
          </span>
        </span>
      </button>
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          title="Revert to default"
          aria-label={`Revert ${label} to default icon`}
          className="absolute top-1.5 right-1.5 p-1 rounded-md text-ink-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
        >
          <RotateCcw size={12} />
        </button>
      )}

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          // Rendered via portal, straight onto <body> — several ancestors
          // in this form (the section cards) use backdrop-blur, which (like
          // transform/filter) creates a new containing block for `fixed`
          // descendants. Left nested in the tree, this modal would center
          // itself against the nearest blurred card instead of the actual
          // viewport, cutting itself off. Portalling out from under all of
          // that is the standard fix, not a one-off patch for this card.
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setOpen(false)}
          >
            <div
              className="w-full max-w-2xl max-h-[80vh] flex flex-col rounded-2xl admin-modal border shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label={label}
            >
              <div className="flex items-center gap-2 px-4 py-3 border-b border-ink-100 dark:border-ink-700 shrink-0">
                <Search size={16} className="text-ink-400 shrink-0" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setVisibleCount(PAGE_SIZE);
                    setHoveredName(null);
                  }}
                  placeholder={`Search ${ICON_PLATFORMS.find((p) => p.id === platform)?.label} icons…`}
                  className="flex-1 bg-transparent outline-none font-body text-sm text-ink dark:text-cream placeholder:text-ink-400"
                />
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="p-1 text-ink-400 hover:text-ink dark:hover:text-cream transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Platform tabs */}
              <div className="flex gap-1 px-4 pt-3 shrink-0">
                {ICON_PLATFORMS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setPlatform(p.id);
                      setQuery("");
                      setVisibleCount(PAGE_SIZE);
                      setHoveredName(null);
                    }}
                    className={`px-3 py-1.5 rounded-lg font-body text-xs tracking-wide transition-colors ${
                      platform === p.id
                        ? "bg-sepia/10 text-sepia border border-sepia/30"
                        : "text-ink-400 dark:text-ink-400 hover:text-ink dark:hover:text-cream border border-transparent"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {onHoverColorsChange && (
                <div className="px-4 pt-3 shrink-0">
                  <IconHoverColorsEditor
                    label={`${label} Hover Colors`}
                    helpText={hoverColorsHelpText}
                    value={cycleColors}
                    onChange={onHoverColorsChange}
                  />
                </div>
              )}

              {/* Hover/focus preview — a bigger, unambiguous look at
                  whichever icon the pointer or keyboard focus is currently
                  over, instead of relying on the grid buttons' native
                  `title` tooltip alone. */}
              <div className="flex items-center gap-3 px-4 pt-3 shrink-0 min-h-[52px]">
                {hoveredName ? (
                  <>
                    <span className="w-9 h-9 rounded-full bg-sepia/10 text-sepia flex items-center justify-center shrink-0">
                      <DynamicIcon platform={platform} name={hoveredName} size={20} />
                    </span>
                    <span className="font-body text-sm text-ink dark:text-cream truncate">
                      {toTitle(hoveredName)}
                    </span>
                  </>
                ) : (
                  <span className="font-body text-xs text-ink-400 dark:text-ink-300">
                    Hover or focus an icon to preview it
                  </span>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {!query && (
                  <p className="font-body text-[11px] uppercase tracking-widest text-ink-400 mb-3">
                    Suggested
                  </p>
                )}
                {results.length === 0 ? (
                  <p className="text-center text-xs text-ink-400 py-8">
                    No icons match &ldquo;{query}&rdquo;.
                  </p>
                ) : (
                  <>
                    <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
                      {results.slice(0, visibleCount).map((name) => (
                        <button
                          key={name}
                          type="button"
                          title={toTitle(name)}
                          onClick={() => select(name)}
                          onMouseEnter={() => setHoveredName(name)}
                          onMouseLeave={() =>
                            setHoveredName((h) => (h === name ? null : h))
                          }
                          onFocus={() => setHoveredName(name)}
                          onBlur={() =>
                            setHoveredName((h) => (h === name ? null : h))
                          }
                          className={`aspect-square flex items-center justify-center rounded-lg border transition-colors ${
                            parsed?.platform === platform && parsed?.name === name
                              ? "border-sepia bg-sepia/10 text-sepia"
                              : "border-transparent hover:border-ink-200 dark:hover:border-ink-600 hover:bg-ink-50 dark:hover:bg-ink-800 text-ink-500 dark:text-ink-300"
                          }`}
                        >
                          <DynamicIcon platform={platform} name={name} size={18} />
                        </button>
                      ))}
                    </div>
                    {visibleCount < results.length && (
                      <button
                        type="button"
                        onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                        className="w-full mt-4 font-body text-xs text-sepia hover:underline"
                      >
                        Show more ({results.length - visibleCount} remaining)
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
