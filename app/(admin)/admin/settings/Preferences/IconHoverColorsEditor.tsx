// app/(admin)/admin/settings/Preferences/IconHoverColorsEditor.tsx
"use client";

import { Plus, X, RotateCcw } from "lucide-react";

// Kept in sync with AdminSidebar.tsx's DEFAULT_HOVER_COLORS — this is the
// factory-default cycle used when the admin hasn't customized it (or clears
// every swatch back to nothing). Shared across every icon slot that offers
// hover colors (see IconPicker.tsx's hoverColors prop), not just the sidebar
// one — each slot still gets its own independent array, this is only the
// shared starting point.
export const DEFAULT_HOVER_COLORS = ["#FFE135", "#44D700", "#FF6B9D", "#5BC8F5"];

const MAX_COLORS = 8;

// Generic swatch-array editor — rendered once per hover-color-enabled icon
// picker (see IconPicker.tsx), each with its own `label`/`helpText` and its
// own independent `value`/`onChange` bound to that slot's own color column.
export function IconHoverColorsEditor({
  label = "Icon Hover Colors",
  helpText = "Colors this icon cycles through each time it's hovered.",
  value,
  onChange,
}: {
  label?: string;
  helpText?: string;
  value: string[];
  onChange: (colors: string[]) => void;
}) {
  const colors = value.length > 0 ? value : DEFAULT_HOVER_COLORS;

  function updateColor(i: number, color: string) {
    const next = [...colors];
    next[i] = color;
    onChange(next);
  }

  function removeColor(i: number) {
    if (colors.length <= 1) return;
    onChange(colors.filter((_, idx) => idx !== i));
  }

  function addColor() {
    if (colors.length >= MAX_COLORS) return;
    onChange([...colors, "#FFFFFF"]);
  }

  return (
    <div>
      <label className="label">{label}</label>
      <p className="font-body text-xs text-ink-400 dark:text-ink-300 mb-3">
        {helpText}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        {colors.map((color, i) => (
          <div key={i} className="relative group">
            <input
              type="color"
              value={color}
              onChange={(e) => updateColor(i, e.target.value)}
              title={color}
              className="w-10 h-10 rounded-lg border border-ink-200 dark:border-ink-600 cursor-pointer bg-transparent p-0"
            />
            {colors.length > 1 && (
              <button
                type="button"
                onClick={() => removeColor(i)}
                aria-label={`Remove color ${color}`}
                className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-ink-700 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={10} />
              </button>
            )}
          </div>
        ))}
        {colors.length < MAX_COLORS && (
          <button
            type="button"
            onClick={addColor}
            aria-label="Add color"
            className="w-10 h-10 rounded-lg border-2 border-dashed border-ink-200 dark:border-ink-600 flex items-center justify-center text-ink-400 hover:text-sepia hover:border-sepia transition-colors"
          >
            <Plus size={16} />
          </button>
        )}
        <button
          type="button"
          onClick={() => onChange(DEFAULT_HOVER_COLORS)}
          className="flex items-center gap-1.5 font-body text-xs text-ink-400 hover:text-sepia dark:hover:text-cream transition-colors ml-1"
        >
          <RotateCcw size={12} />
          Reset to default
        </button>
      </div>
    </div>
  );
}
