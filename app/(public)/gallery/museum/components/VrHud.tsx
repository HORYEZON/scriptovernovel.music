"use client";

// The museum's HUD, inside the headset — the in-world twin of the DOM
// overlay MuseumClient.tsx draws around the canvas (its top control row,
// the current-room indicator, the bottom-left radar card with the stats
// counters, the room-entry splash, the achievement banner). None of that
// DOM reaches a WebXR session, and a visitor who has just walked the museum
// on a screen expects the same furniture around them here.
//
// Camera-anchored, like VrPrompt/VrInteractionPrompt: this is status, not a
// document, and a HUD that stays in the same place in the view however the
// head turns is what "HUD" means. Kept small and near the edges of the
// comfortable view for the same reason a screen HUD hugs its corners.
// Buttons work like any VrUi button — a controller trigger or hand pinch
// with the ray over one.
//
// What doesn't come across, and why: Save Photo / Screenshot read the 2D
// canvas back (`toDataURL`), which during a session is the monitor mirror,
// not the headset view; Filter Vision is a CSS `filter` on a DOM wrapper the
// XR compositor never passes through; Back to Gallery would navigate away
// mid-session — Exit VR is the way out, and the Back button is right there
// on the screen it returns to. Everything else is here.
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import type { MuseumRoomPublic } from "@/types";
import type { MinimapHudConfig } from "@/lib/museum/minimapHud";
import type { EarnedAchievement } from "@/lib/museum/useMuseumAchievements";
import type { MiniMapFrameState } from "./MiniMapTracker";
import { drawMiniMap } from "./MiniMapHud";
import { VrButton, VrLabel, VR_COLORS, VR_FONT_BODY_BOLD, VR_FONT_TITLE, VR_UI_RENDER_ORDER } from "./VrUi";

const DISTANCE = 1.15;
// The comfortable view at that distance — roughly ±28° across, ±19° up and
// down. Nothing sits outside this; a HUD element the lens sweet spot can't
// resolve is a smudge, not information.
const EDGE_X = 0.58;
const EDGE_Y = 0.38;

const BUTTON_W = 0.125;
const BUTTON_H = 0.052;
const BUTTON_GAP = 0.01;

// The same four counters, in the same order and colours, as AchievementHud.
const COUNTER_COLORS = { steps: "#34d399", views: "#38bdf8", time: "#fbbf24", wishlist: "#fb7185" } as const;

function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export interface VrHudStats {
  steps: number;
  views: number;
  elapsedSeconds: number;
  wishlistAdds: number;
}

/**
 * What the HUD needs that MuseumScene.tsx doesn't already have — threaded
 * from MuseumClient.tsx (which owns all of it) through MuseumSceneLoader as
 * one object, so the pass-through doesn't grow a dozen unrelated props.
 * Type-only on the far side of the ssr:false boundary, so this file's three
 * import never leaks upstream.
 */
export interface VrHudProps {
  mapOpen: boolean;
  /** MuseumMap.tsx's row click — teleports and closes the map. */
  onSelectRoom: (roomId: string) => void;
  musicPlaying?: boolean;
  onToggleMusic?: () => void;
  minimapConfig: MinimapHudConfig;
  stats: VrHudStats | null;
  achievement: EarnedAchievement | null;
  onDismissAchievement: () => void;
  splashEnabled: boolean;
  splashSpeedMs: number;
}

