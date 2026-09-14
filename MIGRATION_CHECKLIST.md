# scriptovernovel.music — Migration Checklist (from kalamari.arts)

Baseline: `kalamari.arts` @ `1825a7e` (`Merge branch 'museum-hud-button-toolbar-login-091426'`), synced 2026-09-15.
(Original snapshot was `565a277`; commits `565a277..79404f4` — release-notes trash fix,
VR mirrored panels, cart squid heading, VR HUD — were ported file-by-file on 2026-09-13; `79404f4..99ef810` — site-music handoff
fix + Share 360° — on 2026-09-14; `99ef810..1825a7e` — Share 360° black-square fix,
Hide HUD button / editor toolbar wrap / 2FA back pill — on 2026-09-15.)

> ⚠️ `kalamari.arts` is still receiving bug fixes / features in parallel.
> Anything committed there **after `1825a7e`** is NOT in this copy — see the
> "Re-sync" section at the bottom before treating this folder as current.

## Done

- [x] Copied `kalamari.arts/` → `scriptovernovel.music/` (rsync, working tree)
  - Excluded: `node_modules/`, `.next/`, `.git/`, `.DS_Store`,
    `tsconfig.tsbuildinfo`, `.yarn/install-state.gz`
  - Excluded Docs: `Admin_StoriesModule.md`, `Museum_*.md` (7 files)
  - Kept Docs: `OAuth2_Setup.md`, `PayMongo_Setup.md`, `System_Security.md`,
    `Progress_Timeline.md`, `User_Training.md` (reset to stubs — see below)
  - `VrUi.tsx` was swept in half-baked from the working tree; replaced by the
    committed version when `565a277..79404f4` was ported.
- [x] Rename sweep on the copy (93 files, 0 leftovers):
  - `kalamari.arts` → `scriptovernovel.music`
  - `kalamari-arts` → `scriptovernovel-music`
  - `Kalamari Arts` → `ScriptOverNovel Music`
  - `KALAMARI` → `SCRIPTOVERNOVEL`
  - `Kalamari` → `ScriptOverNovel`
  - `kalamari` → `scriptovernovel` (localStorage keys, slugs, cookie names, log file, backup prefix)
  - Covers `package.json` name, `.claude/settings*.json` paths, `prisma/schema.prisma`
    comments, `lib/openapi.ts`, emails, `NOTICE`, `README.md`, `yarn.lock`, `.env.example`
