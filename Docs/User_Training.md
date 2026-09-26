# ScriptOverNovel Admin Dashboard — User Training Guide

A practical, click-by-click walkthrough of every module in the Admin Dashboard, written for whoever manages the site day-to-day (no coding knowledge required). If you're the owner running this site yourself, this is your manual.

> 💡 **Not sure what something technical means?** Every module below has a short "What this is for" blurb before the steps, plus a **Glossary** at the end covering easily-confused terms.

---

## Table of Contents

1. [Logging In](#1-logging-in)
2. [Header (Preferences)](#2-header-preferences)
3. [Menu animation (Preferences)](#3-menu-animation-preferences)
4. [Preferences — Site Background Effects](#4-preferences--site-background-effects)
5. [Releases (Music page)](#5-releases-music-page)
6. [Videos](#6-videos)
7. [About & Band Members](#7-about--band-members) (incl. [Shows](#73-shows))
8. [Store (Products)](#8-store-products)
9. [Mini Games](#9-mini-games)
10. [Museum Pieces (Digital Museum)](#10-museum-pieces-digital-museum)
11. [Vinyl Room (Digital Museum)](#11-vinyl-room-digital-museum)
12. [Homepage](#12-homepage)
13. [Mailing list](#13-mailing-list)
14. [Picking dates anywhere in the admin](#14-picking-dates-anywhere-in-the-admin)
15. [Glossary — Confusing Terms Explained](#15-glossary--confusing-terms-explained)
16. [Quick Troubleshooting](#16-quick-troubleshooting)

_(Add one numbered entry per module as it ships — sub-sections go in parentheses after the link, e.g. `(incl. [Sales Dashboard](#71-sales-dashboard))`.)_

---

## 1. Logging In

- Go to **`/login`** on your site (e.g. `https://yourdomain.com/login`).
- Log in with your admin email + password.
- There is **no public sign-up** — admin accounts can only be created by someone with database access (see `README.md` → "Creating the First Admin User" for the technical steps).
- Only accounts with the `ADMIN` role can access anything under `/admin/*`.

---

## 2. Header (Preferences)

> 📍 **Where it lives now:** **Settings → Preferences**, the first three tabs — **Header · Menu · Homepage Hero** — ahead of **Branding**. These used to be a separate **Site Design** page in the sidebar; that entry is gone, and old links and bookmarks to it land on the right tab automatically. The three tabs share one **Save**: you can recolour the header, switch to Menu, change a link, and save both together.

**What this is for:** the bar pinned to the top of every public page — search on the left, your wordmark in the middle, the **MENU** button and the light/dark switch on the right. It's frosted glass: the page shows through it, blurred, and it thickens slightly once a visitor scrolls.

### 2.1 Colours

1. **Preferences → Header → Colours & label.**
2. **Background** tints the glass. Pick something close to your page colour for a subtle bar, or a contrasting one for a visible band. The colour is applied at glass opacity, so it will always read a little lighter/softer than the swatch.
3. **Text & icons** colours the wordmark, the search icon and MENU.
4. **Save**. The live preview above the controls shows the bar as it looks in light mode — **press the sun/moon switch inside the preview** to see it the way a dark-mode visitor does. That switch only changes the preview, never your own admin theme.

> 💡 These two colours only apply while a visitor is in **light** mode. In **dark** mode (the default for new visitors) the bar switches to the site's near-black glass with cream text, whatever you picked — so you never have to check your colours twice.

### 2.2 Menu items

**Preferences → Menu → Links.** The band site's pages are **Music, Store (/shop), Videos, About, Contact**. If your menu still shows the older Gallery / Tales rows, retitle and re-point them here — the labels and links are yours to edit.

> 💡 The header wordmark (Preferences → Header → Wordmark) is also what the footer and the entrance splash show — one place to change the band's name or logo.

### 2.2a One logo for the whole site

The **Logo image** under **Header → Wordmark** is now the site's *only* logo upload. **Branding** used to have a separate **Navbar Logo** tile; it's been removed because it did the same job. Everything that used to show that Branding logo now shows the Header one:

- the admin sidebar and the login page
- order receipts and every email the site sends (password reset, order confirmations, mini-game alerts)
- the museum's About plaque, and the 📸 watermark on museum screenshots (stamped bottom-right, on a phone as well as a desktop)

> If you had uploaded *different* pictures in the two places, those spots switch to the Header one the moment this update is live. The old Branding picture is kept only as a backup — it's used if the Header logo is ever removed.

> **The footer is always lettered.** It spells the **Wordmark text** out — *script (◎)ver novel*, with your footer icon standing in for the O — and ignores the uploaded logo image on purpose. Uploading a logo used to replace the footer wordmark with the picture, which erased the only place on the site the band's name was actually written. Change the words under Preferences → Header → Wordmark; the icon is Preferences → Branding → Footer Icon.

### 2.3 Wordmark text size

**Preferences → Header → Wordmark → Fallback size** is a slider (1–4rem; the readout also shows pixels). It sizes the text wordmark shown when no logo image is uploaded. Phones automatically cap it so it can't crowd the MENU button.

### 2.4 The light/dark switch

The sun/moon pill to the right of **MENU** is always on — there's no setting to hide it. The site starts in dark mode for a first-time visitor, and the pill is how they get to light mode; their choice is remembered on that device.

---

## 3. Menu animation (Preferences)

**What this is for:** how the full-screen menu arrives when a visitor presses **MENU**, how it leaves when they press ×, and how the links inside it appear.

### 3.1 Picking the effects

1. **Preferences → Menu → Open & close animation.**
2. **Open effect** — pick a card. *Split — meet in the middle* slides the colour panel in from the left and the photo in from the right so they meet at the centre.
3. **Close effect** — its own card; *Split — part to the edges* is the matching exit.
4. **Link entrance** — how the words (Music, Store, …) appear once the sheet has landed. *Rise one by one* fades each link up in turn; *Rise together* lifts them all at once.
5. Each has its own speed slider. **Save**.

> 💡 The preview at the top of the tab replays automatically whenever you change an effect or a speed — or press **Play open** / **Play close**. The link entrance only starts once the sheet has fully arrived, on the live site and in the preview alike.

### 3.2 Working with the preview

The preview card **stays on screen** while you scroll the controls under it, so recolouring a link or uploading its photo no longer means scrolling back up to see what it did. On a wide desktop the controls move to the left and the preview sits beside them.

- **Play loop** — keeps cycling close → open until you press **Stop loop**. Use it to judge an effect without pressing a button between every take.
- **Backdrop brightness** — the menu opens over your live site, which is usually light, while the preview frame is dark. Slide this towards white to check a pale panel or a light underline the way a visitor will actually see it. It only moves the preview's stand-in backdrop — nothing here is saved.

---

## 4. Preferences — Site Background Effects

**What this is for:** the photo behind every public page (uploaded under **Preferences → Branding → Site Background Image**) can move. Off ("Still") until you switch it on.

### 4.1 Choosing an effect

1. **Preferences → Branding → Site Background Effects.**
2. Pick a card:
   - **Still** — no motion.
   - **Slow Zoom** — a gentle push in and back out, looping.
   - **Drift** — a slow pan across the photo and back.
   - **Breathe** — the photo's brightness swells and fades.
   - **Parallax** — the photo moves with the page as the visitor scrolls, a little slower than the content.
3. **Speed** sets how long one loop takes (Slow / Normal / Fast, or drag). Parallax has no speed — it follows the visitor's scrolling.
4. Check the **Preview** (press **Replay** to restart it; for Parallax, scroll the preview box itself).
5. **Save Branding** at the bottom of the tab.

> 💡 Slower reads as calmer — the photo is on screen the whole visit. Visitors who have turned on *reduce motion* on their device always get the still photo, whatever you pick here.

---

## 5. Releases (Music page)

**What this is for:** everything on the public **Music** page — singles, EPs, albums — and the release that fronts the homepage.

### 5.1 Adding a release

1. **Releases → + New release.**
2. Upload the **Cover** (square works best — it's also the blurred backdrop of the homepage hero).
3. **Title**, **Type** (Single / EP / Album / Live / Compilation), **Release date** (optional), a short **Description** (the first line becomes the hero's subtitle).
4. **Where it streams** — paste the release's link on Spotify, Bandcamp, YouTube, SoundCloud and/or Apple Music. Under each box it tells you whether that link gives visitors an embedded player or just a link. **Player shown on the site** picks which one plays on the page; the rest become "Listen on" pills.
5. **Tracklist** — one row per track: title, duration (`3:42`), an optional link, and **+ Add lyrics** (visitors can fold lyrics open under the track).
6. **Add release**.

> 💡 **Bandcamp:** a normal release-page URL is link-only. For a Bandcamp player, open the release on Bandcamp → Share / Embed → copy the *EmbeddedPlayer* URL and paste that instead.

### 5.2 Featured, hidden, order

- **★ Featured** — that release fronts the homepage ("Out now"). Un-star it and the newest published release takes over.
- **Published / Hidden** pill — hidden releases are off the site but stay in the admin.
- ↑ ↓ arrows set the order used when two releases share a date (or have none).
- 🗑 moves it to **Trash** (Trash → Music) where it can be restored.

### 5.3 Every release now has its own page

Each release has its own address — **`/music/paralysismo`**, for example — shown at the bottom of the edit form. **This is the link to post** when a record comes out: it opens on that release alone, and when it's pasted into Messenger, Facebook or Discord the preview shows *that* cover and title. The old `/music#…` link showed the whole discography with one shared preview image.

The release page is built from what you've already filled in, plus:

- **Videos** — any video whose **Release** field points at this record shows up under "Videos for …". Set that field when adding a video (section 6).
- **On vinyl** — if the record has a vinyl in the Vinyl Room, the page links into the museum.
- **More releases** — the rest of the discography, automatically.

Nothing extra to fill in, and nothing to switch on. The **Music** page still lists everything; each title there now links through to its own page.

---

## 6. Videos

**What this is for:** the public **Videos** page and the Videos strip on the homepage. Only YouTube — paste the link, the site does the rest.

### 6.1 Adding a video

1. **Videos → + New video.**
2. Paste the **YouTube link** (a `watch?v=`, `youtu.be` or `shorts` link). The thumbnail appears under the box when the link is good.
3. **Title**, **Kind** (Music video / Live / Behind the scenes), optionally the **Release** it belongs to, and a short note.
4. **Add video**.

### 6.2 Featured, hidden, order

- **★ Featured** videos lead the homepage strip and the Videos page (and the hero's WATCH button jumps to the featured release's video when there is one).
- **Published / Hidden** pill, ↑ ↓ ordering and 🗑 Trash work exactly as for Releases.

> 💡 Visitors see a still frame first; YouTube's player only loads when they press play — pages stay fast and nothing from YouTube runs until then.

---

## 7. About & Band Members

**What this is for:** the public **About** page — the band's story, who's in it, photos, and every show you've played (with the map).

### 7.1 The band's story (About)

**About** (sidebar → Band) is the old profile form with band labels: **Band Name**, **Tagline** (the line under the name on About and the homepage hero), **Bio** (paragraphs separated by a blank line), **Based in**, **Playing since**, **Email** (shown as "Booking & press"). **Genres / Tags** are the chips under the bio *and* the genre line on the homepage hero. **Band Photos** (Media tab, up to 5) are the photo grid on About — the first one is also the About hero backdrop.

### 7.2 Members

1. **Band Members → Add member.**
2. Upload a **Photo** (portrait), **Name**, **Role** (what they play), an optional **Blurb**.
3. **Add member**. Drag order with ↑ ↓; **Shown / Hidden** pill; 🗑 to Trash (Trash → Band).

### 7.3 Shows

Gigs now have their own page, **/shows**, linked from the menu bar. About keeps the next few with an **All shows** link; the full archive, the ticket buttons and the map live on the new page. The next three upcoming also still appear on the homepage.

**Adding a show** — sidebar → **Shows / Events** → **Add Event**:

1. **Title** — what the night is called ("Shoegaze Night Vol. 4"), not the venue.
2. **Venue Name** and **City** — both show on the row, as "Mow's Bar · Quezon City".
3. **Date & set time** — pick the day, then the time you actually go on. **Leave it blank for a show that isn't dated yet** — it still lists, under upcoming, with **TBA** where the date block goes.
4. **Status** — leave on **Scheduled** for a normal show. **Sold out** keeps the row but drops the Tickets button. **Cancelled** and **Postponed** strike the title through and move it out of the upcoming list, but the show *stays on the page* — someone who already bought a ticket has to be able to find out what happened.
5. **Ticket Link** — the full `https://…` address where tickets are sold. This is what the **Tickets** button opens, and it only appears when there's a link.
6. **Price** and **Price Note** — type a number for the price pill (₱250). The note wins when both are filled, so use it for anything a number can't say: "Free entry", "₱250 at the door", "₱200 presale / ₱250 door".
7. **Lineup** — the rest of the bill, **one act per line**. Reads on the row as "with Severe Weather · Ampelope".
8. **Location on the map** — click the map to drop the pin (or type the coordinates). This is what puts the show on the map at the bottom of /shows, and it's required.
9. **Enabled** — off hides the show from /shows and from the map completely.

**Order** — upcoming shows sort themselves by date, soonest first, with TBA ones last; the archive groups by year, newest first. The ↑ ↓ arrows only break ties between shows on the same date.

**One thing that changed on old shows:** the date field used to have no time, so every show on the site read "8:00 AM". Shows saved before this update have no time recorded, and now simply show no time at all. Open one and set its time if you want it shown.

**The Next Event star** still marks one show as the glowing pin on the map.

---

## 8. Store (Products)

**What this is for:** the merch on **/shop** — each product has its own page (`/shop/<slug>`), and the cart / checkout / orders flow is unchanged (PayMongo).

### 8.1 Adding a product

1. **Products → + New product.**
2. **Photos** — upload up to 8; the first is the cover (↑ ↓ reorder on hover).
3. **Title**, **Category** (Shirts / Vinyl / CDs & cassettes / Posters & prints / Accessories / Other), **Price**, **Stock**, **Description**.
4. **Sizes / formats** — optional. Add a row per size (S / M / L, or 12″ vinyl / cassette) with its own price and stock. With sizes, the product's own stock box is ignored.
5. **In store** (paused products stay in the admin but leave the Store), **Featured** (first in the Store and on the homepage strip). **Add product**.

> 💡 **Create from artwork** — an optional shortcut that starts a product from a gallery piece (title, description, picture) and also hangs it in the Digital Museum's Services Room. Plain merch doesn't appear in the museum.

### 8.2 Editing, ordering, removing

- ↑ ↓ set the Store order (after featured ones). ★ toggles featured; the **In store / Paused** pill hides a product without deleting it.
- 🗑 moves it to **Trash** (Trash → Store). Past orders keep the product's name and picture.

---

## 9. Mini Games

**What this is for:** the games visitors can play from the homepage's Arcade block and inside the Digital Museum's Arcade Room. They are built on your releases now.

### 9.1 The ten games

- **Guess the Cover** — a cover comes into focus step by step; name it early for more points. *Uses every published release (needs 4+).*
- **Name That Track** — a song title, which record is it on? *Needs 2+ published releases with tracklists.*
- **Release Timeline** — put the records in order, oldest to newest. *Needs 4+ published releases with a release date.*
- **Fill the Lyric** — words missing from a few lines. *Pick a release whose tracks have lyrics (Releases → track → Lyrics).*
- **Tracklist Order** — put one record's songs back in running order. *Pick a release with 3+ tracks.*
- **Cover Puzzle · Rotate & Solve · Sliding Cover · Cover Memory · Find the Difference** — the picture puzzles, now played on a release's cover. *Pick a release; Find the Difference also wants an uploaded altered cover, then mark the changes.*

### 9.2 Setting one up

1. **Minigames** (sidebar → Museum & Archive) → pick a game.
2. **Release** — choose the record (the three catalogue games have nothing to pick; they say what they need instead).
3. Difficulty, time limit, scoring, leaderboard and reward settings are as before. **Save**.
4. A game that can't run yet shows why in amber (e.g. "Needs at least 4 published releases").

> 💡 A game that was set up on a gallery artwork before still works until you pick a release for it.

---

## 10. Museum Pieces (Digital Museum)

**What this is for:** the pictures that hang on the walls of the Digital Museum's rooms — live photos, gig posters, press shots, cover art, fan art. (This used to be the art gallery's "Artworks"; it is the same screen, relabelled for the band.)

### 10.1 Adding a piece

1. **Museum & Archive → Museum Pieces → + New Piece.**
2. Upload the **Image** (optionally a short **video clip**, e.g. a live snippet).
3. **Title**, **Description**, **Kind** (pick a preset — *Live photo*, *Gig poster*, *Press shot*, *Cover art*, *Fan art* — or type your own; it shows on the plaque with the **Year**), **Year**, optional **Size** and **Tags**, and a **Section** (a grouping you use when picking pieces for a room).
4. **Published** on, **Add Piece**.

### 10.2 Hanging it in a room

**Digital Museum → Rooms** → a room's **Manage pieces** → add from the list. Reorder with the arrows; **Edit Scene** to drag frames along the walls. A piece can hang in several rooms.

> 💡 A good structure: one room per era or kind — "Gigs 2025", "Posters", "Press" — using Sections to keep the picker short.

---

## 11. Vinyl Room (Digital Museum)

**What this is for:** a room in the Digital Museum where your records hang on the wall. A visitor walks up to a sleeve and presses **[E]** (or taps): the cover swings open like a gatefold, the record slides out of it and lands in their hands, and the cover settles just ajar so the artwork stays facing the room. They carry it to the turntable and put it on. It plays — through effects they can turn (reverb, lo-fi, crackle, echo, a five-pedal shoegaze board, 33 / 45 / 78 speed, backward play and backmasking) — while the **Lyrics Wall** shows the song's words line by line.

> A sleeve whose record is out stays ajar and empty, so the wall shows at a glance what's been taken — walk up to one and you still see its album art, just with the cover lifted off the sleeve. While the record is in a visitor's hands, **[E]** at its sleeve slides it back in and shuts the cover. While it's **on the deck**, **[E]** at the sleeve opens a **details panel** instead: the cover large, whether it's playing (and which way), the tracklist with the current track lit, the lyric line on screen now, a link to the release, a Play/Pause button, and **Put it back in its sleeve** — which stops the deck and returns the record without walking to the turntable.

### 11.1 Adding a record

1. **Music → Vinyls → + New vinyl.**
2. **Release** — pick the record. Its cover becomes the sleeve, its tracklist and lyrics feed the Lyrics Wall. (Add lyrics under Releases → track → Lyrics.)
3. **Audio file** — upload the recording (MP3 / WAV / OGG / AAC / M4A, up to 15 MB). The whole release as one file, or one side of it.
4. **Side label** (optional, e.g. "Side A") and **Published**. **Add vinyl**.

> Published records hang on the wall the next time the room is opened. ↑ ↓ sets the order along the wall; 🗑 moves it to **Trash → Music → Vinyls** (emptying Trash also deletes the audio file).

### 11.2 Turning the room on and laying it out

1. **Digital Museum → Rooms** — the **Vinyl Room** is created for you but starts **off**. Turn it on with its toggle (it can't be deleted).
2. **Edit Scene** on that room:
   - Click a **sleeve** to move it along a wall, raise or lower it, pick another wall, or resize it. **Save** when done.
   - Click the **turntable** to drag it anywhere on the floor (Move) or turn it (Rotate). It saves as you move it.
   - **Turntable & Lyrics Wall** card: upload your own turntable `.glb`, set the **default effects** a visitor starts from, and switch the **Lyrics Wall** on or off, pick its wall (north / east / west) and style it — see below.

### 11.3 Styling the Lyrics Wall

With the wall switched on, the same card carries every control the museum's other plaques have. Nothing here changes the words — only how the screen they sit on looks.

**Type**

- **Font** — any of the museum's faces. Applies to every line on the wall.
- **Text Size** — 50–200%. The wall already fits a long lyric to the panel on its own; this scales that result, so turning it up makes the words bigger without pushing them off the edges.
- **Text Color** — the lyric lines.
- **Glow Color** — the lit trim, the halo around the words and the track caption. It brightens on its own with the deck's reverb and lo-fi while a record plays.

**Panel**

- **Panel Color** / **Edge Color** / **Edge Width** — the screen and its raised border. Zero width is no border at all.
- **Panel Texture** — upload an image stretched across the whole wall (a screen surface, a paper grain, a projection scrim). The Panel colour still tints it, so **set Panel Color to white to show the image exactly as uploaded**.
- **Brightness** — 0–200%. Lifts the wall out of a dim room. The lyrics are left alone, so this changes how the wall sits rather than washing out the words.

**Glassmorphism**

- **Glassmorphism** — a frosted translucent screen instead of a solid painted one. This is the look the wall ships with.
- **Glass Opacity** — how solid the glass reads (only while Glassmorphism is on).
- **Shimmer** — a band of light travelling across the glass, with its own **Speed** and **Strength**. Glass only; every shimmering panel in the museum sweeps in step.

**Video behind the lyrics**

- **None / Upload / YouTube** — pick where the moving picture comes from. Both are remembered, so switching back and forth doesn't lose the other.
- **Upload** — MP4, MOV or WebM. Anything longer than 60 seconds is cropped to its first 60 when you upload it; it loops on the wall.
- **YouTube** — paste the video's page or share link (watch, youtu.be, shorts all work) and press Enter.
- **Video brightness** — 0–200%. Under 100% dims the picture so the lyrics read over it. It starts at **70%**; a bright video needs less.
- **Mute the video** — on by default. The deck is already playing a record, and a second soundtrack from the wall fights it. A browser may still start the video muted until the visitor has clicked into the museum.

> ⚠️ **YouTube vs. Upload in a VR headset.** A YouTube player can't be drawn *inside* the 3D room — it's layered onto the page behind a see-through patch of the wall. Visitors on a screen see it perfectly; **headset visitors see the plain wall**, and it won't appear in a 📸 screenshot either. An uploaded clip is part of the room itself, so it shows everywhere. If VR matters, upload the clip.

> 💡 A room you have never styled looks exactly as it always did — the defaults are the wall's original near-black glass with its gold trim, and no video.

### 11.4 The effects on the deck

Opening the turntable's panel gives a visitor the knobs. They all start from
**your** defaults (Scene Editor → Turntable & Lyrics Wall → Default effects);
a visitor's own changes last for their visit only.

**The old-record set** — Reverb (room size), Lo-fi (warmth and grit), Crackle
(dust on the record) and Echo.

**The shoegaze board** — five modulations in the order a guitarist would chain
them: **Phaser** (swept notches), **Flanger** (the jet sweep), **Chorus** (a
detuned wash), **Vibrato** (pitch wobble — a warped record at depth) and
**Tremolo** (a volume pulse). Above them sits one **Drift** knob: it sets how
fast every sweep moves. Each pedal runs at its own fraction of that speed, so
turning two of them up sounds like two pedals rather than one blur.

**Backward play** — the needle runs from where it is back towards the start of
the record. The timer counts *down*, and the Lyrics Wall walks backwards
through the song.

**Backmasking** — something different: every moment of the song *sounds*
reversed, but the song itself still moves forward. The timer counts up, the
Lyrics Wall keeps its place, and the record ends at its end. It works by
reversing the audio a slice at a time; the **Window** slider sets how long each
slice is — short is a backwards stutter, long lets a whole sung phrase run in
reverse before the next one starts.

Only one of the two can be on — turning one on turns the other off. Either
way the deck has to read the whole recording first, so a long record takes a
moment the first time; after that, switching is instant.

> 💡 **You can set any of these as the room's starting sound**, including
> **Start with backward play** or **Start backmasked** (Scene Editor → Turntable
> & Lyrics Wall → Default effects). A room that had "Start backmasked" on before
> this change keeps doing exactly what it did — that switch is now called
> **Start with backward play**, because that's what it always was.

### 11.5 Good to know

- The museum's own soundtrack pauses while a record plays and comes back when it's taken off.
- A visitor's effect settings last for their visit; the room's defaults are yours.
- **Lyrics timing is approximate**: the lyrics have no timestamps, so lines are spread across the recording by length (and across tracks by their durations, when set). Close, not karaoke-exact.
- **VR**: the room, the wall and the sound work in a headset, but the deck's sliders don't — take the headset off to tweak effects.

---

## 12. Homepage

**What this is for:** the homepage builds itself from what you have published — there is nothing to arrange by hand.

- **Hero** — three answers, in this order. **Preferences → Homepage Hero** switched on wins outright: that is your own hand-designed splash, meant for a launch or an announcement. Switched off (the default), the hero is the featured release (else the newest published one): its cover blurred behind the title, LISTEN into its player, WATCH to Videos. With no releases yet: your tagline (About → Headline) over the site background photo, with the genres above it (About → Skills, relabelled Genres / tags; falls back to the band's four) and the first line of your bio under it.

> ⚠️ Before you switch **Homepage Hero** on for the first time, open that tab and press **Restore defaults** — the heading and button still carry the old art-site wording ("The new collection", VIEW NOW → Gallery) until you do.
- **Latest release** — the same release in full (player, tracklist, links), right under the hero.
- **Upcoming shows** — Shows / Events with a date in the future (up to three). Hidden when there are none.
- **Videos** — the four newest videos, featured first. Hidden when there are none.
- **Merch** — four products, featured first. Hidden when the store is empty.
- **Fan wall** — the three newest notes, when the Freedom Wall is active.
- **Digital Museum + Mini games** — shown when the museum is enabled with published artworks, and when at least one game is playable.

> 💡 The entrance splash's tagline is **Preferences → Branding → Entrance Splash → Tagline** — update it if it still reads like the old art site.

---

## 13. Mailing list

**What this is for:** the one way to reach people who like the band that doesn't go through somebody else's feed. Nothing about it is automatic — you export the list and send from your own mail tool.

### 13.1 Where people sign up

- **The footer of every page** — one field, under Connect.
- **`/subscribe`** — a page of its own. This is the link to put in your Instagram or Facebook bio.
- **The Shows page**, but only when you have no dates booked. Someone who came looking for a gig and found none is the person most likely to want telling.

### 13.2 Confirmed vs. unconfirmed

Signing up does **not** put someone on the list. They get one email with a **Confirm subscription** button, and only once they tap it do they count. Until then they sit in **Waiting to confirm**.

This is on purpose and it is not optional: without it, anyone could type in your friend's address — or a hundred strangers' addresses — and you'd be mailing people who never asked. It also means an address that can't receive mail never reaches your list.

So: **Confirmed is your list. Everything else is not.**

### 13.3 Sending to the list

Sidebar → **Mailing List**:

1. Click the **On the list** tile (or set the filter to **Confirmed**) so you're looking only at confirmed addresses.
2. **Export N shown** → downloads a CSV.
3. Open that CSV in your mail tool (Mailchimp, Buttondown, Brevo — whichever you use) and send from there.

> ⚠️ The export gives you whatever rows are on screen, and the file always has a **Status** column. If you export with the filter on **All statuses**, unconfirmed and unsubscribed addresses are in that file — **do not send to those**. Filter to Confirmed first.

The site itself never sends a newsletter. The only email it sends is the confirmation above.

### 13.4 Removing someone

- **The unsubscribe link** in their email is the normal way, and it keeps working forever — including from an email you sent two years ago. When someone uses it they move to **Left**, and the record stays so they can't be accidentally re-added by a later import.
- **The 🗑 button** deletes the row outright. There is no Trash for this and it can't be undone — it's for a "delete my data" request or a junk signup. If they only want the emails to stop, the unsubscribe is the better answer.

There is no "add subscriber" button, and that's deliberate — see 13.2.

---

## 14. Picking dates anywhere in the admin

**What this is for:** every date field in the admin — Releases, Events, About, Announcements, Marquee Banners, Release Notes — is the same control, and it's the same calendar that sits behind the sidebar clock.

**Two ways in, use whichever is faster:**

- **Type it.** The field is a normal text box. `Sep 23, 2026`, `September 23, 2026`, `9/23/2026` and `2026-09-23` all work — press **Enter** or click away and it's set. Get it wrong and the field tells you and *keeps the date it already had*, so a typo never empties it.
- **Pick it.** Click the 📅 icon for the calendar. **Today** is outlined in gold, your chosen day is filled in gold.

**Inside the calendar:**

- **Jump to any month or year** with the two dropdowns at the top. A 1998 release date is one click away — it used to mean clicking ‹ a few hundred times.
- The ‹ › arrows still step one month at a time, and **Today** at the bottom jumps straight back.
- Fields that need a **time** as well show a small **Time** box. Picking a day keeps whatever time is already set.
- **✕ clears** any field that's allowed to be empty.
- Click outside, or press **Esc**, to close it — **Esc closes only the calendar**, not the form behind it.

---

## 15. Glossary — Confusing Terms Explained

| Term | Meaning |
| --- | --- |
| **Published** | Visible on the public site. Off = hidden everywhere, but not deleted. |
| **Featured** | Pinned to a highlighted spot on the homepage. Must also be Published to show. |
| **Trash** | Soft-deleted. Restorable from Settings → Trash until permanently deleted. |

---

## 16. Quick Troubleshooting

| Symptom | First thing to check |
| --- | --- |
| Can't log in | Caps lock, then the "Forgot Password?" link that appears after 3 failed attempts. |
| Change not showing on the public site | Is the item **Published**? Is its **Section** published? Hard-refresh (Ctrl/Cmd + Shift + R). |
