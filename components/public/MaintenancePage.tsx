// components/public/MaintenancePage.tsx
//
// Rendered in place of the entire public site while Profile.maintenanceMode
// is on (see app/(public)/layout.tsx) — and reused as-is for the admin's
// live preview in MaintenanceClient.tsx, so what the admin sees while
// editing is exactly what visitors get, not an approximation.
//
// No "use client" needed — the only motion here (animate-squid-drift) is
// pure CSS, already used the same way by the Footer/Sidebar squid.
import { SquidIcon } from "@/components/ui/SquidIcon";
import { DynamicIcon } from "@/components/ui/DynamicIcon";
import { parseIconValue } from "@/components/ui/icon-values";
import { DEFAULT_MAINTENANCE_MESSAGE } from "@/lib/maintenance";

export function MaintenancePage({
  message,
  icon,
  fullScreen = true,
}: {
  message?: string | null;
  /** Profile.maintenanceIcon ("platform:name") — falls back to the squid when unset/invalid. */
  icon?: string | null;
  // false for the admin's live preview, which renders this inside a small
  // contained card rather than as the actual page — min-h-screen there
  // would force full-viewport height regardless of the preview box size.
  fullScreen?: boolean;
}) {
  const parsedIcon = parseIconValue(icon);
  return (
    <div
      className={`${fullScreen ? "min-h-screen" : ""} bg-ink-900 flex items-center justify-center p-6 sm:p-10`}
    >
      <div className="max-w-md w-full text-center">
        {/* animate-squid-drift (bob + colour cycle) goes on this wrapper;
            animate-squid-glow (drop-shadow pulse) goes on the icon itself —
            both set the full `animation` shorthand, so stacking them on one
            element would let only the last one win instead of combining. */}
        <div className="relative inline-flex items-center justify-center mb-8 motion-safe:animate-squid-drift">
          <span
            aria-hidden="true"
            style={{
              backgroundColor:
                "color-mix(in srgb, var(--squid-glow) 35%, transparent)",
            }}
            className="pointer-events-none absolute inset-0 scale-150 rounded-full opacity-70 blur-2xl"
          />
          {parsedIcon ? (
            <DynamicIcon
              platform={parsedIcon.platform}
              name={parsedIcon.name}
              style={{ color: "var(--squid-glow)" }}
              className="relative w-16 h-16 motion-safe:animate-squid-glow"
              fallback={<SquidIcon style={{ color: "var(--squid-glow)" }} className="relative w-16 h-16 motion-safe:animate-squid-glow" />}
            />
          ) : (
            <SquidIcon
              style={{ color: "var(--squid-glow)" }}
              className="relative w-16 h-16 motion-safe:animate-squid-glow"
            />
          )}
        </div>

        <p className="font-grotesk text-xs tracking-[0.4em] uppercase text-sepia-light mb-3">
          scriptovernovel.music
        </p>
        <h1 className="font-grotesk text-2xl sm:text-3xl font-bold tracking-widest uppercase text-white mb-4">
          We&apos;ll Be Right Back
        </h1>
        <p className="font-body text-sm text-white/60 leading-relaxed">
          {message?.trim() || DEFAULT_MAINTENANCE_MESSAGE}
        </p>

        <div className="deco-line mt-8 mb-6 mx-auto" />
        <a
          href="https://www.facebook.com/horyezon.dev/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-body text-[11px] tracking-widest uppercase text-white/30 hover:text-white/60 transition-colors duration-200"
        >
          © {new Date().getFullYear()} HoryezoN Indie Solutions
        </a>
      </div>
    </div>
  );
}
