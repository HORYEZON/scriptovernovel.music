# ScriptOverNovel — band website

The website of ScriptOverNovel, a shoegaze / dreampop / math rock / post-rock band from Valenzuela City, PH. A hazy, release-led public site — Music, Store, Videos, About, Contact — with a fan wall, a first-person Digital Museum and mini games, plus a full admin dashboard (site design, releases, videos, merch products, orders, shows, band profile, announcements, trash/soft-delete), media uploads to Cloudflare R2, and dark/light theming.

> Forked from the kalamari.arts art-gallery codebase; the Digital Museum and its archive (artworks, tales, cosplays) live on inside it. The public-site rebuild is phased — see `Docs/Progress_Timeline.md`.

![Next.js](https://img.shields.io/badge/Next.js_15-black?style=flat&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=flat&logo=tailwindcss&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma_7-2D3748?style=flat&logo=prisma)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat&logo=postgresql&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat&logo=supabase&logoColor=white)

---

## Tech Stack

| Layer                | Technology                                                                                                                                                                                   |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework            | Next.js 15 (App Router)                                                                                                                                                                      |
| Language             | TypeScript                                                                                                                                                                                   |
| Styling              | Tailwind CSS 3                                                                                                                                                                               |
| ORM                  | Prisma 7 (`@prisma/adapter-pg` driver adapter over `pg`)                                                                                                                                     |
| Database             | PostgreSQL (Supabase-hosted, pooled via Supavisor)                                                                                                                                           |
| Auth                 | NextAuth v5 beta (Credentials provider, JWT sessions, Prisma adapter)                                                                                                                        |
| Media Storage        | Cloudflare R2 (`scriptovernovel-music-website` bucket, zero-egress) — see [`Docs/Media_Storage_R2.md`](Docs/Media_Storage_R2.md)                                                                     |
| State                | Zustand (cart, V2; wishlist)                                                                                                                                                                 |
| Animation            | Framer Motion                                                                                                                                                                                |
| Masonry Layout       | `react-masonry-css` (gallery section modal — see [`app/(public)/gallery/GalleryClient.tsx`](<app/(public)/gallery/GalleryClient.tsx>))                                                       |
| 3D Rendering         | Three.js via React Three Fiber (`@react-three/fiber`, `@react-three/drei`, `@react-three/xr`) — powers the [Digital Museum](#digital-museum) and its opt-in [VR Mode](#vr-mode), client-only |
| Forms/Bot protection | Google reCAPTCHA v3                                                                                                                                                                          |
| Email                | Nodemailer (Gmail SMTP) + Resend, branded HTML templates via `react-email` (see [`emails/`](emails/))                                                                                        |
| Payments             | PayMongo (V2, not yet wired up for production)                                                                                                                                               |
| Validation           | Zod                                                                                                                                                                                          |
| API Documentation    | OpenAPI 3.0 spec in `lib/openapi.ts`, served via `swagger-ui-react` at `/admin/api-docs`                                                                                                     |
| Maps                 | OpenStreetMap tiles via Leaflet/`react-leaflet` — powers the Timeline/Events pins on `/about`, no API key or billing account needed                                                          |
| Fonts                | Cormorant Garamond, DM Sans, DM Mono, Space Grotesk, Plus Jakarta Sans                                                                                                                       |
| Analytics            | Vercel Web Analytics (`@vercel/analytics`) — public storefront only, see [Website Analytics](#website-analytics-vercel-web-analytics)                                                        |

---

## Features

**Public site**

- **Entrance splash** — a one-time-per-tab KALAM(squid)RI reveal animation shown before the homepage content clears into view. 5 selectable transition effects (Fade, Slide Up, Slide Down,), admin-tunable hold speed and tagline text, with a live preview in the admin form (see [`lib/intro-splash.ts`](lib/intro-splash.ts)). Tracked per-tab via `sessionStorage` so it never replays on repeat navigation in the same tab, and shortens automatically for `prefers-reduced-motion` visitors
- `/` — Section-based gallery (masonry grid), featured artwork carousel, new-release badges; on mobile, sections render as a swipeable carousel (auto-scroll/swipe-only/grid, admin-configurable — see below)
- `/gallery` — Full gallery with filtering/search by medium, tag, section
- **Releases** — the band's singles / EPs / albums on `/music` and the homepage hero: cover, tracklist with fold-out lyrics, and streaming embeds (Spotify · Bandcamp · YouTube · SoundCloud · Apple Music) parsed and host-allow-listed by [`lib/embeds.ts`](lib/embeds.ts), rendered click-to-load by [`EmbedFrame.tsx`](components/public/system/EmbedFrame.tsx). Admin at **Releases**; model helpers in [`lib/releases.ts`](lib/releases.ts) / [`lib/releases-server.ts`](lib/releases-server.ts)
- **Videos** — YouTube-only, admin-managed (`/admin/videos`), on `/videos` and the homepage strip as click-to-play tiles (still frame first, player on press). Model helpers in [`lib/videos.ts`](lib/videos.ts) / [`lib/videos-server.ts`](lib/videos-server.ts)
- **Vinyls** — records for the Digital Museum's **Vinyl Room** (`/admin/vinyls`): one release + one uploaded audio file each. In the room a visitor presses [E] at a sleeve — the cover swings open on its left edge like a gatefold and the record slides out of it ([`VinylSleeve.tsx`](app/(public)/gallery/museum/components/VinylSleeve.tsx), one eased progress ref in `useFrame`; a case whose record is out stays hanging open) — carries it to the turntable and plays it through a Web Audio effects chain ([`lib/museum/vinylAudio.ts`](lib/museum/vinylAudio.ts): reverb, lo-fi, crackle, echo, a five-pedal shoegaze board — phaser/flanger/chorus/vibrato/tremolo off one shared Drift tempo — 33/45/78 rpm, plus **backward play** and **backmasking**, which swap the player's source rather than adding a node since an `<audio>` element can't play backwards at any rate: the file is fetched and decoded once, then played from an `AudioBufferSourceNode` into the same chain as either a fully reversed copy (backward play — the playhead runs back to the start) or a window-reversed copy (backmasking — every moment sounds reversed while song time still runs forward, 1:1, so the timer and Lyrics Wall carry on), the sources handing the playhead to each other in song time). [E] at a sleeve whose record is on the deck opens [`SleeveDetailsPanel.tsx`](app/(public)/gallery/museum/components/SleeveDetailsPanel.tsx) — cover, status, tracklist, play/pause and put-it-back. The Lyrics Wall can carry a **video behind the lyrics** ([`LyricsWallVideo.tsx`](app/(public)/gallery/museum/components/LyricsWallVideo.tsx)): an uploaded clip as a `VideoTexture` (in the scene, so VR and screenshots see it), or a YouTube link as a drei `<Html transform occlude="blending">` iframe layered *behind* the canvas under a transparent patch — the Canvas wrapper is `isolation: isolate` so its z-indices can't lift the canvas over the HUD, and the component restores the canvas styles drei changes; brightness and mute for both while a **Lyrics Wall** projects the track's lyrics ([`lib/museum/lyricsTimeline.ts`](lib/museum/lyricsTimeline.ts), proportional timing). Room provisioning in [`lib/museum/vinylRoom.ts`](lib/museum/vinylRoom.ts), the deck / wall config in [`lib/museum/vinylConfig.ts`](lib/museum/vinylConfig.ts). The wall's own panel is fully themeable from the Scene Editor — font, text scale and colours, plus the shared plaque finish (`BannerFinish`: uploaded texture, raised edge, brightness, frosted-glass mode, shimmer), drawn by the one [`BannerPanel.tsx`](app/(public)/gallery/museum/components/BannerPanel.tsx) every museum plaque uses
- **About / Band Members** — the band's story (Profile fields relabelled), a `BandMember` grid (`/admin/band-members`), the band photos (Profile images) and a Shows history from Events with the Leaflet map
- **Store** — merch products with their own title / photos / category / sizes (`/shop`, `/shop/[slug]`), cart + PayMongo checkout + orders as before. `lib/store/product-display.ts` is the one fallback chain (own fields → legacy artwork → order snapshot); `lib/store/queries.ts` the one "buyable" filter. Legacy artwork-backed products keep working and still hang in the museum's Services Room
- **Release Notes** — a ✨ icon in the navbar beside the theme toggle listing the newest few visitor-facing changes to the site, each opening in full. Admin-written from **Settings → Release Notes**; only the newest N (default 3) are ever shown. See [Release Notes](#release-notes) below
- `/artwork/[slug]` — Dedicated, indexable page per artwork (own OG/Twitter meta + JSON-LD), the target of the Share button and search engines alike
- Artwork detail modal (Framer Motion) with image preview (extra angle shots plus an optional 60-second "making of" timelapse video, auto-trimmed client-side on upload — see [`lib/artwork-video.ts`](lib/artwork-video.ts)/[`lib/video-trim.ts`](lib/video-trim.ts)), sold badge, tags
- **Digital Museum** — a free-roaming, first-person 3D gallery at `/gallery/museum`, reached via a **Go To Museum** button in the gallery header ([`GoToMuseumButton.tsx`](components/public/GoToMuseumButton.tsx)). See [Digital Museum](#digital-museum) below for the full walkthrough
- **Mini games** — ten games built on the band's releases: five music quizzes (Guess the Cover, Name That Track, Fill the Lyric, Tracklist Order, Release Timeline — answer keys are redacted from the browser, `lib/minigames/challenge.ts`'s `redactChallenge`) and five cover puzzles (Cover Puzzle, Rotate & Solve, Sliding Cover, Cover Memory, Find the Difference), reached from the homepage's Arcade block. Desktop gets a popover selector, touch screens a bottom sheet built on a native `<select>`; both open a preview (artwork, rules, difficulty, your best, current top scores) before anything starts. Play is entirely in the browser — the server is contacted twice per round, once to issue the puzzle and once to score it. Anonymous leaderboards per game, plus an optional reward a high score can unlock. See [Mini-game scoring & anti-cheat](#mini-game-scoring--anti-cheat) below
- **Wishlist** — heart-toggle any artwork (no login required, persisted in `localStorage` via Zustand, same pattern as the cart) from the detail modal or `/artwork/[slug]`; `/wishlist` lists everything saved, with a live count badge in the navbar. Both it and the Cart are point-in-time snapshots, so on load each checks its saved ids against [`GET /api/artworks/availability`](<app/api/artworks/availability/route.ts>) / [`GET /api/products/availability`](<app/api/products/availability/route.ts>) — an artwork or product an admin has since deleted or unpublished shows as removed (dimmed, labeled, link/purchase disabled) rather than silently going stale or dead-imaging with no explanation. `POST /api/checkout` re-runs the same check server-side regardless of what the client believes, so a removed product can never actually be paid for
- **Share** — native OS share sheet on mobile (`navigator.share`), a Facebook/X/Threads/Copy-Link popover on desktop; each completed share increments a per-artwork `shareCount`
- Cursor glow — a soft, colour-cycling glow that trails the mouse on desktop (admin-configurable, see Theme Customization below); auto-skipped on touch devices and for `prefers-reduced-motion`
- Background music — an optional looping track with a floating toggle button on every public page; never autoplays, visitor opts in (admin-configurable, see below)
- **Sound effects** — short UI cues on toast success/error, payment confirmed/failed, and minigame moves/exit, admin-configurable per sound (see [Sound Effects](#sound-effects) below). Muted via the toggle inside a minigame session, and the mute persists across visits
- `/about` — Artist bio, profile slideshow, social links, skills, certificates & awards
- **Timeline & Gigs map** — an OpenStreetMap/Leaflet map section on `/about` (no API key or billing account required), one pin per event the artist has attended/exhibited at (title, venue, date, description, photos/videos in a click-to-open modal). Whichever event is admin-flagged **Next Event** gets a distinct yellow, gently pulsing pin (respects `prefers-reduced-motion`); every other pin is plain red. Silently omitted if no events are enabled yet — see [`components/public/EventsMap.tsx`](components/public/EventsMap.tsx)
- `/contact` — Contact form (reCAPTCHA v3 protected, emailed via Nodemailer/Resend)
- `/login` — Admin login with account-lockout-aware UX: after 3 consecutive failed attempts, a **Forgot Password** link appears, self-service via emailed reset link (1‑hour expiry, single-use, `/reset-password?token=...`). Also supports **Google/Facebook sign-in** (link-only to an existing admin email, never creates an account — see [Admin Notifications & Login Security](#admin-notifications--login-security) below) and, when enabled, a **TOTP second factor**
- FAQ chatbox widget (floating, admin-managed questions/answers, customizable toggle icon)
- Site-wide announcement popup (scheduled by date range, priority-ranked when multiple are active, dismissible per browser tab/session via `sessionStorage`)
- Marquee announcement ticker — scrolling bar pinned above the navbar, fully styleable per item (text/background colour, font family, size, scroll speed, separator) and independently scheduled. Multiple bars may run at once, stacked by priority. Pure-CSS animation; pauses on hover/focus (opt-in per item), has an explicit pause button, and honours `prefers-reduced-motion`
- `/shop`, `/cart`, `/checkout` — Product listings, cart (Zustand), checkout (V2, PayMongo)
- Dark/light theme toggle — the sun/moon pill to the right of **MENU** in the header, always on, dark by default for a first-time visitor (choice persisted in `localStorage`). The header itself is frosted glass (kalamari.arts's navbar recipe: a translucent tint over `backdrop-blur` that thickens on scroll); the admin's **Preferences → Header** colours tint it in light mode, dark mode uses ink/cream. At the top of the homepage it drops the tint entirely so the full-bleed hero runs under it, switching its type to cream over a photo hero ([`SiteHeader.tsx`](components/public/site-design/SiteHeader.tsx))
- Homepage hero, resolved in [`ReleaseHero.tsx`](components/public/home/ReleaseHero.tsx): the admin's own **Preferences → Homepage Hero** when switched on (a takeover for launches/announcements, and it outranks everything below), else the featured/newest published release over its blurred cover, else the band hero — the About headline over the site background photo
- Site-wide maintenance mode — when enabled, every visitor sees a branded "we'll be right back" page instead of the real site; `/admin` stays reachable so the admin can always turn it back off
- SEO/discoverability — `/sitemap.xml` (static pages + every published artwork), `/robots.txt` (disallows `/admin`, `/api`, auth pages, and personalized routes like `/cart`/`/wishlist`), per-page OpenGraph/Twitter card metadata, and JSON-LD structured data (`Product` + `BreadcrumbList`) on artwork pages
- Link previews — a generated 1200×630 share card (`app/opengraph-image.tsx`, drawn at build time: the KALAM(squid)RI lockup in BadaBoom with the four accent colours frozen on, since a preview is a flat PNG with no hover or animation, over Space Grotesk supporting lines; both fonts vendored as `.ttf` in `public/fonts/` since Satori can't read `.woff2`) backs every route as the site-wide `og:image`/`twitter:image`; artwork pages override it with the piece itself. `metadataBase` resolves those to absolute URLs from `SITE_URL`, so scrapers get a reachable image rather than a `localhost` one

**Admin dashboard** (`/admin`, protected)

- **Dashboard home** — stat cards, recent orders, quick actions, and a sidebar clock ([`LiveClock.tsx`](components/admin/LiveClock.tsx)) that opens a small calendar popover on click plus a live Manila weather readout ([`WeatherWidget.tsx`](components/admin/WeatherWidget.tsx), via the free Open-Meteo API — no key required)
- **Museum Pieces** (`/admin/artworks`) — the images that hang in the Digital Museum's rooms: live photos, gig posters, press shots, cover art, fan art. CRUD, drag-and-drop image upload plus optional video clips, a **Kind** field with presets (reads on the museum plaque as "Live photo · 2025"), featured/published toggles, assign to section, Featured/Video/Draft filters. Inherited from the art-gallery codebase as `Artwork` — the model, API and `/artwork/[slug]` page keep that name, and the shop-shaped columns (`status`, `isNewRelease`) are hidden in the admin rather than dropped. Sits on its own tab next to **Digital Museum** (below)
- **Digital Museum** — a second tab on the Artworks page: **General Settings** (enable/disable, optional title/description, room-entry splash effect/speed/colors), **Rooms** (create/reorder/enable rooms, per-room splash icon/title, mark one the visitor's spawn point, a **1F/2F** toggle to send any room to the Second Floor, assign existing artwork — same wall/floor/ceiling + splash editing also available for the provisioned About ScriptOverNovel, Freedom Wall, Services, Tales, Arcade, Cosplay and Stairs rooms). Every room also opens in its own **Museum Scene Editor**, a 3D editor for hanging artwork, placing uploaded `.glb` props and text, and configuring room fixtures. See [Digital Museum](#digital-museum) below
- **Sections** — create/reorder gallery sections, cover image, publish toggle
- **Products** — price/stock/availability per artwork (V2 shop), with the same Featured/New Release/Draft quick-filter toggles as Artworks
- **Sales Dashboard** — first entry in the sidebar's **Sales** group (above Products and Orders): a revenue-trend area chart with a 7d/30d/90d/12-month range picker, four stat tiles (revenue, orders, items sold, average order value) each showing the change against the immediately preceding window, and Top-Selling Artworks / Top-Selling Sections lists. Revenue counts `PAID`, `SHIPPED` and `DELIVERED` orders — a single `status` column means a fulfilled order stops reading "PAID", so counting only `PAID` made revenue _shrink_ as orders shipped (see [`lib/sales.ts`](lib/sales.ts) `REVENUE_STATUSES`). The server ships one flattened line-item array for the full 365-day window and the client recomputes on range change, so switching ranges is instant. Chart is hand-rolled inline SVG, same as [`VisitsAreaChart.tsx`](components/admin/VisitsAreaChart.tsx) — no chart library
- **Orders** — order + order-item tracking, PayMongo reference/status (V2), plus **CSV export** (exports every row matching the current archive scope, status filter, search and sort — not just the visible page; [`lib/csv.ts`](lib/csv.ts) handles RFC-4180 quoting, an Excel BOM and CSV-injection defusing), **Download Receipt** (a printable receipt served as self-contained HTML by `GET /api/orders/[id]/receipt`, saved as PDF from the browser's own print dialog — see [`lib/receipt.ts`](lib/receipt.ts)) and **Archive Order**. Archiving is deliberately _not_ the `deletedAt` soft-delete every other module uses: an order is a financial record, so `Order.archivedAt` only clears it out of the working list — it still counts towards revenue, the Sales Dashboard and every export, and Orders is not wired into Trash at all
- **Announcements** — two tabs on one page: **Popups** (scheduled modal CRUD) and **Marquee Banners** (scrolling ticker CRUD, grouped into category tabs, with colour pickers, a speed slider, typography controls and a live preview that reuses the same CSS the public bar does)
- **Settings → FAQs** — reorderable FAQ CRUD, active/inactive toggle
- **Settings → Preferences** — tabs, in order:
  - **Header · Menu · Homepage Hero** — the public site's chrome, formerly its own **Site Design** sidebar module ([`SiteDesignClient.tsx`](<app/(admin)/admin/site-design/SiteDesignClient.tsx>), rendered `embedded` by [`PreferencesClient.tsx`](<app/(admin)/admin/settings/Preferences/PreferencesClient.tsx>), which owns the tab bar and `?tab=header|menu|hero`; `/admin/site-design` now only redirects there, keeping the section). One element across the three tabs, so they share one staged form and one Save. The header preview's theme switch is live — it flips the *preview* to the dark-mode bar (ink tint, cream type), never the admin's own theme. The Header's **Logo image** is the site's one logo: [`lib/site-logo.ts`](lib/site-logo.ts) resolves it (falling back to the old `Profile.logoImage` only while it's empty) for the admin sidebar, login, receipts, every email, mini-game alerts and the museum About plaque / screenshot watermark
  - **Branding** — site background (+ **Site Background Effects** — motion on that photo behind every public page: Still / Slow Zoom / Drift / Breathe / Parallax with a speed slider and a live replayable preview; two `SiteTheme` columns validated in [`lib/theme.ts`](lib/theme.ts)'s `BG_EFFECTS`, played as CSS keyframes on `html::before` by [`PublicThemeStyle.tsx`](components/public/PublicThemeStyle.tsx), parallax's scroll progress fed by [`BackgroundParallax.tsx`](components/public/BackgroundParallax.tsx); all of it stands down for `prefers-reduced-motion`), Admin Sidebar icon + hover-color cycle, FAQ chatbox icon (picked from a searchable Lucide/Tabler icon gallery, `IconPicker.tsx`), the **Mobile Gallery Carousel** (mode: Auto-scroll/Swipe Only/Grid, plus a speed slider with a live preview — see [`lib/gallery-carousel.ts`](lib/gallery-carousel.ts)), the **Hover Shimmer** (the light sweep across a hovered Gallery / Tales / Shop card — per-grid colour, speed and brightness with a live preview; stored as one `Profile.hoverShimmer` Json column, validated in [`lib/hover-shimmer.ts`](lib/hover-shimmer.ts), rendered by [`HoverShimmer.tsx`](components/public/HoverShimmer.tsx)), and the **Entrance Splash** (enable toggle, transition effect picker, speed slider, two taglines — one above the logo and one below, each with its own font family, font-size slider and text color — an adjustable glow behind the lockup with optional shimmer and horizontal/vertical position offsets, a **Logo Letter Colors** mode picking whether the lockup's four coloured syllables only colour on hover or wear their colours throughout — hover is an effect a touch visitor can never trigger, which is why the second mode exists — and a live replayable preview — see [`IntroSplashSection.tsx`](<app/(admin)/admin/settings/Preferences/IntroSplashSection.tsx>) and [`lib/intro-splash.ts`](lib/intro-splash.ts); everything here stages until **Save Branding** _except_ the enable toggle and the shimmer switch, which write themselves — a switch is a decision already finished the moment it is flipped, unlike a colour or a tagline still being composed); collapsible sidebar (desktop) falls back to a default squid mark when no custom icon is set
  - **Theme Customization** — buttons, scrollbar, typography, **Cursor Effects** (on/off toggle + 4 cycle colours for the public-site cursor glow), and independent frosted-glass blur sliders for the public site's and the admin dashboard's own background photo (`bgBlur`/`adminBgBlur`, 0–24px, see [`lib/theme.ts`](lib/theme.ts))
- **Settings → Mini Games** — three tabs on one page:
  - **Games** — the five game types, each with an on/off switch, artwork picked from the existing Artworks collection (no second upload system), difficulty, time limit, score multiplier (with a live "best possible score" readout), leaderboard size, and reward threshold/description. Find the Difference additionally gets a second artwork and a click-to-place hotspot editor. An enabled game whose artwork has since been unpublished is flagged rather than silently vanishing
  - **Leaderboard** — filter by game/artwork/player name, inspect score, time, moves and reward status, remove a single entry, or reset one game's board behind a confirmation. Scores are never editable — see the anti-cheat note below
  - **Rewards** — claims with the player's email (the only screen that shows one), plus pending/fulfilled/rejected tracking
- **Settings → Background Music** — enable/disable toggle, audio upload (MP3/WAV/OGG/AAC/M4A, 15 MB max), default volume slider; nothing plays until a track is set (see [`lib/background-music.ts`](lib/background-music.ts))
- **Settings → Sound** — every sound effect on the site in one place, grouped into tabs by category (**Toast Sound**, **Admin Actions Sound**, **Payment Sound**, **Minigame Sound**). Each sound is independently enabled and sourced — **Prebuilt** (pick from 6 named presets), **Upload** (own clip, reuses the same audio uploader as Background Music), or **Synthesize** (waveform/pitch/length dialed in by ear) — plus a volume slider and a live preview button. See [Sound Effects](#sound-effects) below
- **Settings → Maintenance Mode** — on/off toggle to take the public site offline behind a branded message page, with a live preview of exactly what visitors will see (see [`lib/maintenance.ts`](lib/maintenance.ts))
- **Settings → Security** — enroll/disable a TOTP second factor (Google Authenticator) for the signed-in admin: QR-code enrollment, one confirmed code before it actually activates, 10 one-time recovery codes shown once, and password re-entry to disable. See [Admin Notifications & Login Security](#admin-notifications--login-security) below
- **Notifications bell** (fixed top-right corner, every admin page) — in-app alerts for new paid orders and new mini-game highscores, with an unread badge and mark-as-read. Both event types also always email separately; the bell is a secondary view, not the primary alert. See [Admin Notifications & Login Security](#admin-notifications--login-security) below
- **Website Analytics** (dashboard's own tab, next to Overview) — visitor stats for the public storefront only (never admin sessions), powered by the Vercel Web Analytics API: visitors/pageviews/pages-per-visit, a two-line (page views + visitors) area chart with a hover tooltip, top pages, top traffic sources, and a device breakdown. A 7D/14D/30D/90D date-range filter drives every widget at once, switched client-side via `/api/analytics` (admin-only) without reloading the page — the selection survives navigating to the Overview tab and back. The initial 30-day load is server-rendered inside its own `<Suspense>` boundary so a slow analytics API never blocks the rest of the dashboard, and it degrades to a "Connect Vercel Analytics" prompt if unconfigured — see [Website Analytics setup](#website-analytics-vercel-web-analytics) below
- **About** — bio, headline, profile images/slideshow, background/logo, social links, artist skills, certificates & awards, contact/commission copy
- **Timeline / Events** (`/admin/events`) — full CRUD for the public Timeline/Gigs map: title, venue, description, date, click-to-drop-pin location picker (falls back to manual lat/lng inputs without a Maps key), enable toggle, reorder, and a **Next Event** star toggle (server-enforced single flag, same transactional pattern as the Digital Museum's entry-room). Photo/video upload straight to R2. Wired into **Global Search** and the sidebar
- **Cosplays** (`/admin/cosplays`) — costume photography kept out of Artworks on purpose: character, series, cosplayer, photographer, year and event, with two images per entry (the shot printed on its life-size standee, and an optional photo hung on the panel behind it). The list has the same **Grid / List** view toggle as the other admin modules, defaulting to the card grid. Publishing one gives it a standee in the Digital Museum's **Cosplay Room**, where every field but the description reads on the standee's own plaque (character, series, event · year, credits) — the description stays behind the **[E]** info panel. Membership _and order_ are mirrored from this module, so the reorder arrows move standees around the room's walls. There is no separate public page. See [`Docs/Museum_CosplayRoom.md`](Docs/Museum_CosplayRoom.md)
- **Trash** — soft-delete recovery for artworks, sections, products, cosplays, releases, videos, vinyls, band members, announcements, marquees, notifications, Digital Museum rooms, and Timeline events (`deletedAt`)
- **Global Search** (⌘K / Ctrl+K, `components/admin/GlobalSearch.tsx`) — command-palette search across Artworks, Products, Orders, Sections, Rooms, Announcements, FAQs, and Timeline Events, plus a quick-nav shortcut to every admin page
- **API Documentation** — interactive OpenAPI 3.0 reference at `/admin/api-docs` (Swagger UI), covering all ~130 endpoints. Accepts the `x-api-key` header (set `API_SECRET_KEY` in env) alongside the session cookie — useful for scripts, CI, and the Swagger UI's "Try it out" (see [API Documentation](#api-documentation) below)
- Auth-gated via NextAuth middleware; only `role: ADMIN` users may access `/admin/*`
- Self-service password reset for admin accounts (see `/login` above); every reset email is BCC'd to a configurable notify address (`PASSWORD_RESET_BCC_EMAIL`)

---

## Local Setup

### 1. Install dependencies

```bash
npm install / yarn install
```

### 2. Environment variables

```bash
cp .env.example .env
```

Fill in your `.env`:

```env
# === REQUIRED ===

# PostgreSQL via Supabase (get from Supabase Dashboard > Settings > Database)
# Use the pooled (port 6543) URL for DATABASE_URL, direct (port 5432) for DIRECT_URL
DATABASE_URL="postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres"

# NextAuth (generate secret with: openssl rand -base64 32)
NEXTAUTH_SECRET="your-secret-here"
NEXTAUTH_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Cloudflare R2 — all media (images, .glb props, audio, video). All server-only.
# Token: R2 > Manage R2 API Tokens > Object Read & Write, scoped to the bucket.
# Public URL: the bucket's custom domain, or its Public Development URL
# (https://pub-….r2.dev). No trailing slash. See Docs/Media_Storage_R2.md.
R2_ACCOUNT_ID="…"
R2_ACCESS_KEY_ID="…"
R2_SECRET_ACCESS_KEY="…"
R2_BUCKET="scriptovernovel-music-website"
R2_PUBLIC_URL="https://pub-….r2.dev"

# === OPTIONAL ===

# API key — enables x-api-key header auth on all admin endpoints.
# Leave unset to disable. Generate with: openssl rand -hex 32
API_SECRET_KEY=""

# Google reCAPTCHA v3 (contact form)
NEXT_PUBLIC_RECAPTCHA_SITE_KEY="6Le..."
RECAPTCHA_SECRET_KEY="6Le..."

# Gmail SMTP (contact form email + password reset email)
GMAIL_USER="your-email@gmail.com"
GMAIL_APP_PASSWORD="xxxx xxxx xxxx xxxx"

# Password reset — every reset email is BCC'd here (defaults to the site owner's address)
PASSWORD_RESET_BCC_EMAIL="owner@example.com"

# Mini games — where the "a visitor unlocked a reward" alert AND the "new
# all-time highscore" admin notification are sent. Falls back to GMAIL_USER.
# With no mail configured at all, both are still recorded and visible in the
# admin (rewards in Settings → Mini Games; highscores via the sidebar bell);
# only the email alert is skipped.
MINIGAME_NOTIFY_EMAIL="owner@example.com"

# New-order admin alert — where the "new order paid" notification email goes.
# Falls back to GMAIL_USER. See "Admin Notifications & Login Security" below.
ORDER_ALERT_EMAIL="owner@example.com"

# Admin OAuth sign-in (Google/Facebook) — optional. Only an email that
# already belongs to an ADMIN user can sign in this way; it never creates a
# new account. See Docs/OAuth2_Setup.md for the full walkthrough (Google
# Cloud / Meta app setup, exact redirect URIs to register).
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
FACEBOOK_CLIENT_ID=""
FACEBOOK_CLIENT_SECRET=""

# Resend (transactional email, alternative/addition to Gmail SMTP)
RESEND_API_KEY="re_..."

# PayMongo (V2 — Shop/Checkout only)
PAYMONGO_SECRET_KEY="sk_test_..."
PAYMONGO_PUBLIC_KEY="pk_test_..."
PAYMONGO_WEBHOOK_SECRET="whsk_..."

# Vercel Web Analytics — powers the "Website Analytics" section on the admin
# dashboard. See "Website Analytics (Vercel Web Analytics)" below for the
# full setup walkthrough. Safe to leave unset — the dashboard just shows a
# "Connect Vercel Analytics" prompt instead.
VERCEL_ANALYTICS_TOKEN="..."
VERCEL_PROJECT_ID="prj_..."
VERCEL_TEAM_ID=""                                # only if the project is under a team
```

### 3. Cloudflare R2 bucket

In the Cloudflare Dashboard → **R2**:

1. **Create bucket** — name it (the app reads the name from `R2_BUCKET`); location hint APAC to sit near the `sin1` Vercel region
2. **Settings → Public access** — connect a custom domain, or enable the **Public Development URL**. Whichever you use is `R2_PUBLIC_URL`
3. **Settings → CORS Policy** — required, or the museum's WebGL textures and the browser's direct `.glb`/audio uploads fail. Paste the policy from [`Docs/Media_Storage_R2.md`](Docs/Media_Storage_R2.md#cors)
4. **Manage R2 API Tokens → Create** — _Object Read & Write_, scoped to this bucket only. That pair is `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`

### 4. Database setup

```bash
npm run db:push / yarn db:push    # Push Prisma schema to your database
npm run db:seed / yarn db:seed    # Seed sample artworks + admin user
```

### 5. Run

```bash
npm run dev / yarn dev
```

- **Gallery:** http://localhost:3000
- **Admin:** http://localhost:3000/admin
- **Login:** http://localhost:3000/login

---

## Creating the First Admin User

There is **no public sign-up page** — admin accounts are created manually.

**Option A — Use the seed script** (creates `admin@scriptovernovel.art` / `admin123!`):

```bash
npm run db:seed / yarn db:seed
```

**Option B — Create manually via Prisma Studio:**

```bash
npm run db:studio / yarn db:studio
```

Add a row to the `User` table with `role: ADMIN` and a bcrypt-hashed password.

**Option C — Via the Supabase SQL Editor:**

```sql
INSERT INTO "User" (id, name, email, password, role, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid()::text,
  'Admin',
  'your@email.com',
  '$2a$10$...', -- bcrypt hash of your password
  'ADMIN',
  NOW(),
  NOW()
);
```

Change the default seed password before deploying to production.

---

## Mini-game scoring & anti-cheat

The leaderboard is only worth having if a visitor can't type their own score into it. The rule the whole design follows: **the browser reports what it did, never what it scored.**

```
POST /api/minigames/session     server generates the puzzle, stores it on
                                MiniGameSession with a start time, sends a copy
        │
        ▼
   gameplay happens entirely in the browser — no requests at all
        │
        ▼
POST /api/minigames/submit      body carries the move log, and nothing else
        │                       that matters
        ▼
   server replays those moves against the *stored* challenge
        │
   ┌────┴─────┐
solved     not solved / illegal move / impossibly fast
   │             │
score computed   session marked REJECTED
server-side      (it cannot be retried)
```

What this buys, concretely:

| Attack                                                   | What stops it                                                                                                                                  |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `fetch("/api/minigames/leaderboard", { score: 999999 })` | No endpoint reads a score from a request body. `/submit` computes it; `/leaderboard` only attaches a display name to an already-scored session |
| Submitting a "solved" board without playing              | The move log is replayed from the stored challenge — an empty or bogus list doesn't reach the solved state                                     |
| Teleporting tiles in the sliding puzzle                  | Each move must be orthogonally adjacent to the gap, checked move by move                                                                       |
| Solving by script in 40 ms                               | Elapsed time is measured server-side from `startedAt`; a run faster than `minMoves × a human's fastest tap` is rejected                        |
| Replaying a good round                                   | `MiniGameSession.status` goes to `COMPLETED` on first submit; `LeaderboardEntry.sessionId` and `RewardClaim.sessionId` are unique              |
| Brute-forcing move lists against one session             | A failed verification burns the session (`REJECTED`)                                                                                           |
| Submitting someone else's session id                     | Sessions are bound to an httpOnly, HMAC-signed anonymous player cookie                                                                         |
| Claiming a reward you didn't earn                        | `/reward` re-derives eligibility from the score stored on the session, not from the submit response                                            |
| Score/session spam                                       | Per-IP fixed-window limits in [`lib/minigames/rate-limit.ts`](lib/minigames/rate-limit.ts)                                                     |

Two honest limitations, both deliberate:

- **Find the Difference ships its hotspots to the browser.** A click needs an instant verdict, and round-tripping every click would be exactly the chatty pattern this feature avoids. It leaks nothing — the answer is already visible in the two images — and the server still re-checks every submitted click against its own copy, so a tampered client cannot claim a hit it never made.
- **Rate limiting is per serverless instance.** On Vercel each instance keeps its own counters, so it's a speed bump rather than a global quota. Adding Redis for an art portfolio whose worst case is a spammed board the admin clears in one click wasn't a trade worth making. The load-bearing protections are the ones in the table above.

The goal was never to make cheating mathematically impossible — it's that a casual visitor with devtools open cannot become #1.

### Adding a sixth game

Everything about a game is declared in [`lib/minigames/registry.ts`](lib/minigames/registry.ts). To add one:

1. Add the value to `enum MiniGameType` in `prisma/schema.prisma`
2. Add it to `GameType` / `GAME_TYPES` in [`lib/minigames/types.ts`](lib/minigames/types.ts), along with its challenge and move-log shapes
3. Add a registry entry — metadata plus a preset per difficulty
4. Add a `createChallenge` case in [`challenge.ts`](lib/minigames/challenge.ts) and a `verifySolution` case in [`verify.ts`](lib/minigames/verify.ts). Both switch on the same discriminated union, so TypeScript will point at the missing branch
5. Add the playable component under `components/public/minigames/games/` and a case in `GameCanvas` (`GameSession.tsx`)

Nothing else special-cases a game type — the admin form, the selector, scoring, leaderboards and rewards all read from the registry.

---

## Visitor counter & milestones

The gold **"… VISITORS"** pill in the public footer ([`FooterVisitorCount.tsx`](components/public/FooterVisitorCount.tsx)) is a server-authoritative lifetime count, not an analytics figure. It is deliberately a different number from the admin dashboard's Website Analytics tab — see [below](#it-will-never-match-website-analytics) for why, and `Docs/User_Training.md` §3.1.1 for the version written for the site owner.

### How a visit is counted

One row (`SiteVisitCounter`, id `singleton`) holding a single `count`, incremented through [`app/api/visitor-count/route.ts`](app/api/visitor-count/route.ts):

| Method  | Who    | Does                                                                                                                                                |
| ------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST`  | Public | Registers this browser, returns the running total plus achieved milestones. **Idempotent** — a browser already known is a read, not an increment    |
| `GET`   | Public | Read-only; count + achieved milestones, no cookie writes                                                                                            |
| `PATCH` | Admin  | Recalibrates the count outright (Settings → Visitor Milestones), e.g. to seed from existing Vercel Analytics history rather than restarting at zero |

Both `FooterVisitorCount` and [`VisitorCounterWidget`](components/public/VisitorCounterWidget.tsx) `POST` on mount; whichever lands first counts the visit and the other reads the same total back. The widget renders nothing visible unless there's an unclaimed milestone — the visible number lives in the footer.

### Identity: the same signed cookie Mini Games uses

"A new visitor" means **a browser that has never presented a valid `kal_player` cookie** — the same anonymous identity minted by [`lib/minigames/player.ts`](lib/minigames/player.ts), reused rather than given a second parallel cookie. An existing cookie already means "we have seen this browser", which is exactly the question the counter is asking.

```
readPlayerId() returns an id  →  seen before  →  read the count, no increment
readPlayerId() returns null   →  ensurePlayerId() mints one, count + 1
```

Two properties of that cookie matter here, and both are the reason it isn't `localStorage`:

- **`httpOnly`** — unreadable and unwritable from page JavaScript, devtools included. A visitor can't clear a key and refresh to inflate the count. They _can_ delete cookies entirely, which also costs them their Mini Games history — an accepted trade.
- **HMAC-signed** with `AUTH_SECRET`/`NEXTAUTH_SECRET`. The id is public; forging a _valid_ one for a different player is not possible without the secret. This is load-bearing for Mini Games (scores are attributed to this id), and the counter inherits it for free.

`sessionStorage` would have been worse still: it dies with the tab, so every new tab would read as a new visitor.

> ⚠️ **The cookie is not renewed on later visits.** `ensurePlayerId()` returns early when the cookie verifies, so `maxAge` (1 year) runs from the visitor's _first_ visit. Someone visiting continuously for over a year is eventually counted a second time. Renewing would mean re-setting the cookie on every verified read.

Known, documented imprecision: two tabs opened simultaneously by a brand-new browser can both increment before either cookie is set — at most one extra, accepted for a fun counter. `POST` is additionally rate-limited per IP (20/60s, [`lib/minigames/rate-limit.ts`](lib/minigames/rate-limit.ts)) to blunt a script hammering it with cookies stripped each time. The worst case here is an inflated fun-fact, not a vulnerability.

### It will never match Website Analytics

The footer badge reads consistently **higher** than the dashboard's Website Analytics tab, and that's structural rather than a bug in either:

|            | Footer badge                            | Website Analytics                                                                                         |
| ---------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Source     | This app's own Postgres                 | Vercel Web Analytics API                                                                                  |
| Collection | Server-side, as the request is served   | `@vercel/analytics` script in the browser                                                                 |
| Blockable  | **No**                                  | **Yes** — `/_vercel/insights/script.js` is on uBlock Origin, Brave, AdGuard and Firefox strict blocklists |
| Identity   | Signed cookie, permanent                | Cookieless, rotating daily hash                                                                           |
| Window     | All time, never resets                  | Only the selected range (7/14/30/90D)                                                                     |
| Bots       | Counted if they run JS and keep cookies | Filtered                                                                                                  |

Ad-blocking is the dominant term; a 15–20% gap is normal. Use Website Analytics for real traffic questions (trends, top pages, referrers) and the badge for what it is — a lifetime "how many people have been here" figure.

### Milestones

`VisitorMilestone` rows pair a unique `threshold` with a `reward` string. Every increment runs an `lte` sweep stamping `achievedAt` on any enabled, not-yet-achieved milestone the count has now reached — a sweep rather than an exact-match check, since a burst of concurrent visitors (or an admin `PATCH`) can cross several at once. **`achievedAt` is never cleared**: once earned, a milestone stays earned even if the count is later lowered.

A reached milestone surfaces a claim popup in `VisitorCounterWidget`, and a visitor claims by email via `POST /api/visitor-milestones/[id]/claim`. No session is required — unlike a Mini Games reward, eligibility is "this milestone has been reached", which is true for everyone once it happens. The real gate is the `@@unique([milestoneId, email])` constraint on `VisitorMilestoneClaim`: a database constraint rather than client-trusted state, same principle as the mini-game reward route.

---

## Release Notes

The ✨ icon beside `ThemeToggle` in the public navbar ([`ReleaseNotes.tsx`](components/public/ReleaseNotes.tsx)) opens a short "what's new on the site" list; clicking an entry opens it in full. Written by hand from **Settings → Release Notes**, not generated from `Docs/Progress_Timeline.md` — the timeline is the engineering record and covers admin-only work, this is the visitor-facing subset in plain words.

Kept apart from `Announcement` (a popup that interrupts) and `MarqueeAnnouncement` (a ticker): those are for something happening _now_, this is a running record of what shipped.

**Only the newest N are ever shown.** `Profile.releaseNotesLimit` (default 3, clamped 1–10 by [`lib/release-notes.ts`](lib/release-notes.ts)) is applied as a `take` in the query, not on the client — publishing an N+1th note pushes the oldest out rather than lengthening the list, and the response can't be widened by editing a fetch. `Profile.releaseNotesEnabled` removes the icon entirely rather than leaving one that opens onto an empty box.

| Route                            | Who    | Does                                   |
| -------------------------------- | ------ | -------------------------------------- |
| `GET /api/release-notes`         | Admin  | Every note, drafts included            |
| `POST /api/release-notes`        | Admin  | Create — `publishedAt` defaults to now |
| `PATCH /api/release-notes/[id]`  | Admin  | Edit, or flip published ↔ draft        |
| `DELETE /api/release-notes/[id]` | Admin  | Hard delete — does **not** go to Trash |
| `GET /api/release-notes/active`  | Public | Newest N published only                |

The split between the admin list route and `/active` is the same one `/api/marquees` already uses: an anonymous fetch can't enumerate drafts.

`publishedAt` is admin-editable and is what the list orders by — a note is usually written days after its change shipped, and dating it to the change keeps the order honest. Hard-deleted rather than soft-deleted into Trash, like `VisitorMilestone`: a release note holds no upload and nothing references it, so there is nothing to orphan.

The panel is server-rendered in [`app/(public)/layout.tsx`](<app/(public)/layout.tsx>) so the icon is in the first paint, then refreshes itself once on mount from `/active` — most public routes prerender, so a note published afterwards would otherwise stay invisible until something revalidated. The unread dot is one `localStorage` key holding the newest note id the browser has opened, held back until after mount so it can't cause a hydration mismatch.

---

## Sound Effects

Every short UI sound on the site — a toast notification, a payment result, a minigame move or exit — is one entry in a fixed registry ([`lib/sound/registry.ts`](lib/sound/registry.ts)), configured from a single admin module (**Settings → Sound**) and played through one client-side engine ([`lib/sound/engine.ts`](lib/sound/engine.ts)). No audio files ship with the repo: sounds are either short synthesized Web Audio tones (prebuilt presets or a hand-tuned custom waveform/pitch/length) or a clip the admin uploads.

**Registry keys today:**

| Key               | Category | Fires when…                                                        |
| ----------------- | -------- | ------------------------------------------------------------------ |
| `toast.success`   | Toast    | Any `toast.success(...)` call, admin or public                     |
| `toast.error`     | Toast    | Any `toast.error(...)` call                                        |
| `admin.delete`    | Admin    | A `toast.success(...)` whose message reads as a delete (see below) |
| `payment.success` | Payment  | The order confirmation page (`/order/success`) is shown            |
| `payment.error`   | Payment  | The payment-cancelled page (`/order/cancel`) is shown              |
| `minigame.move`   | Minigame | A piece is moved (currently the sliding puzzle)                    |
| `minigame.exit`   | Minigame | A visitor confirms leaving a round early, via `ExitConfirmModal`   |

A key with no admin override just plays its registry default — nothing needs to be configured for sound to work out of the box.

**Admin toggles.** Every switch in the admin raises a confirmation toast, which is also what gives it its click — the sound is a property of the toast, not of the control. [`lib/admin/toggleToast.ts`](lib/admin/toggleToast.ts) holds the two wordings so the distinction can be read at a glance rather than remembered per screen: `toggleSaved()` for a switch with its own PATCH ("Maintenance mode on"), `toggleStaged()` for one inside a form with its own Save button, which ends in "— remember to Save". Handlers that already had a well-worded toast of their own keep it; the helper exists for the switches that had none.

**How a toast gets a sound without editing ~140 call sites.** Every file that calls `toast.success()`/`toast.error()` imports `toast` from [`lib/toast.ts`](lib/toast.ts) instead of `react-hot-toast` directly (`<Toaster>` itself still comes straight from the library — only the `toast` function is wrapped). The wrapper plays the matching sound and then forwards the call unchanged. Delete detection is a heuristic, not a separate call: a success message containing "delete", "remove", "trash" or "discard" (e.g. `"Artwork deleted"`, `"Section moved to Trash"`) plays `admin.delete` instead of the generic `toast.success` sound, so admin destructive actions get a distinct cue without every delete handler needing its own wiring.

**Muting.** One `localStorage` flag (`sfx:muted`) covers every sound effect on the site — muting once is muting done. The only visible toggle today is the mute button inside a minigame session header (`GameSession.tsx`); every other surface (toasts, payment pages) just respects whatever it's currently set to.

### Adding a new sound

1. Add an entry to `SOUND_EFFECTS` in [`lib/sound/registry.ts`](lib/sound/registry.ts) — a unique `key`, a `category` (existing or new — new categories need a row in `SOUND_CATEGORIES` too, which becomes a new admin tab automatically), a label/description, and sensible defaults
2. Call `playSoundEffect("your.key")` (from `lib/sound/engine.ts`) at the moment it should fire — a client component can call it directly; a server component needs the `<PlaySoundEffect effectKey="your.key" />` helper (`components/public/PlaySoundEffect.tsx`) instead
3. Nothing else — the admin's Sound page reads the registry, so the new key shows up there with no further wiring

---

## Digital Museum

A free-roaming, first-person 3D gallery at `/gallery/museum` — Three.js/React Three Fiber walking around a corridor of admin-curated rooms, instead of the flat gallery grid. It reuses **existing `Artwork` rows only**: a room is curation, never a second content model.

### Data model

```
DigitalMuseum (singleton row)
  ├─ enabled, title, description
  ├─ splashEnabled/Effect/SpeedMs/BgColor/TaglineFontSize/TaglineFontFamily  (room-entry splash, see below)
  ├─ aboutWallColor/FloorColor/CeilingColor, aboutWallTexture/FloorTexture/CeilingTexture,
  │    aboutSplashIcon/SplashTitle   — wall/floor/ceiling + splash overrides for the synthetic
  │                                    "About ScriptOverNovel" room (see below), since it has no MuseumRoom row
  └─ rooms: MuseumRoom[]
        ├─ name, slug, roomType (MAIN_HALL / GALLERY / SPECIAL_EXHIBITION / ABOUT / FREEDOM_WALL /
        │    STAIRS / SERVICES / STORIES / ARCADE / COSPLAY — the last four are provisioned rooms
        │    whose contents mirror another module rather than being hand-picked),
        │    displayOrder, enabled
        ├─ isEntryRoom          — exactly one room across the museum spawns the visitor; enforced
        │                         in a transaction (setting one unsets every other room's flag).
        │                         Rejected (409) on a room whose floor is 1 — see "Second Floor + Stairs" below
        ├─ floor                — 0 = ground floor, 1 = second floor (see "Second Floor + Stairs" below)
        ├─ wallColor, floorColor, ceilingColor
        ├─ wallTexture, floorTexture, ceilingTexture  — optional uploaded images, tiled across the
        │    surface (see "Wall/Floor/Ceiling textures" below); null falls back to the plain color
        ├─ splashIcon, splashTitle  — optional per-room override for the room-entry splash's icon/
        │    title (see "Room-entry splash" below); null falls back to the default glowing squid / room name
        ├─ artworks: MuseumRoomArtwork[]   — join table to Artwork, with its own displayOrder
        ├─ cosplays: MuseumRoomCosplay[]   — COSPLAY rooms only; mirrors published Cosplay rows
        ├─ vinyls: MuseumRoomVinyl[]       — the VINYL room only; mirrors published VinylRecord rows
        └─ sceneObjects: MuseumSceneObject[]  — Museum Scene Editor placements (see below)
```

Admin CRUD for all of the above lives on the **Artworks** page's **Digital Museum** tab ([`DigitalMuseumPanel.tsx`](<app/(admin)/admin/artworks/DigitalMuseumPanel.tsx>) → [`RoomsTab.tsx`](<app/(admin)/admin/artworks/RoomsTab.tsx>)), backed by `app/api/digital-museum/**`. Room size/lighting are fixed presets keyed off `roomType` ([`roomConstants.ts`](<app/(public)/gallery/museum/components/roomConstants.ts>)) — a deliberate scope decision so an admin never touches raw Three.js units.

> **Exhibitions no longer exist.** They were a second curation table sitting beside the room they were tied to, so the same artwork had to be placed twice. Curation folded into `MuseumRoom` itself on 2026-08-20 (`13eae84`) and the leftover feature — the `Exhibition`/`ExhibitionArtwork` tables, the Exhibitions sub-tab, the `/api/exhibitions` routes, the standee object and the gold "✨ FEATURED" plaque — was demolished on 2026-08-22 (`5b73ba2`). The `SPECIAL_EXHIBITION` **room type** that remains is unrelated: it is one of the size/lighting presets, not a curation feature.

### Walking the corridor

Rooms don't teleport-select like V1 — they chain into **one continuous walkable corridor** in `displayOrder`, each connected to the next by a real doorway opening (see [`roomLayout.ts`](<app/(public)/gallery/museum/components/roomLayout.ts>)). Every room shares the same width so doorways always line up; only depth (and a lighting preset) varies by `roomType`. The corridor always ends in an **automatic "About ScriptOverNovel" room**, whose displayed content is built straight from the same Profile/CertificateAward/ArtistSkill/SocialLink rows the public `/about` page reads — never a second content source to keep in sync.

**Provisioned rooms.** About ScriptOverNovel, Freedom Wall, Stairs, Services, Tales (the Stories module — `STORIES` in code), Arcade and Cosplay are _lazily provisioned_ — each is a real `MuseumRoom` row created on demand by its own `lib/museum/*Room.ts` helper rather than added by an admin. A real row is what lets them carry Museum Scene Editor placements, colours and textures like any other room. They can't be created, retyped or deleted; most can still be reordered, restyled and enabled/disabled. The last four don't have hand-picked contents either — they mirror another module, so publishing a Story, a game or a Cosplay is what puts it in the room.

### Second Floor + Stairs

Any room — a curated one, or the fixed **About ScriptOverNovel** / **Freedom Wall** capstones — can be assigned to the **Second Floor** from the Rooms tab's per-room **1F/2F** toggle. The corridor is built as every floor-0 room (sorted by `displayOrder`), then, only if at least one room is on floor 1, an auto-inserted **Stairs** connector room, then every floor-1 room ([`page.tsx`](<app/(public)/gallery/museum/page.tsx>)'s floor-partition-and-splice logic). The Stairs room's floor is a literal ramp — the player camera's height actually rises while crossing it ([`roomLayout.ts`](<app/(public)/gallery/museum/components/roomLayout.ts>)'s `floorYSouth`/`floorYNorth` + `getFloorYAt`, consumed by [`PlayerControls.tsx`](<app/(public)/gallery/museum/components/PlayerControls.tsx>) and rendered as a sloped floor/ceiling in [`MuseumRoom.tsx`](<app/(public)/gallery/museum/components/MuseumRoom.tsx>)) — not just a cosmetic label change.

Like About/Freedom Wall, the Stairs room is lazily provisioned ([`lib/museum/stairsRoom.ts`](lib/museum/stairsRoom.ts)) rather than admin-created, and never appears in the reorderable room list — only its own fixed card (Floor/Wall/Ceiling Color + Texture, same controls as any room) is editable, since the system decides where it sits, not the admin. The visitor entry/spawn room is blocked (409) from ever being on the Second Floor, so nobody spawns upstairs before they've walked the stairs themselves. See [`Docs/Museum_SecondFloorStairs.md`](Docs/Museum_SecondFloorStairs.md) for the full design writeup.

**Controls** ([`PlayerControls.tsx`](<app/(public)/gallery/museum/components/PlayerControls.tsx>)):

| Input                  | Desktop                                                                          | Touch                                                                                                               |
| ---------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Move                   | WASD / arrow keys                                                                | On-screen joystick, bottom-left ([`TouchControls.tsx`](<app/(public)/gallery/museum/components/TouchControls.tsx>)) |
| Look                   | Mouse, via Pointer Lock (click to engage)                                        | Drag anywhere else on screen                                                                                        |
| Interact with a frame  | **E**, once close enough (a hysteresis gap avoids flicker right at the boundary) | Tap the on-screen prompt                                                                                            |
| Open the map           | **M**                                                                            | Map button in the HUD                                                                                               |
| Toggle day/night       | **L**                                                                            | Sun/Moon button in the HUD                                                                                          |
| Hide/show the HUD      | **H**                                                                            | —                                                                                                                   |
| Screenshot             | **R**, or the **Save Photo** (Camera) button in the HUD                          | Camera icon in the HUD                                                                                              |
| Save the last photo    | Download button in the HUD                                                       | Download button in the HUD                                                                                          |
| Share the room in 360° | **Share 360°** button in the HUD                                                 | **Share 360°** button in the HUD                                                                                    |
| Enter/exit VR          | **V**, or the VR button in the HUD (only shown if the device supports it)        | VR Mode switch in the **View** dropdown, below Gyroscope (same device check)                                        |
| Gamepad (any mode)     | Left stick / d-pad move, right stick looks (snap-turns in VR), LB/RB turn, A or right trigger interacts, B closes, Y jumps ([`lib/museum/gamepad.ts`](lib/museum/gamepad.ts)) | Same — any Bluetooth gamepad the browser sees; the only way to walk in VR on a phone in Cardboard-style goggles |

The day/night toggle only dims the museum's own lights/fog (stored in its own `localStorage` key, `museum_dark_mode_v2`) — it's deliberately independent of the site-wide light/dark theme. Visitors arrive in **light mode**; the key is versioned because the old dark-first default auto-seeded a stored preference on a visitor's first load, so flipping the default alone would have left every returning visitor in dark on a setting they never chose. Devices with no WebGL at all fall back to [`MuseumGridFallback.tsx`](<app/(public)/gallery/museum/MuseumGridFallback.tsx>), a browsable 2D grid of the same rooms/artworks — detected client-side via a throwaway canvas, never assumed from user-agent. Three.js is loaded through a `next/dynamic(..., { ssr: false })` import ([`MuseumSceneLoader.tsx`](<app/(public)/gallery/museum/MuseumSceneLoader.tsx>)) so it never reaches the server bundle or a device that doesn't need it.

### VR Mode

An opt-in **VR** button appears in the desktop HUD only on a device that can actually use it (`navigator.xr.isSessionSupported('immersive-vr')`, feature-detected once on mount) — most visitors, on a phone or a headset-less desktop, never see it at all. The phone's **View** dropdown draws its **VR Mode** row _always_, dimmed with the reason when unsupported ("Open in Chrome or Safari to use" inside Facebook/Messenger/Instagram's in-app browser, which has no WebXR; "Not available in this browser" otherwise) — an absent row read as a regression the first time a visitor who'd used VR in Chrome opened the museum from a Facebook post. [`lib/museum/inAppBrowser.ts`](lib/museum/inAppBrowser.ts) is the UA check. It's the same continuous corridor, not a separate route: the camera is a child of a player rig ([`PlayerRig.tsx`](<app/(public)/gallery/museum/components/PlayerRig.tsx>), swapped for [`@react-three/xr`](https://github.com/pmndrs/xr)'s `<XROrigin>` while presenting) that [`PlayerControls.tsx`](<app/(public)/gallery/museum/components/PlayerControls.tsx>) already drives outside VR too — full design/rationale in [`Docs/Museum_VRMode.md`](Docs/Museum_VRMode.md). In VR: thumbstick movement (left stick) + 45° snap-turn (right stick — deliberately not smooth, for comfort), a comfort vignette while translating, and the head itself for looking around. The `[E]` prompt has an in-world twin ([`VrInteractionPrompt.tsx`](<app/(public)/gallery/museum/components/VrInteractionPrompt.tsx>), "TRIGGER · PINCH — View Artwork"), and a controller trigger or hand pinch opens the **same panel state** the desktop/mobile modals use — rendered as mirrored in-world panels built from [`VrUi.tsx`](<app/(public)/gallery/museum/components/VrUi.tsx>) (`VrArtworkPanel`, `VrCertificatePanel`, `VrStoryPanel`, `VrCosplayPanel`, `VrGamePanel`, `VrGigsPanel`, `VrContactPanel`), each with a clickable × and its own buttons (Wishlist, Next page, photo toggle). Whatever can't physically follow into a headset — new-tab links, the timelapse video, the Gigs map, the contact form, playing a mini-game — degrades to a muted "remove headset" line inside the panel rather than a missing feature. The HUD is in the headset too ([`VrHud.tsx`](<app/(public)/gallery/museum/components/VrHud.tsx>)): room name + progress dots, Music / Dark-Light / Map / Hide HUD / Exit VR, the bottom-left radar (the very same `drawMiniMap()` routine the DOM card uses, drawn to a texture) with the stat counters, the room splash and the achievement banner — all driving the same state as the DOM HUD; the [M] map is mirrored as [`VrMapPanel.tsx`](<app/(public)/gallery/museum/components/VrMapPanel.tsx>). Save Photo, Filter Vision and Back to Gallery deliberately don't carry over (each depends on the 2D canvas or DOM the XR compositor never shows). Jump is disabled while presenting. `@react-three/xr` stays behind the same `{ ssr: false }` boundary as the rest of three.js. Full design and the 09/13/26 scope change in [`Docs/Museum_VRMode.md`](Docs/Museum_VRMode.md) §9.

### Hide HUD & Screenshot

Pressing an OS-level screenshot shortcut (Cmd+Shift+4, Win+Shift+S, etc.) blurs the browser tab, which auto-releases Pointer Lock and always caught the "Click to look around" legend mid-frame — there's no way to prevent that at the JS level, it's a browser security behavior. Two in-app features route around it instead:

- **[L] Lighting** — cycles **Light → Dim → Dark** (`MuseumLightMode` in [`MuseumClient.tsx`](<app/(public)/gallery/museum/MuseumClient.tsx>); the HUD button on a phone and the VR HUD's button do the same). Everything downstream still speaks `darkMode` + one brightness: Dim is light mode's colour presets at `DigitalMuseum.museumBrightnessDim`, so adding the third mode touched no scene code. Persisted under the existing `museum_dark_mode_v2` key ("0" light / "1" dark / "2" dim, so an older saved choice still means what it did). Each mode's brightness is set from the Scene Editor toolbar's Light/Dim/Dark preview button + slider
- **[H] Hide HUD** — toggles every on-screen overlay (legend, interaction prompts, the About room corner card) off, so a visitor can take a clean OS-level screenshot themselves. Pressing **H** again restores the HUD; the room-entry splash system stays mounted underneath so it doesn't replay just because the HUD was briefly hidden ([`RoomSplash.tsx`](<app/(public)/gallery/museum/components/RoomSplash.tsx>)'s `hidden` prop only suppresses the visible render, not the component tracking which room's splash has already played). On mobile, where the `[H]` key doesn't exist, the same switch is a **Hide HUD** entry in the touch-only **View** dropdown (alongside Landscape and Gyroscope) — since flipping it hides that dropdown along with the rest of the HUD, a small always-mounted eye icon appears top-right whenever `hudHidden && isCoarsePointer`, as the one way back.
- **[R] Screenshot** — captures the WebGL canvas directly via `gl.domElement.toDataURL()` ([`ScreenshotCapture.tsx`](<app/(public)/gallery/museum/components/ScreenshotCapture.tsx>), mounted inside the `<Canvas>`, with `preserveDrawingBuffer: true`) and immediately downloads it — the canvas is its own compositing layer, so this never includes DOM overlays in the first place, no HUD-hiding needed. The HUD's **Save Photo** (Camera) button triggers the same capture at every width. The desktop **Hide HUD** button beside it (EyeOff icon) is the `[H]` switch above, _not_ a capture — it was once a Camera icon labelled "Screenshot", which visitors pressed expecting a download and got a blank screen instead.

### Share 360°

A **Share 360°** pill beside Save Photo renders the room the visitor is standing in as a Facebook-ready 360° photo — from where they stand, centred on where they're looking. The whole pipeline is client-side in [`lib/museum/panorama360.ts`](lib/museum/panorama360.ts): a `THREE.CubeCamera` at the eye draws the live scene graph into six 2048² faces (so lighting, dark mode, textures and admin-placed objects all come along untouched), a full-screen `ShaderMaterial` maps each output pixel's longitude/latitude to a cube-map direction, and the 4096×2048 result is read back, JPEG-encoded (q 0.95), and tagged. The export is sized per device by `pickPanoramaWidth` — desktop 4096, phones 3072 (2048 where Chrome reports under 6 GB RAM), the museum's low-end tier 2048 — because everything below scales with its square and a 4096 capture peaked at ~250 MB, enough to lose a mid-range phone's tab; the cube is also released before the readback, the full canvas zeroed once the JPEG exists, and the modal previews a 1024-wide copy. The faces are deliberately _half_ the output width — 2× supersampling with mipmaps — because a quarter-width face is only sampled 1:1 at its centre and reads soft everywhere else; and they're 8-bit **sRGB** (`colorSpace: SRGBColorSpace` on the target makes three allocate `SRGB8_ALPHA8`, so WebGL2 encodes on write / decodes on sample) rather than half-float, which gives the same shadow precision at half the memory (100 MB vs 200 MB for the six faces). Inside Facebook/Messenger/Instagram's in-app browser ([`isInAppBrowser()`](lib/museum/inAppBrowser.ts)) the modal shows an amber "open this in Chrome or Safari" note above the buttons and Download's toast stops claiming a save: that WebView swallows `<a download>` on a `blob:` URL silently and usually lacks the Web Share API too, so there is no way to hand the file over from inside it — the visitor's own _Open in browser_ menu is the whole fix. Two more details worth knowing before touching it:

- **Tone mapping is re-applied by hand.** three.js only tone-maps and sRGB-encodes the default framebuffer (`WebGLPrograms.js`); anything drawn into a render target is raw linear light. The shader therefore `#include`s `tonemapping_pars_fragment` and calls the same function the renderer is configured with (ACESFilmic, R3F's default) before `sRGBTransferOETF` — and deliberately does _not_ include `colorspace_pars_fragment`, which three already prepends to every fragment shader (doing so is a redefinition error and a black photo). Verified in headless Chrome against the live canvas.
- **Transmission is off for the shot.** three r169's `renderTransmissionPass` restores the render target without the active cube face (`WebGLRenderer.js:1571`), so a `MeshPhysicalMaterial` with `transmission > 0` in any face's view — the glass of a GLB prop — blanks that face and paints its content onto face 0. `renderEquirectangular` zeroes `transmission` (with `needsUpdate`) on every such material for the one frame and restores it after.
- **The tag is what makes it a 360°.** [`injectGPanoXmp()`](lib/museum/panorama360.ts) splices a Photo Sphere XMP `APP1` segment (`GPano:ProjectionType="equirectangular"`, the full/cropped pano dimensions, `PoseHeadingDegrees`) straight after the JFIF `APP0`. That block — not anything about the page — is what Facebook, Google Photos and Flickr look for; a link post is always a flat OG image.

[`Room360Capture.tsx`](<app/(public)/gallery/museum/components/Room360Capture.tsx>) is the R3F bridge (the same ref pattern as `ScreenshotCapture`), mounted by both [`MuseumScene.tsx`](<app/(public)/gallery/museum/components/MuseumScene.tsx>) (eye = the player rig; low-end devices export 2048 wide) and the admin [`MuseumEditorScene.tsx`](<app/(admin)/admin/artworks/museum-editor/[roomId]/MuseumEditorScene.tsx>) (eye = just inside the south doorway, facing in; gizmo and guide lines hidden for the shot — and it captures unsaved edits, since it reads the scene, not the DB). The editor also uses the `stage` hook to fill its doorways for the duration of the render: it previews one room with no corridor behind it, so an open doorway is otherwise a hole straight through to the void-black scene background, dead centre of the photo. The public scene additionally uses the async `prepare` hook to _light_ every room for the shot (`lightsEnabled`, not `nearbyRoomIds` — widening the latter also starts every artwork load in the building, which crashed phones): point lights are normally gated to the current room ± 1, which is right for walking but leaves a room two doorways away lit by ambient alone. [`Share360Modal.tsx`](<app/(public)/gallery/museum/components/Share360Modal.tsx>) shows the flat strip with **Share…** (Web Share API with the file, offered only where `navigator.canShare({ files })` says so — the Facebook app keeps the XMP), **Download**, and **Copy link** (`/gallery/museum?room=<slug>`); it is sized for the museum's forced-landscape phone viewport (~390px tall), so the buttons never stack.

### Minimap HUD

The bottom-left radar card — a live plan of just the room the visitor is standing in ([`MiniMapHud.tsx`](<app/(public)/gallery/museum/components/MiniMapHud.tsx>)), with the steps/views/time/wishlisted counters stacked underneath it ([`AchievementHud.tsx`](<app/(public)/gallery/museum/components/AchievementHud.tsx>)) inside one shared card. It draws onto a plain 2D `<canvas>` from its own `requestAnimationFrame` loop, reading a ref that [`MiniMapTracker.tsx`](<app/(public)/gallery/museum/components/MiniMapTracker.tsx>) writes every frame from inside the R3F loop — a radar has to feel alive at frame rate, and React state would repaint the whole HUD tree 60×/sec for it. Desktop keeps it always on; touch reaches the same component through [`StatsMinimapPanel.tsx`](<app/(public)/gallery/museum/components/StatsMinimapPanel.tsx>), where the counter card doubles as a tap-to-expand toggle at a phone-appropriate size.

Its look is admin-configurable museum-wide (Artworks ▸ Digital Museum ▸ General Settings ▸ **Minimap HUD**): the map's width/height (the width is the map's own size, not a floor under whatever the counter row needs — as a minimum it was overruled by that row, so the slider read as dead until dragged past it), the counter row's size as a percentage, an icon per counter from a fixed set, and a colour each for the player pointer, artwork dots, object dots, the nearby glow, companion dots, the room outline and its doorways. Stored as one JSON blob in `DigitalMuseum.minimapConfig` with defaults in [`lib/museum/minimapHud.ts`](lib/museum/minimapHud.ts) that are the literal values the components shipped with — a museum that never configures it renders identically, and **Reset to defaults** restores that rather than someone's idea of a nice one. Per-mark _opacity_ stays in the drawing code: those alphas are what make a prop dot recede behind an artwork dot, so an admin picks the hue and the relationship between the marks holds. The admin preview is the real two components fed a sample room and a walking player, not a mock of them.

The map also carries a **floor label** in the padding band above (or below) the room — "Ground Floor" / "Second Floor", or "Stairs" while on the connector (which is stored as floor 0 but is neither floor to whoever is climbing it; `floorLabelFor()` checks the room type first). It's painted onto the same canvas as the room, so the VR radar and the phone's expandable map carry it for free, and a label sized past the padding band grows the band on its side rather than drawing across the wall. The same admin section's **Floor label** group sets the three texts, font (the site theme's six, via [`lib/theme.ts`](lib/theme.ts)'s `THEME_FONT_OPTIONS`), style, size, colour, position and a tracked-capitals switch, with a **Preview as** toggle to see each text. One wrinkle: four of those fonts are `var(--font-…)` references that next/font loads under generated names, which `ctx.font` silently rejects — `resolveCanvasFontFamily()` in `MiniMapHud.tsx` reads each custom property's computed value off `<html>` once and caches it.

### Wall/Floor/Ceiling colors & textures

Each room (and the synthetic About room, via the museum-wide `about*` fields above) has independent **Wall**, **Floor**, and **Ceiling** color pickers, each with an optional **texture upload** — drop in an actual concrete, wood, or fabric photo and it replaces the flat color on that surface. Edited from the Rooms tab's per-room edit form (Floor → Wall → Ceiling order) with a cursor-following hover preview on the uploaded thumbnail. A texture is tiled (`THREE.RepeatWrapping`) rather than stretched across a whole wall — [`MuseumRoom.tsx`](<app/(public)/gallery/museum/components/MuseumRoom.tsx>) assumes `TEXTURE_TILE_METERS` (2m) per repeat and clones the loaded texture per wall/floor/ceiling segment (never mutates the shared cached `THREE.Texture` instance `loadDownscaledTexture` returns, since multiple differently-sized segments — or a different room entirely — can reuse the same uploaded image). Clearing a texture falls back to the plain color underneath it.

### Room-entry splash

The first time a visitor steps into each room in a visit, a brief splash shows the room's name (`RoomSplash.tsx`) — the exact same transition engine as the site-wide entrance splash ([`lib/intro-splash.ts`](lib/intro-splash.ts)), just with per-room content instead of the KALAM(squid)RI wordmark and museum-wide settings instead of profile-wide ones (see [`lib/museum-splash.ts`](lib/museum-splash.ts)). Gated per room via `sessionStorage`, same "once per tab" behavior as the homepage splash. Configured from the Digital Museum tab's **General Settings**, reusing the same admin UI pattern as [`IntroSplashSection.tsx`](<app/(admin)/admin/settings/Preferences/IntroSplashSection.tsx>).

Each room (and the About room) can also override the splash's **icon** and **title** — pick any Lucide/Tabler icon via the same icon-gallery picker used for the site's Admin Sidebar/FAQ Chat icons ([`IconPicker.tsx`](<app/(admin)/admin/settings/Preferences/IconPicker.tsx>)), and type a custom title to show instead of the room's own name. Leave both unset and the splash falls back to the signature glowing squid mark ([`SquidIcon.tsx`](components/ui/SquidIcon.tsx)) and the room's real name.

### Museum Scene Editor

Each room has its own 3D editor at `/admin/artworks/museum-editor/[roomId]` ([`MuseumEditorClient.tsx`](<app/(admin)/admin/artworks/museum-editor/[roomId]/MuseumEditorClient.tsx>) + [`MuseumEditorScene.tsx`](<app/(admin)/admin/artworks/museum-editor/[roomId]/MuseumEditorScene.tsx>)), reached from the room's row in the Rooms tab. It previews the real room — the corridor is chained exactly the way the public museum chains it, because which walls have doorways depends on a room's position, and a doorway wall is measured as two flanking strips.

- **Go to ▾** — a room picker in the header's top-right ([`AdminGoToMenu`](components/admin/AdminGoToMenu.tsx), links from [`museumEditorRoomLinks`](lib/museum/roomStatus.ts)). First entry is **the room being edited, in the public museum**, deep-linked by `?roomId=` — addressed by id rather than by one of the six `?room=` slugs, since a curated room has no slug — so checking what you just laid out doesn't mean walking the corridor from the entrance. Then every room in the museum in corridor order, each opening its own Scene Editor in a new tab, plus the public museum. The room being edited is listed but greyed ("You're editing this room") rather than hidden, so the menu reads as the whole museum; a room a visitor can't currently reach is greyed with the reason, and the Stairs room counts as unreachable whenever nothing is upstairs, however its own toggle is set
- **Artwork frames** — hang position per wall (North / South / East / West, and either side of a doorway), horizontal and vertical (Y) placement, and a reorder/pagination list mirroring the Rooms tab's controls. Alignment guides appear beside neighbouring pieces while dragging
- **Decorative objects** — upload a `.glb` (100MB max) or tile a texture: carpets, pots, lights, furniture. Drag, rotate and resize with gizmos. A model that isn't authored in metres — common for anything routed through FBX — is measured on arrival and scaled once to about door height, so it lands where you can see it instead of vanishing as a 3km-wide object. Props are also **recentred on load** ([`CustomSceneObject`](<app/(public)/gallery/museum/components/CustomSceneObject.tsx>)'s `recenter`, in the editor and the public museum alike): the geometry's horizontal centre goes on the model's pivot and its lowest point on the floor, whatever the exporter left the pivot at — so the gizmo sits on the model, rotation turns it on the spot, and the collision ring's base is the model's base. Fixture models (podium, cabinet, standee, companion, desk) render as exported
- **Text labels** — free text placed on a wall, with its own colours
- **Dividers** — **+ Add Divider** drops a freestanding partition wall into the room. Drag and turn it like any other object, size it with **Width / Height / Thickness** in metres, and finish it in a plain colour or an uploaded texture tiled the same way a room's own walls are (with an optional **Mirror Texture** so the tile joins read as a reflection instead of a seam). Solid by default — visitors are stopped by it, using a rectangular barrier rather than the circular footprint props use, so a panel blocks along its whole face at any angle. Once a divider is in a room, **both of its faces appear in every artwork's Wall picker** (`Divider Wall 1 · Front` / `· Back`) alongside North/South/East/West, so art can hang on it — flush against the face, and following the panel if it is later moved, turned or resized (the association is recovered by facing and distance to the face _segment_ in `snapToDividerFace` — ends included, so two panels standing in a line stay distinct (v6.41.3) — and nothing has to be stored against a panel that can be deleted). Deleting a divider returns its art to the room's own walls rather than leaving it floating. New panels spawn staggered rather than at the room's centre, since two identical slabs at the origin look like one. Uploading or clearing the texture, and toggling **Mirror Texture**, each raise a toast confirming the change is staged until **Save**
- **Room fixtures** — provisioned by the room rather than added by hand, and listed separately for that reason: the About room's five content blocks, the **Contact Desk** (walk up, press **[E]**, and the museum's own Send an Email form opens), the **Digital Wall Clock** (drawn in code so it keeps real time, with 12/24-hour, seconds, date line, caption, time zone and colours), and the Freedom Wall plaque. Each has a **Visible in museum / Hidden from museum** switch — an artist with no certificates can have no Certificates Strip. Hiding keeps the upload, wording, placement and size
- **Room Surfaces** — the room's wall/floor/ceiling colour and optional tiled texture, moved here from the Rooms tab's Edit modal so the surface is chosen while looking at it (the modal keeps name, type, description, splash and spawn). Same [`ColorField` / `TextureField`](<app/(admin)/admin/artworks/museum-ui.tsx>) controls, same `PATCH /api/digital-museum/rooms/[id]` (the About room's go to `DigitalMuseum.about*` via `/api/digital-museum`, as before); saved on change, debounced per field, not part of the Save button
- **Room Lights** — `MuseumRoom.lightColor` / `lightScale` / `lightModelUrl`. The colour overrides the roomType preset's point-light colour in every mode; the size scales the fixture [`MuseumRoom.tsx`](<app/(public)/gallery/museum/components/MuseumRoom.tsx>) now hangs at every point light (a built-in plate/stem/shade/glowing bulb, or an uploaded `.glb` hung from its top via `CustomSceneObject`'s `recenter="top"`). Fixtures come from the same position list as the lights, so `quality="low"`'s two-light layout draws two fixtures
- **Solid** — a per-object collision footprint with a **Collision Size** slider in metres, **Collision Position** sliders that move the circle off the prop's origin (a .glb exported away from its own origin otherwise gets a ring beside it, not under it), **Fit to model** to wrap the geometry where it actually stands, and an orange ring in the preview showing exactly what's blocked. Stored in model units and in the prop's own frame, so the footprint resizes and turns with it. **Collision Height** (off by default) gives that circle a top, measured up from the prop's own base: without it the footprint is a floor-to-ceiling column and a prop is solid at every height or not at all, so a hanging lamp blocked the floor beneath it and an archway couldn't be walked through. With a height set, visitors are only stopped while their own body overlaps it — the preview draws the blocked volume as a translucent cylinder
- Undo/redo, a light/dark toggle so a room can be judged in both, and a leave-confirmation guard on unsaved changes. Undo/redo is local like everything else here, with one synced exception: Add, Duplicate and Remove write a row the moment they're clicked, so stepping the history diffs the object list and soft-deletes / restores the matching rows (`reconcileSceneObjects`) — an undone Add used to leave a divider live in the museum that the editor no longer showed (v6.41.2)

> 💡 **Room Type (Main Hall / Gallery / Special Exhibition) only changes size and lighting** — a Main Hall is the largest, and Special Exhibition uses moodier lighting. There is no other built-in behavior difference; despite the name, `SPECIAL_EXHIBITION` has nothing to do with the removed Exhibitions feature.

---

## Admin Notifications & Login Security

Two related but independent additions: **in-app/email notifications** for things the admin should know about, and **hardening on the admin login itself** (OAuth sign-in + optional TOTP 2FA). No job queue involved anywhere — every notifier is a direct, fire-and-forget call from inside the route/action that triggers it (a mail failure never fails the underlying operation), the same pattern `lib/mail.ts` already used before any of this was added.

**Notifications** (`lib/notifications/`), one small function per event:

| Event                                             | Function                                     | In-app row?                                                                                                                      | Email?                                                                      |
| ------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| New order paid                                    | `notifyAdminOfNewOrder` (`order.ts`)         | ✅ (`Notification`, type `ORDER`)                                                                                                | ✅ `ORDER_ALERT_EMAIL`                                                      |
| New all-time highscore on a mini-game leaderboard | `notifyAdminOfNewHighscore` (`highscore.ts`) | ✅ (`Notification`, type `HIGHSCORE`)                                                                                            | ✅ `MINIGAME_NOTIFY_EMAIL`                                                  |
| Public contact form submitted                     | `notifyAdminOfContactMessage` (`contact.ts`) | ✅ (`Notification`, type `CONTACT` — labeled **"Gmail"** in the admin UI, since that's where the admin reads the actual message) | ✅ `GMAIL_USER` (the form's existing send — see `app/api/contact/route.ts`) |
| Admin's password changed                          | `notifyUserOfPasswordChange` (`security.ts`) | —                                                                                                                                | ✅ to the account's own email                                               |
| New login from an unrecognized device/browser     | `notifyUserOfNewLoginDevice` (`security.ts`) | —                                                                                                                                | ✅ to the account's own email                                               |
| TOTP (2FA) turned off                             | `notifyUserOfTotpDisabled` (`security.ts`)   | —                                                                                                                                | ✅ to the account's own email                                               |

The first three are **admin-only** (`Notification` model in `prisma/schema.prisma` — no `recipientUserId`, deliberately not customer-facing) and surface two ways: the **notifications bell**, fixed to the top-right corner of every admin page (`components/admin/NotificationBell.tsx`, mounted once in `app/(admin)/layout.tsx` — not per-page — backed by `app/api/admin/notifications/route.ts`, last 20 only), and the full history at **`/admin/notifications`** (`NotificationsClient.tsx`) with All/Gmail/Orders/Minigame (Highscores)/Museum tabs and page-by-page browsing. The panel renders through a portal into `document.body` so it's never clipped by an ancestor's `overflow`. The highscore notifier fires only when a submission is rank **1** for its game (a genuine new all-time high, not just a top-10 finish — see the check in `app/api/minigames/leaderboard/route.ts`). The last three are account-security alerts, email-only by design (see the `Notification` model's doc comment in `prisma/schema.prisma`), and are best-effort — never block the action that triggered them.

Clicking a row on `/admin/notifications` opens a **View modal** — for Gmail rows, the full untruncated message (the list itself only ever shows a 200-character preview), sender name/email, and subject; a **Reply via Gmail** button (`mailto:`); and, Gmail-only, **Set as Spam** (hides the row from the default Gmail view without deleting it — a separate **Spam** filter chip shows what's flagged, reversible via **Unmark Spam**) and **Block Sender** (adds the email to a `BlockedEmail` table; `app/api/contact/route.ts` checks it before accepting a submission and, if blocked, returns the exact same response as a genuine send failure — nothing distinguishes a block from a technical hiccup, so there's nothing for a blocked sender to learn). Every row (any type) also has **Archive** (`isArchived` — "I've seen this, hide it without deleting or flagging it as unwanted"; unlike Spam, available on Orders/Minigame (Highscores)/Museum too, not just Gmail; reversible, with an **Archived** toggle in the main toolbar showing everything currently archived, on every tab) and **Delete**, a soft delete via `DELETE /api/admin/notifications/[id]` — same `deletedAt` convention as Artworks/Sections/Products/Announcements/Marquees — which surfaces in **`/admin/trash`**'s new **Notifications** category for restore or permanent deletion, wired through the existing `app/api/trash/[type]/[id]/route.ts`.

Blocks are managed (added or reversed) from **Settings → Blocked Emails** (`app/(admin)/admin/settings/blocked-emails/`, `app/api/admin/blocked-emails/`) — lists every `BlockedEmail` row with an **Unblock** button, and a form to block an address directly without going through an existing Gmail notification.

New-device detection (`lib/auth.ts`'s `authorize()`) compares the signing-in request's user-agent against `User.lastLoginUserAgent`; a user with no prior fingerprint (first login since this shipped) never fires a false alert.

**Admin login hardening:**

- **Google/Facebook OAuth** — added as NextAuth providers in `lib/auth.ts`, gated by a `signIn` callback that only allows an OAuth sign-in whose email already belongs to an `ADMIN` user; it can never create a new account. Full setup (Google Cloud / Meta app creation, exact redirect URIs, env vars): **[`Docs/OAuth2_Setup.md`](Docs/OAuth2_Setup.md)**.
- **TOTP second factor** (`lib/totp.ts`, using `otplib` + `qrcode`) — enrolled per-admin from **Settings → Security**, no env vars needed. QR-code enrollment requires one confirmed code before `totpEnabled` actually flips on; 10 bcrypt-hashed one-time recovery codes are generated and shown once at that moment. Login-time verification is a two-step client flow: `app/api/auth/check-password/route.ts` is a UX-only pre-check (never issues a session) that tells `LoginForm.tsx` whether to show a code field; the actual gate stays entirely inside `authorize()` — a correct password alone can never issue a session once `totpEnabled` is true. Disabling requires re-entering the password even from an active admin session.
- **Known scope limit:** TOTP currently gates the **password** login only, not the OAuth path — extending it there needs a "pending 2FA" intermediate session state touching `middleware.ts`/`auth.config.ts`, deferred as a deliberate scope decision rather than rushed into the single most sensitive code path in the app. See `Docs/OAuth2_Setup.md` §0.

Admin-facing walkthrough for all of the above (screenshots-free but click-by-click): **[`Docs/User_Training.md` §1.2–1.3, §2.1, §14](Docs/User_Training.md)**.

---

## Image uploads & egress

`next.config.ts` runs `next/image` with `unoptimized: true` (Vercel's free image-optimizer quota is 5,000 transformations/month and was the first thing to run out), so **nothing resizes an image between the bucket and the visitor**. Left alone, that meant every gallery card and every museum wall downloaded the artist's original upload — and in September 2026 the bucket blew through Supabase's free-plan egress (13.4 GB against 5.5 GB) and was throttled, taking every image on the site down with it.

The fix is to compress **once, at upload**, and store three sizes:

| Rendition | Longest side | Stored as                                     | Used by                                                                                 |
| --------- | ------------ | --------------------------------------------- | --------------------------------------------------------------------------------------- |
| `full`    | 2400 px      | `img/<id>.webp` — **the URL saved in the DB** | lightbox, artwork page, museum info panel                                               |
| `medium`  | 1280 px      | `img/<id>.m.webp`                             | museum wall textures (`loadDownscaledTexture`), hero carousel, story pages              |
| `thumb`   | 640 px       | `img/<id>.t.webp`                             | gallery / shop / certificate / story grids; cart, wishlist, checkout, order-lookup rows |

- **[`lib/images/compress.ts`](lib/images/compress.ts)** — sharp, WebP quality 82, EXIF-rotated, metadata stripped, alpha preserved. Node-only. GIFs pass through untouched. Roughly 9× / 25× / 95× smaller than a typical phone-camera original.
- **[`lib/images/variants.ts`](lib/images/variants.ts)** — pure string helpers. `imageVariantUrl(url, "thumb")` derives a sibling URL from the stored full-size one, and returns the input **unchanged** for anything not under `img/` (pre-compression uploads, Unsplash seeds, GIFs), so there is no schema change and no migration.
- **[`lib/images/corsUrl.ts`](lib/images/corsUrl.ts)** — `corsImageUrl(url)` appends `?cors=1` to any image the museum will _read back as pixels_ (WebGL texture, canvas `drawImage`). R2 only sends `Access-Control-Allow-Origin` when the request carried an `Origin` header, and a plain `<img>` doesn't, so the navbar's cached, CORS-less copy of the logo used to be handed to the About Room plaque and the `[R]` watermark and fail both (v6.41.1). A distinct query string is a distinct cache key. Fetch-time only; stored URLs are untouched. Every `crossOrigin` load must go through it — details under CORS in [`Docs/Media_Storage_R2.md`](Docs/Media_Storage_R2.md).
- **`uploadCompressedImage()`** in [`lib/storage/server.ts`](lib/storage/server.ts) is the path every admin image route takes (`/api/upload`, `/api/upload/event-image`, `/api/backup/media`). All three files land or none do; `deleteArtworkImage()` removes the siblings with the original.

Rendering rule of thumb: a grid card asks for `thumb`, anything full-bleed or 3D asks for `medium`, and only a lightbox or detail view should receive the stored URL as-is.

> `lib/storage/server.ts` imports sharp and the AWS SDK, so it is server-only. The browser half is [`lib/storage/browser.ts`](lib/storage/browser.ts), which is dependency-free — it only ever PUTs to a presigned URL the server minted. The one value both need (`IMMUTABLE_CACHE`) lives in [`lib/storage/cache.ts`](lib/storage/cache.ts).

---

## Supabase Row-Level Security (RLS)

> **Full write-up:** [`Docs/System_Security.md`](Docs/System_Security.md) — threat model, what was found and fixed in the 2026-09-05 audit, and a copy-paste verification playbook. This section is the short version.

### Two doors, two locks

Supabase is **Postgres only** as of the R2 migration (2026-09-15). There are still two independent ways into it, secured by completely different mechanisms:

| Connection                               | Used by                                            | Credentials                                                                                   | What secures it                                                                                                                                            |
| ---------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Postgres (`DATABASE_URL` / `DIRECT_URL`) | Prisma (`lib/prisma.ts`), every `app/api/**` route | Role `postgres`                                                                               | **Not RLS.** This role has `BYPASSRLS`, so every policy is invisible to it. What actually authorizes these calls is `requireAdmin()` in the route handler. |
| PostgREST (`/rest/v1`)                   | Reachable by anyone holding the public anon key    | anon key (no longer shipped in the JS bundle — nothing in the browser uses Supabase any more) | **Grants and RLS.** No application code is involved, so this is the door that fails silently.                                                              |

This distinction matters more than it looks. RLS is not this app's access control — it is the lock on the _other_ door, the one the browser can knock on directly.

### The posture: deny-all, plus no grant to deny

The `anon` and `authenticated` roles have **no `USAGE` on the `public` schema and zero table grants**, and all 47 tables have RLS enabled with **zero policies**.

That is deliberately stronger than writing careful policies. A policy only matters once a role can see the schema; with the grant revoked, PostgREST refuses at the schema level and never reaches a policy check:

```
GET /rest/v1/User?select=*   →  401  permission denied for schema public
```

So a future table with a badly written policy — or no policy — cannot leak, because the role cannot see the schema it lives in. The revocation also covers `ALTER DEFAULT PRIVILEGES`, so tables created later inherit nothing either.

An event trigger, **`ensure_rls`**, enables RLS on every newly created table in `public`. This is what stops `yarn db:push` from quietly shipping an unprotected table. Do not remove it.

### Storage (Cloudflare R2)

Media no longer lives in Supabase. The R2 bucket is public-read behind `R2_PUBLIC_URL`; every write path is one of:

- **Server writes** from `lib/storage/server.ts` using the R2 API token (`Object Read & Write`, scoped to this one bucket, never in the browser).
- **Browser uploads** (the Museum Scene Editor's `.glb` and audio files, too large for Vercel's ~4.5MB body cap) use a **presigned PUT** minted server-side — `createModelUploadUrl` / `createAudioUploadUrl`. The URL is scoped to one object, one content type and ten minutes; it _is_ the authorization. `lib/storage/browser.ts` holds no key of any kind.

The bucket's CORS policy allows `GET`/`HEAD` from anywhere (the objects are public anyway, and WebGL needs the header) and `PUT` only from the site's own origins. The old Supabase bucket's history — including the `anon INSERT` policy the security audit found and dropped — is in [`Docs/System_Security.md`](Docs/System_Security.md).

> ⚠️ **Never put an R2 credential in a `NEXT_PUBLIC_` variable or a client component.** If a new upload feature appears to need one, it is being built the wrong way — copy the presigned-PUT pattern instead.

### Adding a new table later

1. Nothing to do for security. `ensure_rls` turns RLS on automatically, and with no grants there is nothing to deny.
2. **Do not** add a `for select … using (true)` policy "so the public can read it." The public does not read tables — the Next.js API routes do, through Prisma. The audit removed 23 such policies precisely because they were inert-but-loaded: a single future `GRANT USAGE ON SCHEMA public TO anon` would have turned all of them into world-readable tables, and none filtered on `published` / `isHidden`.
3. **Never `GRANT` anything in `public` to `anon` or `authenticated`.** That one command is what would undo all of the above.

### Verifying

Run the playbook in [`Docs/System_Security.md`](Docs/System_Security.md#verification-playbook) after any Supabase dashboard change or `yarn db:push`. The four database invariants, in short:

```sql
-- 0 rows: every table has RLS
select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;

-- 0: deny-all is the intent
select count(*) from pg_policies where schemaname = 'public';

-- both false
select has_schema_privilege('anon','public','USAGE'),
       has_schema_privilege('authenticated','public','USAGE');

-- 0
select count(*) from information_schema.role_table_grants
 where table_schema = 'public' and grantee in ('anon','authenticated');
```

Then confirm nothing legitimate broke: a public image URL still returns `200`, and a `.glb` upload through the Museum Scene Editor still completes.

---

## Project Structure

```
scriptovernovel.music/
├── app/
│   ├── (public)/                    # Guest-facing pages
│   │   ├── page.tsx                 # Home — sections gallery, featured carousel
│   │   ├── gallery/                 # Full gallery with filters/search
│   │   │   └── museum/              # Digital Museum — page.tsx (server: fetches museum/rooms/
│   │   │                            #   cosplays/stories + About data), MuseumClient.tsx (view state:
│   │   │                            #   loading/3d/unsupported, HUD, dark mode, hide-HUD + screenshot
│   │   │                            #   buttons), MuseumSceneLoader (client-only Three.js entry),
│   │   │                            #   MuseumGridFallback (no-WebGL 2D fallback), components/
│   │   │                            #   (MuseumScene, MuseumRoom, PlayerControls + TouchControls,
│   │   │                            #   ArtworkFrame, CosplayStandee + CosplayRoomContents +
│   │   │                            #   CosplayInfoPanel + standeePlacement (Cosplay Room),
│   │   │                            #   ArtworkInfoPanel, InteractionPrompt, MuseumMap, RoomSplash
│   │   │                            #   + RoomSplashContent [splash icon/title],
│   │   │                            #   ScreenshotCapture [R] / Save Photo canvas capture,
│   │   │                            #   Room360Capture + Share360Modal — Share 360° (lib/museum/panorama360.ts),
│   │   │                            #   AboutRoomContents + AboutRoomCorner, CertificateInfoPanel,
│   │   │                            #   KeyGuide, LoadingScreen, roomConstants.ts, roomLayout.ts,
│   │   │                            #   framePlacement.ts — see "Digital Museum" above)
│   │   │   └── freedom-wall/        # Freedom Wall page — sticky notes visitors drag/pinch (device-only layout)
│   │   ├── stories/                 # Tales — the book shelf + StoryReader (URL kept as /stories)
│   │   ├── artwork/[slug]/          # Dedicated indexable artwork page (SEO + Share target)
│   │   ├── wishlist/                # Saved-artworks list (localStorage, no login)
│   │   ├── about/                   # Artist bio, profile, skills, certificates
│   │   ├── contact/                 # Contact form (reCAPTCHA + email)
│   │   ├── shop/                    # Product listings (V2)
│   │   ├── cart/                    # Shopping cart (V2, Zustand)
│   │   ├── checkout/                # Checkout flow (V2, PayMongo)
│   │   ├── order/success|cancel|lookup/ # Post-checkout redirect pages + self-service order lookup (V2)
│   │   └── layout.tsx               # Navbar + Footer shell, mounts CursorGlow + BackgroundMusicPlayer + MaintenancePage gate
│   ├── (auth)/
│   │   ├── login/                   # Admin login — lockout-aware forgot-password prompt,
│   │   │                            #   Google/Facebook buttons, TOTP code step when enabled
│   │   └── reset-password/          # Token-gated new-password form
│   ├── (admin)/
│   │   ├── layout.tsx               # AdminSidebar shell (auth-protected), mounts
│   │   │                            #   NotificationBell once for every admin page
│   │   └── admin/
│   │       ├── page.tsx             # Redirects bare /admin -> /admin/dashboard
│   │       ├── dashboard/           # Tabbed: Overview (stats/orders/quick actions) +
│   │       │                        #   Website Analytics, via DashboardTabs
│   │       ├── artworks/            # Artwork CRUD + image/video upload (ArtworksClient.tsx),
│   │       │                        #   Digital Museum tab (DigitalMuseumPanel.tsx → RoomsTab.tsx /
│   │       │                        #   MuseumSplashSection.tsx, sharing ArtworkPicker.tsx +
│   │       │                        #   museum-ui.tsx), and museum-editor/[roomId]/ (the 3D
│   │       │                        #   Museum Scene Editor — see "Digital Museum" above)
│   │       ├── cosplays/            # Cosplay CRUD (CosplaysClient.tsx) — feeds the Cosplay Room
│   │       ├── vinyls/              # Vinyl CRUD (VinylsClient.tsx) — feeds the Vinyl Room
│   │       ├── sections/            # Gallery section CRUD + reorder
│   │       ├── products/            # Product/pricing management (V2)
│   │       ├── orders/              # Order tracking (V2)
│   │       ├── announcement/        # Tabbed: AnnouncementClient (popups) +
│   │       │                        #   MarqueeClient (ticker), via AnnouncementTabs
│   │       ├── about/               # Profile/bio/links/skills/certificates editor
│   │       ├── events/              # Timeline/Gigs CRUD (EventsClient.tsx) — title/venue/
│   │       │                        #   description/date, click-to-drop-pin location picker
│   │       │                        #   (react-leaflet/OpenStreetMap, no API key), Next Event toggle, photo/
│   │       │                        #   video upload, reorder — see "Timeline & Gigs map" above
│   │       ├── settings/faqs/       # FAQ CRUD + reorder
│   │       ├── settings/Preferences/# Branding (logo/background/background effects/icons/mobile carousel/entrance splash) + Theme editor (incl. Cursor Effects)
│   │       ├── settings/music/      # Background music toggle, audio upload, volume
│   │       ├── settings/sound/      # Sound effects: SoundClient (category tabs) +
│   │       │                        #   SoundEffectCard (per-key enable/source/volume/preview)
│   │       ├── settings/maintenance/# Maintenance mode toggle + message + live preview
│   │       ├── settings/security/   # TOTP 2FA enroll/disable (SecurityClient) — see
│   │       │                        #   "Admin Notifications & Login Security" below
│   │       ├── settings/blocked-emails/ # BlockedEmailsClient — list + add + Unblock,
│   │       │                        #   the reverse side of a Gmail notification's
│   │       │                        #   "Block Sender" action
│   │       ├── api-docs/            # Swagger UI (swagger-ui-react, ssr:false) — reads
│   │       │                        #   /api/openapi.json; accepts session cookie or
│   │       │                        #   x-api-key via the "Authorize" button
│   │       ├── settings/minigames/  # Mini games: per-game config (MiniGamesClient +
│   │       │                        #   GameConfigPanel + ArtworkPicker + DifferenceEditor),
│   │       │                        #   LeaderboardManager, RewardClaims
│   │       ├── settings/release-notes/ # Release Notes CRUD (draft → publish) — the visitor-facing
│   │       │                        #   "what's new" panel, see "Release Notes" above
│   │       ├── stories/             # Tales module (StoriesClient.tsx + StoryPagesManager) — feeds
│   │       │                        #   the Tales Room; "Stories" in code, "Tales" in every label
│   │       ├── museum/              # Digital Museum admin (General Settings / Rooms / Freedom Wall tabs)
│   │       └── trash/               # Soft-delete recovery
│   └── api/
│       ├── auth/[...nextauth]/      # NextAuth handlers (Credentials + Google + Facebook)
│       ├── auth/forgot-password/    # Issues a hashed, 1-hour reset token + emails the link
│       ├── auth/reset-password/     # Validates token (GET) + sets new password (POST)
│       ├── auth/check-password/     # UX-only pre-check for the TOTP login step — never
│       │                            #   issues a session, see "Admin Notifications &
│       │                            #   Login Security" below
│       ├── admin/notifications/     # Admin-only: list (+ unread count, filters, pagination)
│       │                            #   / mark-read. [id]/ = soft-delete + spam toggle,
│       │                            #   [id]/block/ = block a Gmail sender's email
│       ├── admin/blocked-emails/    # Admin-only: list/add ([id]/ = unblock) — the contact
│       │                            #   form's block list, see app/api/contact/route.ts
│       ├── admin/totp/              # Admin-only: setup/ (start enrollment), verify/
│       │                            #   (confirm + enable + issue recovery codes),
│       │                            #   disable/ (password-confirmed turn-off)
│       ├── artworks/[id]/           # Artwork CRUD API
│       ├── artworks/[id]/share/     # Unauthenticated +1 share-count bump
│       ├── digital-museum/          # Admin-only CRUD for the Digital Museum (GET/PATCH the
│       │                            #   singleton + splash fields). rooms/, rooms/[id]/,
│       │                            #   rooms/reorder/, rooms/[id]/artworks/(+reorder)/,
│       │                            #   rooms/[id]/scene-objects/ (Museum Scene Editor placements),
│       │                            #   room-cosplays/[id]/ — public reads go straight through the
│       │                            #   server-rendered page.tsx above instead
│       │                            #   (no public GET here — see "Digital Museum" above)
│       ├── cosplays/                 # Cosplay CRUD API — route.ts + [id]/
│       ├── events/                  # Timeline/Events CRUD API — [id]/ (PATCH also enforces
│       │                            #   the single Next Event flag in a transaction, same
│       │                            #   pattern as Digital Museum rooms; DELETE = soft delete),
│       │                            #   reorder/, media/ (attach/remove one photo or video),
│       │                            #   public/ (no auth, enabled + non-deleted only — feeds
│       │                            #   EventsMap.tsx on /about)
│       ├── upload/video/            # Timelapse video upload for Artworks (see lib/artwork-video.ts)
│       ├── upload/event-image/, upload/event-video/ # Timeline/Events photo/video upload to R2
│       ├── sections/[id]/reorder/   # Section CRUD + reorder API
│       ├── products/[id]/           # Product CRUD API (V2)
│       ├── orders/[id]/             # Order API (V2)
│       ├── orders/lookup/           # Self-service order lookup by ref/email (V2)
│       ├── checkout/                # PayMongo checkout session (V2)
│       ├── webhooks/paymongo/       # PayMongo webhook handler (V2) — on payment.paid, also
│       │                            #   calls notifyAdminOfNewOrder (lib/notifications/order.ts)
│       ├── faqs/[id]/active/reorder/# FAQ CRUD + reorder API
│       ├── announcements/[id]/active/ # Announcement (popup) CRUD API
│       ├── marquees/[id]/active/    # Marquee ticker CRUD API (/active = live rows)
│       ├── certificates/[id]/       # Certificates & awards API
│       ├── social-links/            # Social links API
│       ├── artist-skills/           # Artist skills API
│       ├── profile/                 # Profile read/update API (branding, theme, carousel, music, maintenance)
│       ├── trash/[type]/[id]/       # Soft-delete restore/purge API — 8 types: announcements,
│       │                            #   marquees, artworks, products, sections, notifications,
│       │                            #   rooms, events
│       ├── analytics/               # Admin-only: re-fetches a Website Analytics snapshot
│       │                            #   for a chosen date range (WebsiteAnalyticsPanel)
│       ├── contact/                 # Contact form submit → email
│       ├── minigames/               # Public: GET / (selector payload), session/ (start a
│       │                            #   round), submit/ (verify + score), leaderboard/
│       │                            #   (read + enter + admin reset), reward/ (claim).
│       │                            #   Admin-only: config/, entries/, claims/
│       ├── sound-effects/           # Public: GET / (every key's playback config).
│       │                            #   Admin-only: config/ (GET list + PUT one key)
│       ├── stories/                 # Tales CRUD API — [id]/, [id]/pages/, [id]/pages/[pageId]/
│       ├── freedom-wall/            # Freedom Wall: notes/ (public create + list), room-status/
│       ├── release-notes/           # Release Notes API — public GET of published notes + admin CRUD
│       ├── openapi.json/            # GET /api/openapi.json — serves the OpenAPI spec
│       │                            #   (admin-only, no CDN cache); consumed by /admin/api-docs
│       ├── upload/model/sign/       # Presigned PUT for browser .glb uploads (see "Image uploads & egress")
│       └── upload/, upload/audio/   # Image + background-music/sound-effect audio upload to R2
├── components/
│   ├── AnimatedFavicon.tsx          # Animated browser-tab favicon (Chrome glow fix)
│   ├── public/                      # Navbar, Footer, CartProvider, ArtworkDetailModal,
│   │                                # FeaturedCarousel, FaqChatbox, AnnouncementPopup,
│   │                                # MarqueeBanner, ProfileSlideshow, CertificatesGallery,
│   │                                # WishlistButton, ShareButton, CursorGlow,
│   │                                # BackgroundMusicPlayer, MaintenancePage, JsonLd,
│   │                                # EventsMap (Timeline/Gigs Google Map, /about — red pins,
│   │                                # pulsing yellow "Next Event" pin, click-to-open modal),
│   │                                # IntroSplash + IntroSplashContent (entrance splash),
│   │                                # PlaySoundEffect (fires a sound-effect key on mount,
│   │                                # for server-component pages), GoToMuseumButton,
│   │                                # ArtworkBadge, VideoIndicator, etc.
│   │   └── minigames/               # MiniGamesLauncher (desktop popover + mobile sheet),
│   │                                # GamePreviewModal, GameSession (owns the mute toggle),
│   │                                # GameResult, GameIcon, ExitConfirmModal (exit-mid-game
│   │                                # warning), Leaderboard, and games/ (one component per game)
│   ├── admin/                       # AdminSidebar (collapsible, custom icon), LiveClock
│   │                                # (+ DashboardCalendar popover, WeatherWidget),
│   │                                # AdminBackToTop, ArtworkVideoUploader,
│   │                                # AdminQueryProvider (TanStack Query client),
│   │                                # NotificationBell (fixed top-right on every admin
│   │                                # page, mounted in app/(admin)/layout.tsx — order/
│   │                                # highscore alerts, unread badge, mark-read, portaled),
│   │                                # GlobalSearch (⌘K/Ctrl+K command palette, also mounted
│   │                                # once in app/(admin)/layout.tsx — searches Artworks,
│   │                                # Products, Orders, Sections, Rooms, Announcements, FAQs,
│   │                                # Timeline Events, plus quick-nav to every admin page),
│   │                                # WebsiteAnalytics (server shell) + WebsiteAnalyticsPanel
│   │                                # (client: date-range filter, stat tiles, lists, devices)
│   │                                # + VisitsAreaChart (hover-tooltip area chart)
│   └── ui/                          # ThemeToggle + ThemeSwitch (the pill, prop-driven so the admin's Header preview shares it), SkeletonCard, OwlIcon, SquidIcon, DynamicIcon (Lucide/Tabler icon gallery)
├── hooks/
│   └── useLockBodyScroll.tsx
├── lib/
│   ├── prisma.ts                    # Prisma client singleton (driver adapter over pg)
│   ├── public-data.ts               # React cache()-wrapped Profile/SocialLink fetchers, shared
│   │                                # by (public) layout + pages so the same request never
│   │                                # re-queries rows a parent Server Component already fetched
│   ├── auth.ts                      # NextAuth config (Credentials + Google + Facebook + JWT +
│   │                                #   Prisma adapter) — TOTP/recovery-code check + new-device
│   │                                #   detection live in the Credentials authorize(); the
│   │                                #   signIn callback gates OAuth to existing admin emails
│   ├── totp.ts                      # TOTP secret/QR/verify + recovery-code generation (otplib
│   │                                #   + qrcode) — backs Settings → Security and login authorize()
│   ├── notifications/               # order.ts, highscore.ts (admin Notification row + email),
│   │                                #   security.ts (email-only account-security alerts) — see
│   │                                #   "Admin Notifications & Login Security" below
│   ├── openapi.ts                   # Full OpenAPI 3.0 spec — all ~130 endpoints, request/response
│   │                                # schemas, two security schemes (sessionAuth cookie + apiKey header)
│   ├── api-auth.ts                  # requireAdmin() guard — session cookie OR x-api-key header (API_SECRET_KEY)
│   ├── marquee.ts                   # Marquee option lists + request sanitiser
│   ├── gallery-carousel.ts          # Mobile gallery carousel modes/speed + sanitisers
│   ├── intro-splash.ts              # Entrance splash effect/speed/text option lists + sanitisers
│   ├── museum-splash.ts             # Digital Museum's per-room entry splash — defaults/sanitisers
│   │                                #   only; reuses lib/intro-splash.ts's transition engine
│   ├── images/corsUrl.ts             # corsImageUrl() — ?cors=1 on every pixel-reading image load so a
│   │                                #   CORS request never hits the browser's CORS-less <img> cache entry
│   │                                #   (R2 omits Access-Control-Allow-Origin without an Origin header)
│   ├── museum/loadDownscaledTexture.ts # Downscales artwork images (and wall/floor/ceiling texture
│   │                                #   uploads) client-side before they become Three.js textures,
│   │                                #   so the museum never uploads a full-res image straight to the GPU
│   ├── museum/useWallFocus.ts       # About room's proximity-hover state (certificate wall) — shared
│   │                                #   hysteresis logic behind AboutRoomContents.tsx's [E] interactions
│   ├── museum/wallClock.ts          # Provisions the Digital Wall Clock scene object — for the About
│   │                                #   room and for whichever room is the visitor's respawn point
│   ├── museum/*Room.ts              # Lazy provisioning + mirror reconciliation for each fixed room:
│   │                                #   aboutRoom, freedomWallRoom, stairsRoom, servicesRoom,
│   │                                #   storiesRoom (the Tales Room), arcadeRoom, cosplayRoom
│   ├── museum/roomBanner.ts         # Room Label Style — the one plaque finish every label in a room reads
│   ├── museum/minimapHud.ts         # Minimap HUD config (size, colours, icons, floor label + spacing)
│   ├── release-notes.ts             # Release Notes categories, limits + sanitisers
│   ├── stories.ts                   # Tales types/labels + continue-reading link validation
│   ├── artwork-video.ts             # Artwork timelapse constants (max duration/file size, allowed
│   │                                #   MIME types) shared by the uploader, trimmer, and upload API
│   ├── artwork-video-upload.ts      # Client-side trim-then-upload flow for artwork video
│   ├── video-trim.ts                # Client-side video trimming (crops anything over 60s before upload)
│   ├── theme.ts                     # Site theme settings (buttons, scrollbar, fonts, cursor glow,
│   │                                #   public/admin background blur-glass intensity) + sanitisers
│   ├── wishlist-store.ts            # Zustand wishlist (persisted, same pattern as cart)
│   ├── share.ts                     # Share-intent URL builders (Facebook/X/Threads)
│   ├── maintenance.ts               # Maintenance-mode defaults + message sanitiser
│   ├── minigames/                   # registry.ts (the one place a game is declared),
│   │                                # types.ts, config.ts (sanitisers), challenge.ts
│   │                                # (server-side puzzle generation), verify.ts (move
│   │                                # replay), scoring.ts, server.ts (Prisma access),
│   │                                # player.ts (signed anonymous cookie), images.ts
│   │                                # (tile slicing via the Next image optimizer),
│   │                                # rate-limit.ts, notify.ts (reward-claim admin email —
│   │                                # separate from lib/notifications/highscore.ts, which
│   │                                # covers rank-1 leaderboard alerts, not reward claims)
│   ├── background-music.ts          # Background music constants + volume/file-type validation
│   ├── sound/                       # registry.ts (every sound-effect key, category + defaults),
│   │                                # types.ts (config shape, presets, sanitisers), engine.ts
│   │                                # (client: AudioContext/upload playback, mute flag, config
│   │                                # cache, playSoundEffect()), server.ts (Prisma access —
│   │                                # merges SoundEffect rows over registry defaults)
│   ├── toast.ts                     # react-hot-toast wrapper — plays a sound on success/error
│   │                                # (and detects deletes) before every existing toast.success()/
│   │                                # toast.error() call site, without editing those call sites
│   ├── site-url.ts                  # Canonical SITE_URL used by metadata/sitemap/JSON-LD
│   ├── vercel-analytics.ts          # Server-only Vercel Web Analytics API client (visits/
│   │                                # count + visits/aggregate), safe-empty on missing
│   │                                # config or API failure — feeds WebsiteAnalytics.tsx
│   ├── storage/                     # Cloudflare R2: r2.ts (S3 adapter), server.ts (uploads), browser.ts (presigned PUT)
│   ├── mail.ts                      # Nodemailer (Gmail SMTP) — password reset, order
│   │                                #   confirmation/alert, and generic sendMail() used by
│   │                                #   lib/notifications/*
│   ├── social-icons.tsx             # Social platform icon map
│   ├── toast-config.ts              # Shared react-hot-toast style/position config
│   ├── tabler-icon-imports.generated.ts # Generated Tabler icon map (see scripts/ below) — do not hand-edit
│   ├── utils.ts                     # Formatting helpers
│   ├── cart-store.ts                # Zustand cart (V2)
│   └── paymongo.ts                  # PayMongo client (V2) — configurable payment_method_types
│                                    #   via PAYMONGO_PAYMENT_METHODS (see .env.example)
├── emails/                          # React-email templates rendered by lib/mail.ts —
│   │                                #   PasswordReset, OrderConfirmation, NewOrderAlert,
│   │                                #   HighscoreAlert, RewardAlert, RewardClaimed, all sharing
│   │                                #   components/EmailLayout.tsx (+ DetailsTable,
│   │                                #   OrderItemsTable) for one consistent brand look.
│   │                                #   preview-data.ts feeds `npm run email` (react-email's
│   │                                #   local preview server, port 3010) with sample props
├── prisma/
│   ├── schema.prisma                # Database schema — incl. Notification (admin-only order/
│   │                                #   highscore/Gmail alerts, soft-deletable + spam-flaggable),
│   │                                #   BlockedEmail (contact-form sender blocklist), User's
│   │                                #   TOTP/login-fingerprint fields, and DigitalMuseum/
│   │                                #   MuseumRoom/MuseumRoomArtwork/MuseumSceneObject and the
│   │                                #   mirror joins MuseumRoomCosplay/Story/MiniGame, plus
│   │                                #   Cosplay and Story/StoryPage (see "Digital Museum" above)
│   └── seed.ts                      # Seed data (admin user + sample artworks)
├── types/
│   └── index.ts                     # Shared TypeScript types
├── scripts/
│   ├── backfill-artwork-slugs.ts    # One-off: populate slug for pre-existing artworks
│   ├── backfill-image-variants.ts   # One-off: generate .m/.t webp variants for pre-compression uploads
│   ├── migrate-media-to-r2.ts       # One-off: the Supabase Storage → R2 move (see Docs/Media_Storage_R2.md)
│   ├── rewrite-media-urls.ts        # One-off: repoint stored URLs at R2_PUBLIC_URL
│   ├── create-release-note.ts       # `yarn release-note` — files a draft Release Note straight to the DB
│   ├── security-check.ts            # Verifies the RLS/grants posture (see Docs/System_Security.md)
│   └── generate-tabler-icon-map.mjs # Regenerates lib/tabler-icon-imports.generated.ts
├── Docs/
│   ├── PayMongo_Setup.md            # Live-mode PayMongo setup (GCash/Card/QR Ph + activating more methods)
│   ├── OAuth2_Setup.md              # Google/Facebook admin OAuth setup (Cloud/Meta app + env vars)
│   ├── System_Security.md           # RLS/grants/Storage posture, threat model, verification playbook
│   ├── Media_Storage_R2.md          # Cloudflare R2: bucket layout, CORS policy, cache headers, migration log
│   ├── Museum_SceneEditor.md        # Museum Scene Editor spec (placements, props, colliders)
│   ├── Museum_AssetOptimization.md  # .glb Draco/Meshopt + KTX2 pipeline, image variants
│   ├── Museum_VRMode.md             # VR mode phases (WebXR rig, HUD, Flip view)
│   ├── Museum_SecondFloorStairs.md  # Second Floor + Stairs connector spec
│   ├── Museum_StoriesRoom.md        # Tales Room (podiums mirroring the published library)
│   ├── Museum_CosplayRoom.md        # Cosplay Room (standees, billboard lights)
│   ├── Museum_MiniGames.md          # Arcade Room + mini games
│   ├── Admin_StoriesModule.md       # Tales module admin spec
│   ├── Progress_Timeline.md         # Dated implementation timeline & patch notes
│   └── User_Training.md             # Admin training guide (Sections/Artworks logic, login/2FA, etc.)
├── app/sitemap.ts, app/robots.ts    # SEO — /sitemap.xml and /robots.txt (App Router conventions)
├── app/opengraph-image.tsx          # Site-wide 1200x630 social share card (generated, static)
├── auth.config.ts                   # Shared NextAuth edge-safe config (used by middleware)
├── middleware.ts                    # Admin route protection (/admin/*, /login)
└── prisma.config.ts                 # Prisma CLI config (DIRECT_URL for migrations)
```

---

## API Documentation

The admin panel ships with an interactive OpenAPI 3.0 reference at **`/admin/api-docs`** — all ~130 endpoints across every module, with "Try it out" for live requests directly from the browser.

The spec is defined as a single TypeScript object in [`lib/openapi.ts`](lib/openapi.ts) (manually maintained — not JSDoc-generated), served by `GET /api/openapi.json` (admin-only), and rendered by `swagger-ui-react`.

### Authentication in Swagger UI

All admin endpoints accept two auth methods — pick whichever fits your workflow:

| Method                 | How it works                                                                                                                                                                  |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Session cookie**     | Log in to `/admin` in the same browser tab; Swagger UI includes the cookie automatically. No extra setup.                                                                     |
| **`x-api-key` header** | Set `API_SECRET_KEY` in your env, generate a key, click **Authorize** in the Swagger UI and paste it. Useful for scripts, CI pipelines, or testing outside a browser session. |

### Generating and using an API key

```bash
# 1. Generate a strong key
openssl rand -hex 32

# 2. Add to .env.local
API_SECRET_KEY=<paste the key here>

# 3. Open the Swagger UI
http://localhost:3000/admin/api-docs

# 4. Click the "Authorize 🔒" button at the top right
#    → paste the key into the "apiKey (apiKey)" field → Authorize
#    Every "Try it out → Execute" request will now include x-api-key automatically.
```

The key can also be sent directly from any HTTP client:

```bash
curl -H "x-api-key: YOUR_KEY" https://your-domain.vercel.app/api/artworks
```

Leave `API_SECRET_KEY` unset (or empty) to disable key-based auth entirely — the session cookie path still works.

> **Maintaining the spec:** Every time you add or modify an API route, update the corresponding entry in [`lib/openapi.ts`](lib/openapi.ts). The Swagger UI reflects whatever is in that file — a new endpoint that isn't in the spec won't appear there.

---

## Deployment (Vercel)

1. Push to GitHub and import at [vercel.com](https://vercel.com)
2. Set these environment variables in Vercel project settings:

| Variable                                                                  | Scope                    | Description                                                                                |
| ------------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------ |
| `DATABASE_URL`                                                            | Server                   | Supabase pooler connection string                                                          |
| `DIRECT_URL`                                                              | Server                   | Supabase direct connection string                                                          |
| `NEXTAUTH_SECRET`                                                         | Server                   | `openssl rand -base64 32`                                                                  |
| `NEXTAUTH_URL`                                                            | Server                   | `https://your-domain.vercel.app`                                                           |
| `NEXT_PUBLIC_APP_URL`                                                     | Public                   | `https://your-domain.vercel.app`                                                           |
| `R2_ACCOUNT_ID`                                                           | Server                   | Cloudflare account id (32 hex chars) — see [Cloudflare R2](#cloudflare-r2-media-storage) below |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`                               | Server                   | R2 API token pair, *Object Read & Write*, scoped to the one bucket                         |
| `R2_BUCKET`                                                               | Server                   | The bucket name                                                                            |
| `R2_PUBLIC_URL`                                                           | Server                   | The bucket's public origin — custom domain or its `*.r2.dev` Public Development URL        |
| `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` / `RECAPTCHA_SECRET_KEY`                 | Public / Server          | Contact form (optional)                                                                    |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` or `RESEND_API_KEY`                   | Server                   | Contact form email delivery (optional)                                                     |
| `MINIGAME_NOTIFY_EMAIL`                                                   | Server                   | Where mini-game reward alerts go (optional)                                                |
| `PAYMONGO_SECRET_KEY` / `PAYMONGO_PUBLIC_KEY` / `PAYMONGO_WEBHOOK_SECRET` | Server / Public / Server | Only needed for V2 Shop/Checkout                                                           |
| `VERCEL_ANALYTICS_TOKEN` / `VERCEL_PROJECT_ID` / `VERCEL_TEAM_ID`         | Server                   | Only needed for the admin dashboard's "Website Analytics" section (optional) — see below   |
| `API_SECRET_KEY`                                                          | Server                   | Static API key for `x-api-key` header auth. Leave unset to disable. `openssl rand -hex 32` |

> **Paste values without the surrounding quotes.** `.env` wraps values in `"..."` for the local dotenv parser, but Vercel stores whatever you paste literally. A quoted `DATABASE_URL` parses as "no host", and `pg` then silently connects to `127.0.0.1:5432` — the site 500s on every page with `Can't reach database server at 127.0.0.1:5432` even though the variable *looks* set. `lib/prisma.ts` now strips stray quotes and throws `DATABASE_URL is not set` if the value is empty, so the failure is at least named. Setting from the CLI avoids the copy/paste entirely: `printf '%s' "$VALUE" | vercel env add DATABASE_URL production --sensitive --force`.

3. After first deploy, push the schema: `npx prisma db push` / `yarn prisma db push`
4. Apply the RLS SQL from [Supabase Row-Level Security](#supabase-row-level-security-rls) above in the Supabase SQL Editor.
5. Set up the R2 bucket below — the deploy boots without it, but every upload and every museum texture fails until it exists.

The build script runs `prisma generate` automatically before `next build`.

> Supabase is **Postgres only** in production. `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are no longer read by the app — only by the one-off migration scripts under `scripts/` — so they don't need to be on Vercel.

### Cloudflare R2 (media storage)

Every upload — artwork images and their resized variants, wall/floor/ceiling textures, `.glb` props, audio — lives in one R2 bucket, and R2 is the **only** copy (the `originals/` prefix holds the masters). The full story, layout and migration log is in [`Docs/Media_Storage_R2.md`](Docs/Media_Storage_R2.md); this is what production needs from it.

In the Cloudflare Dashboard → **R2**:

1. **Create bucket** — the name goes in `R2_BUCKET`. Location hint **APAC** so it sits next to the `sin1` function region above.
2. **Settings → Public access** — connect a custom domain (preferred; it gets Cloudflare's CDN cache in front) or enable the **Public Development URL**. Whichever you use is `R2_PUBLIC_URL`, and it is baked into every stored media URL, so pick it before the first upload.
3. **Settings → CORS Policy** — required. Without it the museum's WebGL textures fail to load and the browser's direct `.glb`/audio uploads (presigned PUT, see [Image uploads & egress](#image-uploads--egress)) are refused. Paste the policy from [`Docs/Media_Storage_R2.md` › CORS](Docs/Media_Storage_R2.md#cors); it must list the production origin *and* any preview origin you test from.
4. **Manage R2 API Tokens → Create** — *Object Read & Write*, scoped to this bucket only. That pair is `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`; the account id on the same screen is `R2_ACCOUNT_ID`.
5. Redeploy after adding the variables — they're read at request time, but Vercel only injects new env on the next build.

Two production behaviours worth knowing:

- **Cache** — objects are written with `Cache-Control: public, max-age=31536000, immutable`, and every upload gets a fresh key, so nothing is ever overwritten in place and a CDN never serves a stale file.
- **CORS cache split** — pixel-reading loads (textures, canvas captures) go through `corsImageUrl()` (`?cors=1`) so the browser never reuses a CORS-less `<img>` cache entry for a CORS fetch. If a texture ever loads on the public site but not in the Scene Editor, or vice versa, that split is the first thing to check.

### Function region — keep it next to the database

`vercel.json` pins Serverless Functions to **`sin1`** (Singapore):

```json
{ "regions": ["sin1"] }
```

This is not a preference — it's the single biggest lever on page speed here, and it has to match wherever `DATABASE_URL` lives (currently `aws-0-ap-southeast-1`, Singapore).

Vercel defaults new projects to `iad1` (Washington DC). Left at that default, every request landed at the Singapore edge, was handed to a function in **US East**, and that function then made each of its database queries back across the Pacific to **Singapore** — roughly 200 ms of pure latency per round trip, paid again for every query. A page doing one query barely noticed; `/gallery/museum`, which runs ~20 of them before it can render, measured **14–16 s TTFB** against ~2 s for the homepage.

If you ever move the Supabase project to another region, change this value in the same commit. A mismatch is silent — nothing errors, pages just get slow in a way that looks like a code problem.

> Region codes: `sin1` Singapore · `hnd1` Tokyo · `syd1` Sydney · `iad1` US East · `fra1` Frankfurt. Hobby projects may pin exactly one.

### Cloudflare in front of the site — not needed

R2 is the only Cloudflare product in use. Putting the *site* behind Cloudflare (proxy/WAF) isn't:

- Vercel already covers CDN, SSL and baseline DDoS protection — the things a Cloudflare proxy would otherwise add.
- PayMongo doesn't create a WAF requirement: checkout happens on PayMongo's hosted page, so the site never holds card data.

---

## Website Analytics (Vercel Web Analytics)

The admin dashboard has a **Website Analytics** tab (next to Overview, `app/(admin)/admin/dashboard/DashboardTabs.tsx`) showing storefront visitor stats — visitors, page views, pages/visit, an area chart of visits over time, top pages, top traffic sources, and a device breakdown — sourced from Vercel's own **Web Analytics** product, not a third-party service. A 7D/14D/30D/90D date-range filter at the top of the tab drives every widget at once. It's entirely optional: with nothing configured, the tab just shows a "Connect Vercel Analytics" prompt instead of breaking the dashboard.

Two independent pieces make it work — **tracking** (the public site collecting the data) and **reading** (the admin dashboard querying it back). Both are required for the section to show real numbers.

### 1. Turn on tracking

1. In the [Vercel dashboard](https://vercel.com/dashboard), open this project.
2. Go to the **Analytics** tab and click **Enable**.
3. Deploy (or redeploy) the app. The `<Analytics />` component from `@vercel/analytics/next` is already wired into [`app/(public)/layout.tsx`](<app/(public)/layout.tsx>) — and **only** that layout, so pageviews are collected for the public storefront but never for `/admin/*` sessions. No further code changes are needed for tracking itself.
4. Visit the live public site a few times to generate some data — a brand-new project has nothing to show yet.

### 2. Let the dashboard read it back

1. **Token** — [Vercel Account Settings → Tokens](https://vercel.com/account/tokens) → Create Token. A token scoped to this project (read access is enough) is fine.
2. **Project ID** — this project's **Settings → General** tab in Vercel, under "Project ID."
3. **Team ID** — only if this project lives under a Vercel team, not a personal account. Also found under **Settings → General**. Leave it blank for a personal account.
4. Set the three as environment variables — locally in `.env`/`.env.local`, and in **Vercel → Project Settings → Environment Variables** for the deployed site:
   ```env
   VERCEL_ANALYTICS_TOKEN="..."
   VERCEL_PROJECT_ID="prj_..."
   VERCEL_TEAM_ID=""   # omit/leave blank for a personal account
   ```
5. Redeploy (or restart `yarn dev` locally) so the new env vars are picked up.
6. Open **Admin → Dashboard** — the Website Analytics section should now show real numbers instead of the "Connect Vercel Analytics" prompt.

> Numbers can take a short while to show up after step 1 (Vercel needs a little time to start collecting), and the dashboard caches what it reads for 15 minutes ([`lib/vercel-analytics.ts`](lib/vercel-analytics.ts) uses `next: { revalidate: 900 }`) — a refresh a minute after enabling analytics won't yet show anything, that's expected.

### Troubleshooting

- **Section still shows "Connect Vercel Analytics"** → `VERCEL_ANALYTICS_TOKEN` or `VERCEL_PROJECT_ID` isn't set in whichever environment you're looking at (local vs. deployed are separate). Double-check both are set there.
- **Configured but every widget says "No analytics data yet."** → Either Web Analytics isn't actually enabled in the Vercel dashboard's Analytics tab (step 1.2 above), or the site simply hasn't had any visits yet in the selected window. This is also exactly what you'll see for the first 15 minutes after enabling — see the caching note above.
- **Numbers look stale after a burst of traffic** → Expected — see the 15-minute cache note above. This is dashboard reporting, not a live counter.

---

## Available Scripts

```bash
npm run dev / yarn dev                   # Start dev server
npm run build / yarn build               # Build for production (includes prisma generate)
npm run start / yarn start               # Start production server
npm run lint / yarn lint                 # Run ESLint
npm run format / yarn format             # Format with Prettier
npm run format:check / yarn format:check # Report formatting drift without writing

npm run db:generate / yarn db:generate   # Generate Prisma client
npm run db:push / yarn db:push           # Push schema to DB (development)
npm run db:migrate / yarn db:migrate     # Run migrations (production)
npm run db:studio / yarn db:studio       # Open Prisma Studio
npm run db:seed / yarn db:seed           # Seed sample data + admin user
npm run db:reset / yarn db:reset         # DESTRUCTIVE: db push --force-reset, then re-seed

npm run email / yarn email               # Local preview server for the email templates (port 3010)
```

---

## Development Workflow

The standing process for shipping a change to this repo. Saying **"Ship It!"** or **"Push It!"** means run all six steps below, now.

### 1. Pre-push checks

Run all three, in order, and fix every **new** error before committing:

```bash
npx tsc --noEmit    # TypeScript
yarn next lint      # ESLint
yarn build          # Production build
```

Vercel's build pipeline fails on ESLint errors that `tsc` alone won't catch (e.g. `react/no-unescaped-entities`), so a clean typecheck is not enough — a push that skips `lint` can still produce a broken deployment.

Pre-existing `<img>` warnings in `AdminSidebar.tsx`, `AnnouncementPopup.tsx` and `Navbar.tsx` are accepted noise. Errors never are.

### 2. Update the docs

Reflect the change in all three, following each file's existing structure rather than restructuring it:

- `README.md`
- `Docs/User_Training.md`
- `Docs/Progress_Timeline.md`

> ⚠️ The folder is tracked as **`Docs/`** with a capital D. macOS's filesystem is case-insensitive, so editing `docs/User_Training.md` writes the right file — but `git add docs/User_Training.md` matches no tracked path and the edit is **silently left unstaged**. The commit then goes through without the doc changes. Always stage these as `Docs/...`, and re-check `git status` afterwards.

### 3. Branch

```bash
git checkout -b <short-kebab-name>-<MMDDYY>    # e.g. arcade-room-090226
```

### 4. Commit

Stage **explicit paths**, never `git add -A`:

```bash
git add app/some-file.tsx Docs/Progress_Timeline.md
git commit    # summary line + a body explaining what changed and why
```

> ⚠️ Multiple Claude sessions often run against this repo at once, and they commit with `git add -A` — which sweeps another session's uncommitted work-in-progress into your commit. Before committing, check `git status` and `git log --oneline origin/main..HEAD`; a parallel session may already have pushed, or swept your edits into their commit. Commit your own work promptly once it builds rather than leaving large WIP sitting across turns.

### 5. Merge to `main`

```bash
git checkout main
git fetch origin && git rebase origin/main    # parallel sessions may have pushed
git merge --no-ff <branch>
```

### 6. Push

```bash
git push origin main
```

### Standing rules

| Rule                                    | Detail                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Swagger stays in sync**               | Adding or changing an API route means updating `openApiSpec.paths` in `lib/openapi.ts` — the spec is hand-written, not generated. Admin-only endpoints need `security: adminSecurity`; public ones omit it. An endpoint missing from the spec never appears in `/admin/api-docs`.                                                                                                                                                                                                                                           |
| **`db:push` hits production**           | `DATABASE_URL` points at the hosted Supabase Postgres. There is no local dev database and no `prisma/migrations/`, so `yarn db:push` alters the **live** schema with no staging buffer. Confirm before running it. Adding a nullable column is safe; dropping or retyping one is not. `yarn prisma generate` is local-only and safe to run freely.                                                                                                                                                                          |
| **`.claude/settings.json` rides along** | It's tracked, and grows each session from "don't ask again" permission approvals. Commit the churn as-is — as part of the work, or as a lone `chore:` commit. No pruning needed.                                                                                                                                                                                                                                                                                                                                            |
| **Modals lock the background**          | Any `fixed inset-0` overlay must call `useLockBodyScroll(isOpen)` from `hooks/useLockBodyScroll.tsx`. Without it a wheel or touch scroll started on the overlay falls through to the page behind, and the site slides around underneath a dialog that stays put. The hook is reference-counted, so nested modals are safe.                                                                                                                                                                                                  |
| **Reuse the shared form primitives**    | Never a bare `<select>` or `<input type="date">`: browsers draw their own caret and their own calendar, each one different and each one cramped against the field's border. Use `AdminSelect` and `AdminDatePicker` from `components/admin/`. `AdminDatePicker` keeps the native value formats (`YYYY-MM-DD`, or `YYYY-MM-DDTHH:mm` with `withTime`), so swapping a native input for it needs no other change. Its month grid is `CalendarPanel`, shared with the sidebar's `DashboardCalendar` — one calendar, everywhere. |

### Claude Code's memory (`MEMORY.md`)

Claude keeps a small file-based memory outside the repo, loaded at the start of
every session. It is for the things that are **not** derivable from the code, the
git history or this README — mostly _how the user wants work done_.

**Write a memory when:**

- The user corrects an approach, or confirms one, and the reason would not be
  obvious to the next session ("always run the pre-push checks", "commit
  explicit paths, never `git add -A`").
- A standing UI or code convention is established that a fresh session would
  otherwise re-invent inconsistently — the two rows added to the table above
  each have a matching memory.
- Something about the environment is true but invisible ("`db:push` targets the
  live Supabase database").

**Don't write a memory for:** anything the repo already records — file layout,
what a component does, a bug that was fixed, or a rule already written down
here. Point at the README instead; a memory that duplicates it will drift.

One fact per file, kebab-case name, plus a one-line pointer in `MEMORY.md`
itself — that index is what gets loaded, so memory bodies never belong in it.
For a convention, say **why** it exists and **how to apply it**, so the rule
survives the next time the situation looks slightly different.

---

## Customization

### Colors (`tailwind.config.ts`)

```
ink        → #0D0D0D  (primary dark / dark mode background, 50–900 scale)
cream      → #FAF8F3  (light mode background)
sepia      → #C8A96E  (accent gold, light #E8D5A8 / dark #8B6E3A)
vermillion → #D94F38  (alerts, sold badge, delete)
```

### Fonts

- **Display:** Cormorant Garamond (headings, italics)
- **Body:** DM Sans (UI text)
- **Mono:** DM Mono (prices, codes)
- **Grotesk/Jakarta:** Space Grotesk, Plus Jakarta Sans (used in select admin/marketing UI)

> The marquee's **Anime Ace** and **BadaBoom** options are the only self-hosted faces — they load from `public/fonts/*.ttf` via `@font-face` in `app/globals.css`. If those files are missing from a deploy, those two options silently fall back; every other option comes from Google Fonts.

### Marquee ticker options (`lib/marquee.ts`)

The admin dropdowns are driven entirely by the option lists in `lib/marquee.ts` — add an entry there and it appears in the form, the sanitiser's allow-list, and the public bar at once:

```ts
MARQUEE_FONTS; // { label, css } — raw CSS font-family stacks
MARQUEE_SIZES; // { label, css } — rem values
MARQUEE_SPEEDS; // { label, value } — seconds per loop; lower is faster
SEPARATORS; // glyphs between repetitions
MARQUEE_CATEGORIES; // suggested sections (admins may still type their own)
```

Two constraints worth knowing before editing:

- **Colours and fonts are applied inline**, so `sanitizeMarquee()` accepts only values present in these lists (plus `#rrggbb` for colours). Anything else falls back to a default — a value that "won't save" is almost always one missing from its list.
- **`lib/` is outside Tailwind's `content` globs.** Every value here must be raw CSS, never a class name, or purge will strip it.

Motion lives in the `.marquee-*` rules in `app/globals.css`. The track holds two identical halves and translates `-50%`, which is what makes the loop seamless — changing that percentage or the number of halves will visibly break the seam.

---

## Version 2 Roadmap

Shop, cart, checkout, and PayMongo payment integration code exists in the codebase but is not yet production-ready. See the `shop/`, `cart/`, `checkout/`, `order/` pages, `app/api/checkout`, `app/api/webhooks/paymongo`, and `lib/paymongo.ts`.

V2 requires: PayMongo API keys, webhook configuration, payment flow testing, and email integration for order confirmations.

---

## License

Licensed under the [Apache License, Version 2.0](LICENSE). You may use, modify,
and redistribute the code — including commercially — provided you retain the
copyright and license notices and state any significant changes you make. The
code is provided "as is", without warranty of any kind.

Copyright 2026 Ryan Briz / Horyezon Indie Solutions.

### Trademarks and branding

The names **"ScriptOverNovel"**, **"scriptovernovel.music"**, and **"Horyezon Indie Solutions"**,
the ScriptOverNovel logo, and all associated visual identity and branding assets are
**not** covered by the Apache License and are **all rights reserved**. Any fork,
mirror, or derivative work must use a different name and branding and must not
imply endorsement by or affiliation with the original project or its authors.
See [`NOTICE`](NOTICE) for details.
