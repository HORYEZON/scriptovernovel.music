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