export function VrHud({
  rooms,
  currentRoomId,
  hudHidden,
  onToggleHud,
  darkMode,
  onToggleDarkMode,
  musicPlaying,
  onToggleMusic,
  mapOpen,
  onToggleMap,
  onExitVr,
  minimapRef,
  minimapConfig,
  stats,
  achievement,
  onDismissAchievement,
  splashEnabled,
  splashSpeedMs,
}: {
  rooms: MuseumRoomPublic[];
  currentRoomId: string | null;
  hudHidden: boolean;
  onToggleHud?: () => void;
  darkMode: boolean;
  onToggleDarkMode?: () => void;
  /** Undefined when the museum has no soundtrack configured — no button. */
  musicPlaying?: boolean;
  onToggleMusic?: () => void;
  mapOpen: boolean;
  onToggleMap?: () => void;
  onExitVr?: () => void;
  minimapRef?: MutableRefObject<MiniMapFrameState | null>;
  minimapConfig: MinimapHudConfig;
  /** Null when Badges & Trophies (or its HUD card) is off — no stats row,
   *  same as the DOM. */
  stats: VrHudStats | null;
  achievement?: EarnedAchievement | null;
  onDismissAchievement?: () => void;
  /** Museum-wide room-splash switch; the per-room one is read off `rooms`. */
  splashEnabled: boolean;
  splashSpeedMs: number;
}) {
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
    group.position.set(0, 0, -DISTANCE);
  });

  const currentRoom = rooms.find((r) => r.id === currentRoomId) ?? rooms[0];
  const currentIndex = rooms.findIndex((r) => r.id === currentRoom?.id);

  // ── Room-entry splash — RoomSplash.tsx's "show on every room change,
  // hold for speedMs, then fade" as a centred title. ────────────────────
  const [splash, setSplash] = useState<{ title: string; until: number } | null>(null);
  const splashOpacity = useRef(0);
  const lastSplashRoom = useRef<string | null>(null);
  useEffect(() => {
    if (!splashEnabled || !currentRoom || !currentRoom.splashEnabled) return;
    if (lastSplashRoom.current === currentRoom.id) return;
    lastSplashRoom.current = currentRoom.id;
    setSplash({ title: currentRoom.splashTitle || currentRoom.name, until: performance.now() + splashSpeedMs + 500 });
  }, [currentRoom, splashEnabled, splashSpeedMs]);
  const splashMat = useRef<THREE.MeshBasicMaterial>(null);
  const splashTextMat = useRef<THREE.MeshBasicMaterial>(null);
  useFrame((_, delta) => {
    if (!splash) return;
    const target = performance.now() < splash.until ? 1 : 0;
    splashOpacity.current = THREE.MathUtils.damp(splashOpacity.current, target, 8, delta);
    if (splashMat.current) splashMat.current.opacity = splashOpacity.current * 0.82;
    if (splashTextMat.current) splashTextMat.current.opacity = splashOpacity.current;
    if (target === 0 && splashOpacity.current < 0.01) setSplash(null);
  });

  // ── Minimap — MiniMapHud.tsx's exact drawing, onto an offscreen canvas
  // uploaded as a texture each frame. Drawn at 2× for crispness at the
  // size it ends up in the view. ──────────────────────────────────────────
  const mapPx = { w: minimapConfig.width, h: minimapConfig.height };
  const mapCanvas = useMemo(() => {
    if (typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    c.width = mapPx.w * 2;
    c.height = mapPx.h * 2;
    return c;
  }, [mapPx.w, mapPx.h]);
  const mapTexture = useMemo(() => {
    if (!mapCanvas) return null;
    const t = new THREE.CanvasTexture(mapCanvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [mapCanvas]);
  useEffect(() => () => mapTexture?.dispose(), [mapTexture]);
  useFrame(() => {
    if (!mapCanvas || !mapTexture || !minimapRef || hudHidden) return;
    const ctx = mapCanvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    drawMiniMap(ctx, mapPx.w, mapPx.h, minimapRef.current, minimapConfig);
    mapTexture.needsUpdate = true;
  });
  // Sized in the view from a fixed width, keeping the admin's aspect.
  const MAP_W = 0.24;
  const mapH = MAP_W * (mapPx.h / mapPx.w);

  // ── Top-right controls, right-aligned like the DOM row. ────────────────
  const buttons: { label: string; onClick?: () => void; active?: boolean }[] = [];
  if (onToggleMusic) buttons.push({ label: musicPlaying ? "Music: on" : "Music: off", onClick: onToggleMusic, active: musicPlaying });
  buttons.push({ label: darkMode ? "Dark" : "Light", onClick: onToggleDarkMode });
  if (rooms.length > 1) buttons.push({ label: mapOpen ? "Close map" : "Map", onClick: onToggleMap, active: mapOpen });
  buttons.push({ label: "Hide HUD", onClick: onToggleHud });
  buttons.push({ label: "Exit VR", onClick: onExitVr });

  const roomTitle = currentRoom?.name ?? "";
  const roomPillW = Math.min(0.5, 0.05 + roomTitle.length * 0.0155);

  return (
    <group ref={groupRef}>
      {hudHidden ? (
        // The mobile HUD's always-mounted eye icon, in spirit: the one way
        // back once everything else is hidden.
        <VrButton label="Show HUD" width={BUTTON_W} height={BUTTON_H} fontSize={0.02} position={[EDGE_X - BUTTON_W / 2, EDGE_Y, 0]} onClick={onToggleHud} variant="ghost" />
      ) : (
        <>
          {/* Current room — the DOM's centred pill and progress dots, at the
              top-left here to leave the right for the controls. */}
          {currentRoom && (
            <group position={[-EDGE_X, EDGE_Y, 0]}>
              <mesh position={[roomPillW / 2, 0, 0]} renderOrder={VR_UI_RENDER_ORDER}>
                <planeGeometry args={[roomPillW, 0.05]} />
                <meshBasicMaterial color={VR_COLORS.black} transparent opacity={0.6} depthTest={false} depthWrite={false} toneMapped={false} />
              </mesh>
              <Text position={[roomPillW / 2, 0, 0.002]} fontSize={0.022} maxWidth={roomPillW - 0.03} anchorX="center" anchorY="middle" font={VR_FONT_BODY_BOLD} renderOrder={VR_UI_RENDER_ORDER + 3}>
                {roomTitle}
                <meshBasicMaterial attach="material" color={VR_COLORS.text} transparent depthTest={false} depthWrite={false} toneMapped={false} />
              </Text>
              {rooms.length > 1 &&
                rooms.map((room, i) => {
                  const on = i === currentIndex;
                  const w = on ? 0.03 : 0.012;
                  // Laid out left to right, each dot after the last.
                  let x = 0.01;
                  for (let k = 0; k < i; k++) x += (k === currentIndex ? 0.03 : 0.012) + 0.008;
                  return (
                    <mesh key={room.id} position={[x + w / 2, -0.045, 0]} renderOrder={VR_UI_RENDER_ORDER + 1}>
                      <planeGeometry args={[w, 0.01]} />
                      <meshBasicMaterial color={on ? "#34d399" : "#6b6b6b"} transparent opacity={on ? 1 : 0.6} depthTest={false} depthWrite={false} toneMapped={false} />
                    </mesh>
                  );
                })}
            </group>
          )}

          {/* Controls, right-aligned. */}
          {buttons.map((b, i) => {
            const fromRight = buttons.length - 1 - i;
            const x = EDGE_X - BUTTON_W / 2 - fromRight * (BUTTON_W + BUTTON_GAP);
            return (
              <VrButton
                key={b.label}
                label={b.label}
                width={BUTTON_W}
                height={BUTTON_H}
                fontSize={0.019}
                position={[x, EDGE_Y, 0]}
                onClick={b.onClick}
                variant={b.active ? "primary" : "ghost"}
                disabled={!b.onClick}
              />
            );
          })}

          {/* Radar card + counters, bottom-left, in one card like desktop. */}
          {(minimapRef || stats) && (
            <group position={[-EDGE_X, -EDGE_Y, 0]}>
              {(() => {
                const cardW = Math.max(MAP_W, stats ? 0.34 : 0) + 0.04;
                const cardH = (minimapRef ? mapH + 0.02 : 0) + (stats ? 0.05 : 0) + 0.02;
                return (
                  <>
                    <mesh position={[cardW / 2, cardH / 2, 0]} renderOrder={VR_UI_RENDER_ORDER}>
                      <planeGeometry args={[cardW, cardH]} />
                      <meshBasicMaterial color={VR_COLORS.black} transparent opacity={0.55} depthTest={false} depthWrite={false} toneMapped={false} />
                    </mesh>
                    {minimapRef && mapTexture && (
                      <mesh position={[cardW / 2, cardH - 0.02 - mapH / 2, 0.001]} renderOrder={VR_UI_RENDER_ORDER + 2}>
                        <planeGeometry args={[MAP_W, mapH]} />
                        <meshBasicMaterial map={mapTexture} transparent depthTest={false} depthWrite={false} toneMapped={false} />
                      </mesh>
                    )}
                    {stats &&
                      (
                        [
                          { key: "steps", value: stats.steps.toLocaleString(), color: COUNTER_COLORS.steps },
                          { key: "views", value: stats.views.toLocaleString(), color: COUNTER_COLORS.views },
                          { key: "time", value: formatElapsed(stats.elapsedSeconds), color: COUNTER_COLORS.time },
                          { key: "wishlist", value: stats.wishlistAdds.toLocaleString(), color: COUNTER_COLORS.wishlist },
                        ] as const
                      ).map((c, i) => {
                        const slot = (cardW - 0.04) / 4;
                        const x = 0.02 + slot * i;
                        return (
                          <group key={c.key} position={[x, 0.03, 0.001]}>
                            <mesh position={[0.01, 0, 0]} renderOrder={VR_UI_RENDER_ORDER + 2}>
                              <planeGeometry args={[0.012, 0.012]} />
                              <meshBasicMaterial color={c.color} transparent depthTest={false} depthWrite={false} toneMapped={false} />
                            </mesh>
                            <Text position={[0.026, 0, 0]} fontSize={0.02} anchorX="left" anchorY="middle" font={VR_FONT_BODY_BOLD} renderOrder={VR_UI_RENDER_ORDER + 3}>
                              {c.value}
                              <meshBasicMaterial attach="material" color={VR_COLORS.text} transparent depthTest={false} depthWrite={false} toneMapped={false} />
                            </Text>
                          </group>
                        );
                      })}
                  </>
                );
              })()}
            </group>
          )}

          {/* Achievement banner — AchievementBanner.tsx's card, minus the
              claim form (name + email: a keyboard). Stays until dismissed,
              exactly like the DOM one, and the DOM one takes over with its
              form the moment the headset comes off. */}
          {achievement && (
            <group position={[0, -0.22, 0]}>
              <mesh renderOrder={VR_UI_RENDER_ORDER}>
                <planeGeometry args={[0.76, 0.19]} />
                <meshBasicMaterial color="#0f1f18" transparent opacity={0.94} depthTest={false} depthWrite={false} toneMapped={false} />
              </mesh>
              <mesh position={[0, 0, -0.001]} renderOrder={VR_UI_RENDER_ORDER - 1}>
                <planeGeometry args={[0.772, 0.202]} />
                <meshBasicMaterial color={VR_COLORS.emerald} transparent depthTest={false} depthWrite={false} toneMapped={false} />
              </mesh>
              <VrLabel position={[-0.35, 0.075, 0.002]} width={0.5} fontSize={0.02} color="#6ee7b7" uppercase letterSpacing={0.1}>
                Achievement unlocked
              </VrLabel>
              <VrLabel position={[-0.35, 0.042, 0.002]} width={0.5} fontSize={0.03} font={VR_FONT_TITLE} color={VR_COLORS.text} maxLines={1}>
                {achievement.reward}
              </VrLabel>
              <VrLabel position={[-0.35, -0.005, 0.002]} width={0.5} fontSize={0.02} color={VR_COLORS.textMuted} maxLines={2}>
                Remove your headset to claim it — the claim form needs your name and email.
              </VrLabel>
              <VrButton label="Dismiss" width={0.14} height={0.055} fontSize={0.021} position={[0.28, 0.02, 0.002]} variant="outline" onClick={onDismissAchievement} />
            </group>
          )}
        </>
      )}

      {/* Splash — drawn even with the HUD hidden? No: RoomSplash.tsx hides
          under hudHidden too (its `hidden` prop), so this matches. */}
      {splash && !hudHidden && (
        <group position={[0, 0.06, 0]}>
          <mesh renderOrder={VR_UI_RENDER_ORDER + 5}>
            <planeGeometry args={[0.9, 0.2]} />
            <meshBasicMaterial ref={splashMat} color={VR_COLORS.black} transparent opacity={0} depthTest={false} depthWrite={false} toneMapped={false} />
          </mesh>
          <Text position={[0, 0, 0.002]} fontSize={0.06} maxWidth={0.84} textAlign="center" anchorX="center" anchorY="middle" font={VR_FONT_TITLE} letterSpacing={0.04} renderOrder={VR_UI_RENDER_ORDER + 6}>
            {splash.title.toUpperCase()}
            <meshBasicMaterial ref={splashTextMat} attach="material" color={VR_COLORS.text} transparent opacity={0} depthTest={false} depthWrite={false} toneMapped={false} />
          </Text>
        </group>
      )}
    </group>
  );
}
