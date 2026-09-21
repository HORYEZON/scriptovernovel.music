"use client";

import { cn } from "@/lib/utils";
import { Landmark, Image as ImageIcon, Sparkles, User, StickyNote, ArrowUpToLine, ShoppingBag, BookOpen, Gamepad2, Shirt, type LucideProps, Disc3 } from "lucide-react";
import type { ForwardRefExoticComponent, RefAttributes } from "react";
import type { MuseumRoomType } from "@/types";

// ─── Keyframes ─────────────────────────────────────────────────────────────────
// Injected via a <style> tag so the iris-scroll and aura-pulse animations
// work without touching globals.css. React's style deduplication ensures
// this runs once per document even if multiple FeaturedDoor instances exist.
const DOOR_KEYFRAMES = `
  @keyframes museum-iris-scroll {
    0%   { background-position: 0% 50%; }
    100% { background-position: 300% 50%; }
  }
  @keyframes museum-aura-pulse {
    0%, 100% { opacity: 0.45; transform: scale(1); }
    50%       { opacity: 0.80; transform: scale(1.10); }
  }
`;

// ─── Icon + label maps ─────────────────────────────────────────────────────────
type LucideIcon = ForwardRefExoticComponent<Omit<LucideProps, "ref"> & RefAttributes<SVGSVGElement>>;
const DOOR_ICON: Record<MuseumRoomType, LucideIcon> = {
  MAIN_HALL: Landmark,
  GALLERY: ImageIcon,
  SPECIAL_EXHIBITION: Sparkles,
  ABOUT: User,
  FREEDOM_WALL: StickyNote,
  STAIRS: ArrowUpToLine,
  SERVICES: ShoppingBag,
  STORIES: BookOpen,
  ARCADE: Gamepad2,
  COSPLAY: Shirt,
  VINYL: Disc3,
};

const TYPE_LABEL: Record<MuseumRoomType, string> = {
  MAIN_HALL: "MAIN HALL",
  GALLERY: "GALLERY",
  SPECIAL_EXHIBITION: "SPECIAL EXHIBITION",
  ABOUT: "ARTIST STUDIO",
  FREEDOM_WALL: "FREEDOM WALL",
  STAIRS: "STAIRS",
  SERVICES: "SERVICES",
  STORIES: "STORIES",
  ARCADE: "ARCADE",
  COSPLAY: "COSPLAY",
  VINYL: "VINYL ROOM",
};

// ─── Public API ────────────────────────────────────────────────────────────────
export interface MuseumDoorProps {
  title: string;
  /** Padded ordinal shown in the corner: pass the room's 1-based position. */
  roomNumber?: number | string;
  roomType: MuseumRoomType;
  /** Enables the iridescent About-ScriptOverNovel treatment. */
  isFeatured?: boolean;
  /** Visitor is currently in this room. */
  isCurrent?: boolean;
  artworkCount?: number;
  /**
   * "portrait" — standard tall card (default).
   * "landscape" — wide horizontal banner, used when the featured door spans
   *  a full row and needs a side-by-side panel+info layout.
   */
  layout?: "portrait" | "landscape";
  onClick?: () => void;
  className?: string;
}

export function MuseumDoor({
  title,
  roomNumber,
  roomType,
  isFeatured = false,
  isCurrent = false,
  artworkCount,
  layout = "portrait",
  onClick,
  className,
}: MuseumDoorProps) {
  if (isFeatured) {
    return layout === "landscape" ? (
      <FeaturedDoorLandscape
        title={title}
        isCurrent={isCurrent}
        onClick={onClick}
        className={className}
      />
    ) : (
      <FeaturedDoorPortrait
        title={title}
        isCurrent={isCurrent}
        onClick={onClick}
        className={className}
      />
    );
  }

  return <StandardDoor
    title={title}
    roomNumber={roomNumber}
    roomType={roomType}
    isCurrent={isCurrent}
    artworkCount={artworkCount}
    onClick={onClick}
    className={className}
  />;
}

