// lib/museum/panorama360.ts
//
// Renders the museum as a 360° equirectangular photo and stamps it so
// Facebook (and Google Photos, Flickr, …) treat it as a panorama.
//
// Why a *photo* and not a link: a Facebook post can only be a draggable 360°
// when the uploaded JPEG itself carries the Photo Sphere XMP block
// (`GPano:ProjectionType="equirectangular"` — the same metadata a Ricoh
// Theta or the FB app's own 360 mode writes). A link preview is always a
// flat OG image, no matter what the page behind it does. So "share this
// room in 360°" has to mean "hand the visitor a correctly-tagged JPEG", and
// this file is the whole of that: render, convert, tag.
//
// Rendering happens in three steps, all on the visitor's GPU:
//
//   1. A CubeCamera at the eye position draws the live scene into six
//      faces. Same scene graph the visitor is already looking at, so the
//      room's lights, dark mode, textures and admin-placed objects all come
//      along for free — nothing is re-described here.
//   2. A full-screen shader samples that cube map once per output pixel,
//      mapping longitude/latitude to a direction. Three.js switches tone
//      mapping and sRGB output *off* whenever it draws into a render target
//      (WebGLPrograms.js: only the default framebuffer gets them), so this
//      pass re-applies the renderer's own tone mapping + transfer function
//      using three's shader chunks — otherwise the export comes out washed
//      out and darker than the screen, which is the first thing anyone
//      would notice.
//   3. The pixels are read back, encoded as JPEG, and the XMP segment is
//      spliced in right after the JFIF header.
//
// Nothing here knows about React or which room it's in; the R3F bridge
// (app/(public)/gallery/museum/components/Room360Capture.tsx) supplies the
// renderer, scene and eye position and hands the result to a modal.

import * as THREE from "three";

export interface RenderPanoramaOptions {
  /** World-space eye position. */
  position: THREE.Vector3;
  /**
   * Yaw the *centre* of the image should face, in radians, measured the
   * same way as `Math.atan2(dir.x, -dir.z)` — 0 looks down −Z (north, the
   * direction the corridor runs), +π/2 looks down +X. The visitor's own
   * view direction, so the post opens on what they were looking at.
   */
  headingRad?: number;
  /**
   * Output width in pixels (height is always half). Facebook accepts up to
   * 6000 wide; 4096 is the sweet spot between "sharp when dragged" and a
   * 32 MB readback a phone can still manage. Clamped to what this GPU
   * allows for both 2D and cube textures.
   */
  width?: number;
  /** Objects this returns true for are hidden for the capture and restored
   *  after — editor gizmos, guide lines, anything that isn't the room. */
  exclude?: (object: THREE.Object3D) => boolean;
  /**
   * Adds anything the photo needs that the live scene doesn't have, and
   * returns the function that takes it out again — run around the render,
   * cleanup guaranteed. The editor uses it to fill its doorways: with no
   * neighbouring room behind them, an open doorway is a hole straight
   * through to the void-black scene background, dead centre of the shot.
   */
  stage?: (scene: THREE.Scene) => () => void;
}

export interface Panorama360Result {
  /** Slug of the room the photo was taken in — the caller resolves the
   *  display name and deep link from this rather than from whatever room
   *  state it holds by the time the encode finishes. */
  slug: string;
  /** JPEG bytes with the GPano XMP block already spliced in. */
  blob: Blob;
  width: number;
  height: number;
  /** A 1024-wide JPEG of the same picture, as an object URL, for the
   *  modal's preview <img> — decoding the full export there costs another
   *  32 MB on a phone that has just spent its budget rendering it. The
   *  consumer revokes it when done (Share360Modal.tsx does on unmount). */
  previewUrl: string;
  fileName: string;
}

