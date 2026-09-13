"use client";

// The in-world mirror of InteractionPrompt.tsx — the "[E] View Artwork"
// pill with the target's name under it. That component is a DOM overlay
// the headset never renders (a standard immersive-vr session shows nothing
// outside the WebXR canvas), which left VR with working proximity detection
// and no visible cue that anything could be done about it. This is driven
// by the very same `visible`/`label`/`title` MuseumScene.tsx computes for
// the DOM prompt, so it appears for every target in every room — artworks,
// certificates, story podiums, cosplay standees, arcade cabinets, the Gigs
// board, the Contact Desk — without a second list to keep in sync.
//
// Parented to the camera like VrPrompt.tsx: it should sit in the same spot
// in the visitor's view however they turn, exactly as the DOM pill sits at
// the bottom of the screen. Slightly above VrPrompt's slot so the Freedom
// Wall's ambient note and this never overlap.
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import { VR_FONT_BODY, VR_FONT_BODY_BOLD, VR_COLORS, VR_UI_RENDER_ORDER } from "./VrUi";

const DISTANCE = 1.1;
const PILL_W = 0.62;
const PILL_H = 0.085;
const KEY_W = 0.19;

export function VrInteractionPrompt({ label, title }: { label: string; title?: string }) {
  const { camera } = useThree();
  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    camera.add(group);
    return () => {
      camera.remove(group);
    };
  }, [camera]);

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;
    group.position.set(0, -0.3, -DISTANCE);
  });

  return (
    <group ref={groupRef}>
      {/* The pill: bg-black/70 with a hairline border. */}
      <mesh renderOrder={VR_UI_RENDER_ORDER}>
        <planeGeometry args={[PILL_W + 0.006, PILL_H + 0.006]} />
        <meshBasicMaterial color="#3a3a3a" transparent depthTest={false} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0, 0.001]} renderOrder={VR_UI_RENDER_ORDER + 1}>
        <planeGeometry args={[PILL_W, PILL_H]} />
        <meshBasicMaterial color={VR_COLORS.black} transparent opacity={0.78} depthTest={false} depthWrite={false} toneMapped={false} />
      </mesh>
      {/* The <kbd>E</kbd> chip, reworded for what a headset has. */}
      <mesh position={[-PILL_W / 2 + 0.02 + KEY_W / 2, 0, 0.002]} renderOrder={VR_UI_RENDER_ORDER + 2}>
        <planeGeometry args={[KEY_W, PILL_H - 0.026]} />
        <meshBasicMaterial color="#2e2e2e" transparent depthTest={false} depthWrite={false} toneMapped={false} />
      </mesh>
      <Text
        position={[-PILL_W / 2 + 0.02 + KEY_W / 2, 0, 0.003]}
        fontSize={0.02}
        anchorX="center"
        anchorY="middle"
        font={VR_FONT_BODY}
        letterSpacing={0.06}
        renderOrder={VR_UI_RENDER_ORDER + 3}
      >
        TRIGGER · PINCH
        <meshBasicMaterial attach="material" color={VR_COLORS.textMuted} transparent depthTest={false} depthWrite={false} toneMapped={false} />
      </Text>
      <Text
        position={[-PILL_W / 2 + 0.03 + KEY_W, 0, 0.003]}
        fontSize={0.03}
        maxWidth={PILL_W - KEY_W - 0.06}
        anchorX="left"
        anchorY="middle"
        font={VR_FONT_BODY_BOLD}
        renderOrder={VR_UI_RENDER_ORDER + 3}
      >
        {label}
        <meshBasicMaterial attach="material" color={VR_COLORS.text} transparent depthTest={false} depthWrite={false} toneMapped={false} />
      </Text>
      {title && (
        <Text
          position={[0, -PILL_H / 2 - 0.028, 0.002]}
          fontSize={0.024}
          maxWidth={PILL_W + 0.3}
          anchorX="center"
          anchorY="middle"
          font={VR_FONT_BODY}
          renderOrder={VR_UI_RENDER_ORDER + 3}
        >
          {title}
          <meshBasicMaterial attach="material" color={VR_COLORS.textSoft} transparent depthTest={false} depthWrite={false} toneMapped={false} />
        </Text>
      )}
    </group>
  );
}
