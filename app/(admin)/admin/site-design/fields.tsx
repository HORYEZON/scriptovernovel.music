"use client";

// app/(admin)/admin/site-design/fields.tsx
//
// The form controls the Site Design editor is built from — the same visual
// language as Preferences → Theme Customization's ColorField/SizeField, plus
// the select, toggle, text and image-upload variants that tab never needed.
// Every value-typed control validates inline and paints its border red, so
// the tab's single Save can refuse with "fix the highlighted fields".
import { useRef, useState, type ReactNode } from "react";
import { ToggleLeft, ToggleRight, Upload, X } from "lucide-react";
import { AdminSelect } from "@/components/admin/AdminSelect";
import { SafeImg } from "@/components/ui/SafeImage";
import { toggleStaged } from "@/lib/admin/toggleToast";
import toast from "@/lib/toast";
import { getErrorMessage, cn } from "@/lib/utils";
import { isValidThemeColor, isValidThemeLength } from "@/lib/theme";
import { isValidHref, isValidLetterSpacing } from "@/lib/site-design";

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function FieldLabel({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300">
      {children}
      {hint && <span className="ml-2 font-normal normal-case tracking-normal opacity-70">{hint}</span>}
    </label>
  );
}

function borderFor(invalid: boolean) {
  return invalid ? "border-red-400 dark:border-red-500" : "border-black/10 dark:border-white/10";
}

const inputBase =
  "w-full px-4 py-2.5 rounded-xl bg-black/5 dark:bg-white/5 border text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors text-sm font-jakarta";

export function ColorField({
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
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={HEX_RE.test(value) ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-10 shrink-0 cursor-pointer rounded-lg border border-black/10 bg-transparent dark:border-white/15"
          aria-label={`${label} swatch`}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(inputBase, "font-mono text-xs", borderFor(invalid))}
          placeholder="#141414"
        />
      </div>
      {hint && <p className="mt-1 font-body text-xs text-ink-400 dark:text-ink-300">{hint}</p>}
      {invalid && (
        <p className="mt-1 font-body text-xs text-red-500 dark:text-red-400">
          Use a hex color (#RRGGBB), rgb()/rgba(), or &quot;transparent&quot;.
        </p>
      )}
    </div>
  );
}

export function LengthField({
  label,
  value,
  onChange,
  hint,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  placeholder?: string;
}) {
  const invalid = value.trim() !== "" && !isValidThemeLength(value);
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(inputBase, borderFor(invalid))}
        placeholder={placeholder ?? "6rem"}
      />
      <p className="mt-1 font-body text-xs text-ink-400 dark:text-ink-300">
        {hint ?? `e.g. ${placeholder ?? "6rem"} — px, rem, or em.`}
      </p>
    </div>
  );
}

/**
 * A LengthField as a slider, for a size that is really one number: the value
 * stays a CSS length string ("2.25rem") so it keeps passing isValidThemeLength
 * and nothing downstream changes — the same arrangement as the Entrance
 * Splash's tagline sizes (lib/intro-splash.ts's taglineRemFromLength). A
 * stored px/em value (typed into the old text field) is read at 16px/rem and
 * 1:1 respectively rather than thrown away, so the thumb always sits where
 * the site currently is.
 */
export function LengthSliderField({
  label,
  value,
  onChange,
  minRem,
  maxRem,
  step = 0.05,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  minRem: number;
  maxRem: number;
  step?: number;
  hint?: string;
}) {
  const clamp = (n: number) => Math.min(maxRem, Math.max(minRem, n));
  const match = /^(\d{1,3}(?:\.\d{1,2})?)(px|rem|em)$/.exec(value.trim());
  const rem = match ? clamp(match[2] === "px" ? parseFloat(match[1]) / 16 : parseFloat(match[1])) : clamp(2);
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <FieldLabel>{label}</FieldLabel>
        <span className="mb-2 font-mono text-xs text-ink-400 dark:text-ink-300">
          {Number(rem.toFixed(2))}rem · {Math.round(rem * 16)}px
        </span>
      </div>
      <input
        type="range"
        min={minRem}
        max={maxRem}
        step={step}
        value={rem}
        onChange={(e) => onChange(`${Number(clamp(Number(e.target.value)).toFixed(2))}rem`)}
        className="w-full cursor-pointer accent-sepia"
        aria-label={label}
      />
      {hint && <p className="mt-1 font-body text-xs text-ink-400 dark:text-ink-300">{hint}</p>}
    </div>
  );
}

export function LetterSpacingField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const invalid = value.trim() !== "" && !isValidLetterSpacing(value);
  return (
    <div>
      <FieldLabel>Letter Spacing</FieldLabel>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(inputBase, borderFor(invalid))}
        placeholder="-0.03em"
      />
      <p className="mt-1 font-body text-xs text-ink-400 dark:text-ink-300">
        Negative tightens — e.g. -0.03em. em or px.
      </p>
    </div>
  );
}

