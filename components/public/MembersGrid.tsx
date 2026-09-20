// components/public/MembersGrid.tsx
//
// The band, one card each: portrait (desaturated until hovered, in the
// hazy direction), name, role, blurb. Server-safe.
import { imageVariantUrl } from "@/lib/images/variants";
import { GlassPanel } from "@/components/public/system/GlassPanel";
import type { PublicBandMember } from "@/lib/band-members";

export function MembersGrid({ members }: { members: PublicBandMember[] }) {
  return (
    <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {members.map((m) => (
        <li key={m.id}>
          <GlassPanel as="article" padding="none" className="group h-full overflow-hidden">
            <div className="relative aspect-[4/5] overflow-hidden bg-ink">
              {m.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageVariantUrl(m.photoUrl, "medium")}
                  alt={m.name}
                  draggable={false}
                  loading="lazy"
                  className="h-full w-full object-cover grayscale-[0.6] transition-[filter,transform] duration-700 group-hover:scale-[1.03] group-hover:grayscale-0"
                />
              ) : (
                <div aria-hidden="true" className="h-full w-full bg-[radial-gradient(circle_at_40%_30%,rgba(200,169,110,0.25),transparent_55%)]" />
              )}
              <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-ink/90 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5">
                <p className="font-fraunces text-2xl font-light leading-tight text-cream">{m.name}</p>
                <p className="mt-1 font-body text-[10px] uppercase tracking-[0.3em] text-sepia-light">{m.role}</p>
              </div>
            </div>
            {m.blurb && <p className="p-5 font-body text-sm leading-relaxed text-cream/70">{m.blurb}</p>}
          </GlassPanel>
        </li>
      ))}
    </ul>
  );
}