- [x] Wordmark lockups rebuilt: `KALAM(squid)RI` → `SCRIPT/N(squid)VEL`
  ("over" is the slash; icon stands in for the O of NOVEL). Coloured **per word**:
  Script = yellow gold `#FFD700`, / = grey `#9A9A9A`, Novel = off-white `#F5F1E8`
  (N and vel around the icon both wear Novel's). `INTRO_LETTER_COLORS` in
  `lib/intro-splash.ts` is now 3 entries; `introSquidColor` default → `#F5F1E8`
  (`lib/intro-splash.ts` + `prisma/schema.prisma`). Files:
  `components/public/FooterWordmark.tsx`, `components/public/IntroSplashContent.tsx`,
  admin `IntroSplashSection.tsx` copy, `lib/openapi.ts` descriptions.
  - [ ] Swap the hexes if the exact gold/grey/off-white shades differ from what you have in mind

## Done (continued)

- [x] `Docs/Progress_Timeline.md` → reset to header + version list stub + a commented-out sample entry
- [x] `Docs/User_Training.md` → reset to header + TOC stub + commented-out sample module, Logging In, Glossary, Troubleshooting
- [x] `.env` → rewritten for LOCAL Supabase (the copied one was already mostly a template — `[PASSWORD]` placeholder, empty keys):
  - `DATABASE_URL` / `DIRECT_URL` → `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
  - `NEXT_PUBLIC_SUPABASE_URL` → `http://127.0.0.1:54321`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` → CLI stock demo keys; **verify against what `supabase start` prints**
  - `NEXTAUTH_URL` → `http://localhost:3000`
  - `AUTH_SECRET` → regenerated
  - ⚠️ `GMAIL_USER` got auto-renamed to `scriptovernovel.music@gmail.com` — set to a real mailbox + app password before testing email
  - Gmail / reCAPTCHA / Vercel → left as-is for now (decided)
- [x] `supabase init` done (`supabase/config.toml`; `.temp/` ignored)
- [ ] **`supabase start`** — needs Docker Desktop running (it wasn't). Then compare the printed anon/service_role keys with `.env`
- [x] `yarn install` (713 pkgs, Prisma client generated)
- [ ] `yarn db:push` → `yarn db:seed` (after `supabase start`; `DATABASE_URL` is 127.0.0.1:54322, so this can only hit the local DB)
- [x] Verified: `npx tsc --noEmit` ✓, `yarn next lint` ✓, `yarn build` ✓ (68 static pages)
- [x] `git init -b main` + initial commit (no remote)
- [ ] Decide `package.json` `version` — currently still `1.16.25` (carried over); reset to `0.1.0`/`1.0.0` if the timeline restarts
- [ ] Brand leftovers that a text replace can't fix (review by hand):
  - Tagline `"ScriptOverNovel — House of Arts"` (`app/layout.tsx`, `app/opengraph-image.tsx`, `app/(public)/page.tsx`, `README.md` line 1) — art wording, not music
  - Meta description "Original paintings, prints, and mixed media…" (`app/layout.tsx:56`, `app/(public)/page.tsx:120`)
  - `SquidIcon` still the fallback logo mark (`components/ui/SquidIcon.tsx`, used by FooterWordmark / Navbar / login)
  - Squid-themed CSS: `animate-squid-drift`, `animate-squid-glow`, `--squid-glow` (`tailwind.config.ts`, `app/globals.css`)
  - **Site-wide 4-colour brand palette** `#FFE135 / #44D700 / #FF6B9D / #5BC8F5` (kalamari yellow/green/pink/cyan)
    still used as the icon colour cycle everywhere: `prisma/schema.prisma` defaults
    (`sidebarIconColors`, `faviconIconColors`, `footerIconColors`, `maintenanceIconColors`,
    `sidebarMobileIconColors`, `splashIconColors`), `IconHoverColorsEditor.tsx`,
    `opengraph-image.tsx`, public pages, `api/social-links`, `api/artist-skills`.
    Needs a 4th colour (or a 3-colour cycle) decided before replacing — only the
    wordmark lockup has been recoloured so far.
  - Artist name "Kyla" in `prisma/schema.prisma` comments and seed data
  - Museum "About ScriptOverNovel" room + all Museum/Stories code (kept on purpose — strip later if the music site doesn't need it)
  - Email templates' copy still talks about artworks / orders / museum achievements
- [x] `.claude/settings*.json` paths fixed to `…/0 Horyezon Indie Solutions/scriptovernovel.music`; stale `scriptovernovel-music.vercel.app` curl allow-entries left in place (harmless)

## Re-sync (bring later kalamari fixes into this copy)

Because both repos keep moving, don't re-rsync blindly (it'd undo the rename).
Instead, port commits:

```bash
cd "/Users/jbriz/Documents/GitHub/0 Horyezon Indie Solutions/kalamari.arts"
git log --oneline 1825a7e..HEAD            # what's new since the snapshot
git diff 1825a7e..HEAD --stat              # which files

# per commit / range, make a patch and apply it to the copy:
git format-patch 1825a7e..HEAD --stdout > /tmp/kalamari-since-snapshot.patch
cd "../scriptovernovel.music"
git apply --3way /tmp/kalamari-since-snapshot.patch   # after git init
```

Hunks touching brand strings will conflict (kalamari → scriptovernovel);
resolve by hand, then re-run the rename sweep on the touched files:

```bash
grep -rIli kalamari . --exclude-dir=node_modules --exclude-dir=.git
```

Bump the baseline line at the top of this file to the new kalamari HEAD after
every sync.