export function TextField({
  label,
  value,
  onChange,
  maxLength,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  maxLength: number;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <div>
      <FieldLabel hint={`${value.length}/${maxLength}`}>{label}</FieldLabel>
      <input
        type="text"
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        className={cn(inputBase, borderFor(false))}
        placeholder={placeholder}
      />
      {hint && <p className="mt-1 font-body text-xs text-ink-400 dark:text-ink-300">{hint}</p>}
    </div>
  );
}

export function HrefField({
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
  const invalid = value.trim() !== "" && !isValidHref(value);
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(inputBase, "font-mono text-xs", borderFor(invalid))}
        placeholder="/gallery"
      />
      <p className="mt-1 font-body text-xs text-ink-400 dark:text-ink-300">
        {hint ?? "A page on this site (/about), a full URL (https://…), or mailto:."}
      </p>
      {invalid && (
        <p className="mt-1 font-body text-xs text-red-500 dark:text-red-400">
          Must start with &quot;/&quot;, &quot;http(s)://&quot; or &quot;mailto:&quot;.
        </p>
      )}
    </div>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
  hint,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: readonly { value: T; label: string }[];
  hint?: string;
}) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <AdminSelect value={value} onChange={(e) => onChange(e.target.value as T)} className="py-2.5 text-sm">
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </AdminSelect>
      {hint && <p className="mt-1 font-body text-xs text-ink-400 dark:text-ink-300">{hint}</p>}
    </div>
  );
}

export function RangeField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  format = (v) => String(v),
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  format?: (v: number) => string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <FieldLabel>{label}</FieldLabel>
        <span className="mb-2 font-mono text-xs text-ink-400 dark:text-ink-300">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full cursor-pointer accent-sepia"
        aria-label={label}
      />
    </div>
  );
}

/** One switch row — label + description on the left, the toggle on the
 *  right. Toasts via toggleStaged since the tab has its own Save. */
export function ToggleRow({
  label,
  description,
  value,
  onChange,
  words,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  words?: { on: string; off: string };
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-black/10 px-4 py-3 dark:border-white/10">
      <div className="min-w-0">
        <p className="font-body text-sm font-medium text-ink dark:text-cream">{label}</p>
        {description && (
          <p className="mt-0.5 font-body text-xs text-ink-400 dark:text-ink-300">{description}</p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => {
          const next = !value;
          onChange(next);
          toggleStaged(label, next, words);
        }}
        className={cn(
          "shrink-0 rounded-lg p-1.5 transition-colors",
          value
            ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400"
            : "bg-black/5 text-ink-400 hover:bg-black/10 dark:bg-white/5 dark:text-ink-300 dark:hover:bg-white/10"
        )}
      >
        {value ? <ToggleRight size={26} /> : <ToggleLeft size={26} />}
      </button>
    </div>
  );
}

/** Upload-or-replace image tile, posting to /api/upload like LogoUploader.
 *  `null`/"" both mean "none". */
export function ImageField({
  label,
  value,
  onChange,
  hint,
  aspect = "aspect-video",
}: {
  label: string;
  value: string | null;
  onChange: (url: string | null) => void;
  hint?: string;
  /** Tailwind aspect class for the tile. */
  aspect?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      onChange(data.url);
      toast.success(`${label} uploaded`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Upload failed"));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      {hint && <p className="mb-2 font-body text-xs text-ink-400 dark:text-ink-300">{hint}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleUpload}
      />
      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "group relative flex w-full items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-ink-200 bg-ink-50 transition-colors hover:border-sepia hover:bg-ink-100 disabled:pointer-events-none disabled:opacity-60 dark:border-ink-600 dark:bg-ink-800 dark:hover:border-cream dark:hover:bg-ink-700",
          aspect
        )}
      >
        {uploading ? (
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-ink-300 border-t-sepia dark:border-ink-500 dark:border-t-cream" />
        ) : value ? (
          <>
            <SafeImg src={value} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <span className="relative z-10 rounded-full bg-black/60 px-3 py-1 font-body text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
              Replace
            </span>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 p-4 text-center">
            <Upload size={20} className="text-ink-400 transition-colors group-hover:text-sepia dark:text-ink-300" />
            <p className="font-body text-xs text-ink-500 dark:text-ink-300">
              Click to upload · JPG, PNG, WebP, GIF — max 10 MB
            </p>
          </div>
        )}
      </button>
      {value && !uploading && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="mt-2 flex items-center gap-1.5 font-body text-xs text-ink-400 transition-colors hover:text-red-500 dark:text-ink-400 dark:hover:text-red-400"
        >
          <X size={13} />
          Remove image
        </button>
      )}
    </div>
  );
}
