// lib/paymongo.ts

import crypto from "crypto";

const PAYMONGO_BASE_URL = "https://api.paymongo.com/v1";

function getAuthHeader() {
  const key = process.env.PAYMONGO_SECRET_KEY;
  if (!key) throw new Error("PAYMONGO_SECRET_KEY is not set");
  return `Basic ${Buffer.from(key + ":").toString("base64")}`;
}

// Every `payment_method_type` PayMongo's Checkout Sessions API currently
// accepts. This is an allowlist, not just documentation — it's used below to
// sanitize PAYMONGO_PAYMENT_METHODS before it ever reaches the API request,
// so a mistyped or tampered env value can't smuggle an arbitrary string into
// the request body.
const SUPPORTED_PAYMENT_METHODS = [
  "gcash",
  "card",
  "paymaya", // Maya (formerly PayMaya)
  "grab_pay",
  "qrph", // QR Ph — reachable from any QR Ph-enrolled bank/wallet app (e.g. GoTyme, Maribank)
  "billease",
  "dob", // online banking (BPI, RCBC, etc.)
  "dob_ubp", // online banking (UnionBank)
] as const;

type PaymentMethodType = (typeof SUPPORTED_PAYMENT_METHODS)[number];

// Enabled by default — restricted to whatever is actually activated on this
// PayMongo account today (Dashboard > Settings > Payment Methods). The rest
// of SUPPORTED_PAYMENT_METHODS above stays defined so they can be turned on
// via PAYMONGO_PAYMENT_METHODS the moment they're activated, but they must
// NOT be added here first: passing a method type that isn't activated makes
// the *entire* checkout-session request fail with a 400, breaking checkout
// for every payment method, not just the unactivated one.
const DEFAULT_PAYMENT_METHODS: PaymentMethodType[] = ["gcash", "card", "qrph"];

// Resolve the payment methods to offer at checkout. Configurable via
// PAYMONGO_PAYMENT_METHODS (comma-separated, e.g. "gcash,card,paymaya") so
// ops can turn a newly-activated method on/off without a code deploy —
// useful since activation happens on PayMongo's dashboard on its own
// timeline. Anything not in SUPPORTED_PAYMENT_METHODS is silently dropped
// rather than forwarded to PayMongo, and an env value that resolves to
// nothing usable falls back to the safe default instead of sending an
// empty/broken payment_method_types array.
function resolvePaymentMethods(): PaymentMethodType[] {
  const raw = process.env.PAYMONGO_PAYMENT_METHODS;
  if (!raw) return DEFAULT_PAYMENT_METHODS;

  const requested = raw
    .split(",")
    .map((m) => m.trim().toLowerCase())
    .filter(Boolean);

  const valid = requested.filter((m): m is PaymentMethodType =>
    (SUPPORTED_PAYMENT_METHODS as readonly string[]).includes(m)
  );

  const invalid = requested.filter((m) => !valid.includes(m as PaymentMethodType));
  if (invalid.length > 0) {
    console.warn(
      `PAYMONGO_PAYMENT_METHODS: ignoring unsupported value(s): ${invalid.join(", ")}`
    );
  }

  // De-dupe while preserving order.
  const deduped = [...new Set(valid)];
  return deduped.length > 0 ? deduped : DEFAULT_PAYMENT_METHODS;
}

export interface LineItem {
  name: string;
  quantity: number;
  amount: number; // in centavos
  currency: string;
  images?: string[];
}

export interface CreateCheckoutSessionParams {
  lineItems: LineItem[];
  successUrl: string;
  cancelUrl: string;
  referenceNumber: string;
  description?: string;
  customerEmail?: string;
  customerName?: string;
}

export async function createCheckoutSession(
  params: CreateCheckoutSessionParams
) {
  const body = {
    data: {
      attributes: {
        billing: params.customerName
          ? {
              name: params.customerName,
              email: params.customerEmail,
            }
          : undefined,
        send_email_receipt: false,
        show_description: true,
        show_line_items: true,
        reference_number: params.referenceNumber,
        description: params.description ?? "ScriptOverNovel Art Order",
        line_items: params.lineItems,
        payment_method_types: resolvePaymentMethods(),
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
      },
    },
  };

  const response = await fetch(`${PAYMONGO_BASE_URL}/checkout_sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: getAuthHeader(),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      `PayMongo error: ${JSON.stringify(error.errors || error)}`
    );
  }

  return response.json();
}

export async function retrieveCheckoutSession(sessionId: string) {
  const response = await fetch(
    `${PAYMONGO_BASE_URL}/checkout_sessions/${sessionId}`,
    {
      headers: {
        Authorization: getAuthHeader(),
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to retrieve checkout session");
  }

  return response.json();
}

export async function retrievePaymentIntent(paymentIntentId: string) {
  const response = await fetch(
    `${PAYMONGO_BASE_URL}/payment_intents/${paymentIntentId}`,
    {
      headers: {
        Authorization: getAuthHeader(),
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to retrieve payment intent");
  }

  return response.json();
}

/**
 * How far out of date a webhook's own timestamp may be and still be honoured.
 *
 * PayMongo signs `t=<unix seconds>` alongside the digest, so a captured
 * request stays byte-for-byte valid forever unless that timestamp is actually
 * checked. The order handler is already idempotent (it skips an order that is
 * PAID), which blunts a replay, but idempotency is a property of one call
 * site and this is a property of the signature — cheaper to enforce here,
 * once, than to rely on every future consumer preserving it.
 *
 * Five minutes is PayMongo's own retry cadence with room for clock skew.
 */
const WEBHOOK_TOLERANCE_SEC = 5 * 60;

export function verifyWebhookSignature(
  payload: string,
  signature: string,
  webhookSecret: string
): boolean {
  const { t: timestamp, v1 } = signature.split(",").reduce(
    (acc: Record<string, string>, part: string) => {
      const [key, value] = part.split("=");
      acc[key] = value;
      return acc;
    },
    {}
  );

  if (!timestamp || !v1) return false;

  // Reject a stale (or absurdly future-dated) event before spending an HMAC
  // on it. Math.abs covers skew in both directions.
  const sentAt = Number(timestamp);
  if (!Number.isFinite(sentAt)) return false;
  if (Math.abs(Date.now() / 1000 - sentAt) > WEBHOOK_TOLERANCE_SEC) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const expectedSignature = crypto
    .createHmac("sha256", webhookSecret)
    .update(signedPayload)
    .digest("hex");

  // Constant-time compare: `===` on strings bails at the first differing
  // byte, so its runtime leaks how much of a guessed digest was correct —
  // enough, over many attempts, to reconstruct a valid signature one byte at
  // a time. timingSafeEqual throws on a length mismatch, so guard that first
  // (the length of a hex SHA-256 digest is public anyway, and leaks nothing).
  const provided = Buffer.from(v1, "hex");
  const expected = Buffer.from(expectedSignature, "hex");
  if (provided.length !== expected.length) return false;

  return crypto.timingSafeEqual(provided, expected);
}

// Convert PHP pesos to centavos (PayMongo uses centavos)
export function tocentavos(amount: number): number {
  return Math.round(amount * 100);
}
