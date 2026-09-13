"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Map, MonitorSmartphone, Sun, Moon, Camera, Download, Volume2, VolumeX, RectangleHorizontal, Compass, Settings2, Aperture, EyeOff, Eye, Glasses } from "lucide-react";
import type { MuseumRoomPublic, MuseumAboutData, MuseumChaseCompanion, MuseumAchievementPublic, FreedomWallNotePublic } from "@/types";
import type { IntroEffect } from "@/lib/intro-splash";
import type { SplashStyle } from "@/lib/museum-splash";
import { MuseumGridFallback } from "./MuseumGridFallback";
import { LoadingScreen, clearMuseumAutoReloads } from "./components/LoadingScreen";
import { MuseumMap } from "./components/MuseumMap";

import { RoomSplash } from "./components/RoomSplash";
import { AchievementHud } from "./components/AchievementHud";
import { AchievementBanner } from "./components/AchievementBanner";
import { AchievementResetNotice } from "./components/AchievementResetNotice";
import { ExitConfirmModal } from "./components/ExitConfirmModal";
import toast from "@/lib/toast";
import { MiniMapHud } from "./components/MiniMapHud";
import type { MinimapHudConfig } from "@/lib/museum/minimapHud";
import { VISION_FILTER_STORAGE_KEY, type VisionFilter } from "@/lib/museum/visionFilters";
import { StatsMinimapPanel } from "./components/StatsMinimapPanel";
import type { MiniMapFrameState } from "./components/MiniMapTracker";
import { useMuseumAchievements } from "@/lib/museum/useMuseumAchievements";
import { playSoundEffect } from "@/lib/sound/engine";
import type { RoomTravelRequest } from "./components/roomLayout";

// Three.js must never touch the server bundle — this is the one and only
// place it's imported, and only on the client, only once a device has
// actually opted into (or defaulted into) the 3D view.
const MuseumSceneLoader = dynamic(
  () => import("./MuseumSceneLoader").then((m) => m.MuseumSceneLoader),
  // `slowNotice` covers the case no error boundary can catch. A chunk import
  // that *rejects* throws on the next render and reaches app/error.tsx like any
  // other error — that case is already handled. The one that isn't is a request
  // that is merely slow, or stalls without ever settling: nothing rejects,
  // nothing throws, and this fallback simply stays on screen. After 12s it says
  // so, and asks the visitor to sit tight rather than reload.
  { ssr: false, loading: () => <LoadingScreen slowNotice /> }
);

// Dynamic for one reason, and it is the whole reason entering the museum was
// slow: EntryLoadGate calls drei's `useProgress`, and importing it statically
// pulled @react-three/drei — and through it all of three.js — into the chunk
// set the museum page loads *eagerly*, in the page HTML.
//
// That silently defeated the `{ ssr: false }` split above. MuseumSceneLoader's
// own comment says it and everything it imports is the part next/dynamic
// defers, but a second static edge into the same library puts it back on the
// critical path, and webpack has no reason to warn about it. Measured on the
// production build: the eager JS for /gallery/museum was 1823 KB, 685 KB of it
// a single three.js chunk that had to arrive before anything could render —
// which is exactly the wait visitors were sitting through, and exactly why a
// refresh was instant (those chunks carry a one-year immutable Cache-Control,
// so the second attempt paid none of it).
//
// The gate is only ever rendered once `view === "3d"`, so deferring it costs
// nothing: it now lands in the same async chunk as the scene it is measuring,
// which is where it always belonged.
const EntryLoadGate = dynamic(
  () => import("./components/EntryLoadGate").then((m) => m.EntryLoadGate),
  { ssr: false, loading: () => <LoadingScreen /> }
);

// The Grid View toggle is gone — touch now has real 3D controls (see
// TouchControls.tsx/PlayerControls.tsx), so "unsupported" (no WebGL at
// all) is the only case that still falls back to MuseumGridFallback.
type View = "loading" | "3d" | "unsupported";

// Visitor's own ambiance preference for the 3D room, distinct from (and
// deliberately not touching) the site-wide `theme` key ThemeToggle.tsx
// manages — this only dims the museum's own lights/fog (see
// roomConstants.ts), not the surrounding site's light/dark CSS.
// Version-suffixed: the previous dark-first default *auto-seeded* "1" for
// every visitor on their first load, so a plain default flip would leave
// almost everyone still entering in dark on a preference they never chose.
// The new key gives all visitors the light-mode default once; from there
// the [L] toggle persists their real choice as before.
const DARK_MODE_STORAGE_KEY = "museum_dark_mode_v2";
// Mobile-only forced-landscape preference (CSS rotate, not a real OS
// orientation lock — see the state declaration below for why).
const LANDSCAPE_MODE_STORAGE_KEY = "museum_landscape_mode";

function detectWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      canvas.getContext("webgl2") ||
        canvas.getContext("webgl") ||
        canvas.getContext("experimental-webgl")
    );
  } catch {
    return false;
  }
}

