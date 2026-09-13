// app/(admin)/admin/artworks/DigitalMuseumPanel.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Landmark, DoorOpen, Save, User, Trophy, Music, Megaphone, Sparkles, Radar, Aperture } from "lucide-react";
import toast from "@/lib/toast";
import { Toggle } from "./museum-ui";
import type { PickableArtwork } from "./ArtworkPicker";
import { RoomsTab, type RoomConfig, type AboutRoomVisuals, type FreedomWallRoomVisuals } from "./RoomsTab";
import { FreedomWallTab } from "./FreedomWallTab";
import { ChaseCompanionsSection } from "./ChaseCompanionsSection";
import { AchievementsTab, type AchievementsConfigValue } from "./AchievementsTab";
import { MuseumSplashSection, type MuseumSplashValue } from "./MuseumSplashSection";
import { MinimapHudSection } from "./MinimapHudSection";
import { VisionFiltersSection } from "./VisionFiltersSection";
import { AdminAccordion, useAccordionState } from "@/components/admin/AdminAccordion";
import {
  DEFAULT_VISION_FILTER_CONFIG,
  parseVisionFilterConfig,
  type VisionFilterConfig,
} from "@/lib/museum/visionFilters";
import { parseMinimapHudConfig, MINIMAP_HUD_DEFAULTS, type MinimapHudConfig } from "@/lib/museum/minimapHud";
import { MUSEUM_SPLASH_DEFAULTS } from "@/lib/museum-splash";
// MuseumPreviewSidebar removed — brightness controls live in the Scene Editor now.
import { AudioUploader } from "../settings/Preferences/AudioUploader";
import { clampMusicVolume } from "@/lib/background-music";

interface MuseumGeneral {
  id: string;
  enabled: boolean;
  title: string | null;
  description: string | null;
}

type SubTab = "general" | "rooms" | "achievements" | "freedom-wall";

