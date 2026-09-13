// app/(admin)/admin/settings/Preferences/ThemeSection.tsx
"use client";

import { useRef, useState } from "react";
import { ChevronDown, RotateCcw, Save, ToggleLeft, ToggleRight } from "lucide-react";
import { toggleStaged } from "@/lib/admin/toggleToast";
import toast from "@/lib/toast";
import { SettingsAccordion, useAccordionSections } from "./SettingsAccordion";
import {
  DEFAULT_SITE_THEME,
  THEME_FONT_OPTIONS,
  DARK_WASH_PRESETS,
  LIGHT_WASH_PRESETS,
  MIN_WASH_BRIGHTNESS,
  MAX_WASH_BRIGHTNESS,
  isValidThemeColor,
  isValidThemeLength,
  isValidCursorGlowColors,
  isValidWashBrightness,
  isValidWashScope,
  type SiteThemeSettings,
  type WashPreset,
  type WashScope,
} from "@/lib/theme";
import { getErrorMessage } from "@/lib/utils";
import { UnsavedChangesBar } from "@/components/admin/UnsavedChangesBar";

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function ColorField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  const invalid = value.trim() !== "" && !isValidThemeColor(value);
  // Computed as one mutually-exclusive class string rather than layering a
  // "border-red-400" utility on top of the base "border-black/10" — both are
  // plain (non-variant) utilities targeting the same border-color property,
  // and Tailwind's dark: media-query ordering doesn't reliably let the red
  // override win in dark mode when both classes are present at once.
  const borderCls = invalid
    ? "border-red-400 dark:border-red-500"
    : "border-black/10 dark:border-white/10";
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={HEX_RE.test(value) ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="w-10 h-10 rounded-lg border border-black/10 dark:border-white/15 cursor-pointer bg-transparent shrink-0"
          aria-label={`${label} swatch`}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full px-4 py-2.5 rounded-xl bg-black/5 dark:bg-white/5 border ${borderCls} text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors text-xs font-mono`}
          placeholder="#C8A96E"
        />
      </div>
      {hint && (
        <p className="font-body text-xs text-ink-400 dark:text-ink-300 mt-1">
          {hint}
        </p>
      )}
      {invalid && (
        <p className="font-body text-xs text-red-500 dark:text-red-400 mt-1">
          Use a hex color (#RRGGBB), rgb()/rgba(), or &quot;transparent&quot;.
        </p>
      )}
    </div>
  );
}

/** A VS Code-style row of preset swatches — clicking one seeds both the wash
 * color and brightness fields for that mode (still freely editable after via
 * the ColorField/BrightnessSlider below it), rather than being its own
 * persisted setting. "Custom" lights up once the current values drift from
 * every preset, same idea as a color picker's "custom" swatch. */
function WashPresetPicker({
  presets,
  washColor,
  brightness,
  onPick,
}: {
  presets: WashPreset[];
  washColor: string;
  brightness: number;
  onPick: (preset: WashPreset) => void;
}) {
  const activeName = presets.find(
    (p) => p.washColor === washColor && p.brightness === brightness
  )?.name;
  return (
    <div className="flex flex-wrap gap-2">
      {presets.map((preset) => {
        const active = preset.name === activeName;
        return (
          <button
            key={preset.name}
            type="button"
            onClick={() => onPick(preset)}
            title={preset.name}
            className={`flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full border text-xs font-body transition-colors ${
              active
                ? "border-sepia bg-sepia/10 text-ink dark:text-cream"
                : "border-black/10 dark:border-white/10 text-ink-400 dark:text-ink-300 hover:border-black/20 dark:hover:border-white/20"
            }`}
          >
            <span
              className="w-4 h-4 rounded-full border border-black/10 dark:border-white/20 shrink-0"
              style={{ background: preset.washColor }}
              aria-hidden="true"
            />
            {preset.name}
          </button>
        );
      })}
      {!activeName && (
        <span className="flex items-center px-3 py-1.5 rounded-full border border-dashed border-black/10 dark:border-white/10 text-xs font-body text-ink-400 dark:text-ink-300">
          Custom
        </span>
      )}
    </div>
  );
}

function BrightnessSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const invalid = !isValidWashBrightness(value);
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300">
          Brightness
        </label>
        <span className="font-mono text-xs text-ink-400 dark:text-ink-300">
          {value}%
        </span>
      </div>
      <input
        type="range"
        min={MIN_WASH_BRIGHTNESS}
        max={MAX_WASH_BRIGHTNESS}
        step={5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-sepia cursor-pointer"
        aria-label="Brightness"
      />
      {invalid && (
        <p className="font-body text-xs text-red-500 dark:text-red-400 mt-1">
          Must be between {MIN_WASH_BRIGHTNESS}% and {MAX_WASH_BRIGHTNESS}%.
        </p>
      )}
    </div>
  );
}

const WASH_SCOPE_OPTIONS: { value: WashScope; label: string }[] = [
  { value: "public", label: "Public" },
  { value: "admin", label: "Admin" },
  { value: "both", label: "Both" },
];

/** Where a mode's wash actually renders — the public site, the /admin
 * dashboard, or both (see lib/theme.ts's WashScope + AdminThemeStyle /
 * PublicThemeStyle). A 3-way segmented control, same visual language as the
 * Preview section's Light/Dark toggle further down. */
function ScopeSelector({
  value,
  onChange,
}: {
  value: WashScope;
  onChange: (v: WashScope) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">
        Apply To
      </label>
      <div className="flex items-center gap-1 rounded-full border border-black/10 dark:border-white/10 p-0.5 w-fit">
        {WASH_SCOPE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`px-3 py-1 rounded-full font-body text-[11px] transition-colors ${
              value === opt.value
                ? "bg-sepia text-white"
                : "text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SizeField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint: string;
}) {
  const invalid = value.trim() !== "" && !isValidThemeLength(value);
  const borderCls = invalid
    ? "border-red-400 dark:border-red-500"
    : "border-black/10 dark:border-white/10";
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full px-4 py-2.5 rounded-xl bg-black/5 dark:bg-white/5 border ${borderCls} text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors text-xs font-jakarta`}
        placeholder={hint}
      />
      <p className="font-body text-xs text-ink-400 dark:text-ink-300 mt-1">
        e.g. {hint} — px, rem, or em.
      </p>
    </div>
  );
}

// The "Preferences → Theme" customizer. Colors/fonts/sizes here are exposed
// to app/(public) at runtime as CSS custom properties by PublicThemeStyle
// (rendered in app/(public)/layout.tsx) and consumed in app/globals.css.
export function ThemeSection({
  initialTheme,
}: {
  initialTheme: SiteThemeSettings;
}) {
  const [form, setForm] = useState<SiteThemeSettings>(initialTheme);
  const savedFormRef = useRef(initialTheme);
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState<"dark" | "light">("dark");
  const isDirty = JSON.stringify(form) !== JSON.stringify(savedFormRef.current);

  function set<K extends keyof SiteThemeSettings>(
    field: K,
    value: SiteThemeSettings[K]
  ) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function setCursorColor(index: number, value: string) {
    setForm((f) => {
      const next = [...f.cursorGlowColors];
      next[index] = value;
      return { ...f, cursorGlowColors: next };
    });
  }

  function isFormValid() {
    return (
      isValidThemeColor(form.btnPrimaryColor) &&
      isValidThemeColor(form.btnSecondaryColor) &&
      isValidThemeColor(form.btnHoverColor) &&
      isValidThemeColor(form.scrollbarTrackColor) &&
      isValidThemeColor(form.scrollbarThumbColor) &&
      isValidThemeColor(form.darkWashColor) &&
      isValidWashBrightness(form.darkBrightness) &&
      isValidThemeColor(form.lightWashColor) &&
      isValidWashBrightness(form.lightBrightness) &&
      isValidWashScope(form.darkWashScope) &&
      isValidWashScope(form.lightWashScope) &&
      isValidThemeLength(form.fontSizeBase) &&
      isValidThemeLength(form.fontSizeHeading) &&
      isValidThemeLength(form.fontSizeBody) &&
      isValidCursorGlowColors(form.cursorGlowColors) &&
      isValidThemeColor(form.adminCardBgLight) &&
      isValidThemeColor(form.adminCardBgDark) &&
      isValidThemeColor(form.adminModalBgLight) &&
      isValidThemeColor(form.adminModalBgDark) &&
      isValidThemeColor(form.adminInputBgLight) &&
      isValidThemeColor(form.adminInputBgDark)
    );
  }

  async function save() {
    if (!isFormValid()) {
      toast.error("Fix the highlighted fields before saving");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/theme", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save theme");
      setForm(data);
      savedFormRef.current = data;
      toast.success("Public theme updated");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to save theme"));
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setForm({ ...savedFormRef.current });
  }

  // Every section starts open, so this tab looks exactly as it did before the
  // accordions existed until an admin folds one — same choice RoomsTab made.
  const sections = useAccordionSections("admin_preferences_theme_sections", {
    site: true,
    buttons: true,
    scrollbars: true,
    wash: true,
    cursor: true,
    typography: true,
    preview: true,
    admin: true,
  });
  const allSectionsOpen = Object.values(sections.open).every(Boolean);

  function restoreDefaults() {
    setForm({ ...DEFAULT_SITE_THEME });
  }

  return (
    <div className="space-y-5">
      {/* One control for every section, nested ones included — folding them
          one at a time to reach the bottom of the tab is the chore the
          accordions were meant to remove, not create. */}
      <div className="flex justify-end -mb-1">
        <button
          type="button"
          onClick={() => sections.setAll(!allSectionsOpen)}
          className="font-body text-xs text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream transition-colors"
        >
          {allSectionsOpen ? "Collapse all" : "Expand all"}
        </button>
      </div>

      <SettingsAccordion
        title="Public Site Theme"
        description="Colours, cursor glow and typography for the public site."
        open={sections.open.site}
        onToggle={() => sections.toggle("site")}
        right={
          <button
            type="button"
            onClick={restoreDefaults}
            className="flex items-center gap-1.5 font-body text-xs text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream transition-colors"
          >
            <RotateCcw size={12} />
            Restore defaults
          </button>
        }
      >

        {/* Button Colors */}
        <SettingsAccordion
          nested
          title="Button Colors"
          description="The primary, secondary and accent button fills used across the public site."
          open={sections.open.buttons}
          onToggle={() => sections.toggle("buttons")}
        >
          <p className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-3">
            Button Colors
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <ColorField
              label="Primary"
              value={form.btnPrimaryColor}
              onChange={(v) => set("btnPrimaryColor", v)}
              hint="Solid CTA fill (.btn-sepia)"
            />
            <ColorField
              label="Secondary"
              value={form.btnSecondaryColor}
              onChange={(v) => set("btnSecondaryColor", v)}
              hint="Outline CTA text/accent"
            />
            <ColorField
              label="Hover"
              value={form.btnHoverColor}
              onChange={(v) => set("btnHoverColor", v)}
              hint="Hover state for both"
            />
          </div>
        </SettingsAccordion>

        {/* Scrollbar Colors */}
        <SettingsAccordion
          nested
          title="Scrollbar Colors"
          description="Track and thumb colours for the site's custom scrollbars."
          open={sections.open.scrollbars}
          onToggle={() => sections.toggle("scrollbars")}
        >
          <p className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-3">
            Scrollbar Colors
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ColorField
              label="Track"
              value={form.scrollbarTrackColor}
              onChange={(v) => set("scrollbarTrackColor", v)}
              hint='Defaults to "transparent"'
            />
            <ColorField
              label="Thumb"
              value={form.scrollbarThumbColor}
              onChange={(v) => set("scrollbarThumbColor", v)}
            />
          </div>
          <p className="font-body text-[11px] text-ink-400 dark:text-ink-300 mt-2">
            Scrollbar styling only renders in Chromium/WebKit browsers.
          </p>
        </SettingsAccordion>

        {/* Dark / Light Mode Wash */}
        <SettingsAccordion
          nested
          title="Dark / Light Mode Wash"
          description="The tint and brightness laid over the background photo, per mode."
          open={sections.open.wash}
          onToggle={() => sections.toggle("wash")}
        >
          <p className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-1">
            Dark / Light Mode Colors
          </p>
          <p className="font-body text-xs text-ink-400 dark:text-ink-300 mb-3">
            Pick a preset (or set your own) for the frosted overlay + photo
            brightness — the whole site&apos;s color mood per mode, VS Code
            color-theme style. Visitors still switch modes themselves; this
            controls what each mode looks like, and each mode&apos;s
            &quot;Apply To&quot; picks whether that applies to the public
            site, the admin dashboard, or both.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="rounded-xl border border-black/10 dark:border-white/10 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-body text-xs font-semibold text-ink dark:text-cream">
                  🌙 Dark Mode
                </p>
                <button
                  type="button"
                  onClick={() => {
                    set("darkWashColor", DEFAULT_SITE_THEME.darkWashColor);
                    set("darkBrightness", DEFAULT_SITE_THEME.darkBrightness);
                    set("darkWashScope", DEFAULT_SITE_THEME.darkWashScope);
                  }}
                  className="flex items-center gap-1.5 font-body text-[11px] text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream transition-colors"
                >
                  <RotateCcw size={11} />
                  Restore defaults
                </button>
              </div>
              <WashPresetPicker
                presets={DARK_WASH_PRESETS}
                washColor={form.darkWashColor}
                brightness={form.darkBrightness}
                onPick={(preset) => {
                  set("darkWashColor", preset.washColor);
                  set("darkBrightness", preset.brightness);
                }}
              />
              <ColorField
                label="Wash Color"
                value={form.darkWashColor}
                onChange={(v) => set("darkWashColor", v)}
                hint="Overlay tint — rgba() recommended for the alpha"
              />
              <BrightnessSlider
                value={form.darkBrightness}
                onChange={(v) => set("darkBrightness", v)}
              />
              <ScopeSelector
                value={form.darkWashScope}
                onChange={(v) => set("darkWashScope", v)}
              />
            </div>

            <div className="rounded-xl border border-black/10 dark:border-white/10 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-body text-xs font-semibold text-ink dark:text-cream">
                  ☀️ Light Mode
                </p>
                <button
                  type="button"
                  onClick={() => {
                    set("lightWashColor", DEFAULT_SITE_THEME.lightWashColor);
                    set("lightBrightness", DEFAULT_SITE_THEME.lightBrightness);
                    set("lightWashScope", DEFAULT_SITE_THEME.lightWashScope);
                  }}
                  className="flex items-center gap-1.5 font-body text-[11px] text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream transition-colors"
                >
                  <RotateCcw size={11} />
                  Restore defaults
                </button>
              </div>
              <WashPresetPicker
                presets={LIGHT_WASH_PRESETS}
                washColor={form.lightWashColor}
                brightness={form.lightBrightness}
                onPick={(preset) => {
                  set("lightWashColor", preset.washColor);
                  set("lightBrightness", preset.brightness);
                }}
              />
              <ColorField
                label="Wash Color"
                value={form.lightWashColor}
                onChange={(v) => set("lightWashColor", v)}
                hint="Overlay tint — rgba() recommended for the alpha"
              />
              <BrightnessSlider
                value={form.lightBrightness}
                onChange={(v) => set("lightBrightness", v)}
              />
              <ScopeSelector
                value={form.lightWashScope}
                onChange={(v) => set("lightWashScope", v)}
              />
            </div>
          </div>
        </SettingsAccordion>

        {/* Cursor Effects */}
        <SettingsAccordion
          nested
          title="Cursor Effects"
          description="The soft glow that trails the cursor on desktop."
          open={sections.open.cursor}
          onToggle={() => sections.toggle("cursor")}
        >
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <p className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300">
                Cursor Effects
              </p>
              <p className="font-body text-xs text-ink-400 dark:text-ink-300 mt-1">
                A soft glow that trails the cursor on desktop, cycling through
                the colors below.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                set("cursorGlowEnabled", !form.cursorGlowEnabled);
                toggleStaged("Cursor glow", !form.cursorGlowEnabled);
              }}
              title={
                form.cursorGlowEnabled
                  ? "Disable cursor glow"
                  : "Enable cursor glow"
              }
              className={`shrink-0 p-1.5 rounded-lg transition-colors ${
                form.cursorGlowEnabled
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
                  : "bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300 hover:bg-black/10 dark:hover:bg-white/10"
              }`}
            >
              {form.cursorGlowEnabled ? (
                <ToggleRight size={26} />
              ) : (
                <ToggleLeft size={26} />
              )}
            </button>
          </div>

          <div
            className={`grid grid-cols-2 sm:grid-cols-4 gap-3 transition-opacity ${
              form.cursorGlowEnabled ? "" : "opacity-50 pointer-events-none"
            }`}
          >
            {form.cursorGlowColors.map((color, i) => (
              <ColorField
                key={i}
                label={`Color ${i + 1}`}
                value={color}
                onChange={(v) => setCursorColor(i, v)}
              />
            ))}
          </div>
          <p className="font-body text-[11px] text-ink-400 dark:text-ink-300 mt-2">
            Cycles through in order, 8 seconds per loop. Desktop-pointer only
            — hidden on touch devices.
          </p>
        </SettingsAccordion>

        {/* Typography */}
        <SettingsAccordion
          nested
          title="Typography"
          description="Font family and the type sizes used across the public site."
          open={sections.open.typography}
          onToggle={() => sections.toggle("typography")}
        >
          <p className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-3">
            Font Text / Family
          </p>
          <div className="relative">
            <select
              value={form.fontFamily}
              onChange={(e) => set("fontFamily", e.target.value)}
              className="w-full px-4 py-2.5 pr-10 rounded-xl admin-input border text-ink dark:text-cream focus:outline-none focus:border-sepia transition-colors text-sm cursor-pointer appearance-none"
            >
              {THEME_FONT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-white dark:bg-ink-900">
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-ink-400"
            />
          </div>

        <div>
          <p className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-3">
            Font Sizes
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <SizeField
              label="Base"
              value={form.fontSizeBase}
              onChange={(v) => set("fontSizeBase", v)}
              hint="16px"
            />
            <SizeField
              label="Headings"
              value={form.fontSizeHeading}
              onChange={(v) => set("fontSizeHeading", v)}
              hint="2rem"
            />
            <SizeField
              label="Body"
              value={form.fontSizeBody}
              onChange={(v) => set("fontSizeBody", v)}
              hint="1rem"
            />
          </div>
          <p className="font-body text-xs text-ink-400 dark:text-ink-300 mt-2">
            Headings/Body apply to text that doesn&apos;t already carry a
            specific size class — most existing headings keep their designed
            size.
          </p>
        </div>
        </SettingsAccordion>

        {/* Live preview */}
        <SettingsAccordion
          nested
          title="Live preview"
          description="A stand-in page rendered with the settings above, in either mode."
          open={sections.open.preview}
          onToggle={() => sections.toggle("preview")}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300">
              Preview
            </p>
            {/* Independent of the admin's own light/dark toggle — this picks
                which of the two mode simulations below to render, now that
                both are customizable rather than the public site being
                fixed-dark. */}
            <div className="flex items-center gap-1 rounded-full border border-black/10 dark:border-white/10 p-0.5">
              {(["light", "dark"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setPreviewMode(mode)}
                  className={`px-3 py-1 rounded-full font-body text-[11px] capitalize transition-colors ${
                    previewMode === mode
                      ? "bg-sepia text-white"
                      : "text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
          <div
            className="relative rounded-xl border border-white/10 overflow-hidden shadow-sm"
            style={{ fontFamily: form.fontFamily }}
          >
            {/* Stand-in for html::before's background photo, so the
                brightness slider has something visible to act on. */}
            <div
              className="absolute inset-0 bg-gradient-to-br from-sepia/50 via-ink-700 to-ink-900"
              style={{
                filter: `brightness(${
                  (previewMode === "dark" ? form.darkBrightness : form.lightBrightness) / 100
                })`,
              }}
              aria-hidden="true"
            />
            {/* Stand-in for .page-glass */}
            <div
              className="absolute inset-0 backdrop-blur-md"
              style={{
                background:
                  previewMode === "dark" ? form.darkWashColor : form.lightWashColor,
              }}
              aria-hidden="true"
            />
            <div
              className={`relative p-6 space-y-4 ${
                previewMode === "dark" ? "text-cream" : "text-ink"
              }`}
            >
              <p
                className="font-medium"
                style={{ fontSize: form.fontSizeHeading }}
              >
                Heading preview
              </p>
              <p
                className={previewMode === "dark" ? "text-cream/70" : "text-ink/70"}
                style={{ fontSize: form.fontSizeBody }}
              >
                Body text preview — the quick brown fox jumps over the lazy dog.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className="inline-flex items-center justify-center px-6 py-3 rounded-md text-zinc-900 font-medium tracking-wide text-sm"
                  style={{ backgroundColor: form.btnPrimaryColor }}
                >
                  Primary
                </span>
                <span
                  className="inline-flex items-center justify-center px-6 py-3 rounded-md bg-white/5 border border-white/10 font-medium text-sm"
                  style={{ color: form.btnSecondaryColor }}
                >
                  Secondary
                </span>
                <span
                  className="inline-flex items-center justify-center px-6 py-3 rounded-md text-black font-medium tracking-wide text-sm"
                  style={{ backgroundColor: form.btnHoverColor }}
                >
                  Hover
                </span>
                <div
                  className={`w-24 h-9 rounded overflow-y-scroll text-[10px] px-2 py-1 ${
                    previewMode === "dark" ? "text-cream/50" : "text-ink/50"
                  }`}
                  style={{
                    scrollbarColor: `${form.scrollbarThumbColor} ${form.scrollbarTrackColor}`,
                    scrollbarWidth: "thin",
                  }}
                >
                  scroll
                  <br />
                  me
                  <br />
                  to
                  <br />
                  see
                </div>
              </div>
            </div>
          </div>
        </SettingsAccordion>
      </SettingsAccordion>

      {/* Admin-only surface colors — separate card since these have no
          public-site counterpart or Apply To scope (unlike the wash colors
          above, they only ever affect /admin). Backgrounds for every
          admin-card/-modal/-input across the dashboard — see
          app/globals.css's .admin-card/.admin-modal/.admin-input classes,
          driven by AdminThemeStyle's CSS vars. */}
      <SettingsAccordion
        title="Admin Dashboard Colors"
        description="Card/widget, modal, and form-input backgrounds across the admin dashboard itself — independent per mode, admin-only."
        open={sections.open.admin}
        onToggle={() => sections.toggle("admin")}
        right={
            <button
              type="button"
              onClick={() => {
                set("adminCardBgLight", DEFAULT_SITE_THEME.adminCardBgLight);
                set("adminCardBgDark", DEFAULT_SITE_THEME.adminCardBgDark);
                set("adminModalBgLight", DEFAULT_SITE_THEME.adminModalBgLight);
                set("adminModalBgDark", DEFAULT_SITE_THEME.adminModalBgDark);
                set("adminInputBgLight", DEFAULT_SITE_THEME.adminInputBgLight);
                set("adminInputBgDark", DEFAULT_SITE_THEME.adminInputBgDark);
              }}
              className="flex items-center gap-1.5 font-body text-xs text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream transition-colors shrink-0"
            >
              <RotateCcw size={12} />
              Restore defaults
            </button>
        }
      >

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="rounded-xl border border-black/10 dark:border-white/10 p-4 space-y-3">
            <p className="font-body text-xs font-semibold text-ink dark:text-cream">
              Card / Widget Background
            </p>
            <ColorField
              label="Light Mode"
              value={form.adminCardBgLight}
              onChange={(v) => set("adminCardBgLight", v)}
            />
            <ColorField
              label="Dark Mode"
              value={form.adminCardBgDark}
              onChange={(v) => set("adminCardBgDark", v)}
            />
          </div>
          <div className="rounded-xl border border-black/10 dark:border-white/10 p-4 space-y-3">
            <p className="font-body text-xs font-semibold text-ink dark:text-cream">
              Modal Background
            </p>
            <ColorField
              label="Light Mode"
              value={form.adminModalBgLight}
              onChange={(v) => set("adminModalBgLight", v)}
            />
            <ColorField
              label="Dark Mode"
              value={form.adminModalBgDark}
              onChange={(v) => set("adminModalBgDark", v)}
            />
          </div>
          <div className="rounded-xl border border-black/10 dark:border-white/10 p-4 space-y-3">
            <p className="font-body text-xs font-semibold text-ink dark:text-cream">
              Input Background
            </p>
            <ColorField
              label="Light Mode"
              value={form.adminInputBgLight}
              onChange={(v) => set("adminInputBgLight", v)}
            />
            <ColorField
              label="Dark Mode"
              value={form.adminInputBgDark}
              onChange={(v) => set("adminInputBgDark", v)}
            />
          </div>
        </div>
      </SettingsAccordion>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving || !isDirty}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sepia text-white font-jakarta text-sm font-medium hover:bg-sepia-dark transition-all duration-200 shadow-md disabled:opacity-50"
        >
          {saving ? (
            <>
              <div className="w-4 h-4 border border-cream/30 border-t-cream rounded-full animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Save size={16} />
              Save Theme
            </>
          )}
        </button>
        {isDirty && !saving && (
          <button
            type="button"
            onClick={reset}
            className="font-body text-xs text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream transition-colors"
          >
            Discard changes
          </button>
        )}
      </div>

      <UnsavedChangesBar
        dirty={isDirty}
        what="theme"
        saving={saving}
        onSave={save}
        onReset={reset}
      />
    </div>
  );
}