// ─── Standard Door ─────────────────────────────────────────────────────────────
// Minimalist brushed-titanium architectural door. The glass panel fills the
// upper portion; a backlit rim glows at the base and brightens on hover; a
// reflection sweep slides through the glass on hover; two tiny CSS rectangles
// on the right edge of the glass panel read as a door handle.
function StandardDoor({
  title,
  roomNumber,
  roomType,
  isCurrent = false,
  artworkCount,
  onClick,
  className,
}: {
  title: string;
  roomNumber?: number | string;
  roomType: MuseumRoomType;
  isCurrent?: boolean;
  artworkCount?: number;
  onClick?: () => void;
  className?: string;
}) {
  const Icon = DOOR_ICON[roomType] ?? ImageIcon;
  const ordinal = roomNumber != null ? String(roomNumber).padStart(2, "0") : null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        // Layout — flex column so the glass panel flexes to fill height
        "group relative flex flex-col overflow-hidden rounded-[2px]",
        "transition-all duration-300 ease-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-black",
        className
      )}
      style={{
        // Warm near-black with a very slight diagonal gradient for the
        // brushed-titanium illusion (not a flat single tone).
        background: "linear-gradient(170deg, #111010 0%, #0c0b0a 40%, #0e0d0c 100%)",
        boxShadow: isCurrent
          ? "0 0 0 1px rgba(228,222,210,0.24), 0 8px 32px rgba(0,0,0,0.65), inset 0 0 28px rgba(228,222,210,0.03)"
          : "0 0 0 1px rgba(228,222,210,0.09), 0 6px 20px rgba(0,0,0,0.55)",
      }}
    >
      {/* Outer architectural trim */}
      <div
        className="absolute pointer-events-none"
        style={{
          inset: "4px",
          borderRadius: "1px",
          border: "1px solid rgba(228,222,210,0.08)",
        }}
      />
      {/* Inner trim — recessed second ring */}
      <div
        className="absolute pointer-events-none"
        style={{
          inset: "7px",
          borderRadius: "1px",
          border: "1px solid rgba(228,222,210,0.04)",
        }}
      />

      {/* Frosted glass panel — fills all space between the trim and footer */}
      <div
        className="relative flex-1 mx-3 mt-3 mb-0 overflow-hidden"
        style={{
          borderRadius: "1px",
          background:
            "linear-gradient(180deg, rgba(240,235,222,0.055) 0%, rgba(240,235,222,0.020) 100%)",
          // All four borders at different weights to suggest light-catching depth
          borderTop: "1px solid rgba(240,235,222,0.11)",
          borderLeft: "1px solid rgba(240,235,222,0.07)",
          borderRight: "1px solid rgba(240,235,222,0.04)",
          borderBottom: "1px solid rgba(240,235,222,0.06)",
          // Very slight inset shadow to push the panel "into" the frame
          boxShadow: "inset 0 2px 6px rgba(0,0,0,0.35)",
        }}
      >
        {/* Glass reflection sweep — slides in on hover */}
        <div
          className="absolute inset-0 pointer-events-none -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out"
          style={{
            background:
              "linear-gradient(112deg, transparent 22%, rgba(240,235,222,0.065) 45%, rgba(240,235,222,0.045) 55%, transparent 78%)",
          }}
        />

        {/* Room-type icon, centered in the glass */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className={cn(
              "rounded-full p-2.5 transition-all duration-300",
              isCurrent
                ? "bg-white/14 text-white/90"
                : "bg-white/[0.05] text-white/32 group-hover:bg-white/[0.09] group-hover:text-white/62"
            )}
          >
            <Icon size={18} strokeWidth={1.4} />
          </div>
        </div>

        {/* Door handle — two small bars on the right edge of the glass.
            Sized and spaced to read as an actual architectural pull handle
            rather than a UI element. */}
        <div
          className="absolute right-[8px] top-1/2 -translate-y-1/2 flex flex-col gap-[3px] pointer-events-none transition-opacity duration-300"
          style={{ opacity: isCurrent ? 0.38 : 0.22 }}
        >
          <div
            className="w-[2.5px] rounded-full group-hover:opacity-60 transition-opacity duration-300"
            style={{ height: "9px", background: "rgba(228,222,210,0.75)" }}
          />
          <div
            className="w-[2.5px] rounded-full group-hover:opacity-50 transition-opacity duration-300"
            style={{ height: "5px", background: "rgba(228,222,210,0.55)" }}
          />
        </div>
      </div>

      {/* Ambient backlit rim — always-on layer */}
      <div
        className="absolute inset-x-0 bottom-0 pointer-events-none"
        style={{
          height: "72px",
          background: isCurrent
            ? "linear-gradient(to top, rgba(240,235,222,0.09) 0%, transparent 100%)"
            : "linear-gradient(to top, rgba(240,235,222,0.042) 0%, transparent 100%)",
        }}
      />
      {/* Rim — hover amplification */}
      <div
        className="absolute inset-x-0 bottom-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          height: "52px",
          background:
            "linear-gradient(to top, rgba(240,235,222,0.12) 0%, transparent 100%)",
        }}
      />

      {/* Footer: divider + labels */}
      <div className="relative z-10 px-3 pb-3 pt-2.5">
        {/* Backlit divider */}
        <div
          className="w-full h-px mb-2"
          style={{
            background: isCurrent
              ? "linear-gradient(90deg, transparent, rgba(228,222,210,0.30), transparent)"
              : "linear-gradient(90deg, transparent, rgba(228,222,210,0.12), transparent)",
          }}
        />

        {/* Type / ordinal label */}
        <p className="font-mono text-[8.5px] tracking-[0.22em] uppercase mb-1 transition-colors duration-300 group-hover:text-white/45"
          style={{ color: "rgba(228,222,210,0.28)" }}>
          {ordinal ? `${ordinal} · ${TYPE_LABEL[roomType]}` : TYPE_LABEL[roomType]}
        </p>

        {/* Room name — shifts up 1px on hover for a subtle press-to-open feel */}
        <p
          className={cn(
            "font-grotesk text-[13px] font-medium leading-tight transition-all duration-300 group-hover:-translate-y-px",
            isCurrent ? "text-white" : "text-white/62 group-hover:text-white/88"
          )}
        >
          {title}
        </p>

        {/* Artwork count */}
        {artworkCount !== undefined && roomType !== "ABOUT" && (
          <p
            className="font-body text-[10px] mt-0.5 transition-colors duration-300 group-hover:text-white/36"
            style={{ color: "rgba(228,222,210,0.22)" }}
          >
            {artworkCount} {artworkCount === 1 ? "work" : "works"}
          </p>
        )}
      </div>

      {/* "You are here" indicator */}
      {isCurrent && (
        <div className="absolute top-[10px] right-[10px]">
          <div className="relative">
            <div
              className="w-[5px] h-[5px] rounded-full"
              style={{ background: "rgba(228,222,210,0.75)" }}
            />
            <div
              className="absolute inset-0 rounded-full animate-ping"
              style={{ background: "rgba(228,222,210,0.30)" }}
            />
          </div>
        </div>
      )}
    </button>
  );
}

