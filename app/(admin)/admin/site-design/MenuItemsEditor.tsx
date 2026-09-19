"use client";

// app/(admin)/admin/site-design/MenuItemsEditor.tsx
//
// The list of links in the menu overlay — one card per row with its label,
// destination, panel colour, underline colour + shape, and hover photo.
// Reorder with the arrows, hide without deleting, or remove. Purely staged:
// the parent tab's Save sends the whole list (see /api/site-design's PUT).
import { useState } from "react";
import { ChevronDown, ChevronUp, Eye, EyeOff, GripVertical, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toggleStaged } from "@/lib/admin/toggleToast";
import {
  MENU_COLOR_PRESETS,
  UNDERLINE_STYLE_OPTIONS,
  MAX_LABEL_LENGTH,
  type SiteMenuItem,
} from "@/lib/site-design";
import { ScribbleUnderline } from "@/components/public/site-design/ScribbleUnderline";
import { ColorField, HrefField, ImageField, SelectField, TextField, ToggleRow } from "./fields";

const MAX_ITEMS = 20;

function newItem(index: number): SiteMenuItem {
  const preset = MENU_COLOR_PRESETS[index % MENU_COLOR_PRESETS.length];
  return {
    // Temp id — the API mints a real cuid on save (any id it doesn't
    // recognise becomes a create).
    id: `new-${Date.now().toString(36)}-${index}`,
    label: "",
    href: "/",
    bgColor: preset.bgColor,
    underlineColor: preset.underlineColor,
    underlineStyle: "scribble",
    image: null,
    openInNewTab: false,
    isVisible: true,
    sortOrder: index,
  };
}

