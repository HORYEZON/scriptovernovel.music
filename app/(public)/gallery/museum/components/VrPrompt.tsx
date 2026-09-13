"use client";

// A short ambient note pinned into the visitor's view — the in-world
// equivalent of one of the museum's DOM corner cards, for the one that has
// something to say in VR: the Freedom Wall's "write a note" composer, which
// needs a keyboard and so can only point at the 2D screen (see
// MuseumScene.tsx's render of this). It was Phase 4's "remove headset to
// view" fallback for every non-artwork panel until 09/13/26, when those got
// mirrored panels of their own (see VrUi.tsx); this stayed for the cases
// that aren't a panel at all.
//
// No fixed spot in the room to anchor to, so it's parented directly onto
// the camera, like PlayerControls.tsx's own comfort vignette, and always
// appears a fixed distance in front of whichever way the visitor is
// looking — below VrInteractionPrompt.tsx's slot, so the two can't overlap.
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";

const FONT_REGULAR = "/fonts/DMSans-Regular.woff";
// Close enough to read comfortably, far enough to clear the near clip
// plane (0.1, see MuseumScene.tsx's <PerspectiveCamera>) with room to spare.
const DISTANCE = 1.1;

export function VrPrompt({ text }: { text: string }) {
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
    group.position.set(0, -0.44, -DISTANCE);
  });

  return (
    <group ref={groupRef}>
      <mesh>
        <planeGeometry args={[0.9, 0.16]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.72} depthTest={false} toneMapped={false} />
      </mesh>
      <Text
        position={[0, 0, 0.005]}
        fontSize={0.045}
        maxWidth={0.8}
        textAlign="center"
        anchorX="center"
        anchorY="middle"
        color="#f5f2ea"
        font={FONT_REGULAR}
      >
        {text}
        <meshBasicMaterial attach="material" depthTest={false} toneMapped={false} color="#f5f2ea" />
      </Text>
    </group>
  );
}
