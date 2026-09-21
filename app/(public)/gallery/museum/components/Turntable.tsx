"use client";

// Turntable.tsx
//
// The Vinyl Room's deck — the floor-standing counterpart to ArcadeCabinet.tsx
// (read that first; this follows the same conventions). Built procedurally so
// it works with no modelling step: a walnut plinth on a low stand, a platter,
// a tonearm, and a speaker cabinet either side. An admin's own .glb replaces
// the procedural body (one room-wide setting, lib/museum/vinylConfig.ts) —
// the record on the platter is drawn on top regardless, since that is the
// live part.
//
// The record spins at the deck's real rpm (33⅓ / 45 / 78) while a track is
// playing and the tonearm swings in over the groove; both come from the same
// `playing` / `rpm` props MuseumScene derives from the audio player, so the
// picture and the sound never disagree.
import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { loadDownscaledTexture } from "@/lib/museum/loadDownscaledTexture";
import { CustomSceneObject } from "./CustomSceneObject";
import { INTERACT_GLOW_COLOR } from "./roomConstants";

// ── Geometry, in metres ────────────────────────────────────────────────────
const STAND_W = 1.1;
const STAND_D = 0.6;
const STAND_H = 0.75;
const PLINTH_W = 0.9;
const PLINTH_D = 0.7;
const PLINTH_H = 0.12;
const PLATTER_R = 0.3;
const PLATTER_H = 0.02;
const RECORD_R = 0.29;
const LABEL_R = 0.1;
const SPEAKER_W = 0.34;
const SPEAKER_H = 0.9;
const SPEAKER_D = 0.32;
const SPEAKER_GAP = 0.25;

/** Radius a visitor is kept out of — covers the stand and both speakers. */
export const TURNTABLE_COLLIDER_RADIUS = STAND_W / 2 + SPEAKER_GAP + SPEAKER_W / 2 + 0.1;

/** Platter top, used to place the record and tonearm on an uploaded model. */
const DEFAULT_PLATTER_Y = STAND_H + PLINTH_H + PLATTER_H;