export function MenuItemsEditor({
  items,
  onChange,
}: {
  items: SiteMenuItem[];
  onChange: (items: SiteMenuItem[]) => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(items[0]?.id ?? null);

  function update(id: string, patch: Partial<SiteMenuItem>) {
    onChange(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }
  function move(index: number, dir: -1 | 1) {
    const next = [...items];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next.map((i, n) => ({ ...i, sortOrder: n })));
  }
  function remove(id: string) {
    onChange(items.filter((i) => i.id !== id).map((i, n) => ({ ...i, sortOrder: n })));
  }
  function add() {
    if (items.length >= MAX_ITEMS) return;
    const item = newItem(items.length);
    onChange([...items, item]);
    setExpanded(item.id);
  }

  return (
    <div className="space-y-3">
      {items.length === 0 && (
        <p className="rounded-xl border border-dashed border-black/10 p-6 text-center font-body text-sm text-ink-400 dark:border-white/10 dark:text-ink-300">
          No links yet — add one below.
        </p>
      )}

      {items.map((item, index) => {
        const open = expanded === item.id;
        const invalidLabel = item.label.trim() === "";
        return (
          <div
            key={item.id}
            className={cn(
              "rounded-xl border transition-colors",
              invalidLabel ? "border-red-400 dark:border-red-500" : "border-black/10 dark:border-white/10",
              !item.isVisible && "opacity-60"
            )}
          >
            {/* Row header */}
            <div className="flex items-center gap-2 px-3 py-2.5">
              <GripVertical size={16} className="shrink-0 text-ink-300 dark:text-ink-500" />
              <div className="flex shrink-0 flex-col">
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label="Move up"
                  className="rounded p-0.5 text-ink-400 hover:text-ink disabled:opacity-30 dark:text-ink-300 dark:hover:text-cream"
                >
                  <ChevronUp size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === items.length - 1}
                  aria-label="Move down"
                  className="rounded p-0.5 text-ink-400 hover:text-ink disabled:opacity-30 dark:text-ink-300 dark:hover:text-cream"
                >
                  <ChevronDown size={14} />
                </button>
              </div>

              {/* Swatch — panel colour with the underline scribbled across it */}
              <span
                className="relative h-8 w-12 shrink-0 overflow-visible rounded-md border border-black/10 dark:border-white/10"
                style={{ backgroundColor: item.bgColor }}
                aria-hidden="true"
              >
                <ScribbleUnderline
                  style={item.underlineStyle}
                  color={item.underlineColor}
                  active
                  className="absolute left-[10%] top-[35%] h-[30%] w-[80%] text-[28px]"
                />
              </span>

              <button
                type="button"
                onClick={() => setExpanded(open ? null : item.id)}
                className="min-w-0 flex-1 text-left"
                aria-expanded={open}
              >
                <span className="block truncate font-jakarta text-sm font-medium text-ink dark:text-cream">
                  {item.label.trim() || <span className="italic text-red-500">Untitled link</span>}
                </span>
                <span className="block truncate font-mono text-[11px] text-ink-400 dark:text-ink-300">{item.href}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  update(item.id, { isVisible: !item.isVisible });
                  toggleStaged(item.label || "Link", !item.isVisible, { on: "shown", off: "hidden" });
                }}
                title={item.isVisible ? "Hide from menu" : "Show in menu"}
                className="shrink-0 rounded-lg p-2 text-ink-400 hover:text-ink dark:text-ink-300 dark:hover:text-cream"
              >
                {item.isVisible ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
              <button
                type="button"
                onClick={() => remove(item.id)}
                title="Remove link"
                className="shrink-0 rounded-lg p-2 text-ink-400 hover:text-red-500 dark:text-ink-300 dark:hover:text-red-400"
              >
                <Trash2 size={16} />
              </button>
            </div>

            {open && (
              <div className="space-y-4 border-t border-black/10 p-4 dark:border-white/10">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <TextField
                    label="Label"
                    value={item.label}
                    onChange={(v) => update(item.id, { label: v })}
                    maxLength={MAX_LABEL_LENGTH}
                    placeholder="Gallery"
                  />
                  <HrefField label="Link" value={item.href} onChange={(v) => update(item.id, { href: v })} />
                </div>

                <div>
                  <p className="mb-2 block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300">
                    Colour pair
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {MENU_COLOR_PRESETS.map((p) => {
                      const active = p.bgColor === item.bgColor && p.underlineColor === item.underlineColor;
                      return (
                        <button
                          key={p.name}
                          type="button"
                          title={p.name}
                          onClick={() => update(item.id, { bgColor: p.bgColor, underlineColor: p.underlineColor })}
                          className={cn(
                            "flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 font-body text-xs transition-colors",
                            active
                              ? "border-sepia bg-sepia/10 text-ink dark:text-cream"
                              : "border-black/10 text-ink-400 hover:border-black/20 dark:border-white/10 dark:text-ink-300 dark:hover:border-white/20"
                          )}
                        >
                          <span className="relative h-5 w-5 overflow-hidden rounded-full border border-black/10 dark:border-white/20" style={{ backgroundColor: p.bgColor }}>
                            <span className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 -rotate-12" style={{ backgroundColor: p.underlineColor }} />
                          </span>
                          {p.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <ColorField label="Panel colour" value={item.bgColor} onChange={(v) => update(item.id, { bgColor: v })} hint="Left panel while hovered" />
                  <ColorField label="Underline colour" value={item.underlineColor} onChange={(v) => update(item.id, { underlineColor: v })} />
                  <SelectField
                    label="Underline shape"
                    value={item.underlineStyle}
                    onChange={(v) => update(item.id, { underlineStyle: v })}
                    options={UNDERLINE_STYLE_OPTIONS}
                    hint={UNDERLINE_STYLE_OPTIONS.find((o) => o.value === item.underlineStyle)?.description}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <ImageField
                    label="Hover photo"
                    value={item.image}
                    onChange={(v) => update(item.id, { image: v })}
                    hint="Fills the right half while this link is hovered. Falls back to the menu's default photo."
                    aspect="aspect-[4/3]"
                  />
                  <div className="space-y-3">
                    <ToggleRow
                      label="Open in new tab"
                      value={item.openInNewTab}
                      onChange={(v) => update(item.id, { openInNewTab: v })}
                      words={{ on: "on", off: "off" }}
                    />
                    <ToggleRow
                      label="Visible"
                      description="Hidden links stay here but never render publicly."
                      value={item.isVisible}
                      onChange={(v) => update(item.id, { isVisible: v })}
                      words={{ on: "shown", off: "hidden" }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

      <button
        type="button"
        onClick={add}
        disabled={items.length >= MAX_ITEMS}
        className="inline-flex items-center gap-2 rounded-xl border border-dashed border-black/15 px-4 py-2.5 font-jakarta text-sm text-ink-500 transition-colors hover:border-sepia hover:text-ink disabled:opacity-50 dark:border-white/15 dark:text-ink-300 dark:hover:text-cream"
      >
        <Plus size={16} />
        Add link
        <span className="font-body text-xs opacity-60">
          {items.length}/{MAX_ITEMS}
        </span>
      </button>
    </div>
  );
}
