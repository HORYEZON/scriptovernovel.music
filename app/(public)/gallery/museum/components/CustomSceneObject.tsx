"use client";

// A custom decorative object — an admin-uploaded .glb model (Museum Scene
// Editor's Phase 2, MuseumSceneObject.kind === "custom") — rendered via
// drei's useGLTF. useGLTF suspends while the file loads (a real network
// fetch, same as an artwork texture) and throws if the file fails to
// parse — wrapped in Suspense + a small error boundary here so one bad or
// slow model can never blank the room around it or crash the whole scene,
// it just quietly doesn't render anything until (or unless) it succeeds.
import { Component, Suspense, useCallback, useEffect, useMemo, type ReactNode } from "react";
import { useGLTF } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { KTX2Loader, type GLTFLoader } from "three-stdlib";
import * as THREE from "three";

// Every uploaded prop's textures are KTX2/Basis (see
// Docs/Museum_AssetOptimization.md). Unlike Draco and Meshopt — which drei's
// useGLTF configures on its own — a KTX2Loader has to be supplied here, and it
// needs two things a plain loader doesn't: the Basis transcoder (served from
// /public/basis, copied out of three's own examples so there is no CDN in the
// path) and the live WebGLRenderer, which is what tells it which GPU texture
// formats this device can actually accept.
//
// Module-level singleton rather than one per component: detectSupport() probes
// the renderer, and the museum mounts dozens of these at once — a loader each
// would repeat that probe and defeat useLoader's cache, which keys on the
// loader instance.
let ktx2Loader: KTX2Loader | null = null;
function getKTX2Loader(gl: THREE.WebGLRenderer): KTX2Loader {
  if (!ktx2Loader) {
    ktx2Loader = new KTX2Loader().setTranscoderPath("/basis/").detectSupport(gl);
  }
  return ktx2Loader;
}

class ModelErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * The circle that actually wraps a model's footprint — its horizontal
 * bounding-box centre and half-width, in the model's own exported units
 * (before `scale`), which is how `colliderRadius` / `colliderOffsetX/Z` are
 * stored.
 *
 * Kept apart from the reach-from-origin radius beside it because the two
 * answer different questions. Reach says "how big a circle *centred on the
 * origin* covers this model", which is the only shape a footprint could take
 * before it could be offset — correct, but for a model exported off to one
 * side of its origin it is a circle several times wider than the prop, most
 * of it blocking bare floor. This says "where the model is and how wide it
 * is", which is what the editor's Fit to model now sets. Reach stays as the
 * fallback for a prop switched solid before it could be measured, so no
 * placement made under the old behaviour moves on its own.
 */
export type ModelFit = {
  radius: number;
  offsetX: number;
  offsetZ: number;
  /** How high the geometry actually reaches above the prop's own base, in
   *  model units. Seeds the Scene Editor's Collision Height so switching that
   *  on starts as a column the size of the thing standing there, rather than
   *  an arbitrary number the admin has to correct. */
  top: number;
};