// Names three's own tone-mapping functions (tonemapping_pars_fragment) by
// the renderer.toneMapping constant, so the export uses exactly the curve
// the live canvas does. R3F's <Canvas> defaults to ACESFilmic.
const TONE_MAPPING_FN: Partial<Record<THREE.ToneMapping, string>> = {
  [THREE.LinearToneMapping]: "LinearToneMapping",
  [THREE.ReinhardToneMapping]: "ReinhardToneMapping",
  [THREE.CineonToneMapping]: "CineonToneMapping",
  [THREE.ACESFilmicToneMapping]: "ACESFilmicToneMapping",
  [THREE.AgXToneMapping]: "AgXToneMapping",
  [THREE.NeutralToneMapping]: "NeutralToneMapping",
};

const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4( position.xy, 0.0, 1.0 );
  }
`;

// Longitude runs left→right across the image, latitude top→bottom.
// `vUv.y` is inverted for latitude on purpose: readRenderTargetPixels
// returns rows bottom-up, so making row 0 (vUv.y = 0) the *zenith* means the
// buffer is already top-down and can go straight into an ImageData without a
// flip pass. The direction basis is chosen so lon = 0 is −Z and lon = +π/2 is
// +X — i.e. looking north with +X on your right, which is what a right-handed
// viewer sees, so text on the walls reads the right way round.
// Only `tonemapping_pars_fragment` is pulled in by hand: three prepends it
// to a program's prefix solely when tone mapping is *on* for that draw,
// which it never is into a render target. `colorspace_pars_fragment`
// (sRGBTransferOETF) is in every fragment prefix unconditionally — including
// it again is a redefinition error and a black photo.
const FRAGMENT_SHADER = /* glsl */ `
  #include <common>
  #include <tonemapping_pars_fragment>
  uniform samplerCube cubeMap;
  uniform float heading;
  varying vec2 vUv;
  void main() {
    float lon = ( vUv.x - 0.5 ) * PI2 + heading;
    float lat = ( 0.5 - vUv.y ) * PI;
    float cl = cos( lat );
    vec3 dir = vec3( sin( lon ) * cl, sin( lat ), -cos( lon ) * cl );
    vec3 color = textureCube( cubeMap, dir ).rgb;
    #ifdef TONE_MAP_FN
      color = TONE_MAP_FN( color );
    #endif
    gl_FragColor = sRGBTransferOETF( vec4( color, 1.0 ) );
  }
