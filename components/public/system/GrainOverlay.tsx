// components/public/system/GrainOverlay.tsx
//
// Film grain scoped to its parent (which must be `relative`). The site-wide
// `.grain` in globals.css is a fixed, full-viewport layer; this is the
// local variant for heroes and panels so the grain sits *over* their photo
// and not over the whole page.
export function GrainOverlay({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`grain-local pointer-events-none absolute inset-0 ${className}`} />;
}
