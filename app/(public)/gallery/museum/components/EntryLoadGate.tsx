"use client";

// app/(public)/gallery/museum/components/EntryLoadGate.tsx
//
// Holds the loading overlay up until the museum's first burst of asset
// fetching has actually drained — not merely until WebGL is confirmed
// available, which is all MuseumClient's `view` state ever meant.
//
// The old behaviour swapped the overlay out the instant `setView("3d")` ran
// (a synchronous WebGL capability check), so a visitor landed inside a room
// whose walls, artwork images and .glb props had not started downloading yet:
// flat-colour surfaces, white frames, missing objects. On a phone over mobile
// data that gap is many seconds long, which is what made it read as broken
// rather than as loading.
//
// Progress comes from drei's useProgress, which is a plain zustand store
// wired to THREE.DefaultLoadingManager — not an R3F context hook, so it works
// out here outside the <Canvas>. Both of the museum's asset paths register
// with that manager on their own: loadDownscaledTexture builds a bare
// THREE.ImageLoader and useGLTF goes through useLoader/GLTFLoader, and
// neither passes a custom manager, so both land in the default one.
//
// Kept as its own component purely to contain re-renders: useProgress fires
// on every item that completes, and subscribing to it inside MuseumClient
// would re-render the entire museum HUD dozens of times during load. Here it
// re-renders one overlay, and the parent only hears the single flip to ready.
import { useEffect, useRef, useState } from "react";
import { useProgress } from "@react-three/drei";
import { LoadingScreen } from "./LoadingScreen";

/** How long the loading manager has to stay idle before the burst counts as
 *  finished. DefaultLoadingManager reports `active: false` in the gap between
 *  two bursts as readily as it does at the end of one — and the museum loads
 *  in waves (room shell textures, then artwork images, then .glb props), so
 *  reacting to the first idle frame would drop the overlay in the middle. */
const SETTLE_MS = 400;

/** Hard ceiling on the whole gate. Two cases need it: a museum whose entry
 *  room has no textures or props at all never registers a single item with
 *  the manager (so there is no burst to wait for), and a stalled CDN would
 *  otherwise trap a visitor behind an overlay that never lifts. Either way
 *  the scene underneath is already interactive — this only decides when to
 *  stop covering it. */
const CEILING_MS = 15000;

export function EntryLoadGate({ onReady }: { onReady: () => void }) {
  const { active, progress, total } = useProgress();
  const [displayProgress, setDisplayProgress] = useState(0);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  // The manager is a global that survives client-side navigation, so `total`
  // can already be non-zero on mount from an earlier page. What matters is
  // that *this* mount saw work, so the settle path below can't fire before
  // anything has been queued.
  const startedRef = useRef(false);
  if (active) startedRef.current = true;

  // Monotonic: useProgress resets `progress` toward 0 at the start of each new
  // burst (it rebases on the previous burst's total), which made the bar jump
  // backwards mid-load. A visitor reads a bar that retreats as a stall.
  useEffect(() => {
    setDisplayProgress((prev) => Math.max(prev, Math.min(100, progress)));
  }, [progress]);

  useEffect(() => {
    const ceiling = setTimeout(() => onReadyRef.current(), CEILING_MS);
    return () => clearTimeout(ceiling);
  }, []);

  useEffect(() => {
    if (!startedRef.current || active) return;
    const settle = setTimeout(() => onReadyRef.current(), SETTLE_MS);
    return () => clearTimeout(settle);
  }, [active, total]);

  return <LoadingScreen progress={displayProgress / 100} />;
}
