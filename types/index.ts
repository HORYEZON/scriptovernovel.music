// types/index.ts

import type { AboutBlockOffsets } from "@/lib/museum/aboutRoomBlocks";
import type { StoryType } from "@/lib/stories";
import type { PublicGame } from "@/lib/minigames/types";

export type { StoryType };

export type ArtworkTag =
  | "abstract"
  | "geometric"
  | "cultural"
  | "monochrome"
  | "portrait"
  | "landscape"
  | "featured"
  | "color"
  | string;

export type ArtworkStatus = "AVAILABLE" | "SOLD";

export interface ArtworkWithProduct {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  tags: string[];
  medium: string | null;
  dimensions: string | null;
  year: number | null;
  featured: boolean;
  isNewRelease: boolean;
  published: boolean;
  status: ArtworkStatus;
  sectionId: string | null;
  section: { id: string; name: string; slug: string } | null;
  product: ProductData | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SectionData {
  id: string;
  name: string;
  slug: string;
  displayOrder: number;
  coverImageUrl: string | null;
  isPublished: boolean;
  artworks: ArtworkWithProduct[];
  _count?: { artworks: number };
  createdAt: Date;
  updatedAt: Date;
}

// Stories — see the Story / StoryPage models in prisma/schema.prisma. The
// StoryType union itself lives in lib/stories.ts next to its labels, since
// every select/filter/badge in the admin and public UI renders from there.
export interface StoryPageData {
  id: string;
  storyId: string;
  imageUrl: string;
  pageNumber: number;
  caption: string | null;
  createdAt?: Date | string;
}

export interface StoryData {
  id: string;
  title: string;
  description: string;
  type: StoryType;
  coverImageUrl: string;
  author: string | null;
  genre: string[];
  year: number | null;
  featured: boolean;
  published: boolean;
  slug: string | null;
  displayOrder: number;
  pages: StoryPageData[];
  _count?: { pages: number };
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface CertificateAwardData {
  id: string;
  title: string;
  issuer: string | null;
  dateAwarded: Date | string | null;
  description: string | null;
  imageUrl: string | null;
  displayOrder: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ProductVariantData {
  id: string;
  label: string;
  price: number;
  stock: number;
}

export interface ProductData {
  id: string;
  /** Null for merch; set on gallery-era products that stand on an artwork. */
  artworkId: string | null;
  price: number;
  stock: number;
  available: boolean;
  variants?: ProductVariantData[];
}

export interface CartItem {
  productId: string;
  /** Null for merch — only legacy artwork-backed products carry one. */
  artworkId?: string | null;
  title: string;
  imageUrl: string;
  price: number;
  quantity: number;
  stock: number;
  // Which size/format was selected, when the product has variants. Two cart
  // lines can share the same productId as long as their variantId differs —
  // see the composite key helper in lib/cart-store.ts.
  variantId?: string | null;
  variantLabel?: string | null;
}

// Same "snapshot at save time" approach as CartItem — price/status can go
// stale if the artwork changes after saving, same trade-off the cart
// already has, kept consistent rather than special-cased.
export interface WishlistItem {
  artworkId: string;
  slug: string | null;
  title: string;
  imageUrl: string;
  price: number | null;
  status: ArtworkStatus;
}

export interface OrderWithItems {
  id: string;
  customerName: string;
  customerEmail: string;
  status: OrderStatus;
  total: number;
  paymentId: string | null;
  paymongoRef: string | null;
  shippingAddress: string | null;
  shippingPhone: string | null;
  deliveryNotes: string | null;
  items: OrderItemData[];
  createdAt: Date;
}

export interface OrderItemData {
  id: string;
  quantity: number;
  price: number;
  variantLabel?: string | null;
  product: {
    id: string;
    artwork: {
      title: string;
      imageUrl: string;
    };
  };
}

export type OrderStatus =
  | "PENDING"
  | "PAID"
  | "FAILED"
  | "CANCELLED"
  | "SHIPPED"
  | "DELIVERED";

export interface ProfileData {
  id: string;
  bio: string;
  profileImage: string | null;
  profileImages: string[];
  backgroundImage: string | null;
  headline: string | null;
  instagram: string | null;
  facebook: string | null;
  twitter: string | null;
  email: string | null;
}

// Public payload for one artwork inside the Digital Museum — a trimmed
// projection of Artwork (see prisma/schema.prisma's MuseumRoomArtwork),
// shaped so a WishlistItem snapshot can be built from it directly:
// { artworkId: id, slug, title, imageUrl, price: product?.price ?? null, status }.
export interface MuseumArtwork {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  slug: string | null;
  medium: string | null;
  dimensions: string | null;
  year: number | null;
  status: ArtworkStatus;
  // `price` is the flat price, which is only the real price when `variants`
  // is empty — a product with sizes prices each one separately (see
  // lib/utils' formatPriceRange, which every price display in the museum
  // goes through so none of them quotes the base figure as if it were the
  // whole story). Ordered by the admin's own sortOrder, same as /shop's
  // size picker.
  product: {
    price: number;
    variants: { id: string; label: string; price: number; stock: number }[];
  } | null;
  // Primary "making of" timelapse only (mirrors Artwork.videoUrl) — the
  // museum's [E] panel (ArtworkInfoPanel.tsx) plays this as bonus content
  // alongside the wall image; the extra videoUrls clips ArtworkDetailModal
  // shows on the web don't carry over here, same "lighter cousin, not every
  // field" trim this type already applies to imageUrls/tags.
  videoUrl: string | null;
}

// "ABOUT" is the one roomType with no matching Prisma enum value — it's
// never a real MuseumRoom DB row (see page.tsx's aboutRoom construction),
// so it's not admin-creatable through the Rooms tab the other three are.
// It's auto-appended to the corridor's public room list on every request.
// "SERVICES" is the shop-wall room (lib/museum/servicesRoom.ts) — a real
// row like FREEDOM_WALL/STAIRS, but the only fixed room that still lives
// inside RoomsTab.tsx's reorderable list (it has a real displayOrder among
// the curated rooms); it just can't be created, retyped, or deleted.
// "STORIES" is the podium room (lib/museum/storiesRoom.ts) — provisioned and
// reorderable on exactly the same terms as SERVICES, and like it, never
// creatable, retypeable or deletable. Its contents mirror every published
// Story instead of every live Product.
// "COSPLAY" is the standee room (lib/museum/cosplayRoom.ts) — same terms again,
// mirroring every published Cosplay. Its contents are pairs: a standee on the
// floor with that cosplay's second photo hanging behind it.
// "VINYL" is the Vinyl Room (lib/museum/vinylRoom.ts): record sleeves from
// Music → Vinyls on the walls, a turntable, and the Lyrics Wall.
export type MuseumRoomType =
  | "MAIN_HALL"
  | "GALLERY"
  | "SPECIAL_EXHIBITION"
  | "ABOUT"
  | "FREEDOM_WALL"
  | "STAIRS"
  | "SERVICES"
  | "STORIES"
  | "ARCADE"
  | "COSPLAY"
  | "VINYL";

/** One record in the Vinyl Room as the museum sees it: the release it is
 *  (cover = sleeve and label, tracks for the Lyrics Wall) plus the audio
 *  file the deck plays, with its wall placement. */
export interface MuseumVinylSleeve {
  entryId: string;
  vinylId: string;
  displayOrder: number;
  positionX: number | null;
  positionY: number | null;
  positionZ: number | null;
  rotationY: number | null;
  scale: number | null;
  title: string;
  coverImageUrl: string;
  releaseSlug: string | null;
  audioUrl: string;
  sideLabel: string | null;
  tracks: { title: string; durationSec: number | null; lyrics: string | null }[];
}

export interface VinylRoomConfigPublic {
  turntableModelUrl: string | null;
  turntable: { x: number; z: number; rotationY: number } | null;
  defaultEffects: { reverb: number; lofi: number; crackle: number; delay: number; speed: 33 | 45 | 78; fine: number };
  lyricsWall: { enabled: boolean; wall: "north" | "east" | "west"; textColor: string; glowColor: string };
}

// Public payload for one room — see app/(public)/gallery/museum/page.tsx.
// Each room carries its own already-filtered (published, non-deleted)
// artwork list, fetched once alongside everything else so switching the
// active room in MuseumClient.tsx is a pure client-side operation.
export interface MuseumRoomPublic {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  roomType: MuseumRoomType;
  isEntryRoom: boolean;
  // 0 = ground floor, 1 = second floor — see prisma/schema.prisma's
  // MuseumRoom.floor and docs/SecondFloorStairs_Spec.md. Rooms already
  // arrive from page.tsx pre-sorted (floor 0 block, then the STAIRS
  // connector if present, then floor 1 block), so nothing downstream needs
  // to re-sort by this — it's carried along mainly for MuseumMap.tsx to
  // know which floor's rooms to show.
  floor: number;
  wallColor: string;
  floorColor: string;
  ceilingColor: string;
  // Optional tiled texture overriding the matching *Color above when set —
  // see MuseumRoom.tsx and roomConstants.ts's TEXTURE_TILE_METERS.
  wallTexture: string | null;
  floorTexture: string | null;
  ceilingTexture: string | null;
  // The room's ceiling lights — see prisma/schema.prisma's
  // MuseumRoom.lightColor. Null colour = the roomType preset's own;
  // null model = the built-in fixture; scale 1 = as designed.
  lightColor: string | null;
  lightScale: number;
  lightModelUrl: string | null;
  // Room-entry splash overrides — see RoomSplashContent.tsx. Null icon
  // falls back to the glowing squid mark; null title falls back to `name`.
  splashIcon: string | null;
  splashTitle: string | null;
  // Per-room "does this room's entry splash actually fire" toggle — see
  // prisma/schema.prisma's MuseumRoom.splashEnabled. Independent of the
  // museum-wide splashEnabled master switch (RoomSplash.tsx checks both).
  splashEnabled: boolean;
  // Admin-placed scene objects (MuseumSceneObject) — decorative props
  // (kind "custom", modelUrl = Supabase .glb URL), text labels (kind
  // "text", modelUrl = JSON TextObjectConfig), and, in the room a visitor
  // respawns into, its wall clock (ABOUT_CLOCK_KIND, modelUrl = JSON
  // WallClockConfig — see lib/museum/wallClock.ts; the About room's own
  // clock travels in `aboutClock` below instead, since that room draws its
  // own contents). Room-local coordinate space
  // (relative to this room's own center, before roomLayout.ts's corridor
  // centerZ offset), same space framePlacement.ts's frame positions use.
  // Usually empty — most rooms have none.
  customObjects: {
    id: string;
    kind: string;
    modelUrl: string;
    positionX: number;
    positionY: number;
    positionZ: number;
    rotationY: number;
    // Uniform scale multiplier — only meaningful for kind "custom" (a .glb
    // prop); 1 = the model's own exported size. See CustomSceneObject.tsx.
    scale: number;
    // kind "custom" only: block the player from walking through this prop
    // (PlayerControls' `obstacles`). `colliderRadius` is the circular
    // footprint in the model's own units, before `scale`; null falls back
    // to a small default. Both ignored unless `solid` is true.
    solid: boolean;
    colliderRadius: number | null;
    // Where that circle sits relative to the model's own origin, in the same
    // model units and in the prop's own rotated frame (0/0 = on the origin,
    // which is how every prop placed before these existed behaves). See
    // MuseumScene's customObstacles for the rotation into world space.
    colliderOffsetX: number;
    colliderOffsetZ: number;
    // How tall that circle stands, in the same model units, measured up from
    // the prop's own base. Null = a floor-to-ceiling column, which is what
    // every solid prop was before this existed. See colliderWorldHeight.
    colliderHeight: number | null;
    // How far that column is lifted off the prop's own base, same model
    // units. 0 = standing on the base, which is what a height-limited
    // collider always did. See colliderWorldBaseY.
    colliderBaseY: number;
  }[];
  // Only ever set for the About ScriptOverNovel room — the Museum Scene Editor's
  // per-block placement for its 4 content blocks (Photo Slideshow / Bio+
  // Skills Plaque / Certificates Strip / Calling Card). Each entry carries
  // a wall, an along-wall + hang-height offset, a resize scale, and (for the
  // plaque / certs / card) display or label config. See
  // lib/museum/aboutRoomBlocks.ts.
  aboutBlockOffsets?: AboutBlockOffsets;
  // ABOUT room only — the Contact Desk's placement and config. A real
  // absolute placement rather than one of aboutBlockOffsets' wall-relative
  // entries: the desk stands on the floor and is dragged and turned freely,
  // the way a Stories podium or an Arcade cabinet is. See
  // lib/museum/aboutRoomBlocks.ts's ContactDeskConfig.
  aboutContact?: {
    position: [number, number, number];
    rotationY: number;
    scale: number;
    config: {
      textureUrl: string | null;
      url: string | null;
      title: string;
      subtitle: string;
      promptLabel: string;
    };
  };
  // ABOUT room only — the digital wall clock's placement and config. Carried
  // as a real absolute placement for the same reason the Contact Desk is: it
  // is dragged, turned and resized freely rather than snapped to a designed
  // wall slot. See lib/museum/aboutRoomBlocks.ts's WallClockConfig.
  aboutClock?: {
    position: [number, number, number];
    rotationY: number;
    scale: number;
    config: {
      label: string;
      use24Hour: boolean;
      showSeconds: boolean;
      showDate: boolean;
      timeZone: string;
      digitColor: string;
      screenColor: string;
      frameColor: string;
      glow: number;
    };
  };
  // Admin-customized artwork frame placements (MuseumRoomArtwork.positionX/
  // positionZ/rotationY/scale) — see prisma/schema.prisma's doc comment.
  // Keyed by artwork.id (unique within one room's `artworks` list — a room
  // can never hold the same artwork twice). Only artworks an admin has
  // actually dragged/resized in the Museum Scene Editor appear here; any
  // artwork.id missing from this record still uses framePlacement.ts's
  // auto-computed even-spacing position (exactly as before this existed).
  artworkPlacementOverrides: Record<string, MuseumArtworkPlacementOverride>;
  artworks: MuseumArtwork[];
  // Only ever non-empty on the single STORIES room — one entry per podium.
  // Unlike `artworks` (hung on walls) these stand on the floor; their
  // placement override rides on the entry itself rather than a separate
  // record, since a podium's position is the only thing the editor changes
  // about it. See lib/museum/storiesRoom.ts and docs/StoriesRoom_Spec.md.
  stories: MuseumStoryPodium[];
  // Only ever non-empty on the single ARCADE room — one entry per playable
  // mini game. Same "placement rides on the entry" shape as `stories`. See
  // lib/museum/arcadeRoom.ts.
  miniGames: MuseumArcadeCabinet[];
  // Only ever non-empty on the single COSPLAY room — one entry per published
  // cosplay. Same "placement rides on the entry" shape as `stories`, and one
  // placement covers the pair (the standee and the photo hung behind it). See
  // lib/museum/cosplayRoom.ts.
  cosplays: MuseumCosplayStandee[];
  // Only ever non-empty on the single VINYL room — one entry per published
  // record (sleeve on the wall). Same "placement rides on the entry" shape as
  // `artworks` (wall-hung). See lib/museum/vinylRoom.ts.
  vinyls: MuseumVinylSleeve[];
  // VINYL room only — the deck, its position, default effects and the Lyrics
  // Wall (lib/museum/vinylConfig.ts). Absent elsewhere.
  vinylConfig?: VinylRoomConfigPublic;
  // COSPLAY room only — the room-wide standee body and backdrop-panel settings
  // (see lib/museum/cosplayStandee.ts). Absent elsewhere. Every standee in the
  // room is built from these; only the two photos are per-cosplay.
  cosplayStandee?: {
    modelUrl: string | null;
    textureUrl: string | null;
    cutoutHeight: number;
    backdropEnabled: boolean;
    backdropWidth: number;
    backdropHeight: number;
    backdropFrameColor: string;
    // Outer border behind that frame — the Banner plaque's raised-edge look.
    // Always drawn; matching backdropFrameColor is how you don't have one.
    backdropEdgeColor: string;
    backdropEdgeThickness: number;
    // The foot plaque's own look, same knobs the Banner offers.
    plaquePanelColor: string;
    plaqueEdgeColor: string;
    plaqueTextColor: string;
    plaqueFontFamily: string;
    plaqueFontScale: number;
    // Billboard lights ringing a lit standee's backdrop — how they look, room-
    // wide. *Which* standees are lit is per-standee (see
    // MuseumCosplayStandee.lightsEnabled below).
    lightsStyle: "marquee" | "floodlight";
    lightsColor: string;
    lightsIntensity: number;
    lightsBulbSize: number;
    lightsSpacing: number;
    lightsAnimation: "static" | "chase" | "blink";
    lightsSpeed: number;
    // Floodlight rig only — how many lamps stand at a lit standee's feet, how
    // far up the print they throw, and how wide the cone opens (the "V").
    floodCount: number;
    floodBeamHeight: number;
    floodBeamSpread: number;
  };
  // ARCADE room only — the room-wide fallback display mode for games that
  // don't set their own (see lib/museum/arcadeConfig.ts). Absent elsewhere.
  arcadeDefaultMode?: "CABINET" | "POSTER";
  // ARCADE room only — what every cabinet in the room is made of: an uploaded
  // .glb, or the built-in body optionally re-surfaced with a tiled image. The
  // screen and marquee are drawn on top either way, so these two numbers are
  // where they land on a model whose dimensions can't be read from here. Same
  // source row as arcadeDefaultMode above.
  arcadeCabinet?: {
    modelUrl: string | null;
    textureUrl: string | null;
    screenHeight: number;
    screenDepth: number;
  };
}

// One game in the Arcade Room: which game to show, where its cabinet stands,
// and whether it's a cabinet or a wall poster. The arcade-cabinet counterpart
// to MuseumStoryPodium, deliberately the same shape. See lib/museum/arcadeRoom.ts.
export interface MuseumArcadeCabinet {
  /** MuseumRoomMiniGame row id — what the Scene Editor selects and saves onto. */
  entryId: string;
  displayOrder: number;
  /** "CABINET" | "POSTER" | null (inherit the room-wide default). */
  displayMode: "CABINET" | "POSTER" | null;
  /** Null when the cabinet sits at its auto-computed grid slot (the default);
   *  set together, never partially, once an admin drags it. Room-local X/Z,
   *  Y is a raise off this room's floor. */
  positionX: number | null;
  positionY: number | null;
  positionZ: number | null;
  rotationY: number | null;
  scale: number | null;
  /** The full public game payload — same one the gallery's Mini Games launcher
   *  renders, so the in-museum info panel + GameSession need no conversion. */
  game: PublicGame;
}

// One cosplay in the Cosplay Room: the standee-plus-backdrop pair to show and
// where it stands. The standee-room counterpart to MuseumStoryPodium, and
// deliberately the same shape. See lib/museum/cosplayRoom.ts.
export interface MuseumCosplayStandee {
  /** MuseumRoomCosplay row id — what the Scene Editor selects and saves onto. */
  entryId: string;
  displayOrder: number;
  /** Null when the pair stands at its auto-computed wall slot (the default);
   *  set together, never partially, once an admin drags it. Room-local X/Z,
   *  Y is a raise off this room's floor. One placement moves both halves. */
  positionX: number | null;
  positionY: number | null;
  positionZ: number | null;
  rotationY: number | null;
  scale: number | null;
  /** This standee's own billboard-lights switch. See the schema's doc comment
   *  on MuseumRoomCosplay.lightsEnabled for why this one is per-standee while
   *  everything else about the lights is room-wide. */
  lightsEnabled: boolean;
  cosplay: MuseumCosplay;
}

// Public payload for one cosplay on a standee — the museum's trimmed cousin of
// the admin Cosplay row, carrying what the standee draws (the two photos, the
// character, the series) plus what the [E] panel shows (description, credits,
// year, event). Deliberately not the whole row: no slug/published/timestamps,
// same trim MuseumStory applies.
export interface MuseumCosplay {
  id: string;
  title: string;
  description: string | null;
  character: string | null;
  series: string | null;
  standeeImageUrl: string;
  /** The photo hung on the panel behind the standee. Null is normal — a cosplay
   *  with one shot gets a standee against a plain panel. */
  backdropImageUrl: string | null;
  cosplayer: string | null;
  photographer: string | null;
  year: number | null;
  event: string | null;
}

// One podium in the Stories Room: the story to display plus where it stands.
export interface MuseumStoryPodium {
  /** MuseumRoomStory row id — what the Scene Editor selects and saves onto. */
  entryId: string;
  displayOrder: number;
  /** Null when the podium sits at its auto-computed grid slot (the default);
   *  set together, never partially, once an admin drags it. Room-local X/Z,
   *  Y is a raise off this room's floor. */
  positionX: number | null;
  positionY: number | null;
  positionZ: number | null;
  rotationY: number | null;
  scale: number | null;
  story: MuseumStory;
}

// Public payload for one story on a podium — the museum's trimmed cousin of
// the /stories payload, shaped to satisfy StoryReader's ReadableStory
// directly so the same reader opens on both surfaces with no conversion.
export interface MuseumStory {
  id: string;
  title: string;
  description: string;
  type: StoryType;
  coverImageUrl: string;
  author: string | null;
  year: number | null;
  slug: string | null;
  continueEnabled: boolean;
  continueUrl: string | null;
  continueLabel: string | null;
  pages: { id: string; imageUrl: string; pageNumber: number; caption: string | null }[];
}

export interface MuseumArtworkPlacementOverride {
  /** Null unless the admin has dragged this frame to a custom spot. `y`
   * is world-space hung height (overrides framePlacement.ts's fixed
   * FRAME_CENTER_Y), not room-local like x/z. */
  position: { x: number; y: number; z: number; rotationY: number } | null;
  /** Null (meaning 1×, default size) unless the admin has resized it. */
  scale: number | null;
}

// Public payload for one visitor-submitted sticky note in the Freedom Wall
// room. Matches the shape returned by GET /api/freedom-wall/notes.
export interface FreedomWallNotePublic {
  id: string;
  nickname: string;
  content: string;
  positionX: number; // 0–100 % along whichever wall `wall` names
  positionY: number; // 0–100 % of wall height
  color: string;     // palette key — "yellow" | "pink" | "blue" | "green" | "purple" | "orange"
  rotation: number;  // degrees, −10 … +10 — cosmetic "pinned" tilt, unrelated to `wall`
  // Uniform size multiplier, admin-adjustable in the Museum Scene Editor —
  // same [0.5, 2.5] range and "wrapping group scale" technique as a hung
  // artwork frame's own MuseumRoomArtwork.scale. 1 = normal card size.
  scale: number;
  // Which of the room's 4 walls this note is pinned to — "north" | "south" |
  // "east" | "west", admin-picked in the Museum Scene Editor exactly like an
  // artwork frame's wall. Defaults "north" (see prisma/schema.prisma).
  wall: string;
  createdAt: string;
}

// Public payload for the "About ScriptOverNovel" room's content — built in
// page.tsx from the exact same Prisma queries app/(public)/about/page.tsx
// itself uses (Profile, CertificateAward, ArtistSkill, SocialLink), so
// editing any of that content in admin mirrors into this room automatically
// on the next request — there's no separate copy of it anywhere. See
// AboutScriptOverNovelPanel.tsx for how it's rendered.
export interface MuseumAboutCertificate {
  id: string;
  title: string;
  issuer: string | null;
  description: string | null;
  imageUrl: string | null;
  dateAwarded: Date | string | null;
}

export interface MuseumAboutSkill {
  id: string;
  name: string;
  hoverColor: string;
}

export interface MuseumAboutSocialLink {
  label: string;
  url: string;
  iconKey: string;
  hoverColor: string;
}

// One gig/event on the About room's "Timeline & Gigs" wall map — the same
// shape as components/public/EventsMap.tsx's PublicEvent (so data.gigs can
// be passed straight into <EventsMap /> when the visitor opens the panel).
export interface MuseumAboutGigMedia {
  id: string;
  url: string;
  type: "IMAGE" | "VIDEO";
}
export interface MuseumAboutGig {
  id: string;
  title: string;
  description: string | null;
  venueName: string | null;
  latitude: number;
  longitude: number;
  eventDate: string | null;
  isNextEvent: boolean;
  createdAt: string;
  media: MuseumAboutGigMedia[];
}

// "Chase Companion" — a toggleable playful mascot/easter egg (Artworks ▸
// Digital Museum ▸ General) — see prisma/schema.prisma's ChaseCompanion
// comment and components/ChaseCompanion.tsx for the actual drift-toward-
// the-visitor behavior. Up to 5 can exist, each independently enabled —
// page.tsx sends only the *enabled* ones down to the client, so an empty
// array (not a null/enabled flag) means "nothing to render."
export interface MuseumChaseCompanion {
  id: string;
  assetType: "model" | "image";
  assetUrl: string;
}

// Digital Museum Achievements — see prisma/schema.prisma's
// MuseumAchievement comment and lib/museum/useMuseumAchievements.ts for
// the tracking/claim logic. Sent to the public client only when the
// admin's master toggle is on (an empty list otherwise).
export type MuseumAchievementCategory = "time" | "views" | "wishlist" | "steps";

export interface MuseumAchievementPublic {
  id: string;
  category: MuseumAchievementCategory;
  threshold: number;
  reward: string;
}

export interface MuseumAboutData {
  displayName: string;
  headline: string | null;
  bio: string | null;
  email: string | null;
  basedIn: string | null;
  experience: string | null;
  languages: string | null;
  // Site logo (Profile.logoImage, same field Navbar.tsx reads) — mounted
  // big on the wall above the portrait slideshow in AboutRoomContents.tsx.
  logoImage: string | null;
  images: string[];
  certificates: MuseumAboutCertificate[];
  skills: MuseumAboutSkill[];
  socialLinks: MuseumAboutSocialLink[];
  // Calling card images (Profile.callingCardFront / callingCardBack) —
  // displayed as a flippable framed piece on the About room's east wall,
  // matching the same flip-card UX from app/(public)/contact/ContactClient.tsx.
  callingCardFront: string | null;
  callingCardBack: string | null;
  // Enabled, non-trashed events (same query as /api/events/public) — the
  // "Timeline & Gigs" wall map block. Ordered next-event-first.
  gigs: MuseumAboutGig[];
}

export interface PayMongoCheckoutResponse {
  data: {
    id: string;
    type: string;
    attributes: {
      checkout_url: string;
      reference_number: string;
      status: string;
      payment_intent: {
        id: string;
      };
    };
  };
}
