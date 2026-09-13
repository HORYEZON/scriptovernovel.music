# Going Live with PayMongo — Setup Guide

> Written 2026-08-13, updated 2026-08-15. Covers: switching from PayMongo test mode to live money, and the now-configurable payment method list (GCash, Card, QRPH by default; Maya/GrabPay/BillEase/Online Banking available behind an env var once activated). **PayPal is not supported by PayMongo** — see the note below before doing anything else.

## 0. Read this first: PayPal isn't a PayMongo option

PayMongo (the gateway this app is already wired to via `lib/paymongo.ts`) only supports Philippine payment rails: **Card, GCash, GrabPay, Maya, Direct Online Banking (BPI/UnionBank/etc.), BillEase, and QRPH.** PayPal is not one of PayMongo's payment method types — there's no config flag or code change that adds it, because PayMongo simply doesn't process PayPal transactions.

If Kyla specifically needs PayPal (e.g. for overseas buyers who don't have a PH bank/e-wallet), that would mean integrating PayPal Checkout as a **second, separate** payment provider alongside PayMongo — a real second integration (own SDK, own webhook, own order-status wiring), not a config change. That's a meaningfully bigger job than what's below. Worth confirming with her whether GCash + Card + QRPH actually covers her buyers before taking that on — for a Philippines-based shop it usually does.

The rest of this guide assumes: **GCash + Card + QRPH (already coded, on by default)**, with Maya, GrabPay, BillEase, and Online Banking available as a one-line env var change once each is activated on the live account — no PayPal.

---

## 1. What's already built vs. what needs setup

| Piece                                                              | Status                                                                                           |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Checkout session creation, webhook handler, order/stock/email flow | ✅ Built (`app/api/checkout/route.ts`, `app/api/webhooks/paymongo/route.ts`)                     |
| GCash + Card + QRPH as payment methods                             | ✅ Default in `lib/paymongo.ts` (`DEFAULT_PAYMENT_METHODS`) — works as soon as live keys are set |
| Maya / GrabPay / BillEase / Online Banking (BPI, UnionBank, etc.)  | ⚠️ Already supported in code, opt-in via one env var — see §4                                    |
| Live PayMongo account (not sandbox)                                | ❌ Needs to be requested/verified — see §2                                                       |
| Live API keys in production env                                    | ❌ Currently only test keys should be set — see §3                                               |
| Webhook registered with PayMongo pointing at your live domain      | ❌ See §5                                                                                        |

The shop itself (`/shop`, `/cart`, `/checkout`) is still **unlinked from the nav** (`components/public/Navbar.tsx` and `Footer.tsx` both have the Shop/Cart links commented out as "Phase 2"). That's your kill switch — nothing below goes live to real customers until those are uncommented, so you can do all of this and dry-run it safely before flipping it on.

---

## 2. Get a live PayMongo account

1. Log in to the [PayMongo Dashboard](https://dashboard.paymongo.com).
2. If the account is still in **Test mode only**, go to **Business Settings** and submit the business verification (KYC) — valid ID, business/DTI registration or sole proprietorship docs, bank account for payouts. This is Kyla's business, so she (or whoever the PayMongo account is registered to) needs to be the one who completes this — approval can take a few business days.
3. Once approved, the dashboard gives you a **Live** mode toggle alongside **Test** mode, each with its own API keys.
4. Check **Settings → Payment Methods** on the live account for which channels are actually active — GCash, Card, and QRPH are what this app ships with by default, but confirm anyway. If Kyla wants Maya, GrabPay, BillEase, or Online Banking too, ask PayMongo (via their dashboard support chat, or the toggle in Payment Methods if it's self-serve) to **enable** each one — some channels need to be explicitly turned on per-merchant before PayMongo's API will accept them.

---

## 3. Swap test keys for live keys

In `lib/paymongo.ts`, only the **secret key** is used (`PAYMONGO_SECRET_KEY`, read in `getAuthHeader()`). `PAYMONGO_PUBLIC_KEY` is listed in `.env.example` but isn't actually referenced anywhere in the code — this app talks to PayMongo entirely server-side via Checkout Sessions, so there's no client-side PayMongo.js that would need the public key. You can leave it unset.

1. In the PayMongo dashboard, switch to **Live** mode → **Developers** → **API Keys**.
2. Copy the **live secret key** (starts with `sk_live_...`).
3. Set it wherever this app's production env vars live (Vercel → Project → Settings → Environment Variables, or your host's equivalent):
   ```
   PAYMONGO_SECRET_KEY=sk_live_xxxxxxxxxxxxxxxxxxxx
   ```
4. Leave your local `.env` pointed at the **test** key (`sk_test_...`) so local development keeps using PayMongo's sandbox and never touches real money.

---

## 4. Turn on more payment methods (Maya, GrabPay, BillEase, Online Banking)

As of this session, the method list is no longer a hardcoded array — it's resolved in [lib/paymongo.ts](lib/paymongo.ts) by `resolvePaymentMethods()`, which reads the `PAYMONGO_PAYMENT_METHODS` env var (comma-separated), validates every value against an allowlist (`SUPPORTED_PAYMENT_METHODS`), and falls back to the built-in default — `gcash,card,qrph` — if the env var is unset or ends up with nothing valid in it. That means turning on another method is now an **env var change, not a code change**.

Supported values (the full allowlist): `gcash`, `card`, `paymaya` (Maya), `grab_pay` (GrabPay), `qrph` (QRPH), `billease` (BillEase), `dob` (Direct Online Banking — buyer picks their bank: BPI, UnionBank, Chinabank, RCBC, etc.), `dob_ubp` (UnionBank specifically, skips the bank-picker).

To add, say, Maya and UnionBank on top of the defaults, set in production env:

```
PAYMONGO_PAYMENT_METHODS="gcash,card,qrph,paymaya,dob_ubp"
```

Two things worth being deliberate about here:

- **The allowlist check happening is not the same as the method being live.** A value like `paymaya` passes the code's validation fine either way — that check only guards against typos/tampering reaching PayMongo's API, it says nothing about whether PayMongo has actually activated that channel on your account. Only add a method to `PAYMONGO_PAYMENT_METHODS` **after** confirming it's active in the Dashboard (§2, step 4).
- **This is a single request, not per-method.** If even one listed method type isn't activated on the account behind the key in use, the _entire_ checkout-session creation call fails with a 400 — every buyer sees a broken checkout, not just ones trying to pay with the unapproved method. Always **test the new value in Test mode first**, with test keys, before touching the production env var.

The checkout page's payment badges ([app/(public)/checkout/CheckoutClient.tsx](<app/(public)/checkout/CheckoutClient.tsx>)) are a separate, hand-maintained list — currently GCash, QR Ph, and Card. If you add a method via the env var, update that list too so customers aren't shown (or not shown) something that doesn't match what's actually offered at PayMongo's hosted checkout.

---

## 5. Register the live webhook

The webhook is how PayMongo tells this app "the customer actually paid" — it's what flips an order from `PENDING` to `PAID`, decrements stock, and sends the confirmation/alert emails. **As of this session, the webhook route rejects any request if `PAYMONGO_WEBHOOK_SECRET` isn't set** (previously it silently skipped verification when unset — that's now a hard failure instead, so this step is not optional).

1. PayMongo dashboard → **Live** mode → **Developers** → **Webhooks** → **Add Endpoint**.
2. URL: `https://<your-production-domain>/api/webhooks/paymongo`
3. Events to send: `checkout_session.payment.paid` and `checkout_session.payment.failed` (the handler in `app/api/webhooks/paymongo/route.ts` only acts on those two, plus a legacy `payment.paid` case).
4. PayMongo shows a **webhook signing secret** (`whsk_...`) for that endpoint — copy it.
5. Set it in production env alongside the secret key:
   ```
   PAYMONGO_WEBHOOK_SECRET=whsk_xxxxxxxxxxxxxxxxxxxx
   ```
6. Also set (if not already, for correct success/cancel/webhook URLs and checkout emails):
   ```
   NEXT_PUBLIC_APP_URL=https://<your-production-domain>
   GMAIL_USER=kylamarie.zuniga@gmail.com
   GMAIL_APP_PASSWORD=<gmail app password>
   ORDER_ALERT_EMAIL=kylamarie.zuniga@gmail.com   # optional, defaults to GMAIL_USER
   ```

---

## 6. Before flipping the Shop nav links on

1. With **live keys still off** (test mode), run a full dry run: add an item to cart → checkout → pay with a PayMongo **test** GCash/card → confirm the order shows `PAID` in `/admin/orders`, stock decremented, confirmation + admin alert emails both arrived.
2. Switch env vars to live keys (§3, §5) on a staging/preview deploy if you have one, and repeat the dry run with a small real GCash payment to yourself — PayMongo live mode does process real money once live keys are set, there's no separate "live test" toggle.
3. Only then uncomment the Shop/Cart links in `Navbar.tsx` / `Footer.tsx` and deploy.

---

## Related: what changed in the 2026-08-13 security pass

While reviewing this flow for launch-readiness, three issues were found and fixed (see chat for the full report): checkout no longer trusts a client-supplied price (it's now always looked up from the product/variant in the database), order-confirmation emails now escape customer-supplied text before embedding it as HTML, and stock decrements on payment are now atomic so two concurrent buyers can't both "win" the last unit of a one-of-a-kind piece. The webhook signature check (§5) was also hardened from optional to mandatory. None of this needs anything from you beyond making sure `PAYMONGO_WEBHOOK_SECRET` is actually set in production, per §5.

## Related: what changed 2026-08-15 (payment methods)

The payment method list moved from a hardcoded array to the env-configurable, allowlist-validated setup described in §4 (`PAYMONGO_PAYMENT_METHODS`, resolved by `resolvePaymentMethods()` in `lib/paymongo.ts`). The default also changed: it's now `gcash,card,qrph` (QRPH replacing what used to be `paymaya` in the default set), because those are the three channels confirmed active on the account at the time — Maya and GrabPay were previously listed in code but not actually activated on the PayMongo dashboard, which would have made every checkout-session request fail once live keys were set. `.env.example` documents the same default and the tradeoffs. See §4 before adding anything back to the list.
