# scriptovernovel.music — Timeline & Patch Notes

### Product Versions

- v1.0 → _(first release — fill in when it ships)_

A third number is a same-day follow-up (fixes, docs) to the release above it,
not a release of its own.

> **Picking a number:** take it from the **last `##` heading in this file**, not
> from the last release you remember. Several Claude sessions often run against
> this repo at once, and each one numbering from memory is how versions end up
> used twice. Entries are appended in the order they shipped, so the bottom of
> the file is always the authority.

---

## September 20, 2026 — v0.1

### Admin Side

- **Site Design → Header** colours now tint a frosted-glass bar instead of
  painting a solid one, and only in light mode — dark mode always uses the
  site's ink/cream, so a header can't end up as a cream slab over a dark page
- The "Light / dark toggle" switch under Header icons is gone: the toggle is
  a permanent part of the header now
- The wordmark's **Fallback size** is a slider (1–4rem) instead of a typed
  CSS length
- **Preferences → Branding → Site Background Effects**: an effect picker,
  speed slider and live preview (with Replay) in the same arrangement as the
  Entrance Splash card, played on your own uploaded background photo

### Public Side

- **The header is frosted glass**, the same look as kalamari.arts's navbar:
  the page shows through it blurred, and it thickens with a hairline and
  shadow once you scroll
- The light/dark switch sits to the right of **MENU** on every page. The site
  opens in dark mode for a first-time visitor; the switch is remembered per
  device. On phones the pill is a size smaller so it fits beside MENU
- **The menu now opens as two panels meeting in the middle**, and its links
  fade up one by one once the sheet has landed — before, the link entrance
  started together with the sheet and was lost inside its motion, whichever
  effect was picked