export function MuseumClient({
  rooms,
  initialRoomId,
  aboutRoomId,
  aboutData,
  chaseCompanions,
  achievementsEnabled,
  achievementsHudEnabled,
  minimapConfig,
  achievements,
  splashEnabled,
  splashStyle,
  splashStyleMobile,
  splashEffect,
  splashSpeedMs,
  splashBgColor,
  splashTaglineFontSize,
  splashTaglineFontFamily,
  museumMusicUrl,
  museumMusicVolume = 50,
  brightnessLight = 50,
  brightnessDark = 50,
  visionFilters = [],
  servicesRoomId = null,
  storiesRoomId = null,
  arcadeRoomId = null,
  cosplayRoomId = null,
  freedomWallRoomId = null,
  freedomWallNotes: initialFreedomWallNotes = [],
  freedomWallEventTitle = null,
  freedomWallAcceptingNotes = false,
  deepLinkRoom = null,
  deepLinkRoomId = null,
}: {
  rooms: MuseumRoomPublic[];
  initialRoomId: string;
  /** Id of the auto-generated "About ScriptOverNovel" room — see page.tsx. */
  aboutRoomId: string;
  aboutData: MuseumAboutData;
  /** Only the *enabled* ones — see page.tsx. Up to 5. */
  chaseCompanions: MuseumChaseCompanion[];
  achievementsEnabled: boolean;
  achievementsHudEnabled: boolean;
  /** The admin's museum-wide look for the radar card — canvas size, the
   *  colour of every mark on the map, and the counters' size and icons. See
   *  lib/museum/minimapHud.ts; an unconfigured museum gets that module's
   *  defaults, which are the values these components shipped with. */
  minimapConfig: MinimapHudConfig;
  achievements: MuseumAchievementPublic[];
  splashEnabled: boolean;
  /** "full-page" (fullscreen reveal) or "side-popup" (slide-in card from the
   * right edge) — the *desktop* choice. See RoomSplash.tsx. */
  splashStyle: SplashStyle;
  /** Same two options, touch visitors' own independent choice. */
  splashStyleMobile: SplashStyle;
  splashEffect: IntroEffect;
  splashSpeedMs: number;
  splashBgColor: string;
  splashTaglineFontSize: string;
  splashTaglineFontFamily: string;
  /** Museum-specific soundtrack URL — null means no museum music is
   *  configured or enabled (admin toggle off). Separate from the
   *  site-wide BackgroundMusicPlayer which is hidden behind z-50. */
  museumMusicUrl?: string | null;
  museumMusicVolume?: number;
  /** Admin-set scene brightness (0–100, 50 = baseline) for light mode. */
  brightnessLight?: number;
  /** Admin-set scene brightness (0–100, 50 = baseline) for dark mode. */
  brightnessDark?: number;
  /** The looks a visitor can cycle with [Q] / the HUD button, already
   *  resolved from the museum's config (see lib/museum/visionFilters.ts).
   *  Empty means the feature is switched off for this museum, and neither
   *  the key handler nor the button exists at all. */
  visionFilters?: VisionFilter[];
  /** Id of the Services / shop-wall room — null when the room is disabled. */
  servicesRoomId?: string | null;
  /** Id of the Stories room — null when the room is disabled. */
  storiesRoomId?: string | null;
  /** Id of the Arcade / mini-games room — null when the room is disabled. */
  arcadeRoomId?: string | null;
  /** Id of the Cosplay / standee room — null when the room is disabled. */
  cosplayRoomId?: string | null;
  /** Id of the Freedom Wall room — null when the room is disabled. */
  freedomWallRoomId?: string | null;
  /** Server-fetched initial notes for the active event. */
  freedomWallNotes?: FreedomWallNotePublic[];
  /** Title of the active FreedomWallEvent, straight from the server render —
   *  admin renames land here on the next load (page.tsx is force-dynamic). */
  freedomWallEventTitle?: string | null;
  /** True when the wall is accepting new submissions (active event set + isActive). */
  freedomWallAcceptingNotes?: boolean;
  /**
   * Deep-link slug from the page's ?room= search param ("freedom-wall" |
   * "about" | "services" | "stories" | "arcade" | "cosplay") — fires a
   * travelRequest on mount so the visitor lands directly in that room instead
   * of the entry room.
   */
  deepLinkRoom?: string | null;
  /** ?roomId= — the same deep link addressed by MuseumRoom.id instead of by
   *  one of the six slugs above, which is the only way to name a curated room
   *  (see page.tsx). Takes precedence over the slug when both are present:
   *  an id is the more specific request. */
  deepLinkRoomId?: string | null;
}) {
  // Freedom Wall notes — starts from server-fetched data, optimistically
  // extended each time a visitor submits a note via FreedomWallCorner.
  const [freedomWallNotes, setFreedomWallNotes] = useState<FreedomWallNotePublic[]>(initialFreedomWallNotes);

  function handleFreedomWallNoteAdded(note: FreedomWallNotePublic) {
    setFreedomWallNotes((prev) => [...prev, note]);
  }
  // …and re-read from the server every time the visitor walks into the wall's
  // room (see the effect further down, once currentRoomId exists). The notes
  // handed down as props are a snapshot of whenever this page was rendered,
  // and a museum session is long-lived: it survives tab switches, bfcache
  // restores and back-navigations, so an admin who repositions notes in the
  // Museum Scene Editor and then returns to an already-open museum tab would
  // otherwise keep seeing the layout from before their Save with nothing on
  // screen suggesting a reload was needed.
  const [view, setView] = useState<View>("loading");
  // `view` only ever answered "can this device run WebGL at all" — it flips to
  // "3d" from a synchronous capability check, before a single texture or .glb
  // has been requested. This is the separate question of whether what the
  // visitor is about to look at has actually arrived; EntryLoadGate below
  // resolves it from THREE.DefaultLoadingManager. Kept apart from `view`
  // because the scene has to be *mounted* for its assets to start loading at
  // all, so this can't be another state the canvas waits behind.
  const [assetsReady, setAssetsReady] = useState(false);
  const [isCoarsePointer, setIsCoarsePointer] = useState(false);
  // Museum-specific audio — separate <audio> from BackgroundMusicPlayer.
  // The museum page sits at z-50, hiding that global player behind it.
  const museumAudioRef = useRef<HTMLAudioElement | null>(null);
  const [musicPlaying, setMusicPlaying] = useState(false);

  function toggleMuseumMusic() {
    const audio = museumAudioRef.current;
    if (!audio) return;
    if (musicPlaying) {
      audio.pause();
      setMusicPlaying(false);
    } else {
      audio.play().catch(() => setMusicPlaying(false));
      setMusicPlaying(true);
    }
  }
  // Which room the visitor is currently walking through — driven live by
  // PlayerControls.tsx's position tracking (see MuseumScene.tsx's
  // onRoomChange), not a selection the visitor makes. Grid View (no WebGL)
  // still needs an explicit room switcher of its own, since there's no
  // walking involved there.
  const [currentRoomId, setCurrentRoomId] = useState(initialRoomId);
  const [gridRoomId, setGridRoomId] = useState(initialRoomId);
  const [mapOpen, setMapOpen] = useState(false);
  // "Click a room in the map, land there" — PlayerControls.tsx watches this
  // (threaded through MuseumSceneLoader/MuseumScene) and teleports on
  // `token` changing, not `roomId` alone, so re-clicking the same room still
  // re-triggers it. See roomLayout.ts's RoomTravelRequest docstring.
  const [travelRequest, setTravelRequest] = useState<RoomTravelRequest | null>(null);
  const travelTokenRef = useRef(0);

  // Re-read the Freedom Wall's notes from the server each time the visitor
  // walks into that room, so their positions/sizes are whatever the admin
  // last saved rather than whatever was true when this page first rendered
  // (see the note next to handleFreedomWallNoteAdded above). GET
  // /api/freedom-wall/notes is force-dynamic and returns exactly the shape
  // page.tsx passes in, so the fresh rows can replace the props wholesale —
  // any note this session submitted optimistically is already in that
  // response too, since it was written to the database before we ever added
  // it locally. A failed fetch keeps whatever is already on the wall.
  useEffect(() => {
    if (!freedomWallRoomId || currentRoomId !== freedomWallRoomId) return;
    let cancelled = false;
    fetch("/api/freedom-wall/notes", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((rows: FreedomWallNotePublic[] | null) => {
        if (!cancelled && Array.isArray(rows)) setFreedomWallNotes(rows);
      })
      .catch(() => {
        /* offline / transient — the wall keeps the notes it already has */
      });
    return () => {
      cancelled = true;
    };
  }, [currentRoomId, freedomWallRoomId]);
  // [H] / the camera button — hides every HUD overlay (top bar, room label,
  // "Click to look around" legend, [E]/exhibition prompts, room splash, the
  // About corner card) for a clean screenshot. Desktop-only problem: taking
  // an OS-level screenshot (Cmd+Shift+4 on Mac, Win+Shift+S on Windows)
  // blurs the browser tab, and both browsers auto-*release Pointer Lock the
  // instant a page loses focus* — that's the browser's own security
  // behavior (stops a malicious page from trapping the cursor), not
  // anything a website can suppress. So the moment a visitor's OS
  // screenshot tool grabs focus, PlayerControls' onUnlock fires and the
  // "Click to look around" card reappears — right as the screenshot is
  // taken. This can't be fixed at the pointer-lock layer at all; the fix is
  // giving the HUD its own visibility switch that doesn't depend on lock
  // state, so a visitor can hide it *before* invoking their OS tool.
  const [hudHidden, setHudHidden] = useState(false);
  // [R] / the download button — captures the WebGL canvas as a PNG and
  // downloads it directly, no OS screenshot tool involved at all. Unlike
  // hudHidden above, this needs no hiding trick: gl.domElement.toDataURL()
  // only ever returns the canvas's own drawn pixels — the HUD is a separate
  // DOM layer that was never part of that buffer to begin with (see
  // ScreenshotCapture.tsx). The capture function itself only exists inside
  // <Canvas> (needs useThree() for the renderer), so this ref is the bridge
  // out — same pattern as MuseumScene.tsx's moveRef/lookRef, just owned up
  // here instead so both the [R] keydown (inside MuseumScene) and this
  // button (out here) can reach the same instance.
  const captureRef = useRef<(() => void) | null>(null);
  // MiniMapHud.tsx's own rAF loop reads this — written every frame by
  // MiniMapTracker.tsx inside the Canvas, never through React state (see
  // that file's doc comment).
  const minimapRef = useRef<MiniMapFrameState | null>(null);
  // Defaults to light mode — visitors should walk into a bright, fully-lit
  // gallery. Dark mode is still available via the [L] toggle; the
  // localStorage preference overrides this once the effect runs client-side.
  // Using `false` here means a first-time visitor immediately sees the lit
  // gallery instead of a dark flash that snaps to light after hydration.
  const [darkMode, setDarkMode] = useState(false);

  // Forced-landscape (mobile only) — a pure-CSS rotate, not the Screen
  // Orientation Lock API (screen.orientation.lock has no support on iOS
  // Safari at all, even installed as a PWA, so a real lock would simply
  // not work for a large share of phone visitors). Persisted the same way
  // darkMode is; actual device orientation is tracked separately below so
  // the rotate transform only applies while the phone is genuinely held
  // in portrait — a visitor who naturally rotates to landscape shouldn't
  // see it applied on top of their own real landscape view.
  const [landscapeMode, setLandscapeMode] = useState(false);
  const [isPortrait, setIsPortrait] = useState(true);
  // Session-only (not persisted) — iOS 13+ requires a fresh user gesture
  // to grant motion-sensor access each time, so remembering "was on last
  // visit" would just mean silently failing to actually turn it on again.
  const [gyroEnabled, setGyroEnabled] = useState(false);
  // VR mode (Docs/Museum_VRMode.md's Phase 2 — mode plumbing only; no XR
  // session code exists yet, this just tracks whether the visitor has
  // asked for it). Session-only like gyroEnabled, not persisted: a
  // headset isn't guaranteed to be connected on the next visit, and
  // remembering "was on last time" would just mean the button silently
  // does nothing on a device with no XR support at all.
  const [vrMode, setVrMode] = useState(false);
  // Whether *this* browser/device can even attempt an immersive-vr
  // session — most visitors are on a phone or a desktop with no headset,
  // so the button renders nothing rather than offering a feature that
  // would just fail. `navigator.xr` itself is undefined on a browser with
  // no WebXR support at all (most of them, still); `isSessionSupported`
  // additionally checks for an actual capable device/runtime.
  const [vrSupported, setVrSupported] = useState(false);
  // The Landscape/Gyroscope toggles used to be two standalone pills in the
  // top bar — on top of Music/Save Photo/Dark Mode/Map that's a lot of
  // buttons crammed into a narrow phone screen. Both now live inside one
  // "View" dropdown instead (see the render below).
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  // Mobile-only: whether the minimap is currently expanded out of the stats
  // card (see StatsMinimapPanel.tsx). Desktop's minimap is always on and
  // never consults this. Starts collapsed — the card is the visitor's
  // affordance for asking, and opening uninvited would put back exactly the
  // permanent overlay the mobile HUD was kept clear of. Deliberately not
  // persisted, unlike darkMode/landscapeMode: this is a "check where I am
  // right now" glance, not a standing preference about how the museum looks.
  const [minimapOpen, setMinimapOpen] = useState(false);

  // ── Filter Vision ──────────────────────────────────────────────────────
  // Which look is on, by filter id, or null for Normal. Persisted like dark
  // mode: it's a standing preference about how the visitor wants the museum
  // to look, not a momentary glance.
  //
  // Starts null on both server and client even when a preference is stored,
  // and the effect below applies it after hydration. Reading localStorage in
  // the initialiser would make the server's HTML and the client's first
  // render disagree.
  const [activeFilterId, setActiveFilterId] = useState<string | null>(null);

  useEffect(() => {
    if (visionFilters.length === 0) return;
    try {
      const stored = localStorage.getItem(VISION_FILTER_STORAGE_KEY);
      // Checked against what this museum currently offers — an admin can
      // disable a built-in or delete a custom filter between visits, and a
      // remembered id for one that no longer exists must not leave the
      // visitor looking at nothing while the HUD claims a filter is on.
      if (stored && visionFilters.some((f) => f.id === stored)) setActiveFilterId(stored);
    } catch {
      // Storage blocked — the filter just doesn't carry over. Harmless.
    }
  }, [visionFilters]);

  const activeFilter = visionFilters.find((f) => f.id === activeFilterId) ?? null;

  /** [Q] / the HUD button — Normal → each filter in order → Normal. One
   *  control rather than a menu: this is a thing to try, and cycling invites
   *  trying it in a way a dropdown does not. */
  function cycleVisionFilter() {
    if (visionFilters.length === 0) return;
    setActiveFilterId((prev) => {
      const index = prev === null ? -1 : visionFilters.findIndex((f) => f.id === prev);
      // Past the last filter, wrap to null (Normal) rather than to the first
      // — so the cycle always passes back through the unfiltered museum and
      // a visitor is never more than a few presses from what it really looks
      // like.
      const next = index + 1 >= visionFilters.length ? null : visionFilters[index + 1].id;
      try {
        if (next) localStorage.setItem(VISION_FILTER_STORAGE_KEY, next);
        else localStorage.removeItem(VISION_FILTER_STORAGE_KEY);
      } catch {
        /* see above */
      }
      return next;
    });
  }

  // Digital Museum Achievements — see lib/museum/useMuseumAchievements.ts.
  // Hook itself is always called (rules of hooks). The steps/elapsed-time
  // counting inside it now always runs regardless of achievementsEnabled
  // (MiniMapHud.tsx's stats row reuses that same data independent of the
  // Achievements feature) — only the threshold/banner/claim machinery
  // built on top of those counts stays gated behind achievementsEnabled,
  // so a museum that hasn't turned Achievements on still sees no banners.
  const achievementsState = useMuseumAchievements(achievements, achievementsEnabled);

  // Back to Gallery confirmation — see components/ExitConfirmModal.tsx for
  // why this is a real component rather than the browser's own dialog.
  // Armed by the same `hasProgress` the refresh guard uses, so the two can't
  // disagree about whether this visit has anything to lose.
  const router = useRouter();
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  function leaveMuseum() {
    setShowExitConfirm(false);
    playSoundEffect("museum.exit");
    router.push("/");
  }

  // Deep-link travel — if the page was opened with ?room=<slug> or
  // ?roomId=<id>, fire a travelRequest once on mount so the visitor lands
  // directly in that room. The 300ms wait lets the scene mount so
  // PlayerControls is registered to read the request.
  useEffect(() => {
    const target =
      // Only a room actually in this corridor — an id for a room that is
      // switched off, deleted or simply wrong travels nowhere rather than
      // stranding the visitor at coordinates no room occupies.
      (deepLinkRoomId && rooms.some((r) => r.id === deepLinkRoomId) ? deepLinkRoomId : null)
      ?? (
      deepLinkRoom === "freedom-wall" ? freedomWallRoomId
      : deepLinkRoom === "about" ? aboutRoomId
      : deepLinkRoom === "services" ? servicesRoomId
      : deepLinkRoom === "stories" ? storiesRoomId
      : deepLinkRoom === "arcade" ? arcadeRoomId
      : deepLinkRoom === "cosplay" ? cosplayRoomId
      : null);
    if (!target) return;
    const t = setTimeout(() => {
      travelTokenRef.current += 1;
      setTravelRequest({ roomId: target, token: travelTokenRef.current });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — fires once on mount only

  // Release pointer lock the instant a claim-worthy banner appears — same
  // "Escape already does this, just do it for them" pattern as toggleMap
  // below. Without it, a desktop visitor would have to notice their cursor
  // is missing and press Escape themselves before the Name/Email inputs in
  // AchievementBanner.tsx would even accept a click.
  useEffect(() => {
    if (achievementsState.banner && typeof document !== "undefined") document.exitPointerLock?.();
  }, [achievementsState.banner]);

  useEffect(() => {
    const webglOk = detectWebGL();
    const coarse =
      typeof window !== "undefined" &&
      window.matchMedia("(pointer: coarse)").matches;
    setIsCoarsePointer(coarse);

    try {
      const stored = localStorage.getItem(DARK_MODE_STORAGE_KEY);
      if (stored === null) {
        // First visit — seed the stored value so the toggle correctly persists
        // subsequent changes from the light-first default.
        localStorage.setItem(DARK_MODE_STORAGE_KEY, "0");
        setDarkMode(false);
      } else {
        setDarkMode(stored === "1");
      }
    } catch {
      // Storage blocked — stays on the light-mode default (useState(false) above).
    }

    try {
      const storedLandscape = localStorage.getItem(LANDSCAPE_MODE_STORAGE_KEY);
      if (storedLandscape === null) {
        // First visit — default straight to forced landscape instead of
        // requiring an explicit tap first (per user request). Harmless to
        // seed this true on desktop too: forceRotate only ever applies
        // when isCoarsePointer is also true (see forceRotate below).
        localStorage.setItem(LANDSCAPE_MODE_STORAGE_KEY, "1");
        setLandscapeMode(true);
      } else {
        setLandscapeMode(storedLandscape === "1");
      }
    } catch {
      // Storage blocked — default to on anyway so a touch visitor still
      // lands in landscape; just won't remember a later manual change.
      setLandscapeMode(true);
    }

    setView(webglOk ? "3d" : "unsupported");
  }, []);

  // VR button visibility — feature-detected once on mount rather than just
  // checking `navigator.xr` exists, so a desktop Chrome with the API present
  // but no headset plugged in doesn't get offered a session that would only
  // fail (isSessionSupported resolves false there, not just on browsers with
  // no WebXR at all). No React Three Fiber/XR code runs yet — see
  // Docs/Museum_VRMode.md's Phase 3 — this only decides whether the button
  // in the HUD row (below) renders at all.
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.xr) return;
    let cancelled = false;
    navigator.xr
      .isSessionSupported("immersive-vr")
      .then((supported) => {
        if (!cancelled) setVrSupported(supported);
      })
      .catch(() => {
        // Some browsers reject rather than resolve false for a mode they
        // don't recognize at all — either way, no button.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Real device orientation — separate from the landscapeMode *preference*
  // above, since the forced-rotate transform should only ever apply while
  // the phone is actually held in portrait (see landscapeMode's own doc
  // comment).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(orientation: portrait)");
    setIsPortrait(mql.matches);
    function onChange(e: MediaQueryListEvent) {
      setIsPortrait(e.matches);
    }
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  // Actual measured viewport pixels — the forceRotate box below used to be
  // sized with `100vh`/`100vw` directly, which reported a visibly wrong
  // (larger than the real, currently-visible viewport) box on several
  // mobile browsers whenever the address-bar/toolbar chrome collapses or
  // expands — `100vh` in particular is notorious for measuring against the
  // *largest possible* viewport rather than what's actually on screen right
  // now. The mismatch showed up as a black gap covering roughly the bottom
  // half of the screen (the rotated box's real rendered size falling short
  // of the true viewport) with the joystick/jump button visually thrown off
  // along with it. Measuring window.innerWidth/innerHeight directly and
  // reacting to resize/orientationchange sidesteps that unit entirely.
  const [viewportPx, setViewportPx] = useState({ w: 0, h: 0 });
  useEffect(() => {
    if (typeof window === "undefined") return;
    function measure() {
      setViewportPx({ w: window.innerWidth, h: window.innerHeight });
    }
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, []);

  function toggleLandscapeMode() {
    setLandscapeMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(LANDSCAPE_MODE_STORAGE_KEY, next ? "1" : "0");
      } catch {
        // Non-persistent this session — harmless, just won't carry over.
      }
      return next;
    });
  }

  // The toggle button itself is the "recent, real user gesture" iOS 13+
  // requires before DeviceOrientationEvent.requestPermission will ever
  // resolve to "granted" — calling this from anywhere else (e.g. on mount)
  // would just silently fail there. Browsers without the gated API
  // (everything except iOS Safari) skip straight to listening — motion
  // data is unrestricted there.
  async function toggleGyro() {
    if (gyroEnabled) {
      setGyroEnabled(false);
      return;
    }
    const RequestableDeviceOrientationEvent = window.DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<"granted" | "denied">;
    };
    if (typeof RequestableDeviceOrientationEvent?.requestPermission === "function") {
      try {
        const result = await RequestableDeviceOrientationEvent.requestPermission();
        if (result !== "granted") {
          toast.error("Motion access denied — enable it in your browser settings to use tilt-to-look.");
          return;
        }
      } catch {
        toast.error("Couldn't request motion access.");
        return;
      }
    }
    setGyroEnabled(true);
  }

  // Close the "View" dropdown on any tap/click outside it — same pattern
  // as a native select/menu, otherwise it'd stay open over the 3D scene
  // until the visitor found the button again.
  useEffect(() => {
    if (!mobileMenuOpen) return;
    function onOutside(e: Event) {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setMobileMenuOpen(false);
      }
    }
    document.addEventListener("touchstart", onOutside);
    document.addEventListener("mousedown", onOutside);
    return () => {
      document.removeEventListener("touchstart", onOutside);
      document.removeEventListener("mousedown", onOutside);
    };
  }, [mobileMenuOpen]);

  function toggleDarkMode() {
    setDarkMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(DARK_MODE_STORAGE_KEY, next ? "1" : "0");
      } catch {
        // Non-persistent this session — harmless, just won't carry over.
      }
      return next;
    });
  }

  // [M] (or the HUD button) both opens *and* closes the map now — same
  // toggle pattern as [E] for the artwork panel and [L] for dark mode,
  // instead of only ever being able to open it.
  function toggleMap() {
    setMapOpen((prev) => {
      const next = !prev;
      // Opening it: release pointer lock so the map's room rows are
      // actually clickable. Under Pointer Lock, mouse events keep targeting
      // whatever element originally requested the lock (the canvas), not
      // whatever the (invisible) cursor is currently over — without this, a
      // locked visitor's clicks on the map would silently hit the canvas
      // behind it instead of the room row. PlayerControls' existing
      // onUnlock handler (the same one Esc already triggers) takes it from
      // here. A no-op if nothing was locked to begin with.
      if (next && typeof document !== "undefined") document.exitPointerLock?.();
      return next;
    });
  }

  // A map row was clicked — teleport (PlayerControls.tsx resolves roomId to
  // a world position) and close the map, same as picking a destination on
  // any real map does.
  function handleSelectRoom(roomId: string) {
    travelTokenRef.current += 1;
    setTravelRequest({ roomId, token: travelTokenRef.current });
    setMapOpen(false);
  }

  function toggleHud() {
    setHudHidden((prev) => {
      const next = !prev;
      // Don't leave the map modal floating in an otherwise-hidden HUD.
      if (next) setMapOpen(false);
      return next;
    });
  }

  // A plain state flip — the actual XR session request/end lives inside
  // MuseumScene.tsx (see its own `vrMode` prop effect), never here. This
  // file is "the one and only place [three.js] is imported, and only on
  // the client" (see MuseumSceneLoader's dynamic-import comment above) —
  // @react-three/xr pulls in three.js just like drei/fiber do, so it can't
  // be imported here either without putting the eager 3D bundle straight
  // back on this page's critical path, exactly what that split exists to
  // avoid.
  function toggleVrMode() {
    setVrMode((prev) => !prev);
  }

  // MuseumScene reports back once its own store's session actually starts
  // or ends — a headset's *own* "Exit VR" UI ends the session without ever
  // going through this button, and without this the button would keep
  // reading "in VR" for a visitor who plainly isn't anymore.
  const handleVrPresentingChange = useCallback((presenting: boolean) => {
    setVrMode(presenting);
  }, []);

  const currentRoom = rooms.find((r) => r.id === currentRoomId) ?? rooms[0];
  const currentIndex = rooms.findIndex((r) => r.id === currentRoom.id);

  // Pure-CSS forced-landscape — see landscapeMode's own doc comment for why
  // this isn't the real Screen Orientation Lock API. Only actually applies
  // while the phone is genuinely in portrait (isPortrait) — a visitor who's
  // already turned their phone sideways sees their own real landscape view
  // untouched, this only kicks in to *simulate* one.
  //
  // Sized/anchored with a *centered* rotate rather than the more commonly
  // copy-pasted "shift right by 100%, rotate around the top-left corner"
  // recipe: position the box's own center at the viewport's center (top:
  // 50%, left: 50%, translate(-50%,-50%)), *then* rotate it 90° about that
  // same center point. A box measuring H×W (viewportPx's height×width)
  // centered and rotated 90° about its own middle has a final on-screen
  // footprint of exactly W×H — i.e. exactly the real viewport, dead
  // center, by construction — with no corner-offset arithmetic to get
  // subtly wrong. The corner-anchored version above was that arithmetic
  // going wrong: it left a visible gap (reported as a black band) covering
  // roughly half the screen, which persisted even after switching from
  // vh/vw to measured pixels (that swap fixed a *different*, real problem
  // — stale viewport units — but wasn't why the gap existed in the first
  // place). Gated on viewportPx actually being measured yet, so there's no
  // one-tick flash of a 0×0 rotated box before the very first measurement
  // lands.
  //
  // Two things downstream *do* have to know this transform is on, and both
  // were previously (wrongly) assumed to need nothing:
  //  - `sceneSize` below, because the <Canvas> is sized in explicit pixels
  //    and this box is laid out pre-rotation (height×width);
  //  - TouchControls.tsx, via `rotatedViewport`. Hit-*testing* really does
  //    work through the transform natively — a tap resolves against the
  //    transformed geometry, so buttons and the joysticks' own hit radii are
  //    fine untouched — but a touch *vector* (a drag delta, or a stick's
  //    offset from its center) is still measured in unrotated screen axes,
  //    and the camera/knob both want the content's. See that file's
  //    `toContentSpace`.
  const forceRotate =
    landscapeMode && isCoarsePointer && isPortrait && viewportPx.w > 0 && viewportPx.h > 0;

  // When a visitor physically rotates the phone to real landscape (no CSS
  // hack needed — isPortrait already went false, forceRotate above is off),
  // the WebGL <Canvas> inside MuseumScene.tsx was staying stuck at its old
  // portrait width instead of growing to fill the new landscape one —
  // exactly a 50/50 split, since a phone's portrait width is roughly half
  // its landscape width. `w-full h-full` (percentage-based) sizing depends
  // on a ResizeObserver correctly firing through the whole parent chain to
  // resize the canvas's drawing buffer, and that didn't happen reliably on
  // this orientation change even though the plain HTML/CSS overlay layer
  // (buttons, the room-name pill, etc. — ordinary flow, no observer
  // involved) resized itself just fine. Pinning this container to the same
  // *measured* pixels used for forceRotate above sidesteps that entirely:
  // it gives the canvas's own parent chain an explicit, unambiguous size
  // change to react to on every resize/orientationchange, rather than
  // hoping a percentage inherited through several nested divs propagates.
  const measuredSize = viewportPx.w > 0 && viewportPx.h > 0;

  // Size handed down to the <Canvas> (MuseumScene.tsx's CanvasResizeSync,
  // which calls gl.setSize() with it directly). NOT the raw viewport: while
  // forceRotate is on, this container is laid out *pre-rotation* as
  // height×width — a box the CSS transform then turns into the viewport's
  // real width×height. Feeding the un-swapped viewport here sized the canvas
  // to w×h inside an h×w box, so on a 389×845 phone the renderer drew a
  // 389-wide canvas into an 845-wide container and, once rotated, covered
  // only the top ~46% of the screen with the remaining ~54% left solid black
  // — the reported "half black screen in landscape", and also a camera
  // aspect ratio (w/h) that was the reciprocal of what was actually on
  // screen, so the scene rendered squashed inside that band on top of being
  // cropped. Swapping in lockstep with the container keeps the drawing
  // buffer, the CSS box and the rotate transform all describing one shape.
  const sceneSize = forceRotate ? { w: viewportPx.h, h: viewportPx.w } : viewportPx;

  return (
    <div
      className="relative w-full h-full"
      style={
        forceRotate
          ? {
              position: "fixed",
              top: "50%",
              left: "50%",
              width: viewportPx.h,
              height: viewportPx.w,
              transform: "translate(-50%, -50%) rotate(90deg)",
              transformOrigin: "center center",
            }
          : measuredSize
            ? { width: viewportPx.w, height: viewportPx.h }
            : undefined
      }
    >
      {/* Museum-specific audio element — hidden, controlled via HUD button.
          Volume is set from the admin's museumMusicVolume setting. */}
      {museumMusicUrl && (
        <audio
          ref={museumAudioRef}
          src={museumMusicUrl}
          loop
          preload="none"
          onLoadedMetadata={() => {
            if (museumAudioRef.current) {
              museumAudioRef.current.volume = Math.min(100, Math.max(0, museumMusicVolume)) / 100;
            }
          }}
        />
      )}

      {/* HUD — always present regardless of which view is active, so a
          visitor is never stuck without a way out, EXCEPT while hudHidden
          (the whole point of that switch is a totally clean screenshot —
          see its declaration above). Two rows so it never crowds
          horizontally on narrow screens: Back/Map on top, the current-room
          indicator centered underneath. */}
      {!hudHidden && (
        <div className="absolute top-4 left-4 right-4 z-50 flex flex-col items-center gap-2 pointer-events-none">
          {/* `relative` so the View dropdown further down can anchor to this
              whole row rather than to its own button — see its comment. */}
          {/* flex-wrap, not overflow-scroll: a HUD row that scrolls hides
              controls behind a gesture nobody thinks to try on a screen they
              are already dragging to look around. Wrapping keeps every button
              reachable — on a portrait phone with music on, the row is Back +
              six pills, which is wider than 375px however tight the padding.
              `items-start` so a wrapped second line stacks under the first
              rather than stretching the Back button to match its height. */}
          <div className="relative w-full flex flex-wrap items-start justify-between gap-2">
            {/* "/" not "/gallery": the gallery lives on the homepage, and
                /gallery is only a server-side redirect stub. Soft-navigating
                to a redirecting route leaves the (public) layout mounted with
                an empty leaf — navbar and footer, blank page — until a hard
                refresh. Link at the real destination instead. */}
            <Link
              href="/"
              onClick={(event) => {
                // Left click only. A cmd/ctrl/shift-click is the visitor
                // asking for a new tab or window, which leaves this one — and
                // its progress — exactly where it is, so there is nothing to
                // confirm and preventing the default would break it.
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                if (achievementsState.hasProgress) {
                  event.preventDefault();
                  // Sound lands with the warning, not after it — the same
                  // beat as admin.deleteConfirm. Firing museum.exit here
                  // instead read as the exit cue arriving a whole dialog late.
                  playSoundEffect("museum.exitConfirm");
                  setShowExitConfirm(true);
                  return;
                }
                playSoundEffect("museum.exit");
              }}
              className="pointer-events-auto inline-flex items-center gap-2 px-2.5 sm:px-4 py-2 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-white text-xs font-medium tracking-wide hover:bg-black/75 transition-colors"
            >
              <ArrowLeft size={14} />
              <span className="hidden sm:inline">Back to Gallery</span>
            </Link>

            {/* min-w-0 + justify-end so this group is what gives way when the
                row runs out of width — it wraps under the Back link rather
                than pushing it off the left edge. */}
            <div className="flex flex-wrap items-center justify-end gap-2 min-w-0">
              {/* Museum soundtrack toggle — shown when a museum-specific
                  music track is configured. Sits left of Save Photo so it
                  reads as the audio control for the space, not the camera. */}
              {museumMusicUrl && (
                <button
                  type="button"
                  onClick={toggleMuseumMusic}
                  title={musicPlaying ? "Pause museum music" : "Play museum music"}
                  className="pointer-events-auto inline-flex items-center gap-2 px-2.5 sm:px-4 py-2 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-white text-xs font-medium tracking-wide hover:bg-black/75 transition-colors"
                >
                  {musicPlaying ? <Volume2 size={14} /> : <VolumeX size={14} />}
                  <span className="hidden sm:inline">Music</span>
                </button>
              )}

              {/* Mobile-only: one "View" dropdown holding the forced-landscape
                  and gyroscope (tilt-to-look) toggles — see landscapeMode/
                  toggleGyro's own doc comments. Collapsed into a single menu
                  instead of two standalone pills so the mobile top bar
                  doesn't get crowded (Music/Save Photo/Dark Mode/Map already
                  live there). Means nothing on desktop, which already has
                  real mouse-look and no orientation to force. */}
              {/* Deliberately NOT `relative`: the dropdown inside is absolute,
                  and dropping the positioning here lets it resolve against the
                  whole top row instead (which is `relative`), so it can center
                  on the screen rather than hang off this one button. It stays a
                  DOM child of this ref either way, which is all the
                  outside-click handler above cares about. */}
              {view === "3d" && isCoarsePointer && (
                <div className="pointer-events-auto" ref={mobileMenuRef}>
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen((prev) => !prev)}
                    title="View controls"
                    className={`inline-flex items-center gap-2 px-2.5 sm:px-4 py-2 rounded-full backdrop-blur-md border text-xs font-medium tracking-wide transition-colors ${
                      mobileMenuOpen
                        ? "bg-white/15 border-white/30 text-white"
                        : "bg-black/60 border-white/10 text-white hover:bg-black/75"
                    }`}
                  >
                    <Settings2 size={14} />
                    <span className="hidden sm:inline">View</span>
                  </button>
                  <AnimatePresence>
                    {mobileMenuOpen && (
                      <motion.div
                        // x lives here rather than as a `-translate-x-1/2`
                        // class because framer-motion writes the whole
                        // `transform` inline for the y slide, which would win
                        // over the class and un-center the panel mid-animation.
                        initial={{ opacity: 0, y: -6, x: "-50%" }}
                        animate={{ opacity: 1, y: 0, x: "-50%" }}
                        exit={{ opacity: 0, y: -6, x: "-50%" }}
                        transition={{ duration: 0.15 }}
                        // Centered on the top row (which spans the screen
                        // inside its left-4/right-4 insets), not right-aligned
                        // to the View button. Anchored to that button, `w-52`
                        // reached further left than the button had room for —
                        // on a ~400px phone the panel started at about -5px and
                        // sat clipped against the screen edge. `top-full` is
                        // now the row's own height, so it still opens directly
                        // beneath the buttons, and `max-w-full` keeps it inside
                        // the insets on any screen.
                        className="absolute left-1/2 top-full mt-2 w-56 max-w-full rounded-xl bg-black/85 backdrop-blur-md border border-white/10 p-1.5 shadow-xl z-50"
                      >
                        <button
                          type="button"
                          onClick={toggleLandscapeMode}
                          className="w-full flex items-center justify-between gap-3 px-3 py-3.5 rounded-lg text-xs font-medium tracking-wide text-white/85 hover:bg-white/10 active:bg-white/15 transition-colors"
                        >
                          <span className="flex items-center gap-2">
                            <RectangleHorizontal size={14} />
                            Landscape
                          </span>
                          <span
                            className={`w-8 h-4 rounded-full relative transition-colors shrink-0 ${
                              landscapeMode ? "bg-emerald-500/70" : "bg-white/20"
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                                landscapeMode ? "translate-x-4" : "translate-x-0"
                              }`}
                            />
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={toggleGyro}
                          className="w-full flex items-center justify-between gap-3 px-3 py-3.5 rounded-lg text-xs font-medium tracking-wide text-white/85 hover:bg-white/10 active:bg-white/15 transition-colors"
                        >
                          <span className="flex items-center gap-2">
                            <Compass size={14} />
                            Gyroscope
                          </span>
                          <span
                            className={`w-8 h-4 rounded-full relative transition-colors shrink-0 ${
                              gyroEnabled ? "bg-emerald-500/70" : "bg-white/20"
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                                gyroEnabled ? "translate-x-4" : "translate-x-0"
                              }`}
                            />
                          </span>
                        </button>
                        {/* VR — same toggle the desktop-only HUD button
                            drives (toggleVrMode/vrMode below); reachable
                            here too so a phone whose browser can actually
                            use it (rare — mainly a headset's own mobile-ish
                            browser) doesn't need a wider screen just to see
                            the button. Only rendered once vrSupported
                            resolves true, same gate as the desktop button. */}
                        {vrSupported && (
                          <button
                            type="button"
                            onClick={toggleVrMode}
                            className="w-full flex items-center justify-between gap-3 px-3 py-3.5 rounded-lg text-xs font-medium tracking-wide text-white/85 hover:bg-white/10 active:bg-white/15 transition-colors"
                          >
                            <span className="flex items-center gap-2">
                              <Glasses size={14} />
                              VR Mode
                            </span>
                            <span
                              className={`w-8 h-4 rounded-full relative transition-colors shrink-0 ${
                                vrMode ? "bg-emerald-500/70" : "bg-white/20"
                              }`}
                            >
                              <span
                                className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                                  vrMode ? "translate-x-4" : "translate-x-0"
                                }`}
                              />
                            </span>
                          </button>
                        )}
                        {/* Hide HUD — same switch the desktop-only Screenshot
                            button drives (toggleHud/hudHidden above), just
                            reachable here too: that button is gated to
                            `!isCoarsePointer` because it exists to work around
                            a desktop-only pointer-lock quirk (see hudHidden's
                            own doc comment), but a mobile visitor still wants
                            a clean, controls-free view for their own photo —
                            they just take it with Save Photo/an OS screenshot
                            instead of [R].
                            An action, not a toggle switch like the two above:
                            tapping it hides this whole dropdown along with
                            everything else HUD, so there's no "on" state it
                            could ever show here — that's what the floating dot
                            further down this file brings back. */}
                        <button
                          type="button"
                          onClick={toggleHud}
                          className="w-full flex items-center gap-2 px-3 py-3.5 rounded-lg text-xs font-medium tracking-wide text-white/85 hover:bg-white/10 active:bg-white/15 transition-colors"
                        >
                          <EyeOff size={14} />
                          Hide HUD
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Save Photo — works on both desktop ([R]) and mobile (tap).
                  Mobile shows a Camera icon (universally understood) instead
                  of the Download arrow that reads as "export" on small screens. */}
              {view === "3d" && (
                <button
                  type="button"
                  onClick={() => captureRef.current?.()}
                  title={isCoarsePointer ? "Save Photo" : "Save Photo [R]"}
                  className="pointer-events-auto inline-flex items-center gap-2 px-2.5 sm:px-4 py-2 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-white text-xs font-medium tracking-wide hover:bg-black/75 transition-colors"
                >
                  {/* Camera on mobile (coarse), Download on desktop — Camera is
                      the universally-recognised "take a photo" icon on touch. */}
                  {isCoarsePointer ? <Camera size={14} /> : <Download size={14} />}
                  <span className="hidden sm:inline">Save Photo</span>
                </button>
              )}

              {view === "3d" && !isCoarsePointer && (
                <button
                  type="button"
                  onClick={toggleHud}
                  title="Hide HUD for a screenshot [H]"
                  className="pointer-events-auto inline-flex items-center gap-2 px-2.5 sm:px-4 py-2 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-white text-xs font-medium tracking-wide hover:bg-black/75 transition-colors"
                >
                  <Camera size={14} />
                  <span className="hidden sm:inline">Screenshot</span>
                </button>
              )}

              {view === "3d" && (
                <button
                  type="button"
                  onClick={toggleDarkMode}
                  title={darkMode ? "Switch to Light Mode [L]" : "Switch to Dark Mode [L]"}
                  className="pointer-events-auto inline-flex items-center gap-2 px-2.5 sm:px-4 py-2 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-white text-xs font-medium tracking-wide hover:bg-black/75 transition-colors"
                >
                  {darkMode ? <Moon size={14} /> : <Sun size={14} />}
                  <span className="hidden sm:inline">{darkMode ? "Dark" : "Light"}</span>
                </button>
              )}

              {/* Filter Vision — shown on both desktop and mobile. Desktop
                  has [Q] as well; the button is what makes the feature
                  discoverable at all, and the only way in on a phone. The
                  label names the *current* look rather than the next one, so
                  it reads as a status the visitor is in rather than a dare. */}
              {view === "3d" && visionFilters.length > 0 && (
                <button
                  type="button"
                  onClick={cycleVisionFilter}
                  title={
                    isCoarsePointer
                      ? activeFilter
                        ? `Filter: ${activeFilter.label} — tap for the next`
                        : "Filter Vision — tap to try a look"
                      : activeFilter
                        ? `Filter: ${activeFilter.label} — [Q] for the next`
                        : "Filter Vision [Q]"
                  }
                  className={`pointer-events-auto inline-flex items-center gap-2 px-2.5 sm:px-4 py-2 rounded-full backdrop-blur-md border text-xs font-medium tracking-wide transition-colors ${
                    activeFilter
                      ? "bg-emerald-500/25 border-emerald-300/40 text-white hover:bg-emerald-500/35"
                      : "bg-black/60 border-white/10 text-white hover:bg-black/75"
                  }`}
                >
                  <Aperture size={14} />
                  <span className="hidden sm:inline">{activeFilter?.label ?? "Filter"}</span>
                </button>
              )}

              {view === "3d" && rooms.length > 1 && (
                <button
                  type="button"
                  onClick={toggleMap}
                  title={mapOpen ? "Close Map [M]" : "Open Map [M]"}
                  className="pointer-events-auto inline-flex items-center gap-2 px-2.5 sm:px-4 py-2 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-white text-xs font-medium tracking-wide hover:bg-black/75 transition-colors"
                >
                  <Map size={14} />
                  <span className="hidden sm:inline">Map</span>
                </button>
              )}

              {/* VR — Docs/Museum_VRMode.md's Phase 2/3. Desktop-only pill;
                  mobile gets the same toggle inside the "View" dropdown
                  instead (below Gyroscope), same reasoning as Landscape/
                  Gyroscope living there rather than as standalone pills —
                  the top bar has no room to spare on a phone. Rendered only
                  once vrSupported resolves true either way, so a phone or a
                  headset-less desktop (most visitors, still) never sees a
                  button for a session it couldn't start. */}
              {view === "3d" && !isCoarsePointer && vrSupported && (
                <button
                  type="button"
                  onClick={toggleVrMode}
                  title={vrMode ? "Exit VR" : "Enter VR"}
                  className={`pointer-events-auto inline-flex items-center gap-2 px-2.5 sm:px-4 py-2 rounded-full backdrop-blur-md border text-xs font-medium tracking-wide transition-colors ${
                    vrMode
                      ? "bg-emerald-500/25 border-emerald-300/40 text-white hover:bg-emerald-500/35"
                      : "bg-black/60 border-white/10 text-white hover:bg-black/75"
                  }`}
                >
                  <Glasses size={14} />
                  <span className="hidden sm:inline">VR</span>
                </button>
              )}
            </div>
          </div>

          {view === "3d" && rooms.length > 1 && (
            <AnimatePresence mode="wait">
              <motion.div
                key={currentRoom.id}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="pointer-events-none flex flex-col items-center gap-1.5 max-w-[85vw]"
              >
                <span className="px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-white text-[11px] font-medium tracking-wide truncate">
                  {currentRoom.name}
                </span>
                {/* Progress dots — where this room sits in the walking order. */}
                <div className="flex items-center gap-1.5">
                  {rooms.map((room, i) => (
                    <span
                      key={room.id}
                      className={`h-1.5 rounded-full transition-all ${
                        i === currentIndex ? "w-4 bg-emerald-400" : "w-1.5 bg-white/25"
                      }`}
                    />
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
          )}

          {/* Desktop stacks the same numbers under its always-on minimap
              instead (see below). Here on mobile the card *is* the minimap's
              control — tap to expand it downward out of this HUD stack, tap
              again to collapse (StatsMinimapPanel.tsx). In forced-landscape
              mode it moves to its own bottom-center spot (see below) — the
              top bar there sits along whichever real screen edge the CSS
              rotate happens to land it on, which reads badly for a stats
              readout the visitor should be able to glance at mid-walk. */}
          {view === "3d" && isCoarsePointer && !landscapeMode && achievementsEnabled && achievementsHudEnabled && (
            <StatsMinimapPanel
              steps={achievementsState.steps}
              views={achievementsState.views}
              elapsedSeconds={achievementsState.elapsedSeconds}
              wishlistAdds={achievementsState.wishlistAdds}
              frameStateRef={minimapRef}
              config={minimapConfig}
              open={minimapOpen}
              onToggle={() => setMinimapOpen((prev) => !prev)}
              placement="below"
            />
          )}
        </div>
      )}

      {/* The way back, on mobile only. Desktop un-hides with [H] regardless
          of what's on screen (KeyH's listener lives outside the HUD's own
          DOM, see MuseumScene's handleKeyDown), but a touch visitor has no
          keyboard — and the toggle above lives *inside* the HUD it just
          hid, so once it's gone there is nothing left to tap. This small,
          low-key dot is the one thing that stays mounted through hudHidden
          on a coarse-pointer device, purely so "Hide HUD" is never a dead
          end. Kept deliberately understated (no label, low opacity) so it
          doesn't defeat the clean view it's sitting on top of. */}
      {isCoarsePointer && hudHidden && (
        <button
          type="button"
          onClick={toggleHud}
          title="Show HUD"
          className="pointer-events-auto absolute top-4 right-4 z-50 p-2.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white/70 hover:text-white hover:bg-black/60 transition-colors"
        >
          <Eye size={16} />
        </button>
      )}

      {/* Landscape-mode's own home for the Step Counter/Time Inside/
          Artworks Viewed/Wishlisted card — bottom-center, clear of both
          joysticks (TouchControls.tsx keeps them left/right) and the top HUD
          row. Anchored by its *bottom* edge, so the minimap it toggles opens
          upward into the empty middle of the screen and the card itself
          doesn't shift a pixel either way (see StatsMinimapPanel.tsx). */}
      {view === "3d" &&
        isCoarsePointer &&
        landscapeMode &&
        !hudHidden &&
        achievementsEnabled &&
        achievementsHudEnabled && (
          <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center">
            <StatsMinimapPanel
              steps={achievementsState.steps}
              views={achievementsState.views}
              elapsedSeconds={achievementsState.elapsedSeconds}
              wishlistAdds={achievementsState.wishlistAdds}
              frameStateRef={minimapRef}
              config={minimapConfig}
              open={minimapOpen}
              onToggle={() => setMinimapOpen((prev) => !prev)}
              placement="above"
            />
          </div>
        )}

      {achievementsEnabled && !hudHidden && (
        <div className="absolute top-24 sm:top-28 left-0 right-0 z-[57] flex justify-center px-4 pointer-events-none">
          <AnimatePresence>
            {achievementsState.banner && (
              // Keyed by achievement id — without this, earning a second
              // achievement while the first's banner is still up (or right
              // after claiming it) reuses the same component instance, so
              // its local name/email/claimed state leaked forward: the new
              // achievement would silently render as already-claimed
              // ("🎉 Claimed") instead of showing its own claim form, which
              // read as the second achievement having simply vanished.
              <AchievementBanner
                key={achievementsState.banner.id}
                achievement={achievementsState.banner}
                onDismiss={achievementsState.dismissBanner}
              />
            )}
          </AnimatePresence>
        </div>
      )}

      {achievementsEnabled && achievementsState.showWelcomeBack && (
        <AchievementResetNotice onDismiss={achievementsState.dismissWelcomeBack} />
      )}

      {/* Sits here, a direct child of the root, rather than inside the HUD:
          the HUD row is `pointer-events-none` with each control opting back
          in, and it is also the thing `hudHidden` unmounts. A confirmation
          the visitor has already asked for should not depend on either. */}
      <AnimatePresence>
        {showExitConfirm && (
          <ExitConfirmModal
            key="museum-exit-confirm"
            onCancel={() => setShowExitConfirm(false)}
            onConfirm={leaveMuseum}
          />
        )}
      </AnimatePresence>

      {/* Two phases of the same overlay, deliberately not merged: before the
          canvas exists there is nothing to measure (the scene chunk itself is
          still downloading), so LoadingScreen runs indeterminate; once it is
          mounted and fetching, EntryLoadGate takes over with a real figure and
          lifts itself when the first wave drains. AnimatePresence is what
          makes that hand-off a fade instead of a cut. */}
      {view === "loading" && <LoadingScreen />}

      <AnimatePresence>
        {view === "3d" && !assetsReady && (
          <EntryLoadGate
            key="entry-load-gate"
            onReady={() => {
              setAssetsReady(true);
              // The one moment that counts as the museum having loaded, and so
              // the only safe place to hand back the retry budget. Clearing it
              // anywhere earlier — on a LoadingScreen unmount, say — would
              // refund an attempt at every phase of the load, which is a loop
              // with extra steps. See clearMuseumAutoReloads.
              clearMuseumAutoReloads();
            }}
          />
        )}
      </AnimatePresence>

      {view === "unsupported" && (
        <div className="w-full h-full overflow-y-auto pt-24 pb-16 px-4 sm:px-8">
          <div className="max-w-sm mx-auto text-center mb-8">
            <div className="inline-flex p-3 rounded-full bg-white/10 text-white/70 mb-4">
              <MonitorSmartphone size={28} />
            </div>
            <p className="font-body text-sm text-white/70">
              3D view isn&apos;t supported on this device — here&apos;s the artwork collection instead.
            </p>
          </div>
          <MuseumGridFallback rooms={rooms} activeRoomId={gridRoomId} onSelectRoom={setGridRoomId} />
        </div>
      )}

      {view === "3d" && (
        // The active look is a CSS `filter` on a wrapper around the canvas
        // rather than a postprocessing pass — see lib/museum/visionFilters.ts
        // for why, and why that choice is what lets a saved screenshot match
        // what is on screen. `willChange` keeps the filtered layer promoted so
        // switching filters doesn't re-rasterise the whole scene on the main
        // thread; the transition makes [Q] a fade rather than a hard cut.
        //
        // Wrapping only the scene, never the HUD: a night-vision museum with
        // green buttons and a green Back arrow would be unusable, and the
        // filter is about the room, not the interface.
        <div
          className="absolute inset-0"
          style={{
            filter: activeFilter?.css || undefined,
            willChange: activeFilter ? "filter" : undefined,
            transition: "filter 220ms ease-out",
          }}
        >
        <MuseumSceneLoader
          rooms={rooms}
          isCoarsePointer={isCoarsePointer}
          landscapeMode={landscapeMode}
          gyroEnabled={gyroEnabled}
          rotatedViewport={forceRotate}
          viewportSize={measuredSize ? sceneSize : undefined}
          onRoomChange={setCurrentRoomId}
          darkMode={darkMode}
          brightnessLight={brightnessLight}
          brightnessDark={brightnessDark}
          onToggleDarkMode={toggleDarkMode}
          onToggleMap={toggleMap}
          onToggleHud={toggleHud}
          hudHidden={hudHidden}
          captureRef={captureRef}
          aboutRoomId={aboutRoomId}
          aboutData={aboutData}
          chaseCompanions={chaseCompanions}
          // Always on now (not gated behind achievementsEnabled) — MiniMapHud
          // below shows the same steps count regardless of whether the
          // Achievements feature itself is turned on.
          onStepsChange={achievementsState.reportSteps}
          onArtworkViewed={achievementsEnabled ? achievementsState.reportArtworkViewed : undefined}
          travelRequest={travelRequest}
          freedomWallRoomId={freedomWallRoomId}
          freedomWallNotes={freedomWallNotes}
          freedomWallEventTitle={freedomWallEventTitle}
          freedomWallAcceptingNotes={freedomWallAcceptingNotes}
          onFreedomWallNoteAdded={handleFreedomWallNoteAdded}
          minimapRef={minimapRef}
          activeFilterCss={activeFilter?.css ?? null}
          onCycleVisionFilter={visionFilters.length > 0 ? cycleVisionFilter : undefined}
          vrMode={vrMode}
          onVrPresentingChange={handleVrPresentingChange}
          // [V] key — desktop-only, same as the HUD button; undefined
          // when vrSupported is false so [V] does nothing on a device
          // that couldn't start a session anyway (same pattern as
          // onCycleVisionFilter above).
          onToggleVrMode={vrSupported ? toggleVrMode : undefined}
          // The in-headset HUD (VrHud.tsx) mirrors this file's own DOM HUD
          // from the same state — one object so the pass-through doesn't
          // grow a prop per control. Music only when a track is configured,
          // stats only when the counters would show on screen too.
          vrHud={{
            mapOpen,
            onSelectRoom: handleSelectRoom,
            musicPlaying: museumMusicUrl ? musicPlaying : undefined,
            onToggleMusic: museumMusicUrl ? toggleMuseumMusic : undefined,
            minimapConfig,
            stats:
              achievementsEnabled && achievementsHudEnabled
                ? {
                    steps: achievementsState.steps,
                    views: achievementsState.views,
                    elapsedSeconds: achievementsState.elapsedSeconds,
                    wishlistAdds: achievementsState.wishlistAdds,
                  }
                : null,
            achievement: achievementsEnabled ? achievementsState.banner : null,
            onDismissAchievement: achievementsState.dismissBanner,
            splashEnabled,
            splashSpeedMs,
          }}
        />
        </div>
      )}

      {/* Bottom-left "radar" — desktop's always-on placement, with the
          steps/views/time/wishlisted counter stacked directly underneath it
          in one shared card. Touch doesn't mount this at all; it reaches the
          same MiniMapHud through StatsMinimapPanel.tsx instead, where it's
          tap-to-expand off the stats card rather than permanent (see the
          isCoarsePointer-only renders above).

          `scale-[0.78]` shrinks the whole card — map, stats row and padding
          together — rather than just the canvas, because the card's *width*
          is set by the stats row underneath (tabular digits with reserved
          `ch` widths), so a smaller canvas alone would have left the card
          exactly as wide. At full size it ran tall enough to collide with
          the About room's social-links drawer, which is anchored at the
          vertical centre of the left edge and hangs well below it
          (AboutRoomCorner.tsx). Transform rather than smaller CSS pixels so
          the canvas still renders at its full backing-store resolution and
          is merely downsampled — a genuinely smaller canvas would have lost
          detail in the dots. `origin-bottom-left` keeps the card pinned to
          the corner it's positioned in, so the bottom-4/left-4 insets still
          read as 16px. Desktop only: touch reaches the same map through
          StatsMinimapPanel.tsx, which sizes it explicitly already. */}
      {view === "3d" && !isCoarsePointer && !hudHidden && (
        <div className="pointer-events-none absolute bottom-4 left-4 z-[55] flex flex-col items-stretch gap-2 rounded-2xl bg-black/50 backdrop-blur-md border border-white/10 p-2 origin-bottom-left scale-[0.78]">
          <MiniMapHud frameStateRef={minimapRef} config={minimapConfig} />
          {achievementsEnabled && achievementsHudEnabled && (
            <AchievementHud
              bare
              config={minimapConfig}
              steps={achievementsState.steps}
              views={achievementsState.views}
              elapsedSeconds={achievementsState.elapsedSeconds}
              wishlistAdds={achievementsState.wishlistAdds}
            />
          )}
        </div>
      )}

      {/* Sits between the HUD (z-50) and ArtworkInfoPanel (z-[60]) — a brief
          "reveal" moment that should dominate over the HUD the way the
          site-wide entrance splash dominates over the navbar, but yield to
          an artwork panel the visitor explicitly opened (which, in
          practice, can't really coincide — the room-change event that
          triggers this fires before a visitor is close enough to interact
          with anything in the new room). Stays mounted even while
          hudHidden — suppressed via the `hidden` prop instead of
          `{!hudHidden && <RoomSplash />}`, since unmounting it would reset
          its internal "already shown this room" tracking (see
          RoomSplash.tsx) and replay the splash the moment [H] un-hides
          the HUD, even for a room the visitor has been standing in the
          whole time. */}
      {view === "3d" && (
        <RoomSplash
          hidden={hudHidden}
          roomId={currentRoom.id}
          roomName={currentRoom.name}
          splashTitle={currentRoom.splashTitle}
          splashIcon={currentRoom.splashIcon}
          enabled={splashEnabled}
          // Per-room toggle (RoomsTab.tsx's "Show entry splash" checkbox) —
          // independent of, and checked alongside, the museum-wide
          // `enabled` above (RoomSplash.tsx requires both).
          roomSplashEnabled={currentRoom.splashEnabled}
          style={splashStyle}
          styleMobile={splashStyleMobile}
          isCoarsePointer={isCoarsePointer}
          landscapeMode={landscapeMode}
          effect={splashEffect}
          speedMs={splashSpeedMs}
          bgColor={splashBgColor}
          taglineFontSize={splashTaglineFontSize}
          taglineFontFamily={splashTaglineFontFamily}
        />
      )}

      {rooms.length > 1 && (
        <MuseumMap
          // In VR the map is VrMapPanel.tsx, inside the canvas; this DOM one
          // would only reach the monitor mirror.
          open={mapOpen && !vrMode}
          rooms={rooms}
          currentRoomId={currentRoom.id}
          onClose={() => setMapOpen(false)}
          onSelectRoom={handleSelectRoom}
          freedomWallNoteCount={freedomWallNotes.length}
        />
      )}
    </div>
  );
}
