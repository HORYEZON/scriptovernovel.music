# Admin Login Hardening — OAuth2 & Two-Factor Setup Guide

> Written 2026-08-16. Covers: enabling "Continue with Google/Facebook" on the admin login, and what Google Authenticator (TOTP) two-factor authentication needs from your side. Both are **optional** — the existing email+password login keeps working exactly as before if you skip this whole guide.

## 0. Read this first: what these two features actually are

This app has exactly **one login surface** — the `ADMIN` account(s) already in the `User` table. Neither feature below is a general sign-up system:

- **Google/Facebook OAuth** is a second way to *authenticate as an account that already exists*. Signing in with a Google/Facebook account only succeeds if that account's email is **exactly the same email as an existing `ADMIN` row** — it can never create a new account, and it can't be used to take over an account with a different email. See `lib/auth.ts`'s `signIn` callback if you want to read the enforcement yourself.
- **TOTP (Google Authenticator)** is a second *factor* on top of the password login, enrolled per-admin from inside the admin panel (**Settings → Security**) — no environment variables needed for this half at all. It's covered here only for completeness; the actual enrollment walkthrough is in [`Docs/UserTraining.md` §14](UserTraining.md#14-settings--security-2fa--sign-in).

**Known limitation, by design:** TOTP currently gates the password login only. Signing in via Google/Facebook does not prompt for a code, even if the account has 2FA enabled. This was a deliberate scope decision — extending 2FA to the OAuth path needs a "pending 2FA" intermediate session state that touches `middleware.ts` and `auth.config.ts`, the single most sensitive code path in the app, and was deferred rather than rushed. If your account has 2FA on, treat password+code as the stronger of the two login paths until that lands.

---

## 1. What's already built vs. what needs setup

| Piece | Status |
| --- | --- |
| Google/Facebook provider wiring, email-must-already-be-admin enforcement | ✅ Built (`lib/auth.ts`) |
| "Continue with Google/Facebook" buttons on `/login` | ✅ Built (`app/(auth)/login/LogInForm.tsx`) |
| TOTP enrollment, verification, disable, recovery codes | ✅ Built — no setup needed, see `Docs/UserTraining.md` §14 |
| Google Cloud OAuth client (Client ID/Secret) | ❌ You need to create this — see §2 |
| Meta (Facebook) app + Facebook Login product | ❌ You need to create this — see §3 |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `FACEBOOK_CLIENT_ID` / `FACEBOOK_CLIENT_SECRET` in production env | ❌ See §4 |