function LoadedModel({
  url,
  scale,
  onMeasure,
}: {
  url: string;
  scale: number;
  /** Reports the model's size in its own exported units (scale not applied)
   *  once it has loaded: how far its geometry reaches from its own origin
   *  horizontally, which the Museum Scene Editor uses to auto-size a solid
   *  prop's collision footprint, and the largest of its three dimensions,
   *  which it uses to tell a model exported in metres from one exported in
   *  centimetres (see that editor's unit scaling — a model authored in cm
   *  arrives a hundred times too big and renders nowhere near the room).
   *  The third value is the tight fit: the circle that actually wraps the
   *  geometry, wherever it sits. See `ModelFit`. */
  onMeasure?: (nativeRadius: number, nativeSpan: number, fit: ModelFit) => void;
}) {
  // useGLTF caches by URL — every instance sharing the same modelUrl
  // (e.g. the Museum Scene Editor's "Duplicate" action, which
  // deliberately reuses the original's URL for the copy) gets back the
  // *exact same* THREE.Object3D. Mounting that shared object via
  // <primitive> more than once doesn't render two copies — a scene graph
  // node can only have one parent, so the second mount silently steals it
  // from the first, leaving the original looking like it vanished. Each
  // instance clones its own copy instead, once, so N objects pointing at
  // the same .glb are N independent nodes.
  // `true, true` are useGLTF's own Draco and Meshopt defaults, restated only
  // because the fourth argument — the KTX2 wiring above — is positional.
  const gl = useThree((state) => state.gl);
  const extendLoader = useCallback(
    (loader: GLTFLoader) => {
      loader.setKTX2Loader(getKTX2Loader(gl));
    },
    [gl]
  );
  const { scene } = useGLTF(url, true, true, extendLoader);
  const cloned = useMemo(() => scene.clone(), [scene]);

  // Measure the model's footprint once, from the un-scaled clone, and hand
  // it up in the model's own units. The caller multiplies by `scale` itself,
  // so a resized prop keeps a matching collider.
  useEffect(() => {
    if (!onMeasure) return;
    const box = new THREE.Box3().setFromObject(cloned);
    const size = box.getSize(new THREE.Vector3());
    const s = scale || 1;
    // Measured from the origin outward, not as half the bounding box's width:
    // the collision circle is centred on the prop's origin (that's the only
    // thing the public museum stores — a point and a radius), while a model's
    // geometry is often nowhere near its own origin. Halving the box's width
    // described a circle around the box's *centre*, so any model exported
    // off-origin got a ring sitting beside it rather than around it. For a
    // model that is centred these are the same number, so nothing that
    // already lined up moves.
    const reach = Math.max(
      Math.abs(box.min.x), Math.abs(box.max.x),
      Math.abs(box.min.z), Math.abs(box.max.z)
    ) / s;
    // Both values go up *unclamped*, in model units. Their whole job is to
    // say how big this model actually is — including "impossibly big",
    // which is how a centimetre-authored .glb is recognised — and a value
    // squeezed into the plausible metre range could no longer say it. The
    // metre clamp belongs on the world-space result instead; see
    // colliderWorldRadius, which every consumer of this radius goes through.
    const span = Math.max(size.x, size.y, size.z) / s;
    // The tight fit: a circle around the geometry's own horizontal centre,
    // wide enough to cover its longer horizontal side. Unlike `reach` this
    // does not grow with how far the model sits from its origin — that
    // distance becomes the offset instead, which is the whole point.
    const center = box.getCenter(new THREE.Vector3());
    const fitRadius = Math.max(size.x, size.z) / 2 / s;
    // Measured from the prop's base (its origin, which is where it is
    // planted) rather than as the box's own height — a model floating above
    // its origin needs the column to reach up *to* it, not just be as tall as
    // the geometry itself.
    const top = box.max.y / s;
    const fit: ModelFit = {
      radius: Number.isFinite(fitRadius) ? fitRadius : 0,
      offsetX: Number.isFinite(center.x) ? center.x / s : 0,
      offsetZ: Number.isFinite(center.z) ? center.z / s : 0,
      top: Number.isFinite(top) && top > 0 ? top : 0,
    };
    onMeasure(
      Number.isFinite(reach) ? reach : 0,
      Number.isFinite(span) ? span : 0,
      fit
    );
  }, [cloned, scale, onMeasure]);

  return <primitive object={cloned} scale={scale} />;
}

// `scale` is a uniform multiplier on the model's own exported size — 1 (the
// default) leaves it exactly as authored, matching every existing placement
// from before this prop existed. Only the Museum Scene Editor's decorative
// props pass a real value; the companion/podium callers keep the default.
export function CustomSceneObject({
  url,
  scale = 1,
  onMeasure,
}: {
  url: string;
  scale?: number;
  /** See LoadedModel's own `onMeasure` above for what the values mean. */
  onMeasure?: (nativeRadius: number, nativeSpan: number, fit: ModelFit) => void;
}) {
  return (
    <ModelErrorBoundary>
      <Suspense fallback={null}>
        <LoadedModel url={url} scale={scale} onMeasure={onMeasure} />
      </Suspense>
    </ModelErrorBoundary>
  );
}
