// app/(admin)/admin/about/AboutClient.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Image from "@/components/ui/SafeImage";
import {
  ArrowDown,
  ArrowUp,
  Award,
  ChevronDown,
  ChevronUp,
  Eye,
  GripVertical,
  Images,
  Link as LinkIcon,
  MessageSquare,
  Sparkles,
  Pencil,
  Phone,
  Plus,
  Save,
  Trash2,
  Upload,
  User,
  X,
} from "lucide-react";
import toast from "@/lib/toast";
import { ProfileSlideshow } from "@/components/public/ProfileSlideshow";
import {
  SOCIAL_ICON_REGISTRY,
  SOCIAL_ICON_KEYS,
  DEFAULT_HOVER_COLORS,
} from "@/lib/social-icons";
import { getErrorMessage } from "@/lib/utils";
import { AdminDatePicker } from "@/components/admin/AdminDatePicker";
import {
  AdminAccordion,
  useAccordionState,
} from "@/components/admin/AdminAccordion";
import { AdminConfirmModal } from "@/components/admin/AdminConfirmModal";
import { UnsavedChangesBar } from "@/components/admin/UnsavedChangesBar";

// ─── Interfaces ──────────────────────────────────────────────────────────────

interface Profile {
  id: string;
  bio: string;
  profileImage: string | null;
  profileImages: string[];
  // backgroundImage / logoImage still exist on the Profile model, but are
  // now edited from Settings → Preferences (see BrandingSection.tsx), not here.
  headline: string | null;
  displayName: string | null;
  basedIn: string | null;
  experience: string | null;
  languages: string | null;
  instagram: string | null;
  facebook: string | null;
  twitter: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  contactHeading: string | null;
  contactIntro: string | null;
  commissionHeading: string | null;
  commissionIntro: string | null;
  callingCardFront: string | null;
  callingCardBack: string | null;
}

interface SocialLink {
  id?: string;
  label: string;
  url: string;
  iconKey: string;
  hoverColor: string;
  sortOrder: number;
}

interface CertificateAward {
  id?: string;
  title: string;
  issuer: string | null;
  dateAwarded: Date | string | null;
  description: string | null;
  imageUrl: string | null;
  displayOrder: number;
}

interface ArtistSkill {
  id?: string;
  name: string;
  hoverColor: string;
  sortOrder: number;
}

// ─── Constants & factories ────────────────────────────────────────────────────

const emptySkill = (): ArtistSkill => ({
  name: "",
  hoverColor: DEFAULT_HOVER_COLORS[0],
  sortOrder: 0,
});

const emptySocialLink = (): SocialLink => ({
  label: "",
  url: "",
  iconKey: "link",
  hoverColor: DEFAULT_HOVER_COLORS[0],
  sortOrder: 0,
});

const emptyCert = (): CertificateAward => ({
  title: "",
  issuer: null,
  dateAwarded: null,
  description: null,
  imageUrl: null,
  displayOrder: 0,
});

const MAX_PROFILE_IMAGES = 5;

type TabId = "profile" | "media" | "links";
const TABS: { id: TabId; label: string }[] = [
  { id: "profile", label: "Profile & Bio" },
  { id: "media", label: "Media" },
  { id: "links", label: "Links & Details" },
];

// ─── Shared sub-components ───────────────────────────────────────────────────

function CertFormFields({
  formState,
  setFormState,
  onUpload,
  uploadingCertImage,
  onPreview,
}: {
  formState: CertificateAward;
  setFormState: (s: CertificateAward) => void;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  uploadingCertImage: boolean;
  onPreview?: (image: { url: string; title?: string }) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">Title *</label>
          <input
            type="text"
            value={formState.title}
            onChange={(e) =>
              setFormState({ ...formState, title: e.target.value })
            }
            className="w-full px-4 py-2.5 rounded-xl admin-input border text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors text-sm"
            placeholder="Best Visual Art Award"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">Issuer</label>
          <input
            type="text"
            value={formState.issuer || ""}
            onChange={(e) =>
              setFormState({ ...formState, issuer: e.target.value || null })
            }
            className="w-full px-4 py-2.5 rounded-xl admin-input border text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors text-sm"
            placeholder="National Art Association"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">Date Awarded</label>
          <AdminDatePicker
            value={
              formState.dateAwarded
                ? typeof formState.dateAwarded === "string"
                  ? formState.dateAwarded
                  : new Date(formState.dateAwarded).toISOString().split("T")[0]
                : ""
            }
            onChange={(dateAwarded) =>
              setFormState({
                ...formState,
                dateAwarded: dateAwarded || null,
              })
            }
            className="px-4 py-2.5 text-sm"
            ariaLabel="Date awarded"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">Image</label>
          <div className="flex items-center gap-2">
            {formState.imageUrl ? (
              <>
                <div className="group/thumb relative w-[42px] h-[42px] rounded-xl border border-black/10 dark:border-white/15 shrink-0 overflow-hidden">
                  <Image
                    src={formState.imageUrl}
                    alt=""
                    fill
                    className="object-cover"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      onPreview?.({
                        url: formState.imageUrl!,
                        title: formState.title,
                      })
                    }
                    className="absolute inset-0 flex items-center justify-center bg-ink/0 group-hover/thumb:bg-ink/50 opacity-0 group-hover/thumb:opacity-100 transition-all"
                    title="View full image"
                  >
                    <Eye size={14} className="text-white" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setFormState({ ...formState, imageUrl: null })}
                  className="text-sm px-4 py-2.5 rounded-xl border border-black/10 dark:border-white/10 text-ink-400 dark:text-ink-300 hover:border-black/20 dark:hover:border-white/20 hover:text-ink dark:hover:text-cream hover:bg-black/5 dark:hover:bg-white/5 transition-colors font-medium"
                >
                  Remove
                </button>
              </>
            ) : (
              <>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onUpload}
                />
                <button
                  type="button"
                  onClick={(e) => {
                    const input = e.currentTarget
                      .previousElementSibling as HTMLInputElement;
                    input?.click();
                  }}
                  disabled={uploadingCertImage}
                  className="text-sm px-4 py-2.5 rounded-xl border border-black/10 dark:border-white/10 text-ink dark:text-cream hover:bg-black/5 dark:hover:bg-white/5 flex items-center justify-center gap-2 transition-colors font-medium disabled:opacity-50"
                >
                  <Upload size={15} />
                  {uploadingCertImage ? "Uploading..." : "Upload"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">Description</label>
        <textarea
          rows={2}
          value={formState.description || ""}
          onChange={(e) =>
            setFormState({ ...formState, description: e.target.value || null })
          }
          className="w-full px-4 py-2.5 rounded-xl admin-input border text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors text-sm resize-none"
          placeholder="Brief description of the award..."
        />
      </div>
    </>
  );
}

