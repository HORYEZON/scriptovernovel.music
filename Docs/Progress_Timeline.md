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

<!--
SAMPLE FORMAT — copy this block for every release, keep the three sub-headings
(drop any that have nothing in them), one bullet per user-facing change, bold
the headline of the release. Delete this sample once the first real entry
exists.

## September 13, 2026 — v1.0

### Admin Side

- **The admin dashboard exists, and it can run the site on its own.**
  Supabase Auth signs the admin in, and `/admin/*` is closed behind a session
  check so a bare URL isn't a way in
- Uploads go directly to Supabase Storage rather than being pasted in as
  links, which is what makes the site self-serve rather than developer-serve

### Public Side

- Responsive homepage grid, with skeleton loaders so a slow connection shows
  the shape of the page instead of a blank one
- Light/dark theme switcher, with the choice remembered between visits
  - The SCRIPT / NOVEL wordmark in the footer is split into word spans, each
    wearing its own brand colour — yellow gold, grey, off-white

### Infra / DB

- New tables with RLS policies — public read-only, admin-only write. The
  public site therefore never needs a privileged key to render
- Supabase Storage bucket for uploaded media

---
-->