// ─── Featured Door: Portrait ────────────────────────────────────────────────────
// The About ScriptOverNovel door in its standard portrait orientation. A prismatic
// gradient-border (via CSS mask), continuously scrolling iridescent shimmer
// in the glass, a pulsing violet aura, and gradient text make this door
// immediately recognisable as a different class of destination.
function FeaturedDoorPortrait({
  title,
  isCurrent = false,
  onClick,
  className,
}: {
  title: string;
  isCurrent?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <>
      {/* Keyframes injected once — React 18 deduplicates identical <style> tags */}
      <style>{DOOR_KEYFRAMES}</style>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "group relative flex flex-col overflow-hidden rounded-[2px]",
          "transition-all duration-500 ease-out",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black",
          className
        )}
        style={{
          background: "linear-gradient(155deg, #09080f 0%, #0d0b17 45%, #0a0912 100%)",
          boxShadow: isCurrent
            ? "0 0 0 1px rgba(148,108,255,0.28), 0 8px 40px rgba(0,0,0,0.72), inset 0 0 32px rgba(100,60,220,0.12)"
            : "0 0 0 1px rgba(124,92,252,0.15), 0 8px 28px rgba(0,0,0,0.60), inset 0 0 20px rgba(80,40,180,0.07)",
        }}
      >
        {/* Iridescent gradient border — the mask trick gives a genuine
            prismatic 1px edge rather than a glow substitute. */}
        <div
          className="absolute pointer-events-none"
          style={{
            inset: "4px",
            borderRadius: "1px",
            padding: "1px",
            background:
              "linear-gradient(135deg, #7c5cfc 0%, #3ecfcf 33%, #e86dc3 66%, #ffc047 100%)",
            WebkitMask:
              "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
          }}
        />
        {/* Second trim ring, inside the iris border */}
        <div
          className="absolute pointer-events-none"
          style={{
            inset: "7px",
            borderRadius: "1px",
            border: "1px solid rgba(180,140,255,0.08)",
          }}
        />

        {/* Deep ambient fluid fill — barely visible at rest, glows on hover */}
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-700"
          style={{
            opacity: "0.16",
            background:
              "conic-gradient(from 240deg at 50% 70%, #7c5cfc, #3ecfcf, #e86dc3, #ffc047, #7c5cfc)",
            filter: "blur(28px)",
          }}
        >
          {/* This element's parent controls opacity via inline style; the
              group-hover scale is applied to an inner div so we can keep the
              opacity transition on the outer element cleanly. */}
        </div>
        <div
          className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-700"
          style={{
            background:
              "conic-gradient(from 240deg at 50% 70%, #7c5cfc, #3ecfcf, #e86dc3, #ffc047, #7c5cfc)",
            filter: "blur(28px)",
            opacity: "0.10",
          }}
        />

        {/* Glass panel */}
        <div
          className="relative flex-1 mx-3 mt-3 mb-0 overflow-hidden"
          style={{
            borderRadius: "1px",
            background:
              "linear-gradient(180deg, rgba(180,140,255,0.075) 0%, rgba(80,180,255,0.040) 100%)",
            borderTop: "1px solid rgba(200,160,255,0.18)",
            borderLeft: "1px solid rgba(180,140,255,0.13)",
            borderRight: "1px solid rgba(120,200,255,0.09)",
            borderBottom: "1px solid rgba(160,120,255,0.08)",
            boxShadow: "inset 0 2px 8px rgba(0,0,0,0.40)",
          }}
        >
          {/* Continuously scrolling iridescent shimmer — always on, subtle */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "linear-gradient(110deg, #7c5cfc 0%, #3ecfcf 20%, #7c5cfc 40%, #e86dc3 60%, #3ecfcf 80%, #7c5cfc 100%)",
              backgroundSize: "300% 100%",
              animation: "museum-iris-scroll 7s linear infinite",
              opacity: 0.085,
              mixBlendMode: "screen",
            }}
          />

          {/* Hover sweep — a brighter pass that adds a "flash" on interaction */}
          <div
            className="absolute inset-0 pointer-events-none -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out"
            style={{
              background:
                "linear-gradient(112deg, transparent 20%, rgba(180,140,255,0.14) 46%, rgba(120,200,255,0.10) 54%, transparent 80%)",
            }}
          />

          {/* Pulse aura — soft radial glow that breathes behind the icon */}
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <div
              style={{
                width: "52px",
                height: "52px",
                borderRadius: "9999px",
                background:
                  "radial-gradient(circle, rgba(130,80,255,0.44) 0%, rgba(60,155,255,0.18) 55%, transparent 100%)",
                filter: "blur(10px)",
                animation: "museum-aura-pulse 3.6s ease-in-out infinite",
              }}
            />
          </div>

          {/* Icon with glowing surround */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="rounded-full p-3 transition-transform duration-500 group-hover:scale-[1.12]"
              style={{
                background:
                  "linear-gradient(135deg, rgba(100,55,220,0.48), rgba(40,140,220,0.32))",
                boxShadow:
                  "0 0 20px rgba(130,70,255,0.38), inset 0 0 12px rgba(255,255,255,0.06)",
                border: "1px solid rgba(180,130,255,0.26)",
              }}
            >
              <User size={20} strokeWidth={1.4} className="text-white/85" />
            </div>
          </div>

          {/* Handle detail — tinted violet to match the door's palette */}
          <div
            className="absolute right-[8px] top-1/2 -translate-y-1/2 flex flex-col gap-[3px] pointer-events-none transition-opacity duration-300"
            style={{ opacity: isCurrent ? 0.35 : 0.18 }}
          >
            <div
              className="rounded-full"
              style={{
                width: "2.5px",
                height: "9px",
                background: "rgba(180,140,255,0.80)",
              }}
            />
            <div
              className="rounded-full"
              style={{
                width: "2.5px",
                height: "5px",
                background: "rgba(180,140,255,0.60)",
              }}
            />
          </div>
        </div>

        {/* Iridescent bottom glow */}
        <div
          className="absolute inset-x-0 bottom-0 pointer-events-none"
          style={{
            height: "80px",
            background:
              "linear-gradient(to top, rgba(100,60,220,0.22) 0%, rgba(60,120,200,0.08) 55%, transparent 100%)",
          }}
        />
        <div
          className="absolute inset-x-0 bottom-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{
            height: "50px",
            background:
              "linear-gradient(to top, rgba(130,75,255,0.34) 0%, transparent 100%)",
          }}
        />

        {/* Footer */}
        <div className="relative z-10 px-3 pb-3 pt-2.5">
          {/* Iridescent divider */}
          <div
            className="w-full h-px mb-2"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(160,110,255,0.52), rgba(80,195,255,0.30), transparent)",
            }}
          />

          <p
            className="font-mono text-[8.5px] tracking-[0.22em] uppercase mb-1"
            style={{ color: "rgba(190,150,255,0.45)" }}
          >
            ARTIST STUDIO
          </p>

          {/* Gradient title — gradient text is deliberate here, not decorative:
              it signals this door is a different category from the others. */}
          <p
            className="font-grotesk text-[13px] font-medium leading-tight transition-transform duration-300 group-hover:-translate-y-px"
            style={{
              background: "linear-gradient(90deg, #cdb4ff, #a8d8ff, #f2b0e0)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            {title}
          </p>

          <p
            className="font-body text-[10px] mt-0.5"
            style={{ color: "rgba(170,130,255,0.32)" }}
          >
            Meet the artist
          </p>
        </div>

        {/* "You are here" dot — violet variant */}
        {isCurrent && (
          <div className="absolute top-[10px] right-[10px]">
            <div className="relative">
              <div
                className="w-[5px] h-[5px] rounded-full"
                style={{ background: "rgba(190,150,255,0.88)" }}
              />
              <div
                className="absolute inset-0 rounded-full animate-ping"
                style={{ background: "rgba(160,110,255,0.38)" }}
              />
            </div>
          </div>
        )}

        {/* "Featured" badge */}
        <div className="absolute top-[10px] left-[10px]">
          <span
            className="font-mono text-[7.5px] tracking-[0.14em] uppercase px-1.5 py-0.5 rounded-[2px]"
            style={{
              background: "rgba(100,60,200,0.22)",
              border: "1px solid rgba(160,110,255,0.18)",
              color: "rgba(200,165,255,0.55)",
            }}
          >
            Featured
          </span>
        </div>
      </button>
    </>
  );
}

