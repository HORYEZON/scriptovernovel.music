"use client";

export function SkeletonCard({ height = "h-72" }: { height?: string }) {
  return (
    <div className="bg-ink-800/70 border border-white/5 rounded-xl break-inside-avoid mb-4 md:mb-6 overflow-hidden shadow-lg">
      <div className={`${height} bg-ink-700 animate-pulse`} />
      <div className="p-4 space-y-3">
        <div className="h-5 w-3/4 bg-ink-700 animate-pulse rounded" />
        <div className="h-3 w-1/3 bg-ink-700 animate-pulse rounded" />
      </div>
    </div>
  );
}

export function SkeletonGrid() {
  const heights = ["h-64", "h-80", "h-72", "h-96", "h-64", "h-80", "h-72", "h-64"];
  return (
    <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 md:gap-6">
      {heights.map((h, i) => (
        <SkeletonCard key={i} height={h} />
      ))}
    </div>
  );
}