The "Continue with Google/Facebook" buttons on `/login` always render — they aren't hidden based on whether the env vars in §4 are set. Until they're set, clicking one will fail (the provider isn't configured server-side) rather than redirect anywhere; the password login is completely unaffected either way, so there's no broken state to worry about while you set this up.

---

## 2. Create a Google OAuth client

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services → Credentials** (create/select a project first if you don't have one for this site).
2. If you haven't already, configure the **OAuth consent screen** (APIs & Services → OAuth consent screen):
   - User type: **External** (unless you have a Google Workspace and want to restrict to it — either works here, since the app's own `signIn` callback already restricts sign-in to a known admin email regardless of consent-screen settings).
   - App name: `ScriptOverNovel Music` (or whatever you prefer — this is just what the Google consent popup shows).
   - Scopes: the defaults (`email`, `profile`, `openid`) are all this app asks for.
   - You don't need to submit for verification for a single-admin internal tool — an "unverified app" warning screen is fine and expected; click through it.
3. Back in **Credentials**, click **Create Credentials → OAuth client ID**.
   - Application type: **Web application**.
   - Name: anything recognizable, e.g. `scriptovernovel-music-admin`.
   - **Authorized redirect URIs** — add exactly this, once per environment you use:
     ```
     http://localhost:3000/api/auth/callback/google       (local dev)
     https://<your-production-domain>/api/auth/callback/google
     ```
     This must match `NEXTAUTH_URL` from your `.env` — Auth.js builds the callback URL as `{NEXTAUTH_URL}/api/auth/callback/google`, and Google rejects anything that doesn't exactly match what's registered here.
4. Click **Create**. Copy the **Client ID** and **Client Secret** shown — you'll need both in §4.

---

## 3. Create a Facebook app + Facebook Login

1. Go to [Meta for Developers](https://developers.facebook.com/) → **My Apps → Create App**.
   - Use case: **Authenticate and request data from users with Facebook Login** (or "Consumer" on older UI versions).
   - App name: `ScriptOverNovel Music` (shown on the Facebook login dialog).
2. Once the app is created, add the **Facebook Login** product from the dashboard (**Add Product → Facebook Login → Set Up**).
3. Go to **Facebook Login → Settings**. Under **Valid OAuth Redirect URIs**, add exactly this, once per environment:
   ```
   http://localhost:3000/api/auth/callback/facebook       (local dev)
   https://<your-production-domain>/api/auth/callback/facebook
   ```
   Same matching rule as Google — this must line up with `NEXTAUTH_URL`.
4. Go to **App Settings → Basic**. Copy the **App ID** and **App Secret** — you'll need both in §4.
5. While the app is in **Development mode**, only users listed as Admins/Developers/Testers on the Facebook app (App Roles) can actually complete a Facebook login — everyone else gets blocked by Facebook itself before this app ever sees them. For a single-admin site this is usually fine to leave as-is (add yourself as a tester if the account you sign in with isn't already the app's owner); switching to **Live mode** removes that restriction but isn't required for this login button to work for you.

---

## 4. Set the environment variables

Add all four to wherever this app's env vars live (your local `.env`, and your host's environment variable settings for production — e.g. Vercel → Project → Settings → Environment Variables):

```env
GOOGLE_CLIENT_ID="xxxxxxxxxxxx.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-xxxxxxxxxxxxxxxxxxxx"
FACEBOOK_CLIENT_ID="xxxxxxxxxxxxxxxxx"
FACEBOOK_CLIENT_SECRET="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

Also double-check `NEXTAUTH_URL` is set correctly for the environment (`http://localhost:3000` locally, your real domain in production) — both redirect URIs above are built from it, and a mismatch here is by far the most common cause of an OAuth sign-in failing with a redirect-URI error.

Restart the dev server (or redeploy) after setting these.

---

## 5. Which admin email(s) can actually use this

Only emails that already exist as an `ADMIN`-role row in the `User` table can sign in via Google/Facebook — see `lib/auth.ts`'s `signIn` callback (`allowDangerousEmailAccountLinking: true` on both providers, paired with that callback's own check, is what makes linking-to-an-existing-account work instead of Auth.js's default "reject an unlinked email" behavior — see the comment above each provider for why that combination is safe here specifically).

If you need a *different* email to use Google/Facebook sign-in, that email needs its own `ADMIN` row first (see `README.md` → "Creating the First Admin User" for how existing admin accounts get created) — there's no self-service way to add one from the OAuth flow itself, by design.

---

## 6. Testing it

1. With env vars set (§4) and `NEXTAUTH_URL` pointed at the environment you're testing, go to `/login`.
2. Click **Continue with Google** (or Facebook). You should be redirected to Google/Facebook's own login screen, then bounced back to `/admin/dashboard` once you approve.
3. Try it once with the email that **is** an existing admin (should succeed) and, if you want to confirm the guard rail, once with a Google/Facebook account whose email is **not** an admin (should fail — you'll land back on `/login`, no account gets created).
4. If it fails with a redirect-URI error from Google/Facebook's own screen (not this app), the URI registered in §2/§3 doesn't exactly match `{NEXTAUTH_URL}/api/auth/callback/google` (or `/facebook`) — check for a trailing slash or http-vs-https mismatch first, those are the usual culprits.

---

## Related

- Two-factor authentication (Google Authenticator) enrollment walkthrough: [`Docs/UserTraining.md` §14](UserTraining.md#14-settings--security-2fa--sign-in)
- Password reset flow (unaffected by any of this): [`Docs/UserTraining.md` §1.1](UserTraining.md#11-forgot-your-password)
- Full env var reference: `README.md` → "Environment variables"