export function Turntable({
  position,
  rotationY = 0,
  scale = 1,
  modelUrl = null,
  platterHeight,
  recordCoverUrl,
  playing,
  rpm,
  active,
  shouldLoad = true,
}: {
  position: [number, number, number];
  rotationY?: number;
  scale?: number;
  modelUrl?: string | null;
  /** Platter-top height on an uploaded model (metres). */
  platterHeight?: number | null;
  /** The record on the platter — its cover is the label. Null = empty deck. */
  recordCoverUrl?: string | null;
  playing: boolean;
  rpm: number;
  active: boolean;
  shouldLoad?: boolean;
}) {
  const recordRef = useRef<THREE.Group>(null);
  const armRef = useRef<THREE.Group>(null);
  const [labelTex, setLabelTex] = useState<THREE.Texture | null>(null);
  const spinRef = useRef(0);

  useEffect(() => {
    setLabelTex(null);
    if (!recordCoverUrl || !shouldLoad) return;
    let cancelled = false;
    loadDownscaledTexture(recordCoverUrl)
      .then((loaded) => {
        if (!cancelled) setLabelTex(loaded.texture);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [recordCoverUrl, shouldLoad]);

  // Spin + tonearm easing, every frame. The spin speed eases in/out so a
  // pause looks like a motor winding down rather than a freeze.
  useFrame((_, delta) => {
    const target = playing ? (rpm / 60) * Math.PI * 2 : 0;
    spinRef.current += (target - spinRef.current) * Math.min(1, delta * 2.5);
    if (recordRef.current) recordRef.current.rotation.y -= spinRef.current * delta;
    if (armRef.current) {
      const armTarget = recordCoverUrl && playing ? -0.42 : 0;
      armRef.current.rotation.y += (armTarget - armRef.current.rotation.y) * Math.min(1, delta * 3);
    }
  });

  const platterY = modelUrl ? platterHeight ?? DEFAULT_PLATTER_Y : DEFAULT_PLATTER_Y;

  return (
    <group position={position} rotation={[0, rotationY, 0]} scale={[scale, scale, scale]} name="turntable">
      {modelUrl ? (
        <CustomSceneObject url={modelUrl} />
      ) : (
        <>
          {/* Stand */}
          <mesh position={[0, STAND_H / 2, 0]}>
            <boxGeometry args={[STAND_W, STAND_H, STAND_D]} />
            <meshStandardMaterial color="#2a211a" roughness={0.75} />
          </mesh>
          {/* Plinth */}
          <mesh position={[0, STAND_H + PLINTH_H / 2, 0]}>
            <boxGeometry args={[PLINTH_W, PLINTH_H, PLINTH_D]} />
            <meshStandardMaterial color={active ? "#5a4530" : "#4a3626"} roughness={0.55} metalness={0.05} />
          </mesh>
          {/* Platter */}
          <mesh position={[-0.08, STAND_H + PLINTH_H + PLATTER_H / 2, 0]}>
            <cylinderGeometry args={[PLATTER_R, PLATTER_R, PLATTER_H, 48]} />
            <meshStandardMaterial color="#8c8c90" roughness={0.35} metalness={0.6} />
          </mesh>
          {/* Speakers */}
          {[-1, 1].map((s) => (
            <group key={s} position={[s * (STAND_W / 2 + SPEAKER_GAP + SPEAKER_W / 2), SPEAKER_H / 2, 0]}>
              <mesh>
                <boxGeometry args={[SPEAKER_W, SPEAKER_H, SPEAKER_D]} />
                <meshStandardMaterial color="#1c1714" roughness={0.8} />
              </mesh>
              {/* Woofer + tweeter */}
              <mesh position={[0, -0.15, SPEAKER_D / 2 + 0.005]}>
                <circleGeometry args={[0.11, 32]} />
                <meshStandardMaterial color="#0a0a0a" roughness={0.9} />
              </mesh>
              <mesh position={[0, 0.22, SPEAKER_D / 2 + 0.005]}>
                <circleGeometry args={[0.04, 24]} />
                <meshStandardMaterial color={playing ? INTERACT_GLOW_COLOR : "#3a3a3a"} roughness={0.6} />
              </mesh>
            </group>
          ))}
          {/* Power lamp */}
          <mesh position={[PLINTH_W / 2 - 0.08, STAND_H + PLINTH_H + 0.005, PLINTH_D / 2 - 0.08]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.012, 16]} />
            <meshStandardMaterial color={playing ? "#ff5a3c" : "#3a1a12"} emissive={playing ? "#ff5a3c" : "#000000"} emissiveIntensity={playing ? 1.4 : 0} />
          </mesh>
        </>
      )}

      {/* Record on the platter — drawn over either body. */}
      {recordCoverUrl && (
        <group ref={recordRef} position={[-0.08, platterY + 0.004, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[RECORD_R, 64]} />
            <meshStandardMaterial color="#0b0b0d" roughness={0.3} metalness={0.25} />
          </mesh>
          {/* Grooves: a couple of faint rings */}
          {[0.16, 0.22, 0.27].map((r) => (
            <mesh key={r} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0005, 0]}>
              <ringGeometry args={[r - 0.002, r, 64]} />
              <meshStandardMaterial color="#26262b" roughness={0.5} />
            </mesh>
          ))}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
            <circleGeometry args={[LABEL_R, 48]} />
            <meshStandardMaterial
              key={labelTex ? labelTex.uuid : "label"}
              map={labelTex}
              color={labelTex ? "#ffffff" : "#c8a96e"}
              roughness={0.8}
              toneMapped={false}
            />
          </mesh>
          <mesh position={[0, 0.006, 0]}>
            <cylinderGeometry args={[0.006, 0.006, 0.014, 12]} />
            <meshStandardMaterial color="#c0c0c4" metalness={0.8} roughness={0.3} />
          </mesh>
        </group>
      )}

      {/* Tonearm: pivot at the back-right of the plinth, swings over the record. */}
      <group ref={armRef} position={[PLINTH_W / 2 - 0.12, platterY + 0.03, -PLINTH_D / 2 + 0.14]}>
        <mesh position={[0, -0.01, 0]}>
          <cylinderGeometry args={[0.025, 0.03, 0.05, 20]} />
          <meshStandardMaterial color="#9a9a9e" metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh position={[-0.11, 0.01, 0.13]} rotation={[0, Math.atan2(0.22, 0.26), 0]}>
          <boxGeometry args={[0.012, 0.012, 0.36]} />
          <meshStandardMaterial color="#b5b5b9" metalness={0.75} roughness={0.25} />
        </mesh>
        <mesh position={[-0.23, 0.0, 0.27]}>
          <boxGeometry args={[0.03, 0.02, 0.05]} />
          <meshStandardMaterial color="#1a1a1c" roughness={0.6} />
        </mesh>
      </group>
    </group>
  );
}
