# System Security

A record of what protects this system, what was found wrong on **2026-09-05**,
what was fixed, and what is deliberately left as-is. This document describes
what shipped, not a plan.

Every claim below was verified against the live production project
(`yqetuaoahwuqwsshkjnf.supabase.co`) rather than inferred from code — the
commands to re-run each check are in [Verification playbook](#verification-playbook).

---

## Posture at a glance

| Area                   | Rating                    | One-line reason                                                                                      |
| ---------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------- |
| Database tables        | **Strong**                | The public API role cannot reach the schema at all — not one table.                                  |
| Storage bucket         | **Strong** (was **weak**) | Anonymous upload and listing removed; size + MIME capped.                                            |
| Mini-game scores       | **Strong**                | Server generates the puzzle, replays the moves, and computes the score. The browser never sends one. |
| Shop / orders          | **Strong**                | Prices come from the database, never the request. Payment webhook signature is mandatory.            |
| Admin authentication   | **Good**                  | Session + role check on every admin route; optional API key now compared in constant time.           |
| Secrets in the browser | **By design**             | The only key shipped to the client is the Supabase anon key, which now opens nothing.                |

---

## The trust boundary

The single most important thing to understand about this system:

> **Row Level Security is not what authorizes this application.**

The app talks to Postgres through Prisma using `DATABASE_URL`, which connects as
the `postgres` role. That role has `BYPASSRLS`. Every policy in the database is
invisible to it.

So RLS here is not the app's access control — **`requireAdmin()` is**. RLS exists
purely to protect the _other_ door into the same database: Supabase's auto-generated
PostgREST API at `/rest/v1/…`, which is reachable by anyone on the internet holding
the public anon key. That key is in the JavaScript bundle. It is supposed to be.

Two doors, two different locks:

```
                        ┌──────────────────────────────────┐
  Browser ──HTTPS──▶    │  Next.js route handler           │
                        │    requireAdmin() / session      │  ← the app's real lock
                        │    Prisma (role: postgres)       │
                        └────────────────┬─────────────────┘
                                         │ BYPASSRLS
                                         ▼
                        ┌──────────────────────────────────┐
  Browser ──anon key──▶ │  Supabase PostgREST /rest/v1     │  ← locked by grants + RLS
       (DevTools)       │  Supabase Storage  /storage/v1   │  ← locked by storage policies
                        └──────────────────────────────────┘
```

Anything that gets the first door wrong is an application bug. Anything that gets
the second door wrong is exposed to the entire internet with no application code
involved at all. The audit focused on the second door, because that is the one
that fails silently.

---

## Layer 1 — Database tables

### How it is locked

The `anon` and `authenticated` roles have **no `USAGE` on the `public` schema and
zero table grants**. This is a stronger position than RLS alone: the request is
refused at the schema level, before any policy is even consulted. A missing or
badly written policy on some future table cannot leak anything, because the role
cannot see the schema to begin with.

Verified live against all 47 tables — every one refuses:

```
GET /rest/v1/User?select=*                → 401  permission denied for schema public
GET /rest/v1/Session?select=*             → 401  permission denied for schema public
GET /rest/v1/Account?select=*             → 401  permission denied for schema public
GET /rest/v1/Order?select=*               → 401  permission denied for schema public
GET /rest/v1/PasswordResetToken?select=*  → 401  permission denied for schema public
```

On top of that:

- **All 47 tables have RLS enabled**, with **zero policies** — deny-all for every
  role that does not bypass RLS.
- **`pg_graphql` is disabled**, closing the second auto-generated API surface
  (`/graphql/v1` returns `pg_graphql extension is not enabled`).
- **No views and no `SECURITY DEFINER` functions** exist in `public` that could be
  used to read around RLS.
- Only `postgres`, `service_role`, `supabase_admin`, `supabase_read_only_user` and
  `supabase_etl_admin` hold `BYPASSRLS`. All are server-side roles whose keys never
  reach a browser.

### The `ensure_rls` safety net

An event trigger, `ensure_rls`, calls `public.rls_auto_enable()` after every DDL
command and enables RLS on any newly created table in `public`.

This matters because of how this project migrates: `yarn db:push` runs Prisma
against the live database. Without this trigger, every new model would land with
RLS off and stay that way until somebody noticed. With it, a new table is protected
the moment it exists.

**Do not remove this trigger.** It is the reason a schema change cannot silently
open a hole.

### What was fixed on 2026-09-05

| Finding                                                                                                                                | Severity      | Fix                                 |
| -------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ----------------------------------- |
| `PasswordResetToken` and `VerificationToken` had RLS **disabled** — they predate the `ensure_rls` trigger, and hold reset-token hashes | Low (latent)  | `ENABLE ROW LEVEL SECURITY` on both |
| 23 tables carried `Enable read access for all users` policies — `FOR SELECT TO public USING (true)`                                    | Low (latent)  | All dropped                         |
| `rls_auto_enable()` was `EXECUTE`-able by `PUBLIC`                                                                                     | Informational | `REVOKE EXECUTE`                    |

The 23 policies deserve an explanation, because they were _inert_ when found — with
no schema grants, a policy grants nothing. They were removed anyway because they
were a **loaded gun pointed at the future**. A single `GRANT USAGE ON SCHEMA public
TO anon` — from a Supabase dashboard toggle, a copied tutorial, or a future
migration — would have instantly turned all 23 into world-readable tables. And none
of them filtered on visibility:

| Table               | Column the policy ignored |
| ------------------- | ------------------------- |
| `Artwork`           | `published`, `status`     |
| `Section`           | `isPublished`             |
| `Announcement`      | `isHidden`                |
| `MuseumSceneObject` | `hidden`                  |

Unpublished artwork would have been readable the moment that grant appeared.

To make that accident impossible rather than merely unlikely, the grants were also
explicitly revoked, **including the defaults that would apply to tables created
later**:

```sql
revoke all on schema public                from anon, authenticated;
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
```

---

## Layer 2 — Storage bucket

This is where the audit found a **genuinely exploitable flaw**, and it was
confirmed by exploiting it against production before fixing it.

### The flaw

The bucket `scriptovernovel.music-artworks` carried a policy from Supabase's dashboard
template:

```
policy:     "Allow Uploads 15bhfms_0"
cmd:        INSERT
roles:      {anon, authenticated}
with check: bucket_id = 'scriptovernovel.music-artworks'    ← the only condition
```

and the bucket itself had `file_size_limit: null` and `allowed_mime_types: null`.

The anon key is public. So the check reduced to _"is this the right bucket?"_ —
which is to say, no check at all. Anyone on the internet could write to it.

**Proof, run against production with nothing but the public anon key:**

```
POST /storage/v1/object/scriptovernovel.music-artworks/_audit_proof/pwn.html
  → HTTP 200  {"Key":"scriptovernovel.music-artworks/_audit_proof/pwn.html", ...}

GET  /storage/v1/object/public/scriptovernovel.music-artworks/_audit_proof/pwn.html
  → HTTP 200  <html><body>PWNED - security audit proof</body></html>

POST .../x.svg   (Content-Type: image/svg+xml)   → HTTP 200, served as image/svg+xml
POST .../big.bin (50 MB)                          → HTTP 200
```

Real impact, in order of likelihood:

1. **Cost and capacity.** No size cap, no quota. The bucket already holds ~1 GB
   across 483 files. Anyone could have filled it overnight and taken the site's
   images down with it, or run up the bill.
2. **Stored XSS / content hosting.** SVG was served back as `image/svg+xml`, which
   browsers render _and_ execute scripts inside when opened directly. It lands on
   `*.supabase.co`, a different origin from the site, so it could not read the
   app's cookies or session — but it was a live script-execution and phishing host
   sitting on infrastructure that looks like the project's own.
3. **Arbitrary file hosting.** Malware or illegal content distributed from the
   project's storage, with the resulting takedown and ToS exposure.

A second, quieter finding: the `Public Read Access` policy let anyone **enumerate
the entire bucket** with the anon key, returning every filename, size and
timestamp — including files belonging to artwork that was never published.

### The fix

Both storage policies were dropped and the bucket was hardened:

```sql
drop policy "Allow Uploads 15bhfms_0"      on storage.objects;
drop policy "Public Read Access 15bhfms_0" on storage.objects;

update storage.buckets
   set file_size_limit    = 104857600,          -- 100 MB
       allowed_mime_types = array[
         'image/jpeg','image/jpg','image/png','image/webp','image/gif','image/avif',
         'model/gltf-binary','model/gltf+json',
         'audio/mpeg','audio/mp3','audio/wav','audio/x-wav','audio/ogg','audio/webm',
         'audio/aac','audio/mp4',
         'video/mp4','video/webm','video/quicktime',
         'application/octet-stream'
       ]
 where id = 'scriptovernovel.music-artworks';
```

`text/html` and `image/svg+xml` are deliberately **absent** from that list — they
are the two types a browser will render and execute. `application/octet-stream` is
included because browsers download it rather than rendering it, and because the
signed-URL upload paths fall back to it when a browser reports no MIME type.

**Why dropping both policies does not break anything** — this was the part that
needed verifying rather than assuming, and both halves were tested end to end:

- **Public image reads still work.** The bucket is `public: true`, and Supabase
  serves `/storage/v1/object/public/…` without consulting RLS at all. The dropped
  `SELECT` policy only ever governed the _authenticated_ API, which is what
  listing uses. Confirmed: existing `.jpeg` and `.glb` files still return HTTP 200.
- **The Museum Scene Editor still uploads.** Its large `.glb` and audio uploads go
  through `createSignedUploadUrl` (minted server-side with the service role) and
  `uploadToSignedUrl` in [`lib/supabase/browser-storage.ts`](../lib/supabase/browser-storage.ts).
  A signed upload URL carries its own authorization and **bypasses storage RLS**,
  so the anon `INSERT` policy was never what made it work. Confirmed by minting a
  token and completing an upload with the anon client after the policy was gone.

The 100 MB cap was chosen against the real data: the largest legitimate object in
the bucket is a 48 MB `.glb`, and [`lib/supabase/storage.ts`](../lib/supabase/storage.ts)
documents 100 MB as the design ceiling for models.

### Result

| Check                             | Before            | After                                           |
| --------------------------------- | ----------------- | ----------------------------------------------- |
| Anonymous upload                  | ✅ HTTP 200       | ❌ `new row violates row-level security policy` |
| Anonymous bucket listing          | ✅ full filenames | ❌ 0 rows                                       |
| Public image read                 | ✅                | ✅ (unchanged)                                  |
| Signed-URL upload (Museum Editor) | ✅                | ✅ (unchanged)                                  |
| Service-role upload (admin panel) | ✅                | ✅ (unchanged)                                  |
| Upload `text/html` as anon        | ✅                | ❌ `415 invalid_mime_type`                      |

Storage policies on `storage.objects` are now **zero**. The bucket is reachable
for public reads and for nothing else.

> **One honest caveat.** The MIME allowlist is enforced by the storage API for
> `anon` and `authenticated`, but **`service_role` bypasses it** — verified: an SVG
> uploaded with the service role still succeeded. That is acceptable, because the
> service role is this app's own server code and it sets `contentType` itself. The
> allowlist is defence-in-depth against a future policy mistake, not a control on
> our own server. Do not read it as "SVG can never enter the bucket."

---

## Layer 3 — Mini-games and leaderboard integrity

This subsystem is the strongest-designed part of the codebase and needed no
changes. The design principle is stated in the code itself:

> _The request body carries what the player did (their move log), never what they
> scored._

### Why a high score cannot simply be posted

| Attack                                          | What stops it                                                                                                                                                                                                                          |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST` a made-up score                          | There is no score field. `/api/minigames/submit` accepts a `sessionId` and a **move log** only. The server replays those moves against the challenge it stored and computes the score itself.                                          |
| Replay a winning move log                       | Sessions are single-use. On success the row goes `COMPLETED`; a second submit gets `409`.                                                                                                                                              |
| Retry different move logs until one is accepted | A failed verification **burns the session** (`REJECTED`) rather than allowing another attempt.                                                                                                                                         |
| Steal someone else's `sessionId`                | The session is bound to `session.playerId`, and the caller's identity comes from an **HMAC-signed, httpOnly cookie** (`kal_player`, signed with `AUTH_SECRET`). A scraped id submitted from another browser gets `403`.                |
| Forge a player identity                         | The cookie is verified with `crypto.timingSafeEqual`. It can be deleted, but not forged.                                                                                                                                               |
| Script a perfect solve instantly                | The server measures elapsed time from **its own clock** (`startedAt` on the row, not a client value) and rejects anything faster than `scoring.minPlausibleMs` — a valid solution submitted faster than a human could physically move. |
| Let the clock run and submit later              | `expiresAt` plus the game's `timeLimitSec` (with a 15 s network grace) expire the round.                                                                                                                                               |
| Claim a reward without earning it               | `/api/minigames/reward` **recomputes** eligibility from the score stored on the session row, ignoring whatever the submit response said. One claim per session, enforced by a unique index.                                            |
| Flood the endpoints                             | Per-IP fixed-window limits: 30 starts/min, 20 submits/min, 10 claims/min, 60 leaderboard reads/min.                                                                                                                                    |

### Accepted residual risks

These are known, deliberate, and documented in the code. They are recorded here
so a future reader does not mistake them for oversights:

1. **Some challenges ship their own answer to the browser.** `FIND_DIFFERENCE`
   sends the difference coordinates (the code explains why: the client needs a
   hit/miss verdict per click without a round trip, and the answer is visible in
   the two images anyway). `MEMORY_CARDS` sends the `deck` array, which is the card
   layout a player would normally have to discover.

   So a determined cheater who reads the network response _can_ play perfectly.
   What they cannot do is play perfectly **faster than a human**, because the
   `minPlausibleMs` floor and the server's own clock still apply. The realistic
   worst case is a legitimate-looking top score on an art-portfolio leaderboard —
   which the admin can clear in one click. This is the correct trade for the
   feature; closing it would mean round-tripping every click.

2. **Rate limiting is per serverless instance, not global.** The counters live in
   process memory (`lib/rate-limit.ts`), so on Vercel each instance keeps its own.
   This is a speed bump, not a quota. It is deliberate — the alternative is a paid
   Redis dependency and a new availability risk. The load-bearing protections are
   the server-side scoring and single-use sessions, not the limiter.

3. **Anonymous players can farm identities.** Clearing the `kal_player` cookie
   yields a fresh player. Nothing prevents many leaderboard entries from one
   person. Accounts would be the only real fix, and this feature is explicitly
   designed to need no account.

---

## Layer 4 — Shop, orders and payments

### Price manipulation: not possible

`/api/checkout` never reads a price from the request. It loads the products from
the database and builds the line items from `variant.price` / `product.price`,
then computes `total` from those values. A tampered `item.price` in the request
body is simply ignored. Quantity is validated as an integer `>= 1`.

### Overselling: guarded atomically

Stock is not decremented with a read-then-write, which would race under concurrent
checkouts. The webhook uses a conditional `updateMany` — decrement _only if_ enough
remains — and checks the affected row count. Two simultaneous buyers of the last
item cannot both succeed.

### Payment webhook: signature mandatory

`/api/webhooks/paymongo` refuses to run unverified. If `PAYMONGO_WEBHOOK_SECRET`
is unset it returns `500` and logs, rather than falling through to "accept
everything" — a failure mode worth calling out, because the opposite default is a
common way payment webhooks get forged. An invalid signature returns `401`.

Order state changes are idempotent: an order already `PAID` is skipped.

### Order data access

| Route                      | Guard                            |
| -------------------------- | -------------------------------- |
| `GET/POST /api/orders`     | `requireAdmin()`                 |
| `/api/orders/[id]`         | `requireAdmin()`                 |
| `/api/orders/[id]/receipt` | `requireAdmin()`                 |
| `/api/orders/lookup`       | **Public by design** — see below |

`/api/orders/lookup` is intentionally unauthenticated so a guest can check their
order without an account. The credential is **email + order reference together**,
and the reference is `KAL-<ms timestamp>-<8 hex>` — guessing one means guessing
32 bits of randomness _and_ the millisecond of creation. Knowing only the email is
not enough. The response is a curated `select` that deliberately omits
`paymentId`, `checkoutUrl`, `customerEmail` and `customerName`, so it cannot be
used to harvest customer details even on a hit.

### What was fixed on 2026-09-05

| Finding                                                                                                                                                                 | Severity | Fix                                                                                                                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `verifyWebhookSignature` compared HMACs with `===` — a non-constant-time compare that leaks, through timing, how many leading bytes of a guessed signature were correct | Medium   | Now `crypto.timingSafeEqual` over the decoded digests                                                                                             |
| The signature's `t=` timestamp was parsed but **never checked**, so a captured webhook stayed valid forever                                                             | Medium   | 5-minute freshness window (`WEBHOOK_TOLERANCE_SEC`), checked before the HMAC                                                                      |
| `requireAdmin()` compared the `x-api-key` header with `===` — same timing leak, against an admin credential                                                             | Medium   | Now `secretsMatch()`, which SHA-256s both sides and compares with `timingSafeEqual` (hashing first keeps a length mismatch from short-circuiting) |
| `/api/orders/lookup` had no rate limit despite being unauthenticated and hitting the database                                                                           | Low      | 10 requests/min per IP                                                                                                                            |

The webhook replay window is belt-and-braces: the handler was already idempotent,
so a replayed `paid` event did nothing. But idempotency is a property of one call
site and signature freshness is a property of the signature — better enforced once,
in the verifier, than depended upon in every future consumer.

Supporting change: the in-memory limiter moved from `lib/minigames/rate-limit.ts`
to `lib/rate-limit.ts` so the orders route could share it. The mini-games module
now re-exports it and keeps only its `LIMITS` table, so **every existing import
path still resolves and all callers still share one counter map**. Copying the file
instead would have created a second set of counters and quietly doubled every
configured budget.

---

## Layer 5 — Admin authentication

- NextAuth v5, credentials (email + bcrypt password hash) plus optional Google and
  Facebook OAuth.
- OAuth sign-in **never creates an account** — the `signIn` callback in
  `lib/auth.ts` only admits an email that already belongs to an `ADMIN` user.
- TOTP two-factor is supported (`totpEnabled`, `totpSecret`, `totpRecoveryCodes`
  on `User`).
- Password reset tokens are stored **hashed** (`PasswordResetToken.tokenHash`),
  with an expiry — a database read alone does not yield a usable reset link.
- Every admin API route opens with `requireAdmin()`, which accepts either a valid
  session cookie with `role === "ADMIN"` or a matching `x-api-key`.
- `API_SECRET_KEY` unset disables header auth entirely, and the code explicitly
  refuses to treat an empty string as a valid key.

---

## What is deliberately public

Three values ship to the browser and are visible in DevTools. All three are
supposed to be:

| Value                            | Why it is safe                                                                                                                                                                                                                     |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`       | A public hostname.                                                                                                                                                                                                                 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`  | Designed to be public. **After this audit it opens nothing**: the database refuses it at the schema level, and storage now accepts only public reads. Used by exactly one code path — the Museum Scene Editor's signed-URL upload. |
| `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` | Half of a keypair; reCAPTCHA is designed around the site key being visible. The secret half stays server-side.                                                                                                                     |

Server-only and never bundled: `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`,
`SUPABASE_SERVICE_ROLE_KEY`, `RECAPTCHA_SECRET_KEY`, `PAYMONGO_*`,
`GMAIL_APP_PASSWORD`, `VERCEL_ANALYTICS_TOKEN`.

### On hiding DevTools

There is no way to disable the browser's Console or Network tab from a web page,
and no reason to want to. Every published workaround — trapping `F12`, blocking
right-click, `debugger` loops, devtools-detection — is bypassed in seconds by
opening the menu, disabling breakpoints, or simply not using a browser: `curl`,
Postman or a proxy never touch DevTools at all. Meanwhile the workarounds break
keyboard accessibility and make production incidents harder to diagnose.

The correct posture, and the one this system now takes, is the opposite:
**assume everything sent to the browser is visible, and make sure nothing sent to
the browser is a key to anything.** The storage flaw above is the proof of why —
hiding the Console would not have closed it by one inch, because the exploit was a
single `curl` command.

---

## Verification playbook

Re-run these after any Supabase dashboard change, any `yarn db:push`, or before a
release.

**1. The public API role must not reach the schema.** All of these must return `401`:

```bash
URL=$(grep '^NEXT_PUBLIC_SUPABASE_URL' .env | cut -d= -f2- | tr -d '"' | xargs)
KEY=$(grep '^NEXT_PUBLIC_SUPABASE_ANON_KEY' .env | cut -d= -f2- | tr -d '"' | xargs)
for t in User Session Account Order PasswordResetToken; do
  printf "%-20s " "$t"
  curl -s -o /dev/null -w "HTTP %{http_code}\n" \
    "$URL/rest/v1/$t?select=*&limit=1" -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
done
```

**2. Anonymous upload must be refused** (expect `400 invalid_mime_type` or an RLS
violation, never `200`):

```bash
curl -s -w "\nHTTP %{http_code}\n" -X POST \
  "$URL/storage/v1/object/scriptovernovel.music-artworks/_probe/x.html" \
  -H "apikey: $KEY" -H "Authorization: Bearer $KEY" \
  -H "Content-Type: text/html" --data-binary "<html>x</html>"
```

**3. Database invariants.** Against `DIRECT_URL`, all four must hold:

```sql
-- must return 0 rows: every table has RLS
select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;

-- must be 0: no policy should exist, deny-all is the intent
select count(*) from pg_policies where schemaname = 'public';

-- must both be false
select has_schema_privilege('anon','public','USAGE'),
       has_schema_privilege('authenticated','public','USAGE');

-- must be 0
select count(*) from information_schema.role_table_grants
 where table_schema = 'public' and grantee in ('anon','authenticated');
```

**4. The safety net is still armed:**

```sql
select evtname, evtenabled from pg_event_trigger where evtname = 'ensure_rls';
-- expect: ensure_rls | O
```

**5. Nothing legitimate broke.** A public image URL still returns `200`, and a
`.glb` upload through the Museum Scene Editor still completes.

---

## Rules to keep this true

1. **Never `GRANT` anything in `public` to `anon` or `authenticated`.** That single
   command is the one action that would undo Layer 1. There is no feature in this
   codebase that needs it — the app reaches the database through Prisma.
2. **Never remove the `ensure_rls` event trigger.** It is what stops `yarn db:push`
   from shipping an unprotected table.
3. **Never add a storage policy for `anon`.** Uploads go through signed URLs minted
   server-side; that path needs no policy. If a new upload feature seems to need
   one, it is being built the wrong way — copy `createModelUploadUrl`.
4. **Never trust a price, score, quantity or identity from a request body.** Load
   it from the database or derive it server-side. The existing checkout and
   mini-game routes are the reference implementations.
5. **Compare secrets with `timingSafeEqual`, never `===`.** Three places do this
   correctly now: `lib/api-auth.ts`, `lib/paymongo.ts`, `lib/minigames/player.ts`.
6. **Keep `SUPABASE_SERVICE_ROLE_KEY` out of any `NEXT_PUBLIC_` variable.** It
   bypasses RLS _and_ the bucket's MIME allowlist. It is the one key that would
   turn every layer above into decoration.

---

## Audit log

**2026-09-05 — full RLS, grants, policy and storage audit.**

Applied to production in a single transaction:

- RLS enabled on `PasswordResetToken`, `VerificationToken`.
- 23 latent `USING (true)` policies dropped from `public`.
- `anon` / `authenticated` revoked from schema, tables, sequences, functions, and
  from future default privileges in `public`.
- `EXECUTE` on `rls_auto_enable()` revoked from `PUBLIC`.
- Storage policies `Allow Uploads 15bhfms_0` and `Public Read Access 15bhfms_0`
  dropped.
- Bucket `scriptovernovel.music-artworks` given a 100 MB size cap and a 20-entry MIME
  allowlist excluding `text/html` and `image/svg+xml`.

Application changes in the same pass:

- `lib/paymongo.ts` — constant-time signature compare, 5-minute replay window.
- `lib/api-auth.ts` — constant-time API-key compare via `secretsMatch()`.
- `app/api/orders/lookup/route.ts` — 10 req/min per IP.
- `lib/rate-limit.ts` — limiter promoted from `lib/minigames/` so both subsystems
  share one counter map; `lib/minigames/rate-limit.ts` re-exports it.

Test artefacts created during the audit (`_audit_proof/*`) were removed, along with
two pre-existing `cachetest/probe-*.bin` files left over from earlier work. Bucket
went from 485 to 483 objects; no production file was touched.

A rollback snapshot of the pre-audit RLS state, every policy, and the bucket
configuration was captured before any change was applied.