function IconPickerForm({
  formState,
  setFormState,
}: {
  formState: SocialLink;
  setFormState: (s: SocialLink) => void;
}) {
  const entry = SOCIAL_ICON_REGISTRY[formState.iconKey];
  const PreviewIcon = entry?.Icon;

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">Icon</label>
          <div className="relative">
            <select
              value={formState.iconKey}
              onChange={(e) => {
                const key = e.target.value;
                const reg = SOCIAL_ICON_REGISTRY[key];
                setFormState({
                  ...formState,
                  iconKey: key,
                  label: formState.label || reg?.label || "",
                });
              }}
              className="w-full px-4 py-2.5 rounded-xl admin-input border text-ink dark:text-cream focus:outline-none focus:border-sepia transition-colors text-sm pr-9 appearance-none cursor-pointer"
            >
              {SOCIAL_ICON_KEYS.map((key) => (
                <option key={key} value={key}>
                  {SOCIAL_ICON_REGISTRY[key].label}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none"
            />
          </div>
          {PreviewIcon && (
            <div className="mt-2 flex items-center gap-2">
              <div
                className="w-8 h-8 flex items-center justify-center rounded"
                style={{ color: formState.hoverColor }}
              >
                <PreviewIcon className="w-5 h-5" />
              </div>
              <span className="font-body text-[10px] text-ink-400 dark:text-ink-300">
                Preview
              </span>
            </div>
          )}
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">Label</label>
          <input
            type="text"
            value={formState.label}
            onChange={(e) =>
              setFormState({ ...formState, label: e.target.value })
            }
            className="w-full px-4 py-2.5 rounded-xl admin-input border text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors text-sm"
            placeholder="Facebook"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">URL</label>
          <input
            type="url"
            value={formState.url}
            onChange={(e) =>
              setFormState({ ...formState, url: e.target.value })
            }
            className="w-full px-4 py-2.5 rounded-xl admin-input border text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors text-sm"
            placeholder="https://..."
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">Hover Color</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={formState.hoverColor}
              onChange={(e) =>
                setFormState({ ...formState, hoverColor: e.target.value })
              }
              className="w-10 h-10 rounded border border-black/10 dark:border-white/15 cursor-pointer bg-transparent shrink-0"
            />
            <input
              type="text"
              value={formState.hoverColor}
              onChange={(e) =>
                setFormState({ ...formState, hoverColor: e.target.value })
              }
              className="w-full px-4 py-2.5 rounded-xl admin-input border text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors text-sm sm:w-24 font-mono text-xs"
              placeholder="#FFE135"
            />
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Phone number helpers ──────────────────────────────────────────────────
// "Local" (no code) numbers are capped at 11 digits (e.g. 09123456789).
// Numbers with a country code are capped at 10 digits (e.g. +63 9123456789).

const COUNTRY_CODES = [
  { code: "", label: "Local (11 digits)" },
  { code: "+63", label: "+63 Philippines" },
  { code: "+1", label: "+1 US / Canada" },
  { code: "+44", label: "+44 UK" },
  { code: "+61", label: "+61 Australia" },
  { code: "+65", label: "+65 Singapore" },
  { code: "+971", label: "+971 UAE" },
  { code: "+81", label: "+81 Japan" },
];

function maxPhoneDigits(code: string) {
  return code ? 10 : 11;
}

function parsePhone(raw: string | null | undefined): {
  code: string;
  digits: string;
} {
  const trimmed = (raw || "").trim();
  const match = trimmed.match(/^(\+\d{1,3})\s*(.*)$/);
  if (match) {
    const code = COUNTRY_CODES.some((c) => c.code === match[1]) ? match[1] : "";
    const digits = match[2].replace(/\D/g, "").slice(0, maxPhoneDigits(code));
    return { code, digits };
  }
  return {
    code: "",
    digits: trimmed.replace(/\D/g, "").slice(0, maxPhoneDigits("")),
  };
}

function combinePhone(code: string, digits: string) {
  return code ? `${code} ${digits}` : digits;
}

// Groups raw digits into a readable, dashed pattern as the person types:
//   local (11 digits, no country code) → 0912-345-6789
//   with a country code (10 digits)    → 912-345-6789
function formatPhoneDigits(digits: string, hasCode: boolean): string {
  const groups = hasCode
    ? [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 10)]
    : [digits.slice(0, 4), digits.slice(4, 7), digits.slice(7, 11)];
  return groups.filter(Boolean).join("-");
}

// Max length of the *formatted* (dashed) string — digits plus the 2 separators.
function maxPhoneLength(code: string) {
  return maxPhoneDigits(code) + 2;
}

// Mirrors the public-facing chip treatment on the About page's Artist Skills
// section (gilded pill, colored glow, light sweep) — but always "on" rather
// than hover-gated, since this preview exists specifically so the admin can
// see the chosen color without having to hover it themselves.
function SkillPreviewChip({ name, color }: { name: string; color: string }) {
  // Hover marquee for a name too long for its column: measured, not guessed
  // — a chip that fits stays still. The shift is the exact overflow, so the
  // scroll ends with the last letter in view and rocks back (alternate).
  const textRef = useRef<HTMLSpanElement>(null);
  const [shift, setShift] = useState(0);
  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    const measure = () => setShift(Math.max(0, el.scrollWidth - el.clientWidth));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [name]);

  return (
    // A flex item with min-w-0 rather than an inline-block with max-w-full:
    // inside a `flex-1` (basis 0%) parent, Chrome resolved that percentage
    // against the zero basis and the chip clipped to three letters with the
    // whole row free beside it.
    <span
      className="group/chip relative flex min-w-0 max-w-full overflow-hidden font-body text-[11px] tracking-[0.08em] uppercase rounded-full border px-3 py-1.5 whitespace-nowrap"
      style={{
        color,
        borderColor: color + "80",
        backgroundColor: color + "1f",
        boxShadow: `0 6px 20px -6px ${color}`,
        // Long names scroll on hover; anything that fits has shift 0 and
        // the animation is a no-op.
        ["--marquee-shift" as string]: `-${shift}px`,
        ["--marquee-duration" as string]: `${Math.max(1.5, shift / 40)}s`,
      }}
    >
      <span
        className="pointer-events-none absolute inset-0 animate-shimmer"
        style={{
          background: `linear-gradient(90deg, transparent, ${color}55, transparent)`,
        }}
      />
      <span
        ref={textRef}
        className={
          "relative block min-w-0 flex-1 overflow-hidden text-ellipsis " +
          (shift > 0 ? "group-hover/chip:animate-skill-marquee group-hover/chip:overflow-visible group-hover/chip:[text-overflow:clip]" : "")
        }
      >
        {name || "Preview"}
      </span>
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AboutClient({
  initialProfile,
  initialSocialLinks = [],
  initialCertificates = [],
  initialArtistSkills = [],
}: {
  initialProfile: Profile | null;
  initialSocialLinks?: SocialLink[];
  initialCertificates?: CertificateAward[];
  initialArtistSkills?: ArtistSkill[];
}) {
  // ── Layout state ────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabId>("profile");
  const [previewOpen, setPreviewOpen] = useState(false);

  // Links & Details is four independent editors stacked in one tab — long
  // enough that reaching Artist Skills meant scrolling past everything else.
  // Same fold the Digital Museum's Rooms tab uses (AdminAccordion), and like
  // there it's display-only: folding a section never changes what's saved.
  const linkSections = useAccordionState("admin:about:links", [
    "social",
    "certificates",
    "contact",
    "skills",
  ] as const);

  // ── Image lightbox (hover-to-preview) state ─────────────────
  const [previewImage, setPreviewImage] = useState<{
    url: string;
    title?: string;
  } | null>(null);

  // ── Upload state ────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [uploadingSlot, setUploadingSlot] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingSlotRef = useRef<number>(0);

  // ── Profile image drag-reorder ──────────────────────────────
  const [draggedSlot, setDraggedSlot] = useState<number | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);

  // ── Social links state ──────────────────────────────────────
  const [socialLinks, setSocialLinks] =
    useState<SocialLink[]>(initialSocialLinks);
  const [savingLinks, setSavingLinks] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<SocialLink>(emptySocialLink());
  const [editForm, setEditForm] = useState<SocialLink>(emptySocialLink());

  // ── Certificates state ──────────────────────────────────────
  const [certificates, setCertificates] =
    useState<CertificateAward[]>(initialCertificates);
  const [savingCerts, setSavingCerts] = useState(false);
  const [editingCertIndex, setEditingCertIndex] = useState<number | null>(null);
  const [showAddCert, setShowAddCert] = useState(false);
  const [addCertForm, setAddCertForm] = useState<CertificateAward>(emptyCert());
  const [editCertForm, setEditCertForm] =
    useState<CertificateAward>(emptyCert());
  const [uploadingCertImage, setUploadingCertImage] = useState(false);
  const certFileInputRef = useRef<HTMLInputElement>(null);
  const certEditFileInputRef = useRef<HTMLInputElement>(null);

  // ── Calling card upload state ───────────────────────────────
  const [uploadingCallingCard, setUploadingCallingCard] = useState<"front" | "back" | null>(null);
  const callingCardFrontInputRef = useRef<HTMLInputElement>(null);
  const callingCardBackInputRef = useRef<HTMLInputElement>(null);

  // ── Artist skills state ─────────────────────────────────────
  const [artistSkills, setArtistSkills] =
    useState<ArtistSkill[]>(initialArtistSkills);
  const [savingSkills, setSavingSkills] = useState(false);
  const [editingSkillIndex, setEditingSkillIndex] = useState<number | null>(
    null
  );
  const [showAddSkill, setShowAddSkill] = useState(false);
  const [addSkillForm, setAddSkillForm] = useState<ArtistSkill>(emptySkill());
  const [editSkillForm, setEditSkillForm] = useState<ArtistSkill>(emptySkill());

  // ── Profile form + dirty tracking ──────────────────────────
  const formInit = {
    bio: initialProfile?.bio || "",
    profileImages: (() => {
      if (initialProfile?.profileImages?.length)
        return initialProfile.profileImages;
      if (initialProfile?.profileImage) return [initialProfile.profileImage];
      return [] as string[];
    })(),
    headline: initialProfile?.headline || "",
    displayName: initialProfile?.displayName || "",
    basedIn: initialProfile?.basedIn || "",
    experience: initialProfile?.experience || "",
    languages: initialProfile?.languages || "",
    instagram: initialProfile?.instagram || "",
    facebook: initialProfile?.facebook || "",
    twitter: initialProfile?.twitter || "",
    email: initialProfile?.email || "",
    phone: initialProfile?.phone || "",
    address: initialProfile?.address || "",
    contactHeading: initialProfile?.contactHeading || "",
    contactIntro: initialProfile?.contactIntro || "",
    commissionHeading: initialProfile?.commissionHeading || "",
    commissionIntro: initialProfile?.commissionIntro || "",
    callingCardFront: initialProfile?.callingCardFront || null as string | null,
    callingCardBack: initialProfile?.callingCardBack || null as string | null,
  };

  const [form, setForm] = useState(formInit);
  const savedFormRef = useRef(formInit);
  const isDirty = JSON.stringify(form) !== JSON.stringify(savedFormRef.current);

  const [phoneCode, setPhoneCode] = useState(
    () => parsePhone(formInit.phone).code
  );
  const [phoneDigits, setPhoneDigits] = useState(
    () => parsePhone(formInit.phone).digits
  );

  // Keeps the caret in place while the dashed xxxx-xxx-xxxx mask is applied
  // as the person types (otherwise the caret jumps to the end every render).
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const phoneCaretRef = useRef<number | null>(null);
  useEffect(() => {
    if (phoneCaretRef.current !== null && phoneInputRef.current) {
      phoneInputRef.current.setSelectionRange(
        phoneCaretRef.current,
        phoneCaretRef.current
      );
      phoneCaretRef.current = null;
    }
  }, [phoneDigits, phoneCode]);

  function handlePhoneCodeChange(code: string) {
    const digits = phoneDigits.slice(0, maxPhoneDigits(code));
    setPhoneCode(code);
    setPhoneDigits(digits);
    setForm({ ...form, phone: combinePhone(code, digits) });
  }

  function handlePhoneDigitsChange(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const raw = input.value;
    const caret = input.selectionStart ?? raw.length;
    const digitsBeforeCaret = raw.slice(0, caret).replace(/\D/g, "").length;

    const digits = raw.replace(/\D/g, "").slice(0, maxPhoneDigits(phoneCode));
    const formatted = formatPhoneDigits(digits, !!phoneCode);

    // Re-locate the caret at the same digit offset inside the newly formatted string.
    const targetDigitCount = Math.min(digitsBeforeCaret, digits.length);
    let seen = 0;
    let caretPos = formatted.length;
    for (let i = 0; i < formatted.length; i++) {
      if (/\d/.test(formatted[i])) seen++;
      if (seen === targetDigitCount) {
        caretPos = i + 1;
        break;
      }
    }
    if (targetDigitCount === 0) caretPos = 0;
    phoneCaretRef.current = caretPos;

    setPhoneDigits(digits);
    setForm({ ...form, phone: combinePhone(phoneCode, digits) });
  }

  // ─────────────────────────────────────────────────────────────
  // Profile image handlers
  // ─────────────────────────────────────────────────────────────

  function triggerProfileImageUpload(slot: number) {
    pendingSlotRef.current = slot;
    fileInputRef.current?.click();
  }

  async function handleProfileImageUpload(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    const slot = pendingSlotRef.current;
    setUploadingSlot(slot);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setForm((f) => {
        const next = [...f.profileImages];
        next[slot] = data.url;
        return { ...f, profileImages: next.slice(0, MAX_PROFILE_IMAGES) };
      });
      toast.success("Image uploaded");
    } catch (err) {
      toast.error(getErrorMessage(err, "Upload failed"));
    } finally {
      setUploadingSlot(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removeProfileImage(slot: number) {
    setForm((f) => ({
      ...f,
      profileImages: f.profileImages.filter((_, i) => i !== slot),
    }));
  }

  function reorderProfileImages(fromIndex: number, toIndex: number) {
    setForm((f) => {
      if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= f.profileImages.length ||
        toIndex >= f.profileImages.length
      )
        return f;
      const next = [...f.profileImages];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return { ...f, profileImages: next };
    });
  }

  function handleImageDragStart(e: React.DragEvent, slot: number) {
    setDraggedSlot(slot);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(slot));
  }

  function handleImageDragOver(e: React.DragEvent, slot: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (draggedSlot !== null && draggedSlot !== slot && dragOverSlot !== slot) {
      setDragOverSlot(slot);
    }
  }

  function handleImageDrop(e: React.DragEvent, slot: number) {
    e.preventDefault();
    if (draggedSlot !== null && draggedSlot !== slot) {
      reorderProfileImages(draggedSlot, slot);
    }
    setDraggedSlot(null);
    setDragOverSlot(null);
  }

  function handleImageDragEnd() {
    setDraggedSlot(null);
    setDragOverSlot(null);
  }

  // Touch-friendly reordering: native HTML5 drag-and-drop (above) doesn't fire
  // on touchscreens, so mobile drags the grip handle via Pointer Events instead.
  function handleSlotPointerDown(
    e: React.PointerEvent<HTMLDivElement>,
    slot: number
  ) {
    if (e.pointerType !== "touch") return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDraggedSlot(slot);
  }

  function handleSlotPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (draggedSlot === null) return;
    const target = document.elementFromPoint(e.clientX, e.clientY);
    const slotEl = target?.closest<HTMLElement>("[data-profile-slot]");
    if (!slotEl) return;
    const overSlot = Number(slotEl.dataset.profileSlot);
    if (Number.isNaN(overSlot)) return;
    setDragOverSlot(overSlot === draggedSlot ? null : overSlot);
  }

  function handleSlotPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "touch") return;
    if (
      draggedSlot !== null &&
      dragOverSlot !== null &&
      dragOverSlot !== draggedSlot
    ) {
      reorderProfileImages(draggedSlot, dragOverSlot);
    }
    setDraggedSlot(null);
    setDragOverSlot(null);
  }

  // ─────────────────────────────────────────────────────────────
  // Profile save (decoupled from FormEvent for sticky bar reuse)
  // ─────────────────────────────────────────────────────────────

  async function saveProfile() {
    if (
      phoneDigits.length > 0 &&
      phoneDigits.length !== maxPhoneDigits(phoneCode)
    ) {
      toast.error(
        phoneCode
          ? `Phone number must have ${maxPhoneDigits(phoneCode)} digits after the country code`
          : `Phone number must have ${maxPhoneDigits(phoneCode)} digits`
      );
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      savedFormRef.current = { ...form };
      toast.success("Profile updated successfully");
    } catch {
      toast.error("Failed to save profile");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    await saveProfile();
  }

  function resetForm() {
    setForm({ ...savedFormRef.current });
    const parsed = parsePhone(savedFormRef.current.phone);
    setPhoneCode(parsed.code);
    setPhoneDigits(parsed.digits);
  }

  // ─────────────────────────────────────────────────────────────
  // Social link helpers
  // ─────────────────────────────────────────────────────────────

  function addSocialLink() {
    if (!addForm.label.trim() || !addForm.url.trim()) {
      toast.error("Label and URL are required");
      return;
    }
    setSocialLinks([
      ...socialLinks,
      { ...addForm, sortOrder: socialLinks.length },
    ]);
    setAddForm(emptySocialLink());
    setShowAddForm(false);
    toast.success(`Added "${addForm.label}"`);
  }

  function startEditing(index: number) {
    setEditingIndex(index);
    setEditForm({ ...socialLinks[index] });
  }

  function saveEdit() {
    if (editingIndex === null) return;
    if (!editForm.label.trim() || !editForm.url.trim()) {
      toast.error("Label and URL are required");
      return;
    }
    const next = [...socialLinks];
    next[editingIndex] = { ...editForm, sortOrder: editingIndex };
    setSocialLinks(next);
    setEditingIndex(null);
    toast.success("Link updated");
  }

  function cancelEdit() {
    setEditingIndex(null);
  }

  function deleteSocialLink(index: number) {
    const label = socialLinks[index].label;
    setSocialLinks(
      socialLinks
        .filter((_, i) => i !== index)
        .map((l, i) => ({ ...l, sortOrder: i }))
    );
    if (editingIndex === index) setEditingIndex(null);
    toast.success(`Removed "${label}"`);
  }

  function moveSocialLink(index: number, direction: "up" | "down") {
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= socialLinks.length) return;
    const next = [...socialLinks];
    [next[index], next[target]] = [next[target], next[index]];
    next.forEach((l, i) => (l.sortOrder = i));
    setSocialLinks(next);
    if (editingIndex === index) setEditingIndex(target);
    else if (editingIndex === target) setEditingIndex(index);
  }

  async function saveSocialLinks() {
    setSavingLinks(true);
    try {
      const res = await fetch("/api/social-links", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          links: socialLinks.map((l, i) => ({
            label: l.label,
            url: l.url,
            iconKey: l.iconKey,
            hoverColor: l.hoverColor,
            sortOrder: i,
          })),
        }),
      });
      if (!res.ok) throw new Error();
      setSocialLinks(await res.json());
      toast.success("Social links saved");
    } catch {
      toast.error("Failed to save social links");
    } finally {
      setSavingLinks(false);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Certificate helpers
  // ─────────────────────────────────────────────────────────────

  async function handleCertImageUpload(
    e: React.ChangeEvent<HTMLInputElement>,
    target: "add" | "edit"
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCertImage(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      if (target === "add")
        setAddCertForm((f) => ({ ...f, imageUrl: data.url }));
      else setEditCertForm((f) => ({ ...f, imageUrl: data.url }));
      toast.success("Image uploaded");
    } catch (err) {
      toast.error(getErrorMessage(err, "Upload failed"));
    } finally {
      setUploadingCertImage(false);
      if (certFileInputRef.current) certFileInputRef.current.value = "";
      if (certEditFileInputRef.current) certEditFileInputRef.current.value = "";
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Calling card upload helpers
  // ─────────────────────────────────────────────────────────────

  async function handleCallingCardUpload(
    e: React.ChangeEvent<HTMLInputElement>,
    side: "front" | "back"
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCallingCard(side);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setForm((f) => ({
        ...f,
        [side === "front" ? "callingCardFront" : "callingCardBack"]: data.url,
      }));
      toast.success(`Calling card ${side} uploaded`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Upload failed"));
    } finally {
      setUploadingCallingCard(null);
      if (side === "front" && callingCardFrontInputRef.current)
        callingCardFrontInputRef.current.value = "";
      if (side === "back" && callingCardBackInputRef.current)
        callingCardBackInputRef.current.value = "";
    }
  }

  async function addCertificate() {
    if (!addCertForm.title.trim()) {
      toast.error("Title is required");
      return;
    }
    setSavingCerts(true);
    try {
      const res = await fetch("/api/certificates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addCertForm),
      });
      if (!res.ok) throw new Error();
      const saved = await res.json();
      setCertificates([...certificates, saved]);
      setAddCertForm(emptyCert());
      setShowAddCert(false);
      toast.success(`Added "${saved.title}"`);
    } catch {
      toast.error("Failed to add certificate");
    } finally {
      setSavingCerts(false);
    }
  }

  function startEditingCert(index: number) {
    setEditingCertIndex(index);
    const cert = certificates[index];
    setEditCertForm({
      ...cert,
      dateAwarded: cert.dateAwarded
        ? new Date(cert.dateAwarded).toISOString().split("T")[0]
        : null,
    });
  }

  async function saveEditCert() {
    if (editingCertIndex === null) return;
    const cert = certificates[editingCertIndex];
    if (!editCertForm.title.trim()) {
      toast.error("Title is required");
      return;
    }
    setSavingCerts(true);
    try {
      const res = await fetch(`/api/certificates/${cert.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editCertForm),
      });
      if (!res.ok) throw new Error();
      const saved = await res.json();
      const next = [...certificates];
      next[editingCertIndex] = saved;
      setCertificates(next);
      setEditingCertIndex(null);
      toast.success("Certificate updated");
    } catch {
      toast.error("Failed to update");
    } finally {
      setSavingCerts(false);
    }
  }

  // Unlike social links / skills, whose Delete only edits the staged list
  // until Save, a certificate's Delete hits the API on the spot — so it gets
  // the same confirmation dialog every other immediate delete in the admin
  // has. Holds the index awaiting confirmation.
  const [pendingCertDelete, setPendingCertDelete] = useState<number | null>(null);

  async function deleteCertificate(index: number) {
    const cert = certificates[index];
    setPendingCertDelete(null);
    setSavingCerts(true);
    try {
      const res = await fetch(`/api/certificates/${cert.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      setCertificates(certificates.filter((_, i) => i !== index));
      if (editingCertIndex === index) setEditingCertIndex(null);
      toast.success(`Removed "${cert.title}"`);
    } catch {
      toast.error("Failed to delete");
    } finally {
      setSavingCerts(false);
    }
  }

  function moveCert(index: number, direction: "up" | "down") {
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= certificates.length) return;
    const next = [...certificates];
    [next[index], next[target]] = [next[target], next[index]];
    next.forEach((c, i) => (c.displayOrder = i));
    setCertificates(next);
    if (editingCertIndex === index) setEditingCertIndex(target);
    else if (editingCertIndex === target) setEditingCertIndex(index);
  }

  async function saveCertificateOrder() {
    setSavingCerts(true);
    try {
      await Promise.all(
        certificates.map((cert, i) =>
          fetch(`/api/certificates/${cert.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ displayOrder: i }),
          })
        )
      );
      toast.success("Certificate order saved");
    } catch {
      toast.error("Failed to save order");
    } finally {
      setSavingCerts(false);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Artist skills helpers
  // ─────────────────────────────────────────────────────────────

  function addArtistSkill() {
    if (!addSkillForm.name.trim()) {
      toast.error("Skill name is required");
      return;
    }
    setArtistSkills([
      ...artistSkills,
      { ...addSkillForm, sortOrder: artistSkills.length },
    ]);
    setAddSkillForm(emptySkill());
    setShowAddSkill(false);
    toast.success(`Added "${addSkillForm.name}"`);
  }

  function startEditingSkill(index: number) {
    setEditingSkillIndex(index);
    setEditSkillForm({ ...artistSkills[index] });
  }

  function saveEditSkill() {
    if (editingSkillIndex === null) return;
    if (!editSkillForm.name.trim()) {
      toast.error("Skill name is required");
      return;
    }
    const next = [...artistSkills];
    next[editingSkillIndex] = {
      ...editSkillForm,
      sortOrder: editingSkillIndex,
    };
    setArtistSkills(next);
    setEditingSkillIndex(null);
    toast.success("Skill updated");
  }

  function deleteArtistSkill(index: number) {
    const name = artistSkills[index].name;
    setArtistSkills(
      artistSkills
        .filter((_, i) => i !== index)
        .map((s, i) => ({ ...s, sortOrder: i }))
    );
    if (editingSkillIndex === index) setEditingSkillIndex(null);
    toast.success(`Removed "${name}"`);
  }

  function moveArtistSkill(index: number, direction: "up" | "down") {
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= artistSkills.length) return;
    const next = [...artistSkills];
    [next[index], next[target]] = [next[target], next[index]];
    next.forEach((s, i) => (s.sortOrder = i));
    setArtistSkills(next);
    if (editingSkillIndex === index) setEditingSkillIndex(target);
    else if (editingSkillIndex === target) setEditingSkillIndex(index);
  }

  async function saveArtistSkills() {
    setSavingSkills(true);
    try {
      const res = await fetch("/api/artist-skills", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skills: artistSkills.map((s, i) => ({
            name: s.name,
            hoverColor: s.hoverColor,
            sortOrder: i,
          })),
        }),
      });
      if (!res.ok) throw new Error();
      setArtistSkills(await res.json());
      toast.success("Artist skills saved");
    } catch {
      toast.error("Failed to save artist skills");
    } finally {
      setSavingSkills(false);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Shared JSX snippets
  // ─────────────────────────────────────────────────────────────

  const saveProfileBtn = (
    <button
      type="button"
      onClick={saveProfile}
      disabled={loading}
      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sepia text-white font-jakarta text-sm font-medium hover:bg-sepia-dark transition-all duration-200 shadow-md disabled:opacity-50"
    >
      {loading ? (
        <>
          <div className="w-4 h-4 border border-cream/30 border-t-cream rounded-full animate-spin" />
          Saving…
        </>
      ) : (
        <>
          <Save size={16} />
          Save Profile
        </>
      )}
    </button>
  );

  // Preview content — shared between mobile accordion and desktop sticky column
  const previewContent = (
    <>
      <div className="group relative aspect-[3/4] bg-black/5 dark:bg-white/5 mb-4 overflow-hidden cursor-pointer">
        {form.profileImages.length > 0 ? (
          <ProfileSlideshow
            images={form.profileImages.slice(0, MAX_PROFILE_IMAGES)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-ink-300 dark:text-ink-600">
            <User size={48} strokeWidth={0.8} />
          </div>
        )}
      </div>

      {form.profileImages.length > 1 && (
        <p className="font-body text-[10px] tracking-widest uppercase text-ink-400 dark:text-ink-300 text-center mb-2">
          +{form.profileImages.length - 1} more · auto-slideshow
        </p>
      )}

      {form.displayName && (
        <p className="font-jakarta text-lg font-semibold tracking-tight text-center text-ink dark:text-cream mt-3">
          {form.displayName}
        </p>
      )}
      {form.headline && (
        <p className="font-jakarta text-sm tracking-tight text-center text-sepia dark:text-sepia-light mt-0.5">
          {form.headline}
        </p>
      )}
      {form.email && (
        <p className="font-body text-xs text-ink-400 dark:text-ink-300 text-center mt-2 break-all">
          {form.email}
        </p>
      )}
      {(form.basedIn || form.experience || form.languages) && (
        <div className="mt-3 pt-3 border-t border-black/10 dark:border-white/10 grid grid-cols-3 gap-1 text-center">
          {[
            { label: "Based in", value: form.basedIn },
            { label: "Experience", value: form.experience },
            { label: "Languages", value: form.languages },
          ].map(({ label, value }) =>
            value ? (
              <div key={label}>
                <p className="font-body text-xs tracking-widest uppercase text-ink-400 dark:text-ink-300">
                  {label}
                </p>
                <p className="font-body text-sm text-ink dark:text-cream leading-tight mt-0.5">
                  {value}
                </p>
              </div>
            ) : null
          )}
        </div>
      )}
      {form.bio && (
        <div className="mt-3 pt-3 border-t border-black/10 dark:border-white/10 space-y-1.5">
          <p className="font-body text-xs tracking-widest uppercase text-ink-400 dark:text-ink-300 mb-2">
            Bio preview
          </p>
          {form.bio
            .split("\n\n")
            .slice(0, 3)
            .map((para, i) => (
              <p
                key={i}
                className="font-body text-sm text-ink-500 dark:text-ink-300 leading-relaxed line-clamp-3"
              >
                {para}
              </p>
            ))}
          {form.bio.split("\n\n").length > 3 && (
            <p className="font-body text-xs text-ink-400 dark:text-ink-300 italic">
              +{form.bio.split("\n\n").length - 3} more paragraph
              {form.bio.split("\n\n").length - 3 !== 1 ? "s" : ""}…
            </p>
          )}
        </div>
      )}
    </>
  );

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────

  return (
    <div className="relative pb-24">
      {/* ── Mobile preview accordion ─────────────────────────── */}
      <div className="lg:hidden mb-4">
        <button
          type="button"
          onClick={() => setPreviewOpen((p) => !p)}
          className="w-full flex items-center justify-between px-4 py-3 admin-card border rounded-2xl backdrop-blur-md shadow-sm text-left transition-colors hover:bg-black/5 dark:hover:bg-white/5"
        >
          <span className="font-body text-xs tracking-widest uppercase text-ink-400 dark:text-ink-300">
            {previewOpen ? "Hide Preview" : "Show Preview"}
          </span>
          {previewOpen ? (
            <ChevronUp
              size={14}
              className="text-ink-400 dark:text-ink-300 shrink-0"
            />
          ) : (
            <ChevronDown
              size={14}
              className="text-ink-400 dark:text-ink-300 shrink-0"
            />
          )}
        </button>
        {previewOpen && (
          <div className="mt-1 admin-card border rounded-2xl backdrop-blur-md shadow-sm p-4 sm:p-6">
            {previewContent}
            {socialLinks.length > 0 && (
              <div className="mt-4 pt-4 border-t border-black/10 dark:border-white/10">
                <p className="font-body text-[9px] tracking-widest uppercase text-ink-400 dark:text-ink-300 mb-3">
                  Footer
                </p>
                <div className="flex flex-wrap items-center justify-center gap-4">
                  {socialLinks.map((link) => {
                    const entry = SOCIAL_ICON_REGISTRY[link.iconKey];
                    const IconComponent = entry?.Icon;
                    if (!IconComponent) return null;
                    return (
                      <span
                        key={`${link.iconKey}-${link.label}`}
                        className="w-7 h-7 flex items-center justify-center"
                        style={{ color: link.hoverColor }}
                        title={link.label}
                      >
                        <IconComponent className="w-4 h-4" />
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Main grid ────────────────────────────────────────── */}
      <form onSubmit={handleSave} id="about-form">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
          {/* Left column — sticky preview (desktop only) */}
          <div className="hidden lg:flex flex-col gap-4 lg:col-span-1 self-start sticky top-6">
            <div className="admin-card border rounded-2xl backdrop-blur-md shadow-sm p-4 sm:p-6">
              <p className="font-body text-xs tracking-widest uppercase text-ink-400 dark:text-ink-300 mb-4">
                Preview
              </p>
              {previewContent}
            </div>

            {socialLinks.length > 0 && (
              <div className="admin-card border rounded-2xl backdrop-blur-md shadow-sm p-4 sm:p-6">
                <p className="font-body text-xs tracking-widest uppercase text-ink-400 dark:text-ink-300 mb-4">
                  Footer Preview
                </p>
                <div className="flex flex-wrap items-center justify-center gap-4 py-2">
                  {socialLinks.map((link) => {
                    const entry = SOCIAL_ICON_REGISTRY[link.iconKey];
                    const IconComponent = entry?.Icon;
                    if (!IconComponent) return null;
                    return (
                      <span
                        key={`${link.iconKey}-${link.label}`}
                        className="w-8 h-8 flex items-center justify-center"
                        style={{ color: link.hoverColor }}
                        title={link.label}
                      >
                        <IconComponent className="w-5 h-5" />
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right column — tabbed form */}
          <div className="lg:col-span-2">
            {/* Tab bar */}
            <div className="flex gap-1 bg-black/5 dark:bg-white/5 p-1 rounded-xl mb-5 overflow-x-auto">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 min-w-[90px] px-2 sm:px-3 py-2 text-[11px] sm:text-xs font-body tracking-wide rounded-lg transition-all whitespace-nowrap ${
                    activeTab === tab.id
                      ? "bg-sepia text-white shadow-sm font-medium"
                      : "text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ── Tab 1: Profile & Bio ───────────────────────── */}
            {activeTab === "profile" && (
              <div className="space-y-5">
                <div className="admin-card border rounded-2xl backdrop-blur-md shadow-sm p-4 sm:p-6 space-y-5">
                  <p className="font-body text-xs tracking-widest uppercase text-ink-400 dark:text-ink-300 border-b border-black/10 dark:border-white/10 pb-4">
                    Profile Details
                  </p>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">Band Name</label>
                    <input
                      type="text"
                      value={form.displayName}
                      onChange={(e) =>
                        setForm({ ...form, displayName: e.target.value })
                      }
                      className="w-full px-4 py-2.5 rounded-xl admin-input border text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors text-sm"
                      placeholder="ScriptOverNovel"
                    />
                    <p className="font-body text-xs text-ink-400 dark:text-ink-300 mt-1">
                      Name shown below the profile photo on the About page.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">Tagline</label>
                    <input
                      type="text"
                      value={form.headline}
                      onChange={(e) =>
                        setForm({ ...form, headline: e.target.value })
                      }
                      className="w-full px-4 py-2.5 rounded-xl admin-input border text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors text-sm"
                      placeholder="Where every melody remembers something"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">Based in</label>
                      <input
                        type="text"
                        value={form.basedIn}
                        onChange={(e) =>
                          setForm({ ...form, basedIn: e.target.value })
                        }
                        className="w-full px-4 py-2.5 rounded-xl admin-input border text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors text-sm"
                        placeholder="NCR, Philippines"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">Playing since</label>
                      <input
                        type="text"
                        value={form.experience}
                        onChange={(e) =>
                          setForm({ ...form, experience: e.target.value })
                        }
                        className="w-full px-4 py-2.5 rounded-xl admin-input border text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors text-sm"
                        placeholder="6+ Years Artist"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">Languages</label>
                      <input
                        type="text"
                        value={form.languages}
                        onChange={(e) =>
                          setForm({ ...form, languages: e.target.value })
                        }
                        className="w-full px-4 py-2.5 rounded-xl admin-input border text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors text-sm"
                        placeholder="English, Filipino"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">Bio *</label>
                    <textarea
                      required
                      rows={10}
                      value={form.bio}
                      onChange={(e) =>
                        setForm({ ...form, bio: e.target.value })
                      }
                      className="w-full px-4 py-2.5 rounded-xl admin-input border text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors text-sm resize-y"
                      placeholder="The band's story. Separate paragraphs with a blank line."
                    />
                    <p className="font-body text-xs text-ink-400 dark:text-ink-300 mt-1">
                      {form.bio.length} characters. Use double line breaks for
                      paragraphs.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">Email</label>
                      <input
                        type="email"
                        value={form.email}
                        onChange={(e) =>
                          setForm({ ...form, email: e.target.value })
                        }
                        className="w-full px-4 py-2.5 rounded-xl admin-input border text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors text-sm"
                        placeholder="email@domain.com"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">Phone</label>
                      <div className="flex gap-2">
                        <div className="relative w-[9.5rem] shrink-0">
                          <select
                            value={phoneCode}
                            onChange={(e) =>
                              handlePhoneCodeChange(e.target.value)
                            }
                            className="w-full px-4 py-2.5 pr-10 rounded-xl admin-input border text-ink dark:text-cream focus:outline-none focus:border-sepia transition-colors text-xs cursor-pointer appearance-none"
                          >
                            {COUNTRY_CODES.map((c) => (
                              <option
                                key={c.code}
                                value={c.code}
                                className="bg-white dark:bg-ink-900 text-ink dark:text-cream"
                              >
                                {c.label}
                              </option>
                            ))}
                          </select>
                          <ChevronDown
                            size={14}
                            className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-ink-400"
                          />
                        </div>
                        <div className="relative flex-1">
                          <Phone
                            size={14}
                            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none"
                          />
                          <input
                            ref={phoneInputRef}
                            type="tel"
                            inputMode="numeric"
                            value={formatPhoneDigits(phoneDigits, !!phoneCode)}
                            onChange={handlePhoneDigitsChange}
                            maxLength={maxPhoneLength(phoneCode)}
                            className="w-full pl-9 pr-4 py-2.5 rounded-xl admin-input border text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors text-sm font-jakarta tracking-wide"
                            placeholder={phoneCode ? "912-345-6789" : "0912-345-6789"}
                          />
                        </div>
                      </div>
                      <p className="font-body text-xs text-ink-400 dark:text-ink-300 mt-1">
                        {phoneDigits.length}/{maxPhoneDigits(phoneCode)} digits
                        {phoneCode ? " (excluding country code)" : ""}
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">Address</label>
                    <input
                      type="text"
                      value={form.address}
                      onChange={(e) =>
                        setForm({ ...form, address: e.target.value })
                      }
                      className="w-full px-4 py-2.5 rounded-xl admin-input border text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors text-sm"
                      placeholder="123 Main St, Valenzuela City, Philippines"
                    />
                    <p className="font-body text-xs text-ink-400 dark:text-ink-300 mt-1">
                      Shown on the public Contact page alongside phone and
                      email.
                    </p>
                  </div>
                </div>

                {saveProfileBtn}
              </div>
            )}

            {/* ── Tab 2: Media (Profile Images + Calling Card) ── */}
            {/* Logo & background branding moved to Settings → Preferences. */}
            {activeTab === "media" && (
              <div className="space-y-5">
                <div className="admin-card border rounded-2xl backdrop-blur-md shadow-sm p-4 sm:p-6 space-y-6">
                  <p className="font-body text-xs tracking-widest uppercase text-ink-400 dark:text-ink-300 border-b border-black/10 dark:border-white/10 pb-4">
                    Band Photos
                  </p>

                  {/* Profile Images */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300">
                        Band Photos
                        <span className="font-body text-[10px] normal-case tracking-normal text-ink-400 dark:text-ink-300 ml-1.5">
                          (up to {MAX_PROFILE_IMAGES})
                        </span>
                      </label>
                      {form.profileImages.length > 1 && (
                        <span className="flex items-center gap-1 font-body text-[10px] tracking-widest uppercase text-ink-400 dark:text-ink-300">
                          <Images size={11} />
                          Slideshow
                        </span>
                      )}
                    </div>
                    <p className="font-body text-xs text-ink-400 dark:text-ink-300 mb-3">
                      Add up to 3 images. Multiple images create an automatic
                      slideshow on the public site.
                      {form.profileImages.length > 1 &&
                        " Drag to reorder — the first image is used as the cover."}
                    </p>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      onChange={handleProfileImageUpload}
                    />

                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-3">
                      {Array.from({ length: MAX_PROFILE_IMAGES }).map(
                        (_, slot) => {
                          const img = form.profileImages[slot];
                          const isUploading = uploadingSlot === slot;
                          const canUpload = slot === form.profileImages.length;

                          if (img) {
                            const isDragging = draggedSlot === slot;
                            const isDragOver =
                              dragOverSlot === slot &&
                              draggedSlot !== null &&
                              draggedSlot !== slot;
                            return (
                              <div
                                key={img}
                                data-profile-slot={slot}
                                className="relative aspect-[3/4] group/slot"
                                draggable
                                onDragStart={(e) =>
                                  handleImageDragStart(e, slot)
                                }
                                onDragOver={(e) => handleImageDragOver(e, slot)}
                                onDrop={(e) => handleImageDrop(e, slot)}
                                onDragEnd={handleImageDragEnd}
                              >
                                <div
                                  className={`relative w-full h-full border overflow-hidden cursor-grab active:cursor-grabbing transition-all duration-150 ${
                                    isDragOver
                                      ? "border-sepia dark:border-cream border-2"
                                      : "border-black/10 dark:border-white/15"
                                  } ${isDragging ? "opacity-40" : "opacity-100"}`}
                                >
                                  <Image
                                    src={img}
                                    alt={`Profile image ${slot + 1}`}
                                    fill
                                    className="object-cover"
                                    draggable={false}
                                  />
                                  <div className="absolute inset-0 bg-black/0 group-hover/slot:bg-black/30 transition-colors duration-200" />

                                  <div
                                    className="absolute top-1.5 left-1.5 w-6 h-6 flex items-center justify-center rounded-full bg-black/60 text-white opacity-100 sm:opacity-0 sm:group-hover/slot:opacity-100 transition-all duration-150 cursor-grab active:cursor-grabbing touch-none"
                                    onPointerDown={(e) =>
                                      handleSlotPointerDown(e, slot)
                                    }
                                    onPointerMove={handleSlotPointerMove}
                                    onPointerUp={handleSlotPointerUp}
                                    onPointerCancel={handleSlotPointerUp}
                                    role="button"
                                    aria-label={`Drag to reorder image ${slot + 1}`}
                                  >
                                    <GripVertical size={12} />
                                  </div>

                                  <button
                                    type="button"
                                    draggable={false}
                                    onClick={() => removeProfileImage(slot)}
                                    className="absolute top-1.5 right-1.5 w-6 h-6 flex items-center justify-center rounded-full bg-black/60 text-white opacity-100 sm:opacity-0 sm:group-hover/slot:opacity-100 hover:bg-red-600 transition-all duration-150"
                                    aria-label={`Remove image ${slot + 1}`}
                                  >
                                    <X size={12} />
                                  </button>

                                  {form.profileImages.length > 1 && (
                                    <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover/slot:opacity-100 transition-all duration-150">
                                      <button
                                        type="button"
                                        draggable={false}
                                        onClick={() =>
                                          reorderProfileImages(slot, slot - 1)
                                        }
                                        disabled={slot === 0}
                                        className="w-6 h-6 flex items-center justify-center rounded-full bg-black/60 text-white disabled:opacity-30 disabled:pointer-events-none hover:bg-black/80 transition-all duration-150"
                                        aria-label={`Move image ${slot + 1} left`}
                                      >
                                        <ArrowUp
                                          size={11}
                                          className="-rotate-90"
                                        />
                                      </button>
                                      <button
                                        type="button"
                                        draggable={false}
                                        onClick={() =>
                                          reorderProfileImages(slot, slot + 1)
                                        }
                                        disabled={
                                          slot === form.profileImages.length - 1
                                        }
                                        className="w-6 h-6 flex items-center justify-center rounded-full bg-black/60 text-white disabled:opacity-30 disabled:pointer-events-none hover:bg-black/80 transition-all duration-150"
                                        aria-label={`Move image ${slot + 1} right`}
                                      >
                                        <ArrowDown
                                          size={11}
                                          className="-rotate-90"
                                        />
                                      </button>
                                    </div>
                                  )}
                                </div>
                                <span className="block font-body text-[9px] sm:text-[10px] text-ink-400 dark:text-ink-300 text-center mt-1.5">
                                  Image {slot + 1}
                                  {slot === 0 && form.profileImages.length > 1
                                    ? " · cover"
                                    : ""}
                                </span>
                              </div>
                            );
                          }

                          if (isUploading) {
                            return (
                              <div
                                key={slot}
                                className="aspect-[3/4] flex flex-col items-center justify-center gap-2 border-2 border-dashed border-black/10 dark:border-white/15 bg-black/5 dark:bg-white/5"
                              >
                                <div className="w-6 h-6 sm:w-7 sm:h-7 border-2 border-ink-300 dark:border-ink-500 border-t-sepia dark:border-t-cream rounded-full animate-spin" />
                                <span className="font-body text-[9px] sm:text-[10px] text-ink-400 dark:text-ink-300">
                                  Uploading…
                                </span>
                              </div>
                            );
                          }

                          return (
                            <div
                              key={slot}
                              className="aspect-[3/4] flex flex-col"
                            >
                              <button
                                type="button"
                                disabled={!canUpload || uploadingSlot !== null}
                                onClick={() => triggerProfileImageUpload(slot)}
                                className="flex-1 flex flex-col items-center justify-center gap-1.5 sm:gap-2 border-2 border-dashed border-black/10 dark:border-white/15 bg-black/5 dark:bg-white/5 hover:border-sepia dark:hover:border-cream hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors disabled:opacity-30 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sepia"
                                aria-label={`Upload image ${slot + 1}`}
                              >
                                <div className="flex items-center justify-center w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-black/5 dark:bg-white/5">
                                  <Upload
                                    size={14}
                                    className="text-ink-400 dark:text-ink-300 sm:w-4 sm:h-4"
                                  />
                                </div>
                                <span className="font-body text-[9px] sm:text-[10px] text-ink-400 dark:text-ink-300 text-center px-1 sm:px-2 leading-tight">
                                  {slot === 0
                                    ? "Add image"
                                    : `Add image ${slot + 1}`}
                                </span>
                              </button>
                            </div>
                          );
                        }
                      )}
                    </div>

                    {form.profileImages.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          removeProfileImage(form.profileImages.length - 1)
                        }
                        className="mt-2 flex items-center gap-1.5 font-body text-xs text-ink-400 dark:text-ink-300 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                      >
                        <X size={13} />
                        Remove last image
                      </button>
                    )}
                  </div>
                </div>

                {/* ── Calling Card ─────────────────────────────── */}
                <div className="admin-card border rounded-2xl backdrop-blur-md shadow-sm p-4 sm:p-6 space-y-4">
                  <div className="flex items-center gap-2 border-b border-black/10 dark:border-white/10 pb-4">
                    <p className="font-body text-xs tracking-widest uppercase text-ink-400 dark:text-ink-300">
                      Calling Card
                    </p>
                    <span className="font-body text-[10px] px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/5 text-ink-400 dark:text-ink-300">
                      Contact page
                    </span>
                  </div>

                  <p className="font-body text-xs text-ink-400 dark:text-ink-300">
                    Upload a front image (required) and optionally a back image. Visitors can download them from the Contact page. When both images are uploaded, a 3D flip card preview is shown.
                  </p>

                  {/* Hidden file inputs */}
                  <input
                    ref={callingCardFrontInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => handleCallingCardUpload(e, "front")}
                  />
                  <input
                    ref={callingCardBackInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => handleCallingCardUpload(e, "back")}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    {/* Front */}
                    {(["front", "back"] as const).map((side) => {
                      const imgUrl = side === "front" ? form.callingCardFront : form.callingCardBack;
                      const isUploading = uploadingCallingCard === side;
                      const inputRef = side === "front" ? callingCardFrontInputRef : callingCardBackInputRef;
                      const label = side === "front" ? "Front (required)" : "Back (optional)";

                      return (
                        <div key={side} className="space-y-2">
                          <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300">
                            {label}
                          </label>
                          {imgUrl ? (
                            <div className="relative aspect-[3/2] rounded-xl overflow-hidden border border-black/10 dark:border-white/15 group/card">
                              <Image
                                src={imgUrl}
                                alt={`Calling card ${side}`}
                                fill
                                className="object-cover"
                              />
                              <div className="absolute inset-0 bg-black/0 group-hover/card:bg-black/40 transition-colors" />
                              <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 group-hover/card:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPreviewImage({ url: imgUrl, title: `Calling Card ${side}` });
                                  }}
                                  className="w-8 h-8 flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
                                  title="View"
                                >
                                  <Eye size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => inputRef.current?.click()}
                                  disabled={isUploading}
                                  className="w-8 h-8 flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors disabled:opacity-50"
                                  title="Replace"
                                >
                                  <Upload size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setForm((f) => ({
                                      ...f,
                                      [side === "front" ? "callingCardFront" : "callingCardBack"]: null,
                                    }))
                                  }
                                  className="w-8 h-8 flex items-center justify-center rounded-full bg-black/60 text-white hover:bg-red-600 transition-colors"
                                  title="Remove"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => inputRef.current?.click()}
                              disabled={isUploading || uploadingCallingCard !== null}
                              className="w-full aspect-[3/2] flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-black/10 dark:border-white/15 bg-black/5 dark:bg-white/5 hover:border-sepia dark:hover:border-cream hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors disabled:opacity-40 disabled:pointer-events-none"
                            >
                              {isUploading ? (
                                <>
                                  <div className="w-6 h-6 border-2 border-ink-300 dark:border-ink-500 border-t-sepia dark:border-t-cream rounded-full animate-spin" />
                                  <span className="font-body text-[10px] text-ink-400 dark:text-ink-300">Uploading…</span>
                                </>
                              ) : (
                                <>
                                  <Upload size={16} className="text-ink-400 dark:text-ink-300" />
                                  <span className="font-body text-[10px] text-ink-400 dark:text-ink-300 capitalize">{side}</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* 3D preview hint */}
                  {form.callingCardFront && form.callingCardBack && (
                    <p className="font-body text-[11px] text-sepia dark:text-sepia-light">
                      ✦ Both sides uploaded — visitors will see a 3D flip card preview on the Contact page.
                    </p>
                  )}
                </div>

                {saveProfileBtn}
              </div>
            )}

            {/* ── Tab 3: Links & Details ─────────────────────── */}
            {activeTab === "links" && (
              <div className="space-y-6">
                {/* Social Links */}
                <AdminAccordion
                  title="Social Links"
                  icon={<LinkIcon size={14} />}
                  badge={socialLinks.length}
                  open={linkSections.open.social}
                  onToggle={() => linkSections.toggle("social")}
                >
                <div className="admin-card border rounded-2xl backdrop-blur-md shadow-sm p-4 sm:p-6 space-y-5">
                  {socialLinks.length === 0 && !showAddForm && (
                    <p className="font-body text-sm text-ink-400 dark:text-ink-300 text-center py-6">
                      No social links yet. Add one below.
                    </p>
                  )}

                  <div className="space-y-2">
                    {socialLinks.map((link, index) => {
                      const entry = SOCIAL_ICON_REGISTRY[link.iconKey];
                      const IconComponent = entry?.Icon;
                      const isEditing = editingIndex === index;

                      if (isEditing) {
                        return (
                          <div
                            key={`${link.iconKey}-${index}`}
                            className="rounded-xl border border-sepia/30 dark:border-cream/30 bg-sepia/5 dark:bg-white/5 p-4 space-y-3"
                          >
                            <IconPickerForm
                              formState={editForm}
                              setFormState={setEditForm}
                            />
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              <button
                                type="button"
                                onClick={saveEdit}
                                className="text-xs px-3 py-1.5 rounded-lg border border-black/10 dark:border-white/10 text-ink dark:text-cream hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-1.5 transition-colors font-medium"
                              >
                                <Save size={13} />
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={cancelEdit}
                                className="text-xs px-3 py-1.5 rounded-lg border border-black/5 dark:border-white/5 text-ink-400 dark:text-ink-300 hover:border-black/10 dark:hover:border-white/10 hover:text-ink dark:hover:text-cream hover:bg-black/5 dark:hover:bg-white/5 transition-colors font-medium"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={`${link.iconKey}-${index}`}
                          className="group flex flex-wrap sm:flex-nowrap items-center gap-3 rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] px-3 py-2.5 hover:border-black/20 dark:hover:border-white/20 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                        >
                          <GripVertical
                            size={14}
                            className="text-ink-300 dark:text-ink-600 shrink-0 hidden sm:block"
                          />
                          <div
                            className="w-8 h-8 flex items-center justify-center shrink-0 rounded"
                            style={{ color: link.hoverColor }}
                          >
                            {IconComponent && (
                              <IconComponent className="w-5 h-5" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1 basis-[calc(100%-7rem)] sm:basis-auto">
                            <p className="font-body text-sm font-medium text-ink dark:text-cream truncate">
                              {link.label}
                            </p>
                            <p className="font-body text-[11px] text-ink-400 dark:text-ink-300 truncate">
                              {link.url}
                            </p>
                          </div>
                          <div className="flex items-center gap-0.5 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => moveSocialLink(index, "up")}
                              disabled={index === 0}
                              className="p-1.5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream disabled:opacity-20 disabled:pointer-events-none transition-colors"
                              title="Move up"
                            >
                              <ArrowUp size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveSocialLink(index, "down")}
                              disabled={index === socialLinks.length - 1}
                              className="p-1.5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream disabled:opacity-20 disabled:pointer-events-none transition-colors"
                              title="Move down"
                            >
                              <ArrowDown size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => startEditing(index)}
                              className="p-1.5 text-ink-400 dark:text-ink-300 hover:text-sepia dark:hover:text-cream transition-colors"
                              title="Edit"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteSocialLink(index)}
                              className="p-1.5 text-ink-400 dark:text-ink-300 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {showAddForm ? (
                    <div className="rounded-xl border border-dashed border-sepia/40 dark:border-cream/30 bg-black/5 dark:bg-white/5 p-4 space-y-3">
                      <p className="font-body text-xs tracking-widest uppercase text-ink-400 dark:text-ink-300">
                        New Social Link
                      </p>
                      <IconPickerForm
                        formState={addForm}
                        setFormState={setAddForm}
                      />
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={addSocialLink}
                            className="text-xs px-3 py-1.5 rounded-lg border border-black/10 dark:border-white/10 text-ink dark:text-cream hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-1.5 transition-colors font-medium"
                          >
                            <Plus size={13} />
                            Add Link
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setShowAddForm(false);
                              setAddForm(emptySocialLink());
                            }}
                            className="text-xs px-3 py-1.5 rounded-lg border border-black/5 dark:border-white/5 text-ink-400 dark:text-ink-300 hover:border-black/10 dark:hover:border-white/10 hover:text-ink dark:hover:text-cream hover:bg-black/5 dark:hover:bg-white/5 transition-colors font-medium"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setAddForm({
                          ...emptySocialLink(),
                          hoverColor:
                            DEFAULT_HOVER_COLORS[
                              socialLinks.length % DEFAULT_HOVER_COLORS.length
                            ],
                        });
                        setShowAddForm(true);
                      }}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-black/15 dark:border-white/15 text-ink-400 dark:text-ink-300 hover:border-sepia hover:bg-sepia/5 hover:text-sepia dark:hover:text-cream transition-colors font-body text-sm"
                    >
                      <Plus size={16} />
                      Add Social Link
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={saveSocialLinks}
                    disabled={savingLinks}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sepia text-white font-jakarta text-sm font-medium hover:bg-sepia-dark transition-all duration-200 shadow-md self-start sm:self-auto disabled:opacity-50"
                  >
                    {savingLinks ? (
                      <>
                        <div className="w-4 h-4 border border-cream/30 border-t-cream rounded-full animate-spin" />
                        Saving…
                      </>
                    ) : (
                      <>
                        <Save size={16} />
                        Save Social Links
                      </>
                    )}
                  </button>
                </div>
                </AdminAccordion>

                {/* Certificates & Awards */}
                <AdminAccordion
                  title="Certificates & Awards"
                  icon={<Award size={14} />}
                  badge={certificates.length}
                  open={linkSections.open.certificates}
                  onToggle={() => linkSections.toggle("certificates")}
                >
                <div className="admin-card border rounded-2xl backdrop-blur-md shadow-sm p-4 sm:p-6 space-y-5">

                  {certificates.length === 0 && !showAddCert && (
                    <p className="font-body text-sm text-ink-400 dark:text-ink-300 text-center py-6">
                      No certificates or awards yet. Add one below.
                    </p>
                  )}

                  <div className="space-y-2">
                    {certificates.map((cert, index) => {
                      const isEditing = editingCertIndex === index;

                      if (isEditing) {
                        return (
                          <div
                            key={cert.id || index}
                            className="rounded-xl border border-sepia/30 dark:border-cream/30 bg-sepia/5 dark:bg-white/5 p-4 space-y-3"
                          >
                            <CertFormFields
                              formState={editCertForm}
                              setFormState={setEditCertForm}
                              onUpload={(e) => handleCertImageUpload(e, "edit")}
                              uploadingCertImage={uploadingCertImage}
                              onPreview={setPreviewImage}
                            />
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              <button
                                type="button"
                                onClick={saveEditCert}
                                disabled={savingCerts}
                                className="text-xs px-3 py-1.5 rounded-lg border border-black/10 dark:border-white/10 text-ink dark:text-cream hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-1.5 transition-colors font-medium disabled:opacity-50"
                              >
                                <Save size={13} />
                                {savingCerts ? "Saving..." : "Save"}
                              </button>

                              <button
                                type="button"
                                onClick={() => setEditingCertIndex(null)}
                                className="text-xs px-3 py-1.5 rounded-lg border border-black/5 dark:border-white/5 text-ink-400 dark:text-ink-300 hover:border-black/10 dark:hover:border-white/10 hover:text-ink dark:hover:text-cream hover:bg-black/5 dark:hover:bg-white/5 transition-colors font-medium"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={cert.id || index}
                          className="group flex flex-wrap sm:flex-nowrap items-center gap-3 rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] px-3 py-2.5 hover:border-black/20 dark:hover:border-white/20 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                        >
                          <div className="group/thumb relative w-8 h-8 flex items-center justify-center shrink-0 rounded overflow-hidden bg-black/5 dark:bg-white/5">
                            {cert.imageUrl ? (
                              <>
                                <Image
                                  src={cert.imageUrl}
                                  alt=""
                                  width={32}
                                  height={32}
                                  className="object-cover w-8 h-8"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPreviewImage({
                                      url: cert.imageUrl!,
                                      title: cert.title,
                                    })
                                  }
                                  className="absolute inset-0 flex items-center justify-center bg-ink/0 group-hover/thumb:bg-ink/50 opacity-0 group-hover/thumb:opacity-100 transition-all"
                                  title="View full image"
                                >
                                  <Eye size={12} className="text-white" />
                                </button>
                              </>
                            ) : (
                              <Award size={14} className="text-sepia" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1 basis-[calc(100%-7rem)] sm:basis-auto">
                            <p className="font-body text-sm font-medium text-ink dark:text-cream truncate">
                              {cert.title}
                            </p>
                            <p className="font-body text-[11px] text-ink-400 dark:text-ink-300 truncate">
                              {cert.issuer || "—"}
                              {cert.dateAwarded &&
                                ` · ${new Date(cert.dateAwarded).getFullYear()}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-0.5 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => moveCert(index, "up")}
                              disabled={index === 0}
                              className="p-1.5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream disabled:opacity-20 disabled:pointer-events-none transition-colors"
                              title="Move up"
                            >
                              <ArrowUp size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveCert(index, "down")}
                              disabled={index === certificates.length - 1}
                              className="p-1.5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream disabled:opacity-20 disabled:pointer-events-none transition-colors"
                              title="Move down"
                            >
                              <ArrowDown size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => startEditingCert(index)}
                              className="p-1.5 text-ink-400 dark:text-ink-300 hover:text-sepia dark:hover:text-cream transition-colors"
                              title="Edit"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setPendingCertDelete(index)}
                              className="p-1.5 text-ink-400 dark:text-ink-300 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {showAddCert ? (
                    <div className="rounded-xl border border-dashed border-sepia/40 dark:border-cream/30 bg-black/5 dark:bg-white/5 p-4 space-y-3">
                      <p className="font-body text-xs tracking-widest uppercase text-ink-400 dark:text-ink-300">
                        New Certificate / Award
                      </p>
                      <CertFormFields
                        formState={addCertForm}
                        setFormState={setAddCertForm}
                        onUpload={(e) => handleCertImageUpload(e, "add")}
                        uploadingCertImage={uploadingCertImage}
                        onPreview={setPreviewImage}
                      />
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={addCertificate}
                            disabled={savingCerts}
                            className="text-xs px-3 py-1.5 rounded-lg border border-black/10 dark:border-white/10 text-ink dark:text-cream hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-1.5 transition-colors font-medium disabled:opacity-50"
                          >
                            <Plus size={13} />
                            {savingCerts ? "Adding..." : "Add Certificate"}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setShowAddCert(false);
                              setAddCertForm(emptyCert());
                            }}
                            className="text-xs px-3 py-1.5 rounded-lg border border-black/5 dark:border-white/5 text-ink-400 dark:text-ink-300 hover:border-black/10 dark:hover:border-white/10 hover:text-ink dark:hover:text-cream hover:bg-black/5 dark:hover:bg-white/5 transition-colors font-medium"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowAddCert(true)}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-black/15 dark:border-white/15 text-ink-400 dark:text-ink-300 hover:border-sepia hover:bg-sepia/5 hover:text-sepia dark:hover:text-cream transition-colors font-body text-sm"
                    >
                      <Plus size={16} />
                      Add Certificate or Award
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={saveCertificateOrder}
                    disabled={savingCerts}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sepia text-white font-jakarta text-sm font-medium hover:bg-sepia-dark transition-all duration-200 shadow-md self-start sm:self-auto disabled:opacity-50"
                  >
                    {savingCerts ? (
                      <>
                        <div className="w-4 h-4 border border-cream/30 border-t-cream rounded-full animate-spin" />
                        Saving…
                      </>
                    ) : (
                      <>
                        <Save size={16} />
                        Save Certificates & Awards
                      </>
                    )}
                  </button>
                </div>
                </AdminAccordion>

                {/* Contact Page Content */}
                <AdminAccordion
                  title="Contact Page Content"
                  icon={<MessageSquare size={14} />}
                  open={linkSections.open.contact}
                  onToggle={() => linkSections.toggle("contact")}
                >
                <div className="admin-card border rounded-2xl backdrop-blur-md shadow-sm p-4 sm:p-6 space-y-5">
                  <p className="font-body text-xs text-ink-400 dark:text-ink-300">
                    The two blurbs shown next to the contact form on the public
                    Contact page.
                  </p>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">&ldquo;Get in Touch&rdquo; Heading</label>
                      <input
                        type="text"
                        value={form.contactHeading}
                        onChange={(e) =>
                          setForm({ ...form, contactHeading: e.target.value })
                        }
                        className="w-full px-4 py-2.5 rounded-xl admin-input border text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors text-sm"
                        placeholder="Get in Touch"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">&ldquo;Get in Touch&rdquo; Text</label>
                      <textarea
                        rows={3}
                        value={form.contactIntro}
                        onChange={(e) =>
                          setForm({ ...form, contactIntro: e.target.value })
                        }
                        className="w-full px-4 py-2.5 rounded-xl admin-input border text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors text-sm resize-y"
                        placeholder="Whether you're interested in acquiring a piece, commissioning an original work, or simply want to say hello — I'd love to hear from you."
                      />
                    </div>
                  </div>

                  <div className="space-y-3 pt-2 border-t border-black/10 dark:border-white/10">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">
                        Booking Heading
                      </label>
                      <input
                        type="text"
                        value={form.commissionHeading}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            commissionHeading: e.target.value,
                          })
                        }
                        className="w-full px-4 py-2.5 rounded-xl admin-input border text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors text-sm"
                        placeholder="Booking"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">Booking Text</label>
                      <textarea
                        rows={3}
                        value={form.commissionIntro}
                        onChange={(e) =>
                          setForm({ ...form, commissionIntro: e.target.value })
                        }
                        className="w-full px-4 py-2.5 rounded-xl admin-input border text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors text-sm resize-y"
                        placeholder="For gigs, festivals and private shows, tell us the date, the venue and the set length you have in mind."
                      />
                    </div>
                  </div>

                  {saveProfileBtn}
                </div>
                </AdminAccordion>

                {/* Artist Skills */}
                <AdminAccordion
                  title="Genres / Tags"
                  icon={<Sparkles size={14} />}
                  badge={artistSkills.length}
                  open={linkSections.open.skills}
                  onToggle={() => linkSections.toggle("skills")}
                >
                <div className="admin-card border rounded-2xl backdrop-blur-md shadow-sm p-4 sm:p-6 space-y-5">
                  {artistSkills.length === 0 && !showAddSkill && (
                    <p className="font-body text-sm text-ink-400 dark:text-ink-300 text-center py-6">
                      No skills yet. Add one below.
                    </p>
                  )}

                  {/* A skill is only a name and a swatch, so one per row made
                      this the tallest card in the tab for no gain. Two/three
                      across keeps the same rows, a third of the height. The
                      open editor still spans the full width — it carries real
                      inputs and shouldn't be squeezed into a column. */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2 items-start">
                    {artistSkills.map((skill, index) => {
                      const isEditing = editingSkillIndex === index;

                      if (isEditing) {
                        return (
                          <div
                            key={`skill-edit-${index}`}
                            className="sm:col-span-2 xl:col-span-3 rounded-xl border border-sepia/30 dark:border-cream/30 bg-sepia/5 dark:bg-white/5 p-4 space-y-3"
                          >
                            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
                              <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">Skill Name</label>
                                <input
                                  type="text"
                                  value={editSkillForm.name}
                                  onChange={(e) =>
                                    setEditSkillForm({
                                      ...editSkillForm,
                                      name: e.target.value,
                                    })
                                  }
                                  className="w-full px-4 py-2.5 rounded-xl admin-input border text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors text-sm"
                                  placeholder="Digital Illustration"
                                  autoFocus
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">Hover Color</label>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="color"
                                    value={editSkillForm.hoverColor}
                                    onChange={(e) =>
                                      setEditSkillForm({
                                        ...editSkillForm,
                                        hoverColor: e.target.value,
                                      })
                                    }
                                    className="w-10 h-10 rounded border border-black/10 dark:border-white/15 cursor-pointer bg-transparent shrink-0"
                                  />
                                  <input
                                    type="text"
                                    value={editSkillForm.hoverColor}
                                    onChange={(e) =>
                                      setEditSkillForm({
                                        ...editSkillForm,
                                        hoverColor: e.target.value,
                                      })
                                    }
                                    className="w-24 px-4 py-2.5 rounded-xl admin-input border text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors text-sm font-mono text-xs"
                                    placeholder="#FFE135"
                                  />
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <SkillPreviewChip
                                name={editSkillForm.name}
                                color={editSkillForm.hoverColor}
                              />
                              <span className="font-body text-[10px] text-ink-400 dark:text-ink-300">
                                preview
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              <button
                                type="button"
                                onClick={saveEditSkill}
                                className="text-xs px-3 py-1.5 rounded-lg border border-black/10 dark:border-white/10 text-ink dark:text-cream hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-1.5 transition-colors font-medium"
                              >
                                <Save size={13} />
                                Save
                              </button>

                              <button
                                type="button"
                                onClick={() => setEditingSkillIndex(null)}
                                className="text-xs px-3 py-1.5 rounded-lg border border-black/5 dark:border-white/5 text-ink-400 dark:text-ink-300 hover:border-black/10 dark:hover:border-white/10 hover:text-ink dark:hover:text-cream hover:bg-black/5 dark:hover:bg-white/5 transition-colors font-medium"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={`skill-${index}`}
                          className="group flex flex-nowrap items-center gap-2 rounded-xl border border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] px-3 py-2.5 hover:border-black/20 dark:hover:border-white/20 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                        >
                          <div
                            className="w-3 h-3 rounded-full shrink-0 ring-1 ring-black/10 dark:ring-white/10"
                            style={{ backgroundColor: skill.hoverColor }}
                          />
                          <div className="min-w-0 flex-1 flex">
                            <SkillPreviewChip name={skill.name} color={skill.hoverColor} />
                          </div>
                          <div className="flex items-center gap-0.5 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => moveArtistSkill(index, "up")}
                              disabled={index === 0}
                              className="p-1.5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream disabled:opacity-20 disabled:pointer-events-none transition-colors"
                              title="Move up"
                            >
                              <ArrowUp size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveArtistSkill(index, "down")}
                              disabled={index === artistSkills.length - 1}
                              className="p-1.5 text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream disabled:opacity-20 disabled:pointer-events-none transition-colors"
                              title="Move down"
                            >
                              <ArrowDown size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => startEditingSkill(index)}
                              className="p-1.5 text-ink-400 dark:text-ink-300 hover:text-sepia dark:hover:text-cream transition-colors"
                              title="Edit"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteArtistSkill(index)}
                              className="p-1.5 text-ink-400 dark:text-ink-300 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {showAddSkill ? (
                    <div className="rounded-xl border border-dashed border-sepia/40 dark:border-cream/30 bg-black/5 dark:bg-white/5 p-4 space-y-3">
                      <p className="font-body text-xs tracking-widest uppercase text-ink-400 dark:text-ink-300">
                        New Skill
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">Skill Name</label>
                          <input
                            type="text"
                            value={addSkillForm.name}
                            onChange={(e) =>
                              setAddSkillForm({
                                ...addSkillForm,
                                name: e.target.value,
                              })
                            }
                            className="w-full px-4 py-2.5 rounded-xl admin-input border text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors text-sm"
                            placeholder="Digital Illustration"
                            autoFocus
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-300 mb-2">Hover Color</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={addSkillForm.hoverColor}
                              onChange={(e) =>
                                setAddSkillForm({
                                  ...addSkillForm,
                                  hoverColor: e.target.value,
                                })
                              }
                              className="w-10 h-10 rounded border border-black/10 dark:border-white/15 cursor-pointer bg-transparent shrink-0"
                            />
                            <input
                              type="text"
                              value={addSkillForm.hoverColor}
                              onChange={(e) =>
                                setAddSkillForm({
                                  ...addSkillForm,
                                  hoverColor: e.target.value,
                                })
                              }
                              className="w-24 px-4 py-2.5 rounded-xl admin-input border text-ink dark:text-cream placeholder-ink-400 focus:outline-none focus:border-sepia transition-colors text-sm font-mono text-xs"
                              placeholder="#FFE135"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <SkillPreviewChip
                          name={addSkillForm.name}
                          color={addSkillForm.hoverColor}
                        />
                        <span className="font-body text-[10px] text-ink-400 dark:text-ink-300">
                          preview
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={addArtistSkill}
                          className="text-xs px-3 py-1.5 rounded-lg border border-black/10 dark:border-white/10 text-ink dark:text-cream hover:bg-black/5 dark:hover:bg-white/5 flex items-center gap-1.5 transition-colors font-medium"
                        >
                          <Plus size={13} />
                          Add Skill
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowAddSkill(false);
                            setAddSkillForm(emptySkill());
                          }}
                          className="text-xs px-3 py-1.5 rounded-lg border border-black/5 dark:border-white/5 text-ink-400 dark:text-ink-300 hover:border-black/10 dark:hover:border-white/10 hover:text-ink dark:hover:text-cream hover:bg-black/5 dark:hover:bg-white/5 transition-colors font-medium"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setAddSkillForm({
                          ...emptySkill(),
                          hoverColor:
                            DEFAULT_HOVER_COLORS[
                              artistSkills.length % DEFAULT_HOVER_COLORS.length
                            ],
                        });
                        setShowAddSkill(true);
                      }}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-black/15 dark:border-white/15 text-ink-400 dark:text-ink-300 hover:border-sepia hover:bg-sepia/5 hover:text-sepia dark:hover:text-cream transition-colors font-body text-sm"
                    >
                      <Plus size={16} />
                      Add Skill
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={saveArtistSkills}
                    disabled={savingSkills}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sepia text-white font-jakarta text-sm font-medium hover:bg-sepia-dark transition-all duration-200 shadow-md self-start sm:self-auto disabled:opacity-50"
                  >
                    {savingSkills ? (
                      <>
                        <div className="w-4 h-4 border border-cream/30 border-t-cream rounded-full animate-spin" />
                        Saving…
                      </>
                    ) : (
                      <>
                        <Save size={16} />
                        Save Genres / Tags
                      </>
                    )}
                  </button>
                </div>
                </AdminAccordion>
              </div>
            )}
          </div>
        </div>
      </form>

      <AdminConfirmModal
        open={pendingCertDelete !== null}
        title={
          pendingCertDelete !== null && certificates[pendingCertDelete]
            ? `Remove "${certificates[pendingCertDelete].title}"?`
            : ""
        }
        description="The certificate and its image are removed straight away — this one doesn't wait for Save."
        confirmLabel="Remove"
        loading={savingCerts}
        onConfirm={() => pendingCertDelete !== null && deleteCertificate(pendingCertDelete)}
        onCancel={() => setPendingCertDelete(null)}
      />

      <UnsavedChangesBar
        dirty={isDirty}
        what="profile"
        saving={loading}
        onSave={saveProfile}
        onReset={resetForm}
      />

      {/* FULL IMAGE PREVIEW LIGHTBOX */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
          onClick={() => setPreviewImage(null)}
        >
          <button
            onClick={() => setPreviewImage(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <X size={22} />
          </button>
          <div
            className="relative w-full max-w-2xl flex flex-col items-center gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative w-full h-[60vh] sm:h-[65vh]">
              <Image
                src={previewImage.url}
                alt={previewImage.title || "Full image preview"}
                fill
                className="object-contain"
                priority
              />
            </div>
            {previewImage.title && (
              <p className="text-cream font-jakarta text-sm text-center">{previewImage.title}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