- **Site Background Effects** — the background photo can now move: Slow
  Zoom, Drift, Breathe or Parallax (with the visitor's scrolling), each with
  its own speed. Off by default; visitors with reduced motion turned on
  always get the still photo

---

## September 20, 2026 — v0.2

### Admin Side

- Sidebar groups renamed for the band site: **Band** (About, Shows / Events)
  and **Museum & Archive** (Artworks, Minigames, Digital Museum, Freedom
  Wall, Tales, Cosplays, Announcements)
- Entrance Splash: the wordmark is now the header's own logo text / image
  (Site Design → Header → Wordmark); the "Logo Letter Colors" control is gone
  and "Squid Color" is now **Icon Color** — the seal above the name
- Site Design defaults: menu items Music / Store / Videos / About / Contact,
  hero "New single out now → LISTEN", no mailing-list line. Existing saved
  menu rows are unchanged — retitle them under Site Design → Menu
- Contact subjects are now Booking / Shows, Press / Media, Collaboration,
  General (old messages keep their old labels in Notifications)

### Public Side

- **The site reads as a band site.** New hazy homepage: a full-screen hero
  (the band's name and genres over the blurred site photo, LISTEN / WATCH),
  then only the sections that have something in them — upcoming shows, merch,
  the fan wall, the Digital Museum with Mini Games beside it. The artwork
  gallery grid has left the homepage; that content lives in the museum
- One design language across pages: thin-serif headings with a tracked
  eyebrow, frosted panels, film grain, slow fade-ups (respects reduced motion)
- Footer and entrance splash show the admin's own wordmark with the chosen
  icon as a seal, instead of the fixed SCRIPT/N(icon)VEL lockup
- The Tales page is gone from the public site (still in the museum's Stories
  room); `/wall` is a short address for the fan wall
- Header search now searches merch (releases and videos join as they ship)
- Share cards, page titles and descriptions describe the band, not a gallery
- Footer links: Music, Store, Videos, About, Contact, Fan Wall, Digital Museum

### Infra / DB

- No schema change. Groundwork for the next phases: `lib/embeds.ts` (YouTube /
  Spotify / Bandcamp / SoundCloud / Apple Music link parsing + `EmbedFrame`
  player), `lib/store/product-display.ts` (product title/image fallback chain
  ahead of the merch decoupling), `/api/site-search`

---

## September 20, 2026 — v0.3

### Admin Side

- **Releases** (sidebar → Music): singles / EPs / albums with cover, type,
  date, description, tracklist (durations, per-track links, lyrics) and
  streaming links for Spotify, Bandcamp, YouTube, SoundCloud and Apple Music,
  each checked as you paste. Pick which platform's player the site shows.
  Feature one to front the homepage; hide, reorder, trash and restore

### Public Side

- **Music page** — every release with its embedded player, tracklist with
  fold-out lyrics, and "Listen on" links for the other platforms. Filter by
  type when there's more than one
- **The homepage leads with a release** — the featured (or newest) one's cover
  as the hero backdrop, then the release in full right under it
- Header search now finds releases and tracks

### Infra / DB

- New tables `Release` and `ReleaseTrack` (migration `20260920160000_releases`)

---

## September 20, 2026 — v0.4

### Admin Side

- **Videos** (sidebar → Music): paste a YouTube link, title it, tag it as a
  music video / live / behind the scenes, tie it to a release. Feature,
  hide, reorder, trash and restore

### Public Side

- **Videos page** — every video as a still frame that plays in place when
  pressed; filter by kind. The homepage gets a Videos strip, and the hero's
  WATCH button jumps to the featured release's own video when it has one
- Header search finds videos too

### Infra / DB

- New table `Video` (migration `20260920170000_videos`)

---

## September 20, 2026 — v0.5

### Admin Side

- **Band Members** (sidebar → Band): photo, name, role, blurb; show/hide,
  reorder, trash
- **About** form relabelled for a band — Band Name, Tagline, Playing since,
  Genres / Tags, Band Photos, Booking (the fields are the same, only the
  words changed)

### Public Side

- **About page rebuilt**: a hazy hero over the first band photo, the story
  with genres and a Book us button, the members grid, the band photos (tap
  to open), and **Shows** — upcoming first, then past shows by year, with the
  map under them. Awards stay as an optional block

### Infra / DB

- New table `BandMember` (migration `20260920180000_band_members`)

---

## September 20, 2026 — v0.6

### Admin Side

- **Products are merch now**: their own title, description, up to 8 photos,
  a category, sizes/formats with per-size price and stock, In store / Paused,
  Featured, ordering. "Create from artwork" remains as the shortcut that also
  hangs the item in the museum's Services Room
- Sales dashboard groups by product (category as the group column); Trash →
  Store shows product titles and covers

### Public Side

- **Store rebuilt**: a hazy hero, category chips, product cards, and a page
  for every item (`/shop/<name>`) with photos, size picker, Add to cart and
  Share. Cart, checkout and order lookup are unchanged underneath; order
  emails and the success page say "order" instead of "artwork"
- Order reference numbers now start with `SON-`

### Infra / DB

- `Product` gains title / description / images / category / slug / featured /
  sortOrder and `artworkId` becomes optional (migration
  `20260920190000_merch_products`); `scripts/backfill-products-from-artwork.ts`
  copied the existing artwork-backed products' names and pictures across

---

## September 23, 2026 — v0.13.1

### Admin Side

- **Fixed: the Vinyl Room called itself a Cosplay room.** Its Room Type field
  read "Cosplay — fixed" with a t-shirt icon, directly under a badge correctly
  saying FIXED · VINYL. The field was an if-chain over the fixed room types
  ending in a bare Cosplay fallback, and the Vinyl Room had been added to the
  list without a branch of its own. It reads from the same label/icon maps the
  rest of the tab uses now, which are exhaustive over the room types — so the
  next one added fails to compile rather than inheriting a wrong name

### Public Side

- **Fixed: a show's details could open where you couldn't close them.** On
  About → Shows, clicking a pin soon after the section faded in put the modal's
  header — and its ✕ — above the top of the window. `position: fixed` measures
  against the nearest transformed ancestor rather than the screen, and the
  section's own fade-up is a transform; it settles after about a second, which
  is why this came and went. The modal is rendered into the page body now, so
  it can't be caught by it. The museum's Gigs panel keeps the old behaviour on
  purpose — its map is inside a rotated container that is meant to contain it

## September 23, 2026 — v0.13

### Admin Side

- **Site Background Effects preview actually shows the effect.** Zoom travels
  scale(1)→1.12 and drift ±2.5% over twenty seconds, which on a soft radial
  gradient with no edge anywhere in it is invisible — the card read as
  "nothing happens" while the animation had been running the whole time. The
  stand-in now carries a ruled grid, the frame holds still page furniture over
  it (a header rule, a card, a footer rule) so the motion has something to be
  relative to, and a **preview speed** control (1× / 4× / 10×) makes a
  forty-second round trip judgeable. The saved speed is untouched
- **Entrance Splash → Icon Color** gains **Auto glow**, which leaves the seal
  drifting through the logo's gold / grey / white instead of pinned to one hex
- **Blur / Glass Intensity**: the **Heavy** preset is gone. It sat at 18px
  while the slider runs to 24, so from the top of the range the chip that
  sounds strongest *lowered* the blur and nothing was highlighted at 24. The
  slider was always the way past Frosted

### Public Side

- **The entrance splash shows the band's name again.** Uploading a logo made
  it render the picture *instead of* the wordmark, so every word typed under
  Preferences → Branding → Entrance Splash was invisible and the splash looked
  like it ignored its own settings. It is the lettered lockup now —
  **script (◎)ver novel** — with the words and font from Site Design → Header
  and the seal on the brand glow
- **Album covers open full size** on /music and the homepage. Clicking one
  lifts the original out of its 18rem square; Esc or a click away closes it
- **A single's player is the right height.** A single is an album of one track
  on every service, so its URL asks for the tall tracklist widget and the
  player left a slab of black under its one row
- **Fan Wall, Mini Games and Digital Museum** are in the menu, above the
  social links — the three things you *do* on the site, previously reachable
  only from the footer or by scrolling the homepage
- **Page mastheads are shorter.** Music, Store, Videos and About opened on
  55–60svh of blurred photo for what is usually one word; the first release
  is on screen with the title now
- **The light/dark switch is a record** that slides and spins between the sun
  and the moon, in the logo's gold
- The favicon's colour cycle follows the logo too
- **Fixed: the page jumped sideways when the menu opened.** Locking the page
  removes the scrollbar, which hands the layout ~15px of extra width — so
  everything, the fixed header included, slid across as the overlay appeared
  and slid back on close. The scrollbar's column is reserved permanently now
  (`scrollbar-gutter: stable`), so the lock changes no widths at all. Every
  modal and overlay on the site benefits, not just the menu
- The collapsed sidebar icon no longer steps through a second, unrelated
  palette on hover — the brand glow is its colour, full stop

### Infra / DB

- No migration. `Wordmark`'s `iconPlacement="inline"` (added in v0.11) now
  serves the splash as well, and `logoImage` is gone from the splash chain
  entirely rather than passed and ignored
- `introSquidColor: ""` is the new "auto" sentinel — the column is already a
  String, so this needed no schema change
- New `components/public/system/ImageLightbox.tsx`, lifted out of
  GalleryClient where the only lightbox on the site had been welded in

## September 23, 2026 — v0.12

### Admin Side

- **Every date field takes a typed date.** The control was a button, so the
  calendar was the only way in — fine for "next Tuesday", tedious for a date
  you already know. It is a real text box now: `Sep 23, 2026`,
  `September 23, 2026`, `9/23/2026` and `2026-09-23` all parse, on Enter or
  on blur. A date that can't be read leaves the old value alone and says so,
  rather than clearing the field on a typo
- **The calendar jumps to any month or year** — two dropdowns where its
  header used to be a label. A 1998 release date meant clicking ‹ over three
  hundred times; it is one click now. The arrows still step a month at a
  time, and **Today** still jumps back
- Reaches every date in the admin at once — Releases, Events, About,
  Announcements, Marquees, Release Notes and the sidebar clock's own calendar
  all draw the same panel

### Infra / DB

- No migration and no API change — the stored value is still `YYYY-MM-DD` /
  `YYYY-MM-DDTHH:mm`. Typed text is parsed ISO-first on purpose:
  `new Date("2026-09-23")` is UTC midnight, which lands a day early in Manila,
  while every other accepted spelling parses as local
- `components/admin/AdminDatePicker.tsx` and `CalendarPanel.tsx` are kept
  byte-identical with kalamari.arts's copies

## September 23, 2026 — v0.11

### Admin Side

- The **collapsed sidebar's** brand icon drifts and glows like the expanded
  one. A custom icon used to sit on a hover-driven colour step instead, which
  never fires on touch — and the collapsed rail is most of what a narrow
  screen shows. Hovering with a mouse still steps the colour
- The sidebar wordmark's per-letter hover colours follow the new palette

### Public Side

- **The footer spells the band out again.** Uploading a logo used to replace
  the footer wordmark with the image, and the footer was the only place the
  name was written — so the upload silently deleted it. The footer is lettered
  now: **script (◎)ver novel**, with the icon standing in for the O. The
  uploaded logo stays in the header, where it was always the point
- **New glow colours** — the logo's own gold, silver-grey and white, replacing
  the inherited yellow / green / blue / pink. Applies to the footer seal, the
  entrance splash, the admin sidebar icon and the cursor trail's fallback
  (a cursor palette set under Theme → Cursor Effects still wins)

### Infra / DB

- No migration. `Wordmark` grew an `iconPlacement="inline"` mode that sets the
  seal into the text in place of a letter (`iconSplit`, default "O"), falling
  back to the left-hand seal when that letter isn't in the name, so renaming
  the band can't leave the lockup iconless. `aria-label` restores the letter
  for screen readers
- The palette lives in `squidCycle` (tailwind.config.ts) and
  `cursorGlowCycle` (globals.css); the admin-wide `DEFAULT_HOVER_COLORS` is
  untouched — it is the icon/social/skill palette, not the wordmark's

## September 23, 2026 — v0.10

### Admin Side

- **Scene Editor → Vinyl Room → Turntable & Lyrics Wall**: the Lyrics Wall is
  styleable. It had two colour pickers; it now carries the full plaque
  treatment every other panel in the museum already had —
  - **Type**: font (any museum face), text size 50–200%, lyric colour, glow
    colour. Size is a multiplier on the wall's own fit-to-panel result, so
    turning it up enlarges the words without pushing a long line off the edges
  - **Panel**: panel and edge colours, edge width, an uploaded **panel
    texture** stretched across the wall (the panel colour tints it — white
    shows the image as uploaded), and brightness 0–200%
  - **Glassmorphism**: frosted-translucent mode with its own opacity, plus a
    **shimmer** sweep and its speed/strength, in step with every other
    shimmering panel in the museum
- A room that has never been styled is unchanged: the defaults restate the
  wall's original near-black glass, gold trim and DM Sans

### Public Side

- Nothing moves on its own — the wall looks exactly as it did until a room is
  actually styled

### Infra / DB

- No migration. `lyricsWall` grew from four keys to sixteen inside the Vinyl
  Room's existing `vinyl-room-config` scene object; unknown/missing keys fall
  back to the shipped look, so old rows read correctly
- `LyricsWallConfig` extends `BannerFinish` (`lib/museum/roomBanner.ts`) and
  the wall is drawn by `BannerPanel.tsx`, so there is still exactly one frosted
  panel implementation in the codebase
- `VinylRoomConfigPublic` in `types/index.ts` was a hand-copied structural twin
  of `VinylRoomConfig` and had already drifted — it is an alias now

## September 23, 2026 — v0.9

### Admin Side

- **Site Design → Menu**: the live preview is **sticky** — it stays on screen
  while you work the controls under it, instead of scrolling away the moment
  you recolour a link or upload its photo. On a wide desktop the controls and
  the preview sit side by side
- Two new preview controls on that card: **Play loop** (keeps cycling close →
  open so an effect can be judged without pressing a button between takes)
  and **Backdrop brightness** — a 0–100% slider for the stand-in page the
  menu opens over, so a pale panel or underline can be checked against a
  light page. Preview only, never saved
- **Videos**: the YouTube thumbnail in the New / Edit video modal is centred
  under the link field instead of hugging the left edge

### Public Side

- **Site Design → Homepage Hero is a takeover now.** Switched on, it wins the
  homepage outright — a hand-designed splash for a launch or an announcement.
  Switched off (the default), the homepage keeps resolving itself: the
  featured release, else the band hero. It used to sit *below* the release,
  which made it unreachable on any site that had published one — exactly when
  you'd reach for it
- The header goes **fully transparent over every homepage hero**, not just the
  custom one, so a full-bleed hero runs under it uninterrupted. Over a photo
  hero the header's type switches to cream, since the admin's near-black
  default would have disappeared into the dark wash
- The band hero (shown when nothing is published yet) leads with the **About →
  Headline** and the first line of the bio. The band's name is gone from it —
  the header wordmark is already on screen, and the same words twice on one
  screen read as a mistake

## September 21, 2026 — v0.8.1

### Admin Side

- **Artworks → Museum Pieces**: the inherited art-gallery module is now the
  museum's picture library (live photos, gig posters, press shots, cover
  art). Sold / Available, "New Release", price sorting and the "Go to
  Gallery" link are gone from the admin; **Medium → Kind** with presets
  that read on the museum plaque. Sidebar, Global Search, Dashboard, Trash
  and the Rooms picker say "pieces". No schema change — the columns stay

### Public Side

- Museum prompt reads **[E] View** (not "View Artwork"); map and
  achievements count "pieces"; the piece page drops the Sold / Available
  line and its "New Release" badge

## September 21, 2026 — v0.8

### Admin Side

- **Vinyls** (Music → Vinyls): a record = one release + one uploaded audio
  file (≤ 15 MB, the museum soundtrack's R2 upload), an optional side label,
  published switch, ordering, Trash (purge removes the audio). Wired into
  Global Search, admin search, the sidebar and `/admin/api-docs`
- **Vinyl Room** in Digital Museum → Rooms: a provisioned mirror room (off
  by default) that hangs every published vinyl. Its Scene Editor places
  sleeves like frames (wall picker, height, size), drags the turntable, and
  has a **Turntable & Lyrics Wall** card — turntable `.glb`, default effects,
  Lyrics Wall on/off, wall and colours (one `vinyl-room-config` scene object)

### Public Side

- **Vinyl Room**: take a record off the wall ([E] / tap; a held-item card
  shows what you're carrying), put it on the turntable and it plays through
  a Web Audio chain — reverb, lo-fi, crackle, echo, 33 / 45 / 78 rpm with
  fine speed (pitch follows, like a real deck). The deck panel has transport,
  a seek bar, the tracklist and the current lyric; the museum soundtrack
  pauses while a record plays. Settings persist for the visit
- **Lyrics Wall**: a glass panel projecting the playing track's lyrics line
  by line, timed proportionally across the recording (approximate — lyrics
  carry no timestamps). Not in VR: the room and sound are, the sliders aren't

### Infra / DB

- `MuseumRoomType.VINYL`, new `VinylRecord` and `MuseumRoomVinyl` tables
  (migration `20260921090000_vinyl_room`)
- New API: `/api/vinyls` (+ `[id]`, `reorder`), `/api/digital-museum/room-vinyls/[id]`

## September 20, 2026 — v0.7

### Admin Side

- **Minigames are built on releases**: each game picks a release (its cover
  is the puzzle); Find the Difference takes an uploaded altered cover. Three
  new games draw on the whole catalogue and need nothing picked — the panel
  says what they need (e.g. four published releases)

### Public Side

- **Five music games**: Guess the Cover (a cover sharpens step by step —
  guess early for more points), Name That Track, Fill the Lyric, Tracklist
  Order and Release Timeline. The five picture puzzles play on record covers
  now. Quiz answers never reach the browser — the server judges every round
- Fixed: the games overlay was being clipped to the homepage's Arcade block

### Infra / DB

- `MiniGame.releaseId` + `secondaryImageUrl`, five new `MiniGameType` values
  (migration `20260920200000_music_minigames`)

---

## September 24, 2026 — v0.14 (sleeves that open, a pedalboard on the deck)

### Public Side

- **A record sleeve opens.** [E] at one on the Vinyl Room's wall no longer
  just hands the record over: the cover swings on its left edge like a
  gatefold, the disc slides out of the open right edge and turns on the spot,
  and only then does it reach your hands. Putting it back runs the same
  animation in reverse. A case whose record is out on the deck stays hanging
  open, so the wall reads at a glance as "that one's out"
- **The turntable has a shoegaze board.** Phaser, flanger, chorus, vibrato and
  tremolo, chained in the order a player would, plus one **Drift** knob that
  sets the tempo for all five — each pedal runs its own LFO at its own
  multiple of it, so turning two up sounds like two pedals rather than one
  blob
- **Backmasking.** A record can be played backwards from the deck panel. It
  picks up from wherever the song was, and the timer counts down
- The Store's product cards have their hover light-sweep. The **Hover
  Shimmer → Shop** setting has existed in the admin since the shimmer
  shipped; nothing had ever rendered it there
- The About page's genre chips react to a hover — they had no hover styling of
  any kind
- **Header search, tidied.** The panel showed two ✕ (the browser draws its own
  inside a search input), stayed light-mode tan in dark mode, and let the page
  scroll behind it. One ✕ now, frosted glass that follows the theme, and a
  single scrollbar. Also ↑/↓ to walk the results and Enter to open one

### Admin Side

- The deck's default effects (Museum Editor → Vinyl) gain the five
  modulations, the Drift knob and a **Start backmasked** switch
- The admin panel's browser tab wears the record icon with the same colour
  glow the public site has, regardless of an uploaded Site Design favicon —
  that upload is public branding and has no business labelling the back office

### Infra / DB

- No migration. `VinylEffects` gains `chorus`/`flanger`/`phaser`/`tremolo`/
  `vibrato`/`modRate`/`reverse`; the stored config is coerced through
  `sanitizeVinylEffects` as always, so an existing row simply picks up the
  new defaults. `lib/openapi.ts` updated
- Backmasking swaps the player's *source* rather than adding a node: an
  `<audio>` element can't play backwards at any rate, so the file is fetched,
  decoded, reversed sample-by-sample and played from an `AudioBufferSourceNode`
  into the same chain. The two modes hand the playhead to each other. A decode
  needs CORS on the bucket — the same requirement the element already has —
  and a failure keeps the record playing forwards and says so rather than
  dropping into silence
- `SLEEVE_OPEN_MS` is exported from `VinylSleeve.tsx` and imported by
  `MuseumScene`, so the swing and the moment the record changes hands can't
  drift apart

---

## September 24, 2026 — v0.15 (backward play vs backmasking, sleeve details, a video behind the lyrics)

### Public Side

- **Backward play and Backmasking are now two different things.** What v0.14
  shipped as "backmasking" — the needle running from the end back to the
  start, timer counting down — keeps working exactly as it did, under its
  proper name, **Backward play**. **Backmasking** is new: every moment of the
  song *sounds* reversed, but the song still moves forward — the timer counts
  up, the Lyrics Wall keeps its place, the record ends at its end. A
  **Window** slider sets how much plays backwards at a time. One or the other,
  never both
- **An empty sleeve stays half-open.** Once the record is in your hands the
  cover relaxes from fully swung to about 50°, so the artwork keeps facing the
  room instead of turning to the wall
- **[E] at a sleeve whose record is on the deck opens its details** — it used
  to say "On the deck" and do nothing. Cover, whether it's playing and which
  way, the tracklist with the current track lit, the lyric on screen now,
  play/pause, and **Put it back in its sleeve**
- **A video behind the lyrics.** Upload a clip or paste a YouTube link; set its
  brightness so the words still read; muted by default

### Admin Side

- Scene Editor → Turntable & Lyrics Wall: the old "Start backmasked" switch is
  **Start with backward play** (same stored key, so rooms that had it on keep
  starting the same way), beside a new **Start backmasked** with its window
  slider
- The Lyrics Wall card gains **Video behind the lyrics**: None / Upload /
  YouTube, the file or link, **Video brightness** (0–200%, starts at 70%) and
  **Mute the video** (on by default)

### Infra / DB

- No migration. `VinylEffects` gains `backmask` + `backmaskWindow`;
  `LyricsWallConfig` gains `videoSource`/`videoUrl`/`videoYoutubeUrl`/
  `videoBrightness`/`videoMuted`. All coerced through the existing sanitizers,
  so stored rooms pick up the defaults. `sanitizeVinylEffects` breaks a tie in
  favour of `reverse` if a blob somehow has both on
- `vinylAudio.ts`: the buffer path is generalised from one reversed copy to a
  `src` of `element | reverse | backmask`. The record is decoded once; both
  derived buffers are built from it and cached (the backmask one per window,
  rebuilt debounced on a slider drag). Backmask windows are reversed in place
  with a 12 ms fade at each seam — without it every seam clicks. Song time maps
  1:1 onto the backmask buffer, which is what lets seek, the timer and the
  Lyrics Wall ignore the mode entirely. `VinylPlayerState.reversed` became
  `source`
- **YouTube can't be a WebGL texture** (a cross-origin iframe's pixels are
  unreadable by design), so it's drei `<Html transform occlude="blending">`:
  real DOM behind the canvas, a mesh punching a transparent patch where it
  sits, lyrics drawn over that. drei's blending mode restyles the `<canvas>`
  (absolute, huge z-index, `pointer-events: none`) and never restores it —
  that would lift the canvas over the HUD and break the click pointer lock
  needs. So `zIndexRange={[1, 0]}` (canvas 0, iframe −1), both Canvas wrappers
  (museum + Scene Editor) are `isolation: isolate` so those numbers can't reach
  the HUD, and `LyricsWallVideo` restores `pointer-events` right after drei's
  effect and all three styles on unmount. It steps aside while a headset is
  presenting (the patch would be a black hole there)
- Verified headless (Chromium + SwiftShader, a throwaway page mounting the real
  `LyricsWall`): canvas z-index 0 / iframe −1, an un-z-indexed HUD box stays on
  top, a canvas click still reaches R3F, a 3D object in front of the wall
  occludes the video, unmount restores the canvas and removes the iframe; a
  16:9 YouTube video and an uploaded clip both fill the panel. The upload path's
  brightness is gamma-corrected (`pow(b, 2.2)`) so it matches CSS `brightness()`
  on the YouTube path at the same setting

---

## September 24, 2026 — v0.16 (Site Design moves into Preferences; one logo)

### Admin Side

- **Site Design is now three tabs of Settings → Preferences** — **Header ·
  Menu · Homepage Hero**, first in the tab bar, ahead of Branding. The Site
  Design entry is gone from the sidebar. Old links and bookmarks
  (`/admin/site-design`, including `?tab=menu` / `?tab=hero`) land on the right
  tab; the Settings hub card and Global Search point there too. The three
  tabs still share one staged form and one Save
- **The header preview's light/dark switch works.** It was a painted stand-in;
  pressing it now shows the bar as a dark-mode visitor sees it — the ink tint
  and cream type that ignore your Header colours — with the same rolling-record
  thumb as the real switch. It changes the preview only, never your own theme
- **Branding's "Navbar Logo" tile is gone** — it duplicated Header → Logo
  image. That Header logo is now the site's one logo everywhere the Branding
  one used to appear: the admin sidebar, the login page, order receipts, every
  email, mini-game alerts, and the museum's About plaque (and so the 📸
  screenshot watermark). Where the two had different pictures, those places
  switch to the Header one

### Infra / DB

- No migration and no data write. `lib/site-logo.ts` (`getSiteLogoUrl`)
  resolves `SiteDesign.headerLogoImage`, falling back to `Profile.logoImage`
  only while the header logo is empty — so nothing goes blank, and the old
  upload is left alone rather than overwritten. Branding's form no longer
  carries `logoImage`, so a Branding save can't touch it either.
  `LogoUploader.tsx` deleted (unused)
- `SiteDesignClient` gains `embedded` + a controlled `tab`; its own tab bar
  and `?tab=` reading switch off when embedded. `SITE_DESIGN_TABS` is exported
  so Preferences builds its bar from the same list. `VinylThumb` is exported
  from `ThemeToggle.tsx` so the preview's switch and the real one can't drift
- Verified headless on a throwaway page rendering the real `SiteDesignClient`
  embedded: no duplicate tab bar, the preview switch flips `aria-pressed` and
  repaints the bar dark, no page errors

---

## September 26, 2026 — v0.17 (Theme switch shares one pill; museum mobile fixes)

### Public Side

- **The release-notes bell (✨) stays cream in light mode.** It carried its
  own near-black colour instead of inheriting the header's, so over the
  homepage hero it went almost invisible while every icon beside it stayed
  light. It now inherits like the rest of the row, and fades on hover rather
  than turning sepia
- **Homepage hero no longer says the band's name twice.** The fallback hero
  (shown until the first release is published) used the header wordmark as its
  title, directly under the same wordmark in the bar. It leads with the
  Profile **headline** now, with the first line of the **bio** underneath —
  fill both in under Profile. Once a release is published this hero is
  replaced by the release one anyway
- **Menu destinations corrected** — Music pointed at the homepage, Store at a
  page that no longer exists (404), and Videos at the Store. Data fix on the
  live menu rows, no deploy involved

### Digital Museum

- **The "Holding" card no longer sits on the joystick.** On a phone it was
  pinned bottom-right, straight over TouchControls in both portrait and
  landscape. On touch it moves to the top-right, under the toolbar; desktop
  keeps it bottom-right where nothing competes with it
- **Screenshot watermark is bottom-right everywhere.** It was centred on
  phones, which signed the middle of a portrait capture instead of its corner
- **A sleeve whose record you're carrying keeps showing its album art.** The
  cover settled ~52° open, far enough that walking up to it showed the cover's
  edge and the empty inner card — the art looked gone. It rests at ~18° now:
  clearly lifted off the sleeve, still square to the room

### Admin Side

- **The Header preview's light/dark switch is the real one.** The preview
  carried its own copy of the pill's markup, and that copy had drifted: its
  thumb wrapper never set the gold, so the record's grooves and label —
  drawn in `currentColor` — came out zinc, and the disc's `dark:` fill
  followed the *admin's* theme rather than the preview's

### Infra

- `components/ui/ThemeSwitch.tsx` — the pill, drawn purely from a `dark`
  prop, no `dark:` variants. `ThemeToggle` is now a thin wrapper owning the
  real theme (the `<html>` class + localStorage), and the Header preview
  wraps the same component with its preview-only flag. Ported from
  kalamari.arts' `ThemeSwitch`, which split it this way for exactly this
  reason. `VinylThumb` moves there and takes `dark` as a prop; it is still
  re-exported from `ThemeToggle.tsx` for existing importers
- `ScreenshotCapture`'s `isCoarsePointer` prop removed — the watermark no
  longer branches on it
- No migration. `tsc`, `next lint` and `yarn build` all clean

---

## September 26, 2026 — v0.18 (Shows has its own page)

### Public Side

- **`/shows` — the gig page.** The band's dates used to be a section three
  screens down `/about`, with no address of their own to post and nothing a
  search engine could read as an event. They now have a page: upcoming dates
  first (soonest first, TBA last), then the archive of everything played by
  year, then the map of every stage. **Shows** joins the menu bar after Music
- **A show row can be acted on.** Each row now carries the venue *and* city,
  the rest of the bill ("with Severe Weather · Ampelope"), what a ticket
  costs, and a **Tickets** button when there's a link to sell one
- **A cancelled or postponed show stays listed**, struck through and badged,
  instead of vanishing — someone holding a ticket has to be able to find out,
  and a show that quietly disappears reads as a site bug. It moves out of the
  upcoming list, and its ticket button comes off
- **Shows no longer claim they start at 8:00 AM.** The admin's date field had
  no time, so every date was stored as midnight UTC and rendered in Manila as
  eight in the morning. Shows with no time recorded now show no time at all,
  and new ones can be given the real set time
- **A show with no date still lists.** It reads **TBA** and sits at the end of
  the upcoming list rather than being filed under the past — it is announced,
  not finished
- **About keeps the next few shows** with an *All shows* link. `#shows` still
  resolves there, so every link ever posted to `/about#shows` still lands on
  something about shows
- Upcoming dates carry `MusicEvent` structured data (as an `ItemList`, with
  the venue, coordinates, status and ticket offer), so a gig can turn up in
  search on its own. Past shows are deliberately left out. A TBA show has no
  `startDate` and so earns no rich result until it is dated

### Admin Side

- **Shows / Events** (was *Timeline / Events*) gains **City**, **Status**
  (Scheduled / Sold out / Cancelled / Postponed), **Ticket Link**,
  **Price**, **Price Note** and **Lineup**, and its date field now carries a
  set time
- **Price Note beats Price.** "Free entry" and "₱250 at the door" are truer
  than a bare figure, so the note is shown instead of the number when both
  are filled
- The list rows show city and a non-scheduled status, and search matches city

### Infra

- `lib/shows.ts` (client-safe: statuses, limits, the ticket-URL rule, the
  one sanitizer both write routes and the form share, `isUpcomingShow`,
  `hasShowTime`) and `lib/shows-server.ts` (`SHOW_SELECT`, the public
  queries, `splitShows` / `groupShowsByYear`, `revalidateShowPaths`) —
  mirroring the `lib/releases*.ts` split. `ShowRow` takes the one
  `PublicShow` shape, which is a superset of `EventsMap`'s `PublicEvent`, so
  the list and the map read from one query
- `Event` gains `city`, `lineup`, `ticketUrl`, `ticketPrice`, `ticketNote`
  and `status` (new `ShowStatus` enum), plus an `(enabled, eventDate)` index
  for the page's two queries. Migration `20260926100000_shows_page` — all
  additive: new nullable columns, one defaulted column, one enum, one index
- `GET /api/events/public` now selects through `SHOW_SELECT`, so it cannot
  drift from the page; its response gained the new fields and lost nothing
- `scripts/add-menu-item.ts` — an idempotent menu-row insert. `Shows` was
  added to `DEFAULT_MENU_ITEMS` *and* to the live menu, because a site whose
  menu rows are already saved never reads those defaults
- The admin's date→input conversion goes through `Date` rather than string
  slicing, and the form submits a real ISO instant, so the picker's local
  wall-clock time isn't reinterpreted in the server's timezone (UTC on
  Vercel)
- `tsc`, `next lint` and `yarn build` all clean; `/shows` verified against
  the live data (4 shows, all TBA) with its JSON-LD parsed

---

## September 26, 2026 — v0.19 (Every release gets its own page)

### Public Side

- **`/music/[slug]` — a page per record.** A release used to be an anchor on
  one long `/music`, so the whole discography shared a single title, a single
  description and a single share image: posting a new single linked to a page
  mostly about the others. Each release now has its own address, its own
  `<title>` and description, and **its own cover as the link preview**
- The release page carries the cover, the player, every platform it's on, the
  tracklist with fold-out lyrics, **the videos made for that release**, a link
  into the **Vinyl Room** when the record exists there, and the rest of the
  discography
- **`/music` is still the browsing view** — each card's title now links
  through to its release page, with a *Release page* link under the tracklist
- Every link to a release across the site now points at its page instead of
  the anchor: the homepage hero's **Listen**, the admin's own preview link,
  ⌘K search results, and the Vinyl Room's turntable and sleeve panels
- Release pages carry `MusicAlbum` structured data with the tracklist as
  `MusicRecording`s, plus a `BreadcrumbList`, and each one is its own
  `/sitemap.xml` entry (with the row's `updatedAt` as `lastModified`), so a
  record can be found on its own name

### Admin Side

- Nothing new to fill in. The edit form's footer now shows the release's real
  address (`/music/<slug>`) rather than the old `#slug` anchor — that is the
  link to post when a record comes out
- A video's **Release** field is what puts it on that release's page

### Infra

- `app/(public)/music/[slug]/page.tsx`, with `generateMetadata` (OG image =
  the cover, `og:type: music.album`, canonical on the slug)
- `getPublicReleaseBySlug` resolves **slug *or* id**: `Release.slug` is
  nullable — it is generated on create, so a row older than the generator is
  only reachable by id, and every link is written `slug ?? id`. One
  `releaseHref()` in `lib/releases.ts` owns that fallback
- `RELEASE_DETAIL_INCLUDE` nests its own `where`s on videos and vinyls — a
  release being published must not surface an unpublished video or a trashed
  record
- `ReleaseCover.tsx` and `ReleaseTracklist.tsx` extracted from `ReleaseCard`
  and shared with the new page. The lyrics disclosure is the fiddliest piece
  of the release UI and two copies were never going to stay in step
- `revalidateReleasePaths` also clears `/music/[slug]` (the `"page"` form,
  which covers every instance of the route)
- `app/sitemap.ts` now queries releases, with the query caught so a DB hiccup
  can't take the sitemap down with it
- `numTracks` is omitted rather than sent as `0` when a tracklist hasn't been
  typed in yet — on both the list and the detail page
- `tsc`, `next lint` and `yarn build` all clean. Verified against live data:
  `/music/paralysismo` 200, the same release by id 200, an unknown slug 404,
  both JSON-LD blocks parsed, and the sitemap carries the release