// Central Digital Museum configuration area — General (on/off + optional
// title/description) / Rooms (create/edit/enable/reorder rooms, manage each
// room's artworks, and mark a room a "Themed Exhibition" — folded directly
// into the room rather than a separate model, see RoomsTab.tsx's
// RoomConfig doc comment). V1 was a single flat artwork list; this is the
// V2 upgrade of the exact same tab (see ArtworksClient.tsx:673 — still just
// `<DigitalMuseumPanel artworks={...} />` on the "Digital Museum" page tab,
// no structural change up there).
export function DigitalMuseumPanel({ artworks }: { artworks: PickableArtwork[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [subTab, setSubTab] = useState<SubTab>("general");

  // The Museum Scene Editor's "Digital Museum · Rooms" breadcrumb
  // (museum-editor/[roomId]/page.tsx) links back to
  // /admin/artworks?tab=museum&museumTab=rooms — same "read a sub-tab
  // straight from the URL" pattern as ArtworksClient.tsx's own top-level
  // tab param, so returning from the editor lands exactly where the admin
  // came from instead of always resetting to General Settings.
  useEffect(() => {
    const requested = searchParams.get("museumTab");
    if (requested === "general" || requested === "rooms" || requested === "achievements" || requested === "freedom-wall") {
      setSubTab(requested);
    }
  }, [searchParams]);
  const [general, setGeneral] = useState<MuseumGeneral | null>(null);
  const [aboutVisuals, setAboutVisuals] = useState<AboutRoomVisuals | null>(null);
  const [aboutRoomId, setAboutRoomId] = useState<string | null>(null);
  const [freedomWallRoomId, setFreedomWallRoomId] = useState<string | null>(null);
  const [freedomWallEnabled, setFreedomWallEnabled] = useState(false);
  const [freedomWallVisuals, setFreedomWallVisuals] = useState<FreedomWallRoomVisuals | null>(null);
  // Second Floor + Stairs (see docs/SecondFloorStairs_Spec.md) — About and
  // Freedom Wall's own `floor` column, distinct from their visuals above,
  // patched via rooms/[id] using their real ids rather than the museum-wide
  // PATCH. Stairs is a fixed card with visuals only (no enabled/floor of
  // its own — see stairsRoom.ts).
  const [aboutFloor, setAboutFloor] = useState(0);
  const [freedomWallFloor, setFreedomWallFloor] = useState(0);
  const [stairsRoomId, setStairsRoomId] = useState<string | null>(null);
  const [stairsVisuals, setStairsVisuals] = useState<FreedomWallRoomVisuals | null>(null);
  // Per-room "show entry splash" toggles (see docs on RoomSplash.tsx) —
  // About's lives inside aboutVisuals (aboutSplashEnabled); Freedom Wall
  // and Stairs are real MuseumRoom rows patched via rooms/[id], same as
  // their floor toggles above.
  const [freedomWallSplashEnabled, setFreedomWallSplashEnabled] = useState(true);
  const [stairsSplashEnabled, setStairsSplashEnabled] = useState(true);
  const [achievementsConfig, setAchievementsConfig] = useState<AchievementsConfigValue | null>(null);
  const [museumMusic, setMuseumMusic] = useState<{ url: string; enabled: boolean; volume: number }>({
    url: "", enabled: false, volume: 50,
  });
  const [rooms, setRooms] = useState<RoomConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [splash, setSplash] = useState<MuseumSplashValue>(MUSEUM_SPLASH_DEFAULTS);
  const [savedSplash, setSavedSplash] = useState<MuseumSplashValue>(MUSEUM_SPLASH_DEFAULTS);
  const [savingSplash, setSavingSplash] = useState(false);
  // Minimap HUD look — same local-edits-plus-one-Save shape as the splash
  // settings above, and for the same reason: colour pickers and sliders fire
  // on every drag step, and the preview beside them already shows the result
  // without a round trip.
  const [minimap, setMinimap] = useState<MinimapHudConfig>(MINIMAP_HUD_DEFAULTS);
  const [savedMinimap, setSavedMinimap] = useState<MinimapHudConfig>(MINIMAP_HUD_DEFAULTS);
  const [savingMinimap, setSavingMinimap] = useState(false);
  // Filter Vision — same local-edits-plus-one-Save shape as the minimap and
  // splash blocks above, for the same reason (colour pickers and sliders fire
  // on every drag step). The master switch is deliberately *not* part of that:
  // see saveVisionFilters vs toggleVisionFilters below.
  const [visionEnabled, setVisionEnabled] = useState(true);
  const [visionConfig, setVisionConfig] = useState<Required<VisionFilterConfig>>(
    DEFAULT_VISION_FILTER_CONFIG
  );
  const [savedVisionConfig, setSavedVisionConfig] = useState<Required<VisionFilterConfig>>(
    DEFAULT_VISION_FILTER_CONFIG
  );
  const [savingVision, setSavingVision] = useState(false);

  // General Settings' collapsible sections. Everything starts open, so the tab
  // looks exactly as it did before the accordions existed until an admin folds
  // something themselves.
  const sections = useAccordionState("scriptovernovel:museum:general-sections", [
    "basics",
    "splash",
    "minimap",
    "filters",
  ] as const);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const museumRes = await fetch("/api/digital-museum");
        if (!museumRes.ok) throw new Error();
        const museum = await museumRes.json();
        if (cancelled) return;
        setGeneral({
          id: museum.id,
          enabled: museum.enabled,
          title: museum.title,
          description: museum.description,
        });
        const loadedSplash: MuseumSplashValue = {
          splashEnabled: museum.splashEnabled,
          splashEffect: museum.splashEffect,
          splashSpeedMs: museum.splashSpeedMs,
          splashBgColor: museum.splashBgColor,
          splashTaglineFontSize: museum.splashTaglineFontSize,
          splashTaglineFontFamily: museum.splashTaglineFontFamily,
          splashStyle: museum.splashStyle ?? "full-page",
          splashStyleMobile: museum.splashStyleMobile ?? "full-page",
        };
        setSplash(loadedSplash);
        setSavedSplash(loadedSplash);
        const loadedMinimap = parseMinimapHudConfig(museum.minimapConfig);
        setMinimap(loadedMinimap);
        setSavedMinimap(loadedMinimap);
        setAboutVisuals({
          aboutWallColor: museum.aboutWallColor,
          aboutFloorColor: museum.aboutFloorColor,
          aboutCeilingColor: museum.aboutCeilingColor,
          aboutWallTexture: museum.aboutWallTexture,
          aboutFloorTexture: museum.aboutFloorTexture,
          aboutCeilingTexture: museum.aboutCeilingTexture,
          aboutSplashIcon: museum.aboutSplashIcon,
          aboutSplashTitle: museum.aboutSplashTitle,
          aboutEnabled: museum.aboutEnabled ?? true,
          aboutSplashEnabled: museum.aboutSplashEnabled ?? true,
        });
        setRooms(museum.rooms);
        setAboutRoomId(museum.aboutRoomId ?? null);
        setFreedomWallRoomId(museum.freedomWallRoomId ?? null);
        setFreedomWallEnabled(museum.freedomWallEnabled ?? false);
        if (museum.freedomWallVisuals) {
          setFreedomWallVisuals(museum.freedomWallVisuals as FreedomWallRoomVisuals);
        }
        setAboutFloor(museum.aboutFloor ?? 0);
        setFreedomWallFloor(museum.freedomWallFloor ?? 0);
        setStairsRoomId(museum.stairsRoomId ?? null);
        if (museum.stairsVisuals) {
          setStairsVisuals(museum.stairsVisuals as FreedomWallRoomVisuals);
        }
        setFreedomWallSplashEnabled(museum.freedomWallSplashEnabled ?? true);
        setStairsSplashEnabled(museum.stairsSplashEnabled ?? true);
        setAchievementsConfig({
          achievementsEnabled: museum.achievementsEnabled,
          achievementsHudEnabled: museum.achievementsHudEnabled,
        });
        setMuseumMusic({
          url: museum.museumMusicUrl ?? "",
          enabled: museum.museumMusicEnabled ?? false,
          volume: clampMusicVolume(museum.museumMusicVolume),
        });
        setVisionEnabled(museum.visionFiltersEnabled ?? true);
        {
          const parsed = parseVisionFilterConfig(museum.visionFilterConfig);
          setVisionConfig(parsed);
          setSavedVisionConfig(parsed);
        }
        // Brightness is now managed per-editor (Scene Editor toolbar), not here.
      } catch {
        if (!cancelled) toast.error("Failed to load Digital Museum configuration");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggleEnabled(enabled: boolean) {
    if (!general) return;
    const previous = general;
    setGeneral({ ...general, enabled });
    try {
      const res = await fetch("/api/digital-museum", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error();
      toast.success(enabled ? "Digital Museum enabled" : "Digital Museum disabled");
      router.refresh();
    } catch {
      setGeneral(previous);
      toast.error("Failed to update museum status");
    }
  }

  async function saveGeneralField(field: "title" | "description", value: string) {
    if (!general) return;
    const previous = general;
    setGeneral({ ...general, [field]: value || null });
    try {
      const res = await fetch("/api/digital-museum", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setGeneral(previous);
      toast.error(`Failed to save ${field}`);
    }
  }

  const ABOUT_VISUAL_LABELS: Record<keyof AboutRoomVisuals, string> = {
    aboutWallColor: "Wall Color",
    aboutFloorColor: "Floor Color",
    aboutCeilingColor: "Ceiling Color",
    aboutWallTexture: "Wall Texture",
    aboutFloorTexture: "Floor Texture",
    aboutCeilingTexture: "Ceiling Texture",
    aboutSplashIcon: "Splash Icon",
    aboutSplashTitle: "Splash Title",
    aboutEnabled: "About Room",
    aboutSplashEnabled: "Entry Splash",
  };

  // The About room's wall/floor/ceiling (RoomsTab.tsx's fixed "About
  // ScriptOverNovel" card) — same PATCH endpoint as title/description above, since
  // these fields live on DigitalMuseum too (see AboutRoomVisuals' doc
  // comment). Toasts by field name (Wall/Floor/Ceiling Color/Texture) so a
  // change here reads the same as a real room's — see RoomsTab.tsx's
  // updateRoom for the identical pattern.
  async function updateAboutVisuals(patch: Partial<AboutRoomVisuals>) {
    if (!aboutVisuals) return;
    const previous = aboutVisuals;
    setAboutVisuals({ ...aboutVisuals, ...patch });
    const label = ABOUT_VISUAL_LABELS[Object.keys(patch)[0] as keyof AboutRoomVisuals];
    try {
      const res = await fetch("/api/digital-museum", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error();
      if ("aboutEnabled" in patch) {
        toast.success(patch.aboutEnabled ? "About ScriptOverNovel enabled" : "About ScriptOverNovel disabled");
      } else if ("aboutSplashEnabled" in patch) {
        toast.success(
          patch.aboutSplashEnabled
            ? "Entry splash on for About ScriptOverNovel"
            : "Entry splash off for About ScriptOverNovel"
        );
      } else if (label) {
        toast.success(`${label} updated`);
      }
      router.refresh();
    } catch {
      setAboutVisuals(previous);
      toast.error(label ? `Failed to update ${label}` : "Failed to update About ScriptOverNovel room");
    }
  }

  // Freedom Wall room enabled toggle — PATCHes the MuseumRoom row directly
  // (same endpoint as any curated room) and keeps local state in sync.
  async function toggleFreedomWallEnabled(enabled: boolean) {
    if (!freedomWallRoomId) return;
    const prev = freedomWallEnabled;
    setFreedomWallEnabled(enabled);
    try {
      const res = await fetch(`/api/digital-museum/rooms/${freedomWallRoomId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error();
      toast.success(enabled ? "Freedom Wall enabled" : "Freedom Wall disabled");
      router.refresh();
    } catch {
      setFreedomWallEnabled(prev);
      toast.error("Failed to toggle Freedom Wall");
    }
  }

  // Freedom Wall room's wall/floor/ceiling — PATCHes the MuseumRoom row
  // directly (same endpoint as any curated room) so we can keep these in the
  // room row rather than on DigitalMuseum like the About room does.
  const FW_VISUAL_LABELS: Record<keyof FreedomWallRoomVisuals, string> = {
    wallColor: "Wall Color",
    floorColor: "Floor Color",
    ceilingColor: "Ceiling Color",
    wallTexture: "Wall Texture",
    floorTexture: "Floor Texture",
    ceilingTexture: "Ceiling Texture",
  };

  async function updateFreedomWallVisuals(patch: Partial<FreedomWallRoomVisuals>) {
    if (!freedomWallVisuals || !freedomWallRoomId) return;
    const previous = freedomWallVisuals;
    setFreedomWallVisuals({ ...freedomWallVisuals, ...patch });
    const label = FW_VISUAL_LABELS[Object.keys(patch)[0] as keyof FreedomWallRoomVisuals];
    try {
      const res = await fetch(`/api/digital-museum/rooms/${freedomWallRoomId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error();
      if (label) toast.success(`${label} updated`);
      router.refresh();
    } catch {
      setFreedomWallVisuals(previous);
      toast.error(label ? `Failed to update ${label}` : "Failed to update Freedom Wall room");
    }
  }

  // Second Floor toggle (see docs/SecondFloorStairs_Spec.md) — About and
  // Freedom Wall's own `floor` column is a real MuseumRoom field, PATCHed
  // via their real ids just like a curated room's Floor button in
  // RoomsTab.tsx, distinct from their color/texture visuals above.
  async function updateAboutFloor(floor: number) {
    if (!aboutRoomId) return;
    const previous = aboutFloor;
    setAboutFloor(floor);
    try {
      const res = await fetch(`/api/digital-museum/rooms/${aboutRoomId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ floor }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || undefined);
      }
      toast.success(floor === 1 ? "About ScriptOverNovel moved to Second Floor" : "About ScriptOverNovel moved to Ground Floor");
      router.refresh();
    } catch (e) {
      setAboutFloor(previous);
      toast.error(e instanceof Error && e.message ? e.message : "Failed to update Floor");
    }
  }

  async function updateFreedomWallFloor(floor: number) {
    if (!freedomWallRoomId) return;
    const previous = freedomWallFloor;
    setFreedomWallFloor(floor);
    try {
      const res = await fetch(`/api/digital-museum/rooms/${freedomWallRoomId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ floor }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || undefined);
      }
      toast.success(floor === 1 ? "Freedom Wall moved to Second Floor" : "Freedom Wall moved to Ground Floor");
      router.refresh();
    } catch (e) {
      setFreedomWallFloor(previous);
      toast.error(e instanceof Error && e.message ? e.message : "Failed to update Floor");
    }
  }

  // Stairs connector room's wall/floor/ceiling — same PATCH pattern as
  // Freedom Wall's visuals above. No enabled/floor toggle of its own (see
  // lib/museum/stairsRoom.ts and the fixed card in RoomsTab.tsx).
  async function updateStairsVisuals(patch: Partial<FreedomWallRoomVisuals>) {
    if (!stairsVisuals || !stairsRoomId) return;
    const previous = stairsVisuals;
    setStairsVisuals({ ...stairsVisuals, ...patch });
    const label = FW_VISUAL_LABELS[Object.keys(patch)[0] as keyof FreedomWallRoomVisuals];
    try {
      const res = await fetch(`/api/digital-museum/rooms/${stairsRoomId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error();
      if (label) toast.success(`${label} updated`);
      router.refresh();
    } catch {
      setStairsVisuals(previous);
      toast.error(label ? `Failed to update ${label}` : "Failed to update Stairs room");
    }
  }

  // Per-room "show entry splash" toggles — same rooms/[id] PATCH pattern as
  // the visuals/floor handlers above, just a plain boolean field.
  async function updateFreedomWallSplashEnabled(enabled: boolean) {
    if (!freedomWallRoomId) return;
    const previous = freedomWallSplashEnabled;
    setFreedomWallSplashEnabled(enabled);
    try {
      const res = await fetch(`/api/digital-museum/rooms/${freedomWallRoomId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ splashEnabled: enabled }),
      });
      if (!res.ok) throw new Error();
      toast.success(
        enabled ? "Entry splash on for Freedom Wall" : "Entry splash off for Freedom Wall"
      );
      router.refresh();
    } catch {
      setFreedomWallSplashEnabled(previous);
      toast.error("Failed to update entry splash setting");
    }
  }

  async function updateStairsSplashEnabled(enabled: boolean) {
    if (!stairsRoomId) return;
    const previous = stairsSplashEnabled;
    setStairsSplashEnabled(enabled);
    try {
      const res = await fetch(`/api/digital-museum/rooms/${stairsRoomId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ splashEnabled: enabled }),
      });
      if (!res.ok) throw new Error();
      toast.success(enabled ? "Entry splash on for Stairs" : "Entry splash off for Stairs");
      router.refresh();
    } catch {
      setStairsSplashEnabled(previous);
      toast.error("Failed to update entry splash setting");
    }
  }

  // Digital Museum Achievements' two toggles (master + HUD) — same PATCH
  // endpoint, same optimistic pattern as updateAboutVisuals above. The
  // achievements themselves (thresholds/rewards) are managed inside
  // AchievementsTab.tsx via their own dedicated CRUD routes.
  async function updateAchievementsConfig(patch: Partial<AchievementsConfigValue>) {
    if (!achievementsConfig) return;
    const previous = achievementsConfig;
    setAchievementsConfig({ ...achievementsConfig, ...patch });
    try {
      const res = await fetch("/api/digital-museum", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setAchievementsConfig(previous);
      toast.error("Failed to update Achievements settings");
    }
  }

  // Museum soundtrack — optimistic toggle for enabled/volume; URL is set via
  // AudioUploader on upload success (each upload is its own PATCH immediately).
  async function updateMuseumMusic(patch: Partial<typeof museumMusic>) {
    const previous = museumMusic;
    setMuseumMusic((m) => ({ ...m, ...patch }));
    const apiPatch: Record<string, unknown> = {};
    if (patch.url !== undefined) apiPatch.museumMusicUrl = patch.url || null;
    if (patch.enabled !== undefined) apiPatch.museumMusicEnabled = patch.enabled;
    if (patch.volume !== undefined) apiPatch.museumMusicVolume = patch.volume;
    try {
      const res = await fetch("/api/digital-museum", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(apiPatch),
      });
      if (!res.ok) throw new Error();
      if (patch.enabled !== undefined) {
        toast.success(patch.enabled ? "Museum soundtrack enabled" : "Museum soundtrack disabled");
      }
      router.refresh();
    } catch {
      setMuseumMusic(previous);
      toast.error("Failed to update museum soundtrack");
    }
  }

  // Brightness is now adjusted and saved directly from the Museum Scene Editor toolbar.

  // The splash controls (sliders, color picker) fire onChange on every drag
  // step — patching the API on each one would be excessive, so this mirrors
  // BrandingSection.tsx's IntroSplashSection usage: local-only edits plus one
  // explicit Save that PATCHes all six fields together.
  const splashDirty = JSON.stringify(splash) !== JSON.stringify(savedSplash);

  const minimapDirty = JSON.stringify(minimap) !== JSON.stringify(savedMinimap);

  const visionDirty =
    JSON.stringify(visionConfig) !== JSON.stringify(savedVisionConfig);

  // The master switch writes immediately, unlike the filter list below it.
  // Flipping a feature on or off is a finished decision the moment it is
  // flipped — the same reasoning the Entrance Splash's switches follow — and
  // making it wait behind a Save button that is otherwise about *which*
  // filters exist would read as the switch not working.
  async function toggleVisionFilters(enabled: boolean) {
    const previous = visionEnabled;
    setVisionEnabled(enabled);
    try {
      const res = await fetch("/api/digital-museum", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visionFiltersEnabled: enabled }),
      });
      if (!res.ok) throw new Error();
      toast.success(enabled ? "Filter Vision enabled" : "Filter Vision disabled");
      router.refresh();
    } catch {
      setVisionEnabled(previous);
      toast.error("Failed to update Filter Vision");
    }
  }

  async function saveVisionFilters() {
    setSavingVision(true);
    try {
      const res = await fetch("/api/digital-museum", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visionFilterConfig: visionConfig }),
      });
      if (!res.ok) throw new Error();
      setSavedVisionConfig(visionConfig);
      toast.success("Filter Vision saved");
      router.refresh();
    } catch {
      toast.error("Failed to save Filter Vision");
    } finally {
      setSavingVision(false);
    }
  }

  async function saveMinimap() {
    setSavingMinimap(true);
    try {
      const res = await fetch("/api/digital-museum", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minimapConfig: minimap }),
      });
      if (!res.ok) throw new Error();
      setSavedMinimap(minimap);
      toast.success("Minimap HUD saved");
      router.refresh();
    } catch {
      toast.error("Failed to save the Minimap HUD");
    } finally {
      setSavingMinimap(false);
    }
  }

  async function saveSplash() {
    setSavingSplash(true);
    try {
      const res = await fetch("/api/digital-museum", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(splash),
      });
      if (!res.ok) throw new Error();
      setSavedSplash(splash);
      toast.success("Room splash settings saved");
      router.refresh();
    } catch {
      toast.error("Failed to save room splash settings");
    } finally {
      setSavingSplash(false);
    }
  }

  if (loading || !general) {
    return (
      <div className="admin-card border rounded-2xl p-8 text-center text-sm text-ink-400 dark:text-ink-300">
        Loading Digital Museum configuration…
      </div>
    );
  }

  const enabledRoomCount = rooms.filter((r) => r.enabled).length;

  return (
    <div className="space-y-6">

      {/* Museum Status — always visible regardless of sub-tab, same as before */}
      <div className="admin-card border rounded-2xl p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Landmark size={20} />
          </div>
          <div>
            <p className="font-jakarta text-sm font-medium text-ink dark:text-cream">Digital Museum</p>
            <p className="font-body text-xs text-ink-400 dark:text-ink-300">
              {general.enabled
                ? `Live — ${enabledRoomCount} room${enabledRoomCount === 1 ? "" : "s"} open to visitors.`
                : "Disabled — visitors won't see the “Go To Museum” button."}
            </p>
          </div>
        </div>
        <Toggle checked={general.enabled} onChange={toggleEnabled} label="Toggle Digital Museum" />
      </div>

      {/* Sub-tabs — horizontally scrollable on mobile so "Freedom Wall" and
          the other labels never wrap onto multiple lines. */}
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar border-b border-black/10 dark:border-white/10">
        {(
          [
            { id: "general", label: "General Settings", icon: Landmark },
            { id: "rooms", label: `Rooms (${rooms.length})`, icon: DoorOpen },
            { id: "achievements", label: "Badges & Trophies", icon: Trophy },
            { id: "freedom-wall", label: "Freedom Wall", icon: Megaphone },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setSubTab(id)}
            className={`shrink-0 whitespace-nowrap inline-flex items-center gap-2 px-3.5 py-2 font-jakarta text-xs font-medium border-b-2 -mb-px transition-colors ${
              subTab === id
                ? "border-sepia text-ink dark:text-cream"
                : "border-transparent text-ink-400 dark:text-ink-300 hover:text-ink dark:hover:text-cream"
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {subTab === "general" && (
        <div className="space-y-4">
          {/* Every block below is folded behind the same accordion the Rooms
              tab uses. This tab had grown to five unrelated concerns stacked
              in one scroll — museum basics, splash, minimap, filters, music —
              each with its own Save button, and finding the one you wanted
              meant scrolling past four you didn't. Folding is display only:
              a collapsed section is still in effect, and what's open is
              remembered per browser. */}
          <AdminAccordion
            title="Museum Basics"
            subtitle="Title, description, the About room, companions and the soundtrack"
            icon={<Landmark size={15} />}
            open={sections.open.basics}
            onToggle={() => sections.toggle("basics")}
          >
          {/* 2-column grid on md+: Title/Desc + About left, Chase + Soundtrack right.
              No items-* so the default stretch makes paired cells match height. */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* LEFT col ── top: Title + Description */}
            <div className="admin-card border rounded-2xl p-4 space-y-4 h-full">
              <div>
                <label className="font-body text-xs text-ink-400 dark:text-ink-300 mb-1.5 block">
                  Museum Title <span className="opacity-60">(optional)</span>
                </label>
                <input
                  type="text"
                  defaultValue={general.title ?? ""}
                  onBlur={(e) => e.target.value !== (general.title ?? "") && saveGeneralField("title", e.target.value)}
                  placeholder="e.g. ScriptOverNovel Digital Museum"
                  className="admin-input w-full px-3 py-2 rounded-xl text-sm"
                />
                <p className="font-body text-[11px] text-ink-400 dark:text-ink-300 mt-1.5">
                  Shown as the browser tab title on /gallery/museum.
                </p>
              </div>
              <div>
                <label className="font-body text-xs text-ink-400 dark:text-ink-300 mb-1.5 block">
                  Museum Description <span className="opacity-60">(optional)</span>
                </label>
                <textarea
                  defaultValue={general.description ?? ""}
                  onBlur={(e) => e.target.value !== (general.description ?? "") && saveGeneralField("description", e.target.value)}
                  rows={3}
                  className="admin-input w-full px-3 py-2 rounded-xl text-sm resize-none"
                />
                <p className="font-body text-[11px] text-ink-400 dark:text-ink-300 mt-1.5">
                  Shown as the page&apos;s meta description (search/share previews).
                </p>
              </div>
            </div>

            {/* RIGHT col ── top: About ScriptOverNovel info */}
            <div className="admin-card border rounded-2xl p-4 flex items-start gap-3 h-full">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                <User size={16} />
              </div>
              <div>
                <p className="font-jakarta text-sm font-medium text-ink dark:text-cream">About ScriptOverNovel room</p>
                <p className="font-body text-xs text-ink-400 dark:text-ink-300 mt-0.5">
                  Every visitor&apos;s corridor ends in an automatic &quot;About ScriptOverNovel&quot; room — its
                  bio, photos, skills, certificates, and social links always mirror the Profile /
                  Certificates / Skills / Social Links you manage in Settings, nothing to configure
                  here for those. Its wall/floor/ceiling are editable though — see the &quot;About
                  ScriptOverNovel&quot; card at the bottom of the Rooms tab.
                </p>
              </div>
            </div>

            {/* LEFT col ── bottom: Chase Companions */}
            <ChaseCompanionsSection />

            {/* RIGHT col ── bottom: Museum Soundtrack */}
          {/* Museum Soundtrack — separate from the site-wide Profile music.
              Visitors toggle it via the HUD button inside the museum. */}
          <div className="admin-card border rounded-2xl p-4 space-y-4 h-full">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 shrink-0">
                <Music size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-jakarta text-sm font-medium text-ink dark:text-cream">Museum Soundtrack</p>
                  <Toggle
                    checked={museumMusic.enabled}
                    onChange={(enabled) => updateMuseumMusic({ enabled })}
                    label="Toggle museum soundtrack"
                  />
                </div>
                <p className="font-body text-xs text-ink-400 dark:text-ink-300 mt-0.5">
                  Plays only inside the museum — separate from your site-wide background music.
                  Visitors control it via the music button in the museum HUD.
                </p>
              </div>
            </div>

            <AudioUploader
              value={museumMusic.url}
              onChange={(url) => updateMuseumMusic({ url })}
            />

            {museumMusic.url && (
              <div>
                <label className="font-body text-xs text-ink-400 dark:text-ink-300 mb-1.5 block">
                  Default Volume — {museumMusic.volume}%
                </label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={museumMusic.volume}
                  onChange={(e) => setMuseumMusic((m) => ({ ...m, volume: Number(e.target.value) }))}
                  onMouseUp={(e) => updateMuseumMusic({ volume: Number((e.target as HTMLInputElement).value) })}
                  onTouchEnd={(e) => updateMuseumMusic({ volume: Number((e.target as HTMLInputElement).value) })}
                  className="w-full accent-sepia"
                />
              </div>
            )}
          </div>
          </div>{/* end 2-col grid */}
          </AdminAccordion>

          <AdminAccordion
            title="Room Splash"
            subtitle="The brief animation shown when a visitor first walks into a room"
            icon={<Sparkles size={15} />}
            open={sections.open.splash}
            onToggle={() => sections.toggle("splash")}
          >
          <MuseumSplashSection value={splash} onChange={(patch) => setSplash((s) => ({ ...s, ...patch }))} />

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={saveSplash}
              disabled={savingSplash || !splashDirty}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sepia text-white font-jakarta text-sm font-medium hover:bg-sepia-dark transition-all duration-200 shadow-md disabled:opacity-50"
            >
              {savingSplash ? (
                <>
                  <div className="w-4 h-4 border border-cream/30 border-t-cream rounded-full animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Save size={16} />
                  Save Splash Settings
                </>
              )}
            </button>
            {splashDirty && !savingSplash && (
              <span className="font-body text-xs text-ink-400 dark:text-ink-300">Unsaved changes</span>
            )}
          </div>
          </AdminAccordion>

          <AdminAccordion
            title="Minimap HUD"
            subtitle="The radar card and counters in the museum's bottom-left corner"
            icon={<Radar size={15} />}
            open={sections.open.minimap}
            onToggle={() => sections.toggle("minimap")}
          >
          <MinimapHudSection
            value={minimap}
            onChange={(patch) => setMinimap((m) => ({ ...m, ...patch }))}
          />

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={saveMinimap}
              disabled={savingMinimap || !minimapDirty}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sepia text-white font-jakarta text-sm font-medium hover:bg-sepia-dark transition-all duration-200 shadow-md disabled:opacity-50"
            >
              {savingMinimap ? (
                <>
                  <div className="w-4 h-4 border border-cream/30 border-t-cream rounded-full animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Save size={16} />
                  Save Minimap HUD
                </>
              )}
            </button>
            {minimapDirty && !savingMinimap && (
              <span className="font-body text-xs text-ink-400 dark:text-ink-300">Unsaved changes</span>
            )}
          </div>
          </AdminAccordion>

          <AdminAccordion
            title="Filter Vision"
            subtitle="The looks visitors cycle with [Q] — five built in, plus your own colours"
            icon={<Aperture size={15} />}
            badge={visionEnabled ? visionConfig.enabledBuiltIns.length + visionConfig.custom.length : "off"}
            open={sections.open.filters}
            onToggle={() => sections.toggle("filters")}
          >
          <VisionFiltersSection
            enabled={visionEnabled}
            value={visionConfig}
            onToggleEnabled={toggleVisionFilters}
            onChange={(patch) => setVisionConfig((c) => ({ ...c, ...patch }))}
          />

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={saveVisionFilters}
              disabled={savingVision || !visionDirty}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sepia text-white font-jakarta text-sm font-medium hover:bg-sepia-dark transition-all duration-200 shadow-md disabled:opacity-50"
            >
              {savingVision ? (
                <>
                  <div className="w-4 h-4 border border-cream/30 border-t-cream rounded-full animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Save size={16} />
                  Save Filter Vision
                </>
              )}
            </button>
            {visionDirty && !savingVision && (
              <span className="font-body text-xs text-ink-400 dark:text-ink-300">Unsaved changes</span>
            )}
          </div>
          </AdminAccordion>

        </div>
      )}

      {subTab === "rooms" && (
        <div className="space-y-6">
          <RoomsTab
            rooms={rooms}
            setRooms={setRooms}
            allArtworks={artworks}
            aboutVisuals={aboutVisuals}
            onUpdateAboutVisuals={updateAboutVisuals}
            aboutRoomId={aboutRoomId}
            aboutFloor={aboutFloor}
            onUpdateAboutFloor={updateAboutFloor}
            freedomWallRoomId={freedomWallRoomId}
            freedomWallEnabled={freedomWallEnabled}
            onToggleFreedomWall={toggleFreedomWallEnabled}
            freedomWallVisuals={freedomWallVisuals}
            onUpdateFreedomWallVisuals={updateFreedomWallVisuals}
            freedomWallFloor={freedomWallFloor}
            onUpdateFreedomWallFloor={updateFreedomWallFloor}
            freedomWallSplashEnabled={freedomWallSplashEnabled}
            onUpdateFreedomWallSplashEnabled={updateFreedomWallSplashEnabled}
            stairsRoomId={stairsRoomId}
            stairsVisuals={stairsVisuals}
            onUpdateStairsVisuals={updateStairsVisuals}
            stairsSplashEnabled={stairsSplashEnabled}
            onUpdateStairsSplashEnabled={updateStairsSplashEnabled}
          />

        </div>
      )}

      {subTab === "achievements" && achievementsConfig && (
        <AchievementsTab value={achievementsConfig} onChange={updateAchievementsConfig} />
      )}

      {subTab === "freedom-wall" && (
        <FreedomWallTab />
      )}

    </div>
  );
}
