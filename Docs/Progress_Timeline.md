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
