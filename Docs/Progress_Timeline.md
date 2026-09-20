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
