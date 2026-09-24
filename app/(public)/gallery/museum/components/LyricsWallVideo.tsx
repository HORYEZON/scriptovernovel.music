"use client";

// LyricsWallVideo.tsx
//
// The moving picture behind the Lyrics Wall's words — an uploaded clip or a
// YouTube video, dimmed by `brightness` so the lyrics stay readable on top of
// it, and muted unless the admin says otherwise. LyricsWall.tsx mounts one of
// these inside its BannerPanel, between the panel surface (z 0) and the
// halo/lyrics (z 0.005+), so the words always sit over the video.
//
// The two sources can't share an implementation, and the difference is worth
// knowing before touching either:
//
//  UploadedWallVideo — a <video> element as a THREE.VideoTexture on a plane.
//    A real part of the 3D scene: it's lit, depth-tested, visible in a VR
//    headset, and in screenshots. Needs CORS on the bucket, same as every
//    other museum texture (corsImageUrl).
//
//  YouTubeWallVideo — a YouTube iframe's pixels can never be read into WebGL
//    (cross-origin, by design), so the player is real DOM, 3D-transformed by
//    drei's <Html transform> to sit exactly on the wall, and placed *behind*
//    the canvas. A mesh at the same spot writes transparent pixels into the
//    canvas ("blending" occlusion), so the iframe shows through that one
//    patch while the lyrics — drawn afterwards, in front — still land on top.
//    Consequences: it can't be seen in a headset (a headset only sees the
//    WebGL layer, so this component unmounts itself while presenting) and it
//    isn't in screenshots.
//
//    drei's blending mode also restyles the <canvas> itself — absolute, a
//    huge z-index, pointer-events: none — and never undoes it. Left alone
//    that would put the canvas above the museum's HUD and stop it receiving
//    the clicks pointer lock needs. So: zIndexRange [1, 0] (canvas z-index 0,
//    iframe -1), the Canvas wrapper is made a stacking context
//    (MuseumScene's `isolation: isolate`) so those numbers never compete
//    with the HUD's, and this component puts pointer-events back straight
//    after drei's effect and restores all three styles when it unmounts.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { corsImageUrl } from "@/lib/images/corsUrl";
import { parseYouTube } from "@/lib/embeds";

/** Pixel width the YouTube player is laid out at before drei scales it onto
 *  the wall. High enough that the player picks a sharp stream; the CSS 3D
 *  transform does the rest. */
const YT_LAYOUT_PX = 1280;
/** Between the panel surface (0) and BannerShimmer (0.004) / the halo
 *  (0.005) / the lyrics (0.01+). */
const VIDEO_Z = 0.003;

export function UploadedWallVideo({
  url,
  width,
  height,
  brightness,
  muted,
}: {
  url: string;
  width: number;
  height: number;
  brightness: number;
  muted: boolean;
}) {
  const [texture, setTexture] = useState<THREE.VideoTexture | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  // Read inside the load effect without making it a dependency — a mute
  // toggle must not tear down and reload the clip.
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  useEffect(() => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.loop = true;
    video.muted = mutedRef.current;
    video.playsInline = true;
    video.preload = "auto";
    video.src = corsImageUrl(url);
    videoRef.current = video;

    const tex = new THREE.VideoTexture(video);
    tex.colorSpace = THREE.SRGBColorSpace;

    // Cover, not stretch: crop whichever axis overflows the panel so a 16:9
    // clip on a wider wall isn't squashed.
    const fit = () => {
      if (!video.videoWidth || !video.videoHeight) return;
      const panelAspect = width / height;
      const videoAspect = video.videoWidth / video.videoHeight;
      if (videoAspect > panelAspect) {
        tex.repeat.set(panelAspect / videoAspect, 1);
        tex.offset.set((1 - tex.repeat.x) / 2, 0);
      } else {
        tex.repeat.set(1, videoAspect / panelAspect);
        tex.offset.set(0, (1 - tex.repeat.y) / 2);
      }
    };
    video.addEventListener("loadedmetadata", fit);

    // Unmuted playback needs a user gesture behind it; entering the museum
    // is usually one, but if the browser still refuses, play muted rather
    // than show a frozen first frame.
    video.play().catch(() => {
      video.muted = true;
      video.play().catch(() => {});
    });
    setTexture(tex);

    return () => {
      video.removeEventListener("loadedmetadata", fit);
      video.pause();
      video.removeAttribute("src");
      video.load();
      tex.dispose();
      videoRef.current = null;
      setTexture(null);
    };
  }, [url, width, height]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = muted;
    if (!muted) video.play().catch(() => {});
  }, [muted]);

  // The material multiplies in linear light, while the YouTube path's CSS
  // brightness() works on sRGB-encoded values. Raising to the sRGB gamma makes
  // "70%" look like 70% here too — un-corrected it read as ~85%, and the two
  // sources disagreed at the same setting.
  const color = useMemo(() => {
    const linear = Math.pow(Math.max(0, brightness), 2.2);
    return new THREE.Color(linear, linear, linear);
  }, [brightness]);

  if (!texture) return null;
  return (
    <mesh position={[0, 0, VIDEO_Z]}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture} color={color} toneMapped={false} />
    </mesh>
  );
}

