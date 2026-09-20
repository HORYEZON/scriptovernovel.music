# ScriptOverNovel Admin Dashboard — User Training Guide

A practical, click-by-click walkthrough of every module in the Admin Dashboard, written for whoever manages the site day-to-day (no coding knowledge required). If you're the owner running this site yourself, this is your manual.

> 💡 **Not sure what something technical means?** Every module below has a short "What this is for" blurb before the steps, plus a **Glossary** at the end covering easily-confused terms.

---

## Table of Contents

1. [Logging In](#1-logging-in)
2. [Site Design — Header](#2-site-design--header)
3. [Site Design — Menu animation](#3-site-design--menu-animation)
4. [Preferences — Site Background Effects](#4-preferences--site-background-effects)
5. [Glossary — Confusing Terms Explained](#5-glossary--confusing-terms-explained)
6. [Quick Troubleshooting](#6-quick-troubleshooting)

_(Add one numbered entry per module as it ships — sub-sections go in parentheses after the link, e.g. `(incl. [Sales Dashboard](#71-sales-dashboard))`.)_

---

<!--
SAMPLE FORMAT — one `## N. Module Name` section per admin module, in sidebar
order. Open with a bold "What this is for" line, then `### N.x` sub-sections
for each task, numbered steps for click-paths, and `> ⚠️` / `> 💡` callouts
for gotchas. Delete this sample once the first real module is written.

## 5. Sections Module

**What this is for:** Sections are the categories/albums that group items together on the public homepage (e.g. "Singles", "Albums", "Live Sessions"). Each section shows as a cover-image card; clicking it opens a grid of everything inside.

### 5.1 Creating a section

1. **+ New Section** → enter a **Section Name** (a URL-friendly slug is generated automatically).
2. Optionally upload a **Cover Image** — if you skip this, the section card will automatically fall back to the first item's image once items are added to it.
3. **Published** checkbox — off = hidden from the public site, and any items assigned to it become effectively invisible on the public site too, even if those items are individually marked Published.
4. **Create Section**.

### 5.2 Reordering sections

Sections appear on the homepage in **Display Order**. Use the ↑ / ↓ arrows on each row/card to move a section up or down.

> ⚠️ Reordering only works when you're **not** actively searching, filtering, or sorting by something other than "Display Order" — clear those first if the arrows look greyed out.

### 5.3 Deleting a section

Deleting a section moves it to Trash — **and everything inside it goes too.** The confirmation popup tells you exactly how many items will be trashed alongside the section, so double-check that count before confirming. Everything can be restored together from Trash.

---
-->

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

### 2.2 Wordmark text size

**Site Design → Header → Wordmark → Fallback size** is a slider (1–4rem; the readout also shows pixels). It sizes the text wordmark shown when no logo image is uploaded. Phones automatically cap it so it can't crowd the MENU button.

### 2.3 The light/dark switch

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

## 5. Glossary — Confusing Terms Explained

| Term | Meaning |
| --- | --- |
| **Published** | Visible on the public site. Off = hidden everywhere, but not deleted. |
| **Featured** | Pinned to a highlighted spot on the homepage. Must also be Published to show. |
| **Trash** | Soft-deleted. Restorable from Settings → Trash until permanently deleted. |

---

## 6. Quick Troubleshooting

| Symptom | First thing to check |
| --- | --- |
| Can't log in | Caps lock, then the "Forgot Password?" link that appears after 3 failed attempts. |
| Change not showing on the public site | Is the item **Published**? Is its **Section** published? Hard-refresh (Ctrl/Cmd + Shift + R). |