// ─── Featured Door: Landscape ──────────────────────────────────────────────────
// The About ScriptOverNovel door when spanning the full width of a map grid row.
// The glass panel moves to the left (~120px column) and the room info fills
// the right side — the same materials and effects, different composition.
function FeaturedDoorLandscape({
  title,
  isCurrent = false,
  onClick,
  className,
}: {
  title: string;
  isCurrent?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <>
      <style>{DOOR_KEYFRAMES}</style>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "group relative flex flex-row items-stretch overflow-hidden rounded-[2px] w-full",
          "transition-all duration-500 ease-out",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black",
          className
        )}
        style={{
          minHeight: "110px",
          background:
            "linear-gradient(135deg, #09080f 0%, #0d0b17 50%, #0a0912 100%)",
          boxShadow: isCurrent
            ? "0 0 0 1px rgba(148,108,255,0.27), 0 8px 40px rgba(0,0,0,0.70), inset 0 0 28px rgba(100,60,220,0.10)"
            : "0 0 0 1px rgba(124,92,252,0.14), 0 6px 24px rgba(0,0,0,0.56), inset 0 0 18px rgba(80,40,180,0.06)",
        }}
      >
        {/* Iridescent border */}
        <div
          className="absolute pointer-events-none"
          style={{
            inset: "4px",
            borderRadius: "1px",
            padding: "1px",
            background:
              "linear-gradient(135deg, #7c5cfc 0%, #3ecfcf 33%, #e86dc3 66%, #ffc047 100%)",
            WebkitMask:
              "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
          }}
        />

        {/* Ambient fill */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.14] group-hover:opacity-[0.24] transition-opacity duration-700"
          style={{
            background:
              "conic-gradient(from 200deg at 18% 50%, #7c5cfc, #3ecfcf, #e86dc3, #ffc047, #7c5cfc)",
            filter: "blur(32px)",
          }}
        />

        {/* Left glass panel — icon column */}
        <div
          className="relative shrink-0 flex items-center justify-center overflow-hidden"
          style={{
            width: "108px",
            margin: "10px 0 10px 10px",
            borderRadius: "1px",
            background:
              "linear-gradient(180deg, rgba(180,140,255,0.07) 0%, rgba(80,180,255,0.04) 100%)",
            borderTop: "1px solid rgba(200,160,255,0.17)",
            borderLeft: "1px solid rgba(180,140,255,0.12)",
            borderRight: "1px solid rgba(120,200,255,0.08)",
            borderBottom: "1px solid rgba(160,120,255,0.07)",
            boxShadow: "inset 0 2px 6px rgba(0,0,0,0.38)",
          }}
        >
          {/* Iris scroll */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "linear-gradient(110deg, #7c5cfc 0%, #3ecfcf 20%, #7c5cfc 40%, #e86dc3 60%, #3ecfcf 80%, #7c5cfc 100%)",
              backgroundSize: "300% 100%",
              animation: "museum-iris-scroll 7s linear infinite",
              opacity: 0.08,
              mixBlendMode: "screen",
            }}
          />
          {/* Hover sweep */}
          <div
            className="absolute inset-0 pointer-events-none -translate-x-full group-hover:translate-x-full transition-transform duration-900 ease-in-out"
            style={{
              background:
                "linear-gradient(112deg, transparent 20%, rgba(180,140,255,0.14) 48%, transparent 76%)",
            }}
          />
          {/* Pulse aura */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "9999px",
                background:
                  "radial-gradient(circle, rgba(130,80,255,0.42) 0%, transparent 70%)",
                filter: "blur(9px)",
                animation: "museum-aura-pulse 3.6s ease-in-out infinite",
              }}
            />
          </div>
          {/* Icon */}
          <div
            className="relative rounded-full p-3 transition-transform duration-500 group-hover:scale-[1.10]"
            style={{
              background:
                "linear-gradient(135deg, rgba(100,55,220,0.46), rgba(40,140,220,0.30))",
              boxShadow:
                "0 0 18px rgba(130,70,255,0.36), inset 0 0 10px rgba(255,255,255,0.05)",
              border: "1px solid rgba(178,130,255,0.24)",
            }}
          >
            <User size={22} strokeWidth={1.4} className="text-white/84" />
          </div>
        </div>

        {/* Right info panel */}
        <div className="relative z-10 flex flex-col justify-center px-5 py-4 min-w-0 flex-1">
          {/* Vertical divider between panels */}
          <div
            className="absolute left-0 pointer-events-none"
            style={{
              top: "22%",
              bottom: "22%",
              width: "1px",
              background:
                "linear-gradient(to bottom, transparent, rgba(160,110,255,0.36), rgba(80,195,255,0.18), transparent)",
            }}
          />

          <p
            className="font-mono text-[8.5px] tracking-[0.22em] uppercase mb-1.5"
            style={{ color: "rgba(190,150,255,0.44)" }}
          >
            ARTIST STUDIO · FEATURED
          </p>

          <p
            className="font-grotesk text-[15px] font-medium leading-tight mb-1.5 transition-transform duration-300 group-hover:-translate-y-px"
            style={{
              background: "linear-gradient(90deg, #cdb4ff, #a8d8ff, #f2b0e0)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            {title}
          </p>

          <p
            className="font-body text-[11px]"
            style={{ color: "rgba(170,130,255,0.36)" }}
          >
            Meet the artist
          </p>
        </div>

        {/* Right-edge fade */}
        <div
          className="absolute right-0 top-0 bottom-0 w-20 pointer-events-none"
          style={{
            background:
              "linear-gradient(to left, rgba(100,60,220,0.16) 0%, transparent 100%)",
          }}
        />

        {/* Current indicator */}
        {isCurrent && (
          <div className="absolute top-[10px] right-[10px]">
            <div className="relative">
              <div
                className="w-[5px] h-[5px] rounded-full"
                style={{ background: "rgba(190,150,255,0.88)" }}
              />
              <div
                className="absolute inset-0 rounded-full animate-ping"
                style={{ background: "rgba(160,110,255,0.36)" }}
              />
            </div>
          </div>
        )}
      </button>
    </>
  );
}