export function YouTubeWallVideo({
  url,
  width,
  height,
  brightness,
  muted,
}: {
  url: string;
  width: number;
  height: number;
  brightness: number;
  muted: boolean;
}) {
  const gl = useThree((s) => s.gl);
  const parsed = useMemo(() => parseYouTube(url), [url]);

  // A headset only ever sees the WebGL layer: there the transparent patch
  // would be a black hole in the wall, so step aside entirely while presenting.
  const [inXR, setInXR] = useState(false);
  const inXRRef = useRef(false);
  useFrame(() => {
    const presenting = gl.xr.isPresenting;
    if (presenting !== inXRRef.current) {
      inXRRef.current = presenting;
      setInXR(presenting);
    }
  });

  if (!parsed?.id || inXR) return null;
  return (
    <YouTubeLayer
      id={parsed.id}
      width={width}
      height={height}
      brightness={brightness}
      muted={muted}
    />
  );
}

function YouTubeLayer({
  id,
  width,
  height,
  brightness,
  muted,
}: {
  id: string;
  width: number;
  height: number;
  brightness: number;
  muted: boolean;
}) {
  const gl = useThree((s) => s.gl);
  // Snapshot the canvas's own styles during the first render — before drei's
  // layout effect (a child's, so it runs before ours) has changed them.
  const [original] = useState(() => ({
    zIndex: gl.domElement.style.zIndex,
    position: gl.domElement.style.position,
    pointerEvents: gl.domElement.style.pointerEvents,
  }));

  useLayoutEffect(() => {
    const canvas = gl.domElement;
    // drei set pointer-events: none so the DOM behind could be clicked; here
    // nothing behind should be, and the canvas has to keep receiving the
    // click that locks the pointer.
    canvas.style.pointerEvents = original.pointerEvents;
    return () => {
      canvas.style.zIndex = original.zIndex;
      canvas.style.position = original.position;
      canvas.style.pointerEvents = original.pointerEvents;
    };
  }, [gl, original]);

  // Layout size in px, and the drei distanceFactor that maps it back onto the
  // panel's width in metres (drei: world units = px × distanceFactor / 400).
  const pxW = YT_LAYOUT_PX;
  const pxH = Math.round((YT_LAYOUT_PX * height) / width);
  const distanceFactor = (width / pxW) * 400;

  // Cover the panel with a 16:9 player: size the iframe to overflow whichever
  // axis the panel is narrower in, and let the box crop it.
  const panelAspect = width / height;
  const frameW = panelAspect > 16 / 9 ? pxW : Math.round(pxH * (16 / 9));
  const frameH = panelAspect > 16 / 9 ? Math.round(pxW * (9 / 16)) : pxH;

  const src = useMemo(() => {
    const p = new URLSearchParams({
      autoplay: "1",
      mute: muted ? "1" : "0",
      loop: "1",
      // loop=1 only loops when the video is also its own playlist.
      playlist: id,
      controls: "0",
      disablekb: "1",
      playsinline: "1",
      rel: "0",
      modestbranding: "1",
      iv_load_policy: "3",
    });
    return `https://www.youtube-nocookie.com/embed/${id}?${p.toString()}`;
  }, [id, muted]);

  return (
    <Html
      transform
      occlude="blending"
      zIndexRange={[1, 0]}
      distanceFactor={distanceFactor}
      position={[0, 0, VIDEO_Z]}
      pointerEvents="none"
    >
      <div
        style={{
          width: pxW,
          height: pxH,
          overflow: "hidden",
          position: "relative",
          background: "#000",
          filter: `brightness(${brightness})`,
          pointerEvents: "none",
        }}
      >
        <iframe
          // A remount on mute change is what makes YouTube pick the new
          // `mute` param up; the player has no URL-less way to be told.
          key={src}
          src={src}
          title="Lyrics Wall video"
          allow="autoplay; encrypted-media; picture-in-picture"
          tabIndex={-1}
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: frameW,
            height: frameH,
            transform: "translate(-50%, -50%)",
            border: 0,
            pointerEvents: "none",
          }}
        />
      </div>
    </Html>
  );
}
