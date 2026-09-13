// lib/museum/storyPodiumModel.ts
//
// The Stories Room's optional pedestal model — the admin's way to replace
// StoryPodium.tsx's procedural podium with their own .glb, without giving up
// the part that has to stay dynamic: the book on top, whose cover is each
// story's own uploaded image.
//
// Stored as a kind-marked singleton MuseumSceneObject on the Stories Room,
// the same lazy-provisioned pattern as the Freedom Wall banner (see
// freedomWallBanner.ts) and the About room's 3 blocks. Room-scoped rather
// than per-story on purpose: a library of twenty books wants one pedestal
// design, not twenty.
//
// Unlike those two, this object is *configuration, not a placement* — it is
// never drawn where it "sits". Its position columns are unused; the podiums
// themselves are positioned by MuseumRoomStory rows (see podiumPlacement.ts).
// MuseumScene.tsx therefore skips it when building the room's decorative
// object list, or it would render as a stray prop floating at the origin.
//
// Client-safe (no prisma import) so both server code (the museum page, the
// scene-objects API route) and client code (MuseumScene, the Museum Scene
// Editor) can import these directly — the DB provisioning lives in
// storiesRoom.ts's ensureStoryPodiumModel, which imports this module.

export const STORY_PODIUM_MODEL_KIND = "story-podium-model";

/** Height of StoryPodium.tsx's own procedural pedestal — the fallback for
 *  `bookHeight` below, and what the editor's field defaults to. */
export const DEFAULT_PODIUM_BOOK_HEIGHT = 1.1;

export interface PodiumModelConfig {
  /**
   * Optional tiled surface image for the *procedural* pedestal — the same
   * kind of upload a room's wall/floor/ceiling takes, and tiled in the same
   * world units (roomConstants' TEXTURE_TILE_METERS) so a podium finished in
   * the same stone as the floor reads as one material rather than two.
   *
   * Ignored when `url` below is set: an uploaded .glb brings its own
   * materials, and repainting them would fight whatever the model already
   * looks like.
   */
  textureUrl?: string | null;
  /** Supabase URL of the uploaded .glb. Null/absent = use the procedural
   *  pedestal (the default state of a freshly provisioned row). */
  url?: string | null;
  /**
   * How high off the floor the book sits once `url` is used.
   *
   * An uploaded model's own height can't be known here without parsing its
   * glTF bounding box, and getting it wrong means a book floating above the
   * pedestal or sunk into it — so this is an admin-tuned number rather than
   * something inferred. The agreed convention for the model itself: its
   * origin is on the floor, and this value is where its top surface is.
   */
  bookHeight?: number;
}

export const DEFAULT_PODIUM_MODEL_CONFIG: Required<PodiumModelConfig> = {
  textureUrl: null,
  url: null,
  bookHeight: DEFAULT_PODIUM_BOOK_HEIGHT,
};

/** Parse the config JSON stored in the SceneObject's modelUrl column — same
 *  trick TextObjectConfig / PlaqueConfig / BannerColors already use. A row
 *  holding a bare URL (rather than JSON) is treated as the model URL, so an
 *  object written by a plainer upload path still works. */
export function parsePodiumModelConfig(
  raw: string | null | undefined
): Required<PodiumModelConfig> {
  if (!raw) return { ...DEFAULT_PODIUM_MODEL_CONFIG };
  try {
    const parsed = JSON.parse(raw) as PodiumModelConfig;
    return {
      textureUrl:
        typeof parsed.textureUrl === "string" && parsed.textureUrl ? parsed.textureUrl : null,
      url: typeof parsed.url === "string" && parsed.url ? parsed.url : null,
      bookHeight:
        typeof parsed.bookHeight === "number" && Number.isFinite(parsed.bookHeight)
          ? parsed.bookHeight
          : DEFAULT_PODIUM_BOOK_HEIGHT,
    };
  } catch {
    return raw.startsWith("http")
      ? { textureUrl: null, url: raw, bookHeight: DEFAULT_PODIUM_BOOK_HEIGHT }
      : { ...DEFAULT_PODIUM_MODEL_CONFIG };
  }
}

export function serializePodiumModelConfig(config: PodiumModelConfig): string {
  return JSON.stringify({
    textureUrl: config.textureUrl ?? null,
    url: config.url ?? null,
    bookHeight: config.bookHeight ?? DEFAULT_PODIUM_BOOK_HEIGHT,
  });
}
