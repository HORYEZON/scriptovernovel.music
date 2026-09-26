// lib/store/notify.ts
//
// "Tell me when this is back" — the client-safe half: the acknowledgement the
// form and the API both use, and the limits.
//
// Email validation is `lib/subscribers.ts`'s, reused rather than rewritten: an
// address is an address, and two regexes in one codebase is one of them being
// wrong.
export { isValidSubscriberEmail as isValidNotifyEmail, normalizeEmail } from "@/lib/subscribers";

/** Same sentence whether the request was new or already on file — see the POST
 *  route on why nothing here confirms or denies that an address is waiting. */
export const NOTIFY_ACK = "Done — we'll email you once, the day it's available.";

/** One person can't queue up for the whole shop from one address in a sitting.
 *  Generous for a real visitor, tight enough that the endpoint can't be used to
 *  line a stranger up for fifty alerts. */
export const NOTIFY_RATE_LIMIT = 6;
export const NOTIFY_RATE_WINDOW_MS = 60 * 1000;
