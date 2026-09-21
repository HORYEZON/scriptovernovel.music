# ScriptOverNovel Admin Dashboard — User Training Guide

A practical, click-by-click walkthrough of every module in the Admin Dashboard, written for whoever manages the site day-to-day (no coding knowledge required). If you're the owner running this site yourself, this is your manual.

> 💡 **Not sure what something technical means?** Every module below has a short "What this is for" blurb before the steps, plus a **Glossary** at the end covering easily-confused terms.

---

## Table of Contents

1. [Logging In](#1-logging-in)
2. [Site Design — Header](#2-site-design--header)
3. [Site Design — Menu animation](#3-site-design--menu-animation)
4. [Preferences — Site Background Effects](#4-preferences--site-background-effects)
5. [Releases (Music page)](#5-releases-music-page)
6. [Videos](#6-videos)
7. [About & Band Members](#7-about--band-members)
8. [Store (Products)](#8-store-products)
9. [Mini Games](#9-mini-games)
10. [Museum Pieces (Digital Museum)](#10-museum-pieces-digital-museum)
11. [Vinyl Room (Digital Museum)](#11-vinyl-room-digital-museum)
12. [Homepage](#12-homepage)
13. [Glossary — Confusing Terms Explained](#13-glossary--confusing-terms-explained)
14. [Quick Troubleshooting](#14-quick-troubleshooting)

_(Add one numbered entry per module as it ships — sub-sections go in parentheses after the link, e.g. `(incl. [Sales Dashboard](#71-sales-dashboard))`.)_

---

## 1. Logging In

- Go to **`/login`** on your site (e.g. `https://yourdomain.com/login`).
- Log in with your admin email + password.
- There is **no public sign-up** — admin accounts can only be created by someone with database access (see `README.md` → "Creating the First Admin User" for the technical steps).
- Only accounts with the `ADMIN` role can access anything under `/admin/*`.

---

## 2. Site Design — Header

**What this is for:** the bar pinned to the top of every public page — search on the left, your wordmark in the middle, the **MENU** button and the light/dark switch on the right. It's frosted glass: the page shows through it, blurred, and it thickens slightly once a visitor scrolls.

### 2.1 Colours

1. **Site Design → Header → Colours & label.**
2. **Background** tints the glass. Pick something close to your page colour for a subtle bar, or a contrasting one for a visible band. The colour is applied at glass opacity, so it will always read a little lighter/softer than the swatch.
3. **Text & icons** colours the wordmark, the search icon and MENU.
4. **Save**. The live preview above the controls shows the bar as it looks in light mode.

> 💡 These two colours only apply while a visitor is in **light** mode. In **dark** mode (the default for new visitors) the bar switches to the site's near-black glass with cream text, whatever you picked — so you never have to check your colours twice.

### 2.2 Menu items

**Site Design → Menu → Links.** The band site's pages are **Music, Store (/shop), Videos, About, Contact**. If your menu still shows the older Gallery / Tales rows, retitle and re-point them here — the labels and links are yours to edit.

> 💡 The header wordmark (Site Design → Header → Wordmark) is also what the footer and the entrance splash show now — one place to change the band's name or logo.

### 2.3 Wordmark text size

**Site Design → Header → Wordmark → Fallback size** is a slider (1–4rem; the readout also shows pixels). It sizes the text wordmark shown when no logo image is uploaded. Phones automatically cap it so it can't crowd the MENU button.

### 2.4 The light/dark switch

The sun/moon pill to the right of **MENU** is always on — there's no setting to hide it. The site starts in dark mode for a first-time visitor, and the pill is how they get to light mode; their choice is remembered on that device.

---

## 3. Site Design — Menu animation

**What this is for:** how the full-screen menu arrives when a visitor presses **MENU**, how it leaves when they press ×, and how the links inside it appear.

### 3.1 Picking the effects

1. **Site Design → Menu → Open & close animation.**
2. **Open effect** — pick a card. *Split — meet in the middle* slides the colour panel in from the left and the photo in from the right so they meet at the centre.
3. **Close effect** — its own card; *Split — part to the edges* is the matching exit.
4. **Link entrance** — how the words (Music, Store, …) appear once the sheet has landed. *Rise one by one* fades each link up in turn; *Rise together* lifts them all at once.
5. Each has its own speed slider. **Save**.

> 💡 The preview at the top of the tab replays automatically whenever you change an effect or a speed — or press **Play open** / **Play close**. The link entrance only starts once the sheet has fully arrived, on the live site and in the preview alike.

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

**Shows / Events** is unchanged — every enabled event shows on About under **Shows**: upcoming ones first, then past ones by year, with the map under them. The next three upcoming also appear on the homepage.

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

**What this is for:** a room in the Digital Museum where your records hang on the wall. A visitor walks up to a sleeve, presses **[E]** (or taps) to take the record, carries it to the turntable, and puts it on. It plays — through effects they can turn (reverb, lo-fi, crackle, echo, 33 / 45 / 78 speed) — while the **Lyrics Wall** shows the song's words line by line.

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
   - **Turntable & Lyrics Wall** card: upload your own turntable `.glb`, set the **default effects** a visitor starts from, and switch the **Lyrics Wall** on or off, pick its wall (north / east / west) and its colours.

### 11.3 Good to know

- The museum's own soundtrack pauses while a record plays and comes back when it's taken off.
- A visitor's effect settings last for their visit; the room's defaults are yours.
- **Lyrics timing is approximate**: the lyrics have no timestamps, so lines are spread across the recording by length (and across tracks by their durations, when set). Close, not karaoke-exact.
- **VR**: the room, the wall and the sound work in a headset, but the deck's sliders don't — take the headset off to tweak effects.

---

## 12. Homepage

**What this is for:** the homepage builds itself from what you have published — there is nothing to arrange by hand.

- **Hero** — the featured release (else the newest published one): its cover blurred behind the title, LISTEN into its player, WATCH to Videos. With no releases yet: the band's name (Site Design → Header → Wordmark), the genres (About → Skills, relabelled Genres / tags; falls back to the band's four), the tagline (About → Headline) — or, if **Site Design → Homepage Hero** is switched on, your custom hero.
- **Latest release** — the same release in full (player, tracklist, links), right under the hero.
- **Upcoming shows** — Shows / Events with a date in the future (up to three). Hidden when there are none.
- **Videos** — the four newest videos, featured first. Hidden when there are none.
- **Merch** — four products, featured first. Hidden when the store is empty.
- **Fan wall** — the three newest notes, when the Freedom Wall is active.
- **Digital Museum + Mini games** — shown when the museum is enabled with published artworks, and when at least one game is playable.

> 💡 The entrance splash's tagline is **Preferences → Branding → Entrance Splash → Tagline** — update it if it still reads like the old art site.

---

## 13. Glossary — Confusing Terms Explained

| Term | Meaning |
| --- | --- |
| **Published** | Visible on the public site. Off = hidden everywhere, but not deleted. |
| **Featured** | Pinned to a highlighted spot on the homepage. Must also be Published to show. |
| **Trash** | Soft-deleted. Restorable from Settings → Trash until permanently deleted. |

---

## 14. Quick Troubleshooting

| Symptom | First thing to check |
| --- | --- |
| Can't log in | Caps lock, then the "Forgot Password?" link that appears after 3 failed attempts. |
| Change not showing on the public site | Is the item **Published**? Is its **Section** published? Hard-refresh (Ctrl/Cmd + Shift + R). |