`;

/**
 * Draws the scene from `position` into a 2:1 equirectangular canvas. Must
 * be called synchronously with no `await` before the readback — same
 * discipline as ScreenshotCapture.tsx: the caller owns the renderer's frame.
 *
 * Leaves the renderer exactly as it found it (render target, XR state,
 * hidden objects) even if a step throws.
 */
export function renderEquirectangular(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  options: RenderPanoramaOptions
): HTMLCanvasElement {
  const caps = renderer.capabilities;
  const requested = options.width ?? 4096;
  // Output in 512-px steps within what the GPU allows — 3072 is a real
  // option for phones (see pickPanoramaWidth), not just powers of two.
  const outWidth = Math.max(1024, Math.floor(Math.min(requested, caps.maxTextureSize) / 512) * 512);
  const outHeight = outWidth / 2;
  // Cube faces at *half* the output width — 2× supersampling. A face spans
  // 90°, so a quarter-width face would be sampled 1:1 only at its centre
  // and stretched towards its edges, and with plain bilinear lookups the
  // result read as soft everywhere (the first thing reported). Twice the
  // resolution plus mipmaps means every output pixel is a proper average
  // of at least a few rendered ones. WebGL2 mipmaps any size; WebGL1 only
  // powers of two, so the face rounds down there.
  let faceSize = Math.min(outWidth / 2, caps.maxCubemapSize);
  if (!caps.isWebGL2) faceSize = 2 ** Math.floor(Math.log2(faceSize));

  // 8-bit *sRGB* faces, not linear: the cube is the one place bit depth
  // shows, and 8-bit linear bands in a dark-mode room's shadows. Tagging
  // the target's texture SRGBColorSpace makes three allocate it as
  // SRGB8_ALPHA8 (WebGLTextures.getInternalFormat), so WebGL2 encodes on
  // write and decodes on sample in hardware — perceptual precision at
  // half the memory of half-float, which matters at 2048² × 6 faces
  // (100 MB here; 200 MB as half-float, enough to lose a phone tab).
  // Materials still write linear light into it: three's own shaders use
  // the linear OETF for any render target, exactly as before.
  const cubeTarget = new THREE.WebGLCubeRenderTarget(faceSize, {
    type: THREE.UnsignedByteType,
    colorSpace: THREE.SRGBColorSpace,
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
  });
  const cubeCamera = new THREE.CubeCamera(0.1, 100, cubeTarget);
  cubeCamera.position.copy(options.position);

  const outTarget = new THREE.WebGLRenderTarget(outWidth, outHeight, {
    type: THREE.UnsignedByteType,
    depthBuffer: false,
    stencilBuffer: false,
  });

  const toneFn = TONE_MAPPING_FN[renderer.toneMapping];
  const material = new THREE.ShaderMaterial({
    uniforms: {
      cubeMap: { value: cubeTarget.texture },
      heading: { value: options.headingRad ?? 0 },
      toneMappingExposure: { value: renderer.toneMappingExposure },
    },
    defines: toneFn ? { TONE_MAP_FN: toneFn } : {},
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    depthTest: false,
    depthWrite: false,
  });
  const quadScene = new THREE.Scene();
  quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));
  const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const hidden: THREE.Object3D[] = [];
  if (options.exclude) {
    const exclude = options.exclude;
    scene.traverse((object) => {
      if (object.visible && exclude(object)) {
        object.visible = false;
        hidden.push(object);
      }
    });
  }

  // Transmission is switched off for the shot. three r169's
  // renderTransmissionPass (WebGLRenderer.js) ends with
  // `setRenderTarget( currentRenderTarget )` — no active cube face — so
  // whenever a MeshPhysicalMaterial with transmission > 0 (the glass of a
  // GLB prop) is in a cube face's view, everything drawn after that pass
  // lands on face 0 and the face being rendered stays cleared: a solid
  // black 90° square in the photo, exactly where the prop was. Zeroing
  // transmission drops USE_TRANSMISSION from those materials' programs
  // (hence needsUpdate, both ways), so the pass never runs; the glass
  // renders as ordinary tinted physical material for the one frame.
  const transmissive: { material: THREE.MeshPhysicalMaterial; transmission: number }[] = [];
  scene.traverse((object) => {
    const material = (object as THREE.Mesh).material;
    for (const m of Array.isArray(material) ? material : material ? [material] : []) {
      const physical = m as THREE.MeshPhysicalMaterial;
      if (physical.isMeshPhysicalMaterial && physical.transmission > 0) {
        transmissive.push({ material: physical, transmission: physical.transmission });
        physical.transmission = 0;
        physical.needsUpdate = true;
      }
    }
  });

  const unstage = options.stage?.(scene);
  const previousTarget = renderer.getRenderTarget();
  try {
    cubeCamera.update(renderer, scene);

    renderer.setRenderTarget(outTarget);
    renderer.render(quadScene, quadCamera);
    // The cube (the largest allocation by far — 6 faces plus mipmaps) has
    // done its job once the equirect pass is drawn; free it *before* the
    // readback and canvas take their own copies, so the two never coexist.
    // A phone tab that reached ~250 MB here crashed to Chrome's "Aw, Snap".
    renderer.setRenderTarget(null);
    cubeTarget.dispose();
    renderer.setRenderTarget(outTarget);
    const pixels = new Uint8Array(outWidth * outHeight * 4);
    renderer.readRenderTargetPixels(outTarget, 0, 0, outWidth, outHeight, pixels);
    renderer.setRenderTarget(null);
    outTarget.dispose();

    const canvas = document.createElement("canvas");
    canvas.width = outWidth;
    canvas.height = outHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D context unavailable");
    ctx.putImageData(new ImageData(new Uint8ClampedArray(pixels.buffer), outWidth, outHeight), 0, 0);
    return canvas;
  } finally {
    renderer.setRenderTarget(previousTarget);
    unstage?.();
    for (const object of hidden) object.visible = true;
    for (const { material, transmission } of transmissive) {
      material.transmission = transmission;
      material.needsUpdate = true;
    }
    material.dispose();
    // Idempotent — already released on the happy path above; this is for
    // a throw partway through.
    outTarget.dispose();
    cubeTarget.dispose();
  }
}

/**
 * Export width for this device. The memory a capture needs scales with
 * the square of this: at 4096 the cube faces, the equirect target, the
 * readback, the canvas and the preview decode add up to ~250 MB on top of
 * the museum itself, which is fine on a desktop GPU and a crashed tab on
 * a mid-range phone. So phones step down — 3072 where Chrome reports
 * generous RAM (or won't say, which is every iPhone, all of them capable),
 * 2048 where it reports little — and the museum's own low-end tier (old
 * phones by core count / RAM, see deviceTier.ts) goes straight to 2048.
 * Facebook renders any of these as a 360°; 2048 is merely softer when
 * dragged on a large screen.
 */
export function pickPanoramaWidth(lowEnd: boolean): number {
  if (lowEnd) return 2048;
  if (typeof window === "undefined") return 4096;
  const coarse = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
  if (!coarse) return 4096;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (typeof memory === "number" && memory > 0 && memory < 6) return 2048;
  return 3072;
}

/**
 * Splices a Photo Sphere / GPano XMP packet into a JPEG so Facebook and
 * friends recognise it as an equirectangular 360°. Inserted as an APP1
 * segment straight after the JFIF APP0 (or the SOI marker when there is
 * none) — the position every reader scans first.
 *
 * `headingDeg` is where the image's centre column points, so the viewer
 * opens on the same thing the visitor was looking at.
 */
export function injectGPanoXmp(jpeg: ArrayBuffer, width: number, height: number, headingDeg = 0): Blob {
  const bytes = new Uint8Array(jpeg);
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new Error("Not a JPEG");
  }

  // Skip past an APP0 (JFIF) segment if the encoder wrote one — Chrome and
  // Safari both do. Segment length is big-endian and includes its own two
  // length bytes.
  let insertAt = 2;
  if (bytes[2] === 0xff && bytes[3] === 0xe0) {
    insertAt = 4 + ((bytes[4] << 8) | bytes[5]);
  }

  const heading = ((Math.round(headingDeg) % 360) + 360) % 360;
  const packet =
    '<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>' +
    '<x:xmpmeta xmlns:x="adobe:ns:meta/">' +
    '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">' +
    '<rdf:Description rdf:about="" xmlns:GPano="http://ns.google.com/photos/1.0/panorama/"' +
    ' GPano:ProjectionType="equirectangular"' +
    ' GPano:UsePanoramaViewer="True"' +
    ` GPano:FullPanoWidthPixels="${width}"` +
    ` GPano:FullPanoHeightPixels="${height}"` +
    ` GPano:CroppedAreaImageWidthPixels="${width}"` +
    ` GPano:CroppedAreaImageHeightPixels="${height}"` +
    ' GPano:CroppedAreaLeftPixels="0"' +
    ' GPano:CroppedAreaTopPixels="0"' +
    ` GPano:PoseHeadingDegrees="${heading}"` +
    ` GPano:InitialViewHeadingDegrees="${heading}"` +
    ' GPano:InitialViewPitchDegrees="0"' +
    ' GPano:InitialViewRollDegrees="0"' +
    ' GPano:InitialHorizontalFOVDegrees="75"' +
    "/></rdf:RDF></x:xmpmeta>" +
    '<?xpacket end="w"?>';

  const encoder = new TextEncoder();
  const namespace = encoder.encode("http://ns.adobe.com/xap/1.0/\0");
  const payload = encoder.encode(packet);
  const segmentLength = 2 + namespace.length + payload.length;
  if (segmentLength > 0xffff) throw new Error("XMP packet too large for one APP1 segment");

  const segment = new Uint8Array(2 + segmentLength);
  segment[0] = 0xff;
  segment[1] = 0xe1;
  segment[2] = (segmentLength >> 8) & 0xff;
  segment[3] = segmentLength & 0xff;
  segment.set(namespace, 4);
  segment.set(payload, 4 + namespace.length);

  const out = new Uint8Array(bytes.length + segment.length);
  out.set(bytes.subarray(0, insertAt), 0);
  out.set(segment, insertAt);
  out.set(bytes.subarray(insertAt), insertAt + segment.length);
  return new Blob([out], { type: "image/jpeg" });
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("JPEG encode failed"))), "image/jpeg", quality);
  });
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<ArrayBuffer> {
  return canvasToJpegBlob(canvas, quality).then((blob) => blob.arrayBuffer());
}

async function makePreviewUrl(canvas: HTMLCanvasElement): Promise<string> {
  const small = document.createElement("canvas");
  small.width = Math.min(1024, canvas.width);
  small.height = small.width / 2;
  const ctx = small.getContext("2d");
  if (!ctx) throw new Error("2D context unavailable");
  ctx.drawImage(canvas, 0, 0, small.width, small.height);
  return URL.createObjectURL(await canvasToJpegBlob(small, 0.85));
}

/**
 * The whole pipeline: render → JPEG → tag. `renderEquirectangular` runs
 * synchronously up front (it must — see its doc comment); only the encode
 * is async.
 */
export async function capturePanorama360(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  options: RenderPanoramaOptions & { slug: string; quality?: number }
): Promise<Panorama360Result> {
  const canvas = renderEquirectangular(renderer, scene, options);
  const { width, height } = canvas;
  const jpeg = await canvasToJpeg(canvas, options.quality ?? 0.95);
  const previewUrl = await makePreviewUrl(canvas);
  // Release the full-size canvas's backing store now rather than when GC
  // gets round to it — on a phone that's the difference between the next
  // step fitting or not.
  canvas.width = 0;
  canvas.height = 0;
  const headingDeg = ((options.headingRad ?? 0) * 180) / Math.PI;
  const blob = injectGPanoXmp(jpeg, width, height, headingDeg);
  return {
    slug: options.slug,
    blob,
    width,
    height,
    previewUrl,
    fileName: `scriptovernovel-360-${options.slug}-${Date.now()}.jpg`,
  };
}

/** The visitor-facing deep link for a room — `?room=` is what
 *  app/(public)/gallery/museum/page.tsx already resolves on entry. */
export function roomShareUrl(slug: string): string {
  return `${window.location.origin}/gallery/museum?room=${encodeURIComponent(slug)}`;
}

/** Whether this browser can hand a file to the OS share sheet — true on
 *  every current phone browser, and on Safari/Chrome desktop with a share
 *  target installed. The modal only offers "Share…" when this is. */
export function canShareFile(blob: Blob, fileName: string): boolean {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") return false;
  if (typeof navigator.canShare !== "function") return false;
  try {
    return navigator.canShare({ files: [new File([blob], fileName, { type: blob.type })] });
  } catch {
    return false;
  }
}

export type ShareOutcome = "shared" | "cancelled";

/**
 * Opens the OS share sheet with the JPEG. Facebook's app accepts a photo
 * this way and keeps its XMP, so the resulting post is a real 360°.
 * "cancelled" is the visitor dismissing the sheet — not an error, and the
 * modal stays open so they can pick Download instead.
 */
export async function shareViaSheet(result: Panorama360Result, title: string, text: string): Promise<ShareOutcome> {
  const file = new File([result.blob], result.fileName, { type: result.blob.type });
  try {
    await navigator.share({ files: [file], title, text });
    return "shared";
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
    throw error;
  }
}

export function downloadPanorama(result: Panorama360Result): void {
  // Its own object URL — previewUrl is the small preview, not the export.
  // Revoked on the next tick, after the click has handed it to the browser.
  const url = URL.createObjectURL(result.blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = result.fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
