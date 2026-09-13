// lib/totp.ts
//
// Thin wrapper around otplib for the admin's TOTP second factor, plus the
// one-time recovery-code helpers that go with it. Kept in one place so
// lib/auth.ts's authorize() and the app/api/admin/totp/* routes agree on
// exactly how a code is generated, checked, and how recovery codes are
// hashed — the same reasoning as lib/mail.ts centralizing the transport.
//
// otplib v13's API is functional, not the classic `authenticator` singleton
// of older versions — see generateSecret/generateURI/verify below.
import { generateSecret, generateURI, verify } from "otplib";
import QRCode from "qrcode";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const ISSUER = "ScriptOverNovel Music";

// ±30s (one time-step either side of "now") — enough to absorb ordinary
// clock drift between the admin's phone and this server without opening a
// multi-minute replay window. otplib's own tolerance option, not a
// hand-rolled one.
const EPOCH_TOLERANCE_SECONDS = 30;

export function generateTotpSecret(): string {
  return generateSecret();
}

/** otpauth:// URI that becomes the enrollment QR code. */
export function totpKeyUri(email: string, secret: string): string {
  return generateURI({ issuer: ISSUER, label: email, secret });
}

export async function totpQrCodeDataUrl(keyUri: string): Promise<string> {
  return QRCode.toDataURL(keyUri);
}

/** True when `token` is a valid current (±30s) code for `secret`. */
export async function verifyTotpToken(
  token: string,
  secret: string
): Promise<boolean> {
  try {
    const result = await verify({
      secret,
      token,
      epochTolerance: EPOCH_TOLERANCE_SECONDS,
    });
    return result.valid;
  } catch {
    // Malformed input (wrong length, non-numeric) — callers just want a
    // boolean, not a thrown error.
    return false;
  }
}

const RECOVERY_CODE_COUNT = 10;

/** e.g. "7K3F-9QXP" — short enough to type by hand, long enough that 10 of
 * them can't be brute-forced in the time it'd take to lock the account out
 * some other way. */
function randomRecoveryCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I — hand-entry
  const part = () =>
    Array.from(crypto.randomBytes(4))
      .map((b) => chars[b % chars.length])
      .join("");
  return `${part()}-${part()}`;
}

/** Plaintext codes to show the admin once, and their bcrypt hashes to
 * persist — the plaintext never gets stored. */
export async function generateRecoveryCodes(): Promise<{
  plaintext: string[];
  hashed: string[];
}> {
  const plaintext = Array.from({ length: RECOVERY_CODE_COUNT }, randomRecoveryCode);
  const hashed = await Promise.all(plaintext.map((code) => bcrypt.hash(code, 10)));
  return { plaintext, hashed };
}

/**
 * Checks `code` against a user's stored recovery-code hashes and, if it
 * matches, returns the remaining hash list with that one removed (single-
 * use). Returns null when nothing matched — callers should leave the stored
 * list untouched in that case.
 */
export async function consumeRecoveryCode(
  code: string,
  hashedCodes: string[]
): Promise<string[] | null> {
  const normalized = code.trim().toUpperCase();
  for (let i = 0; i < hashedCodes.length; i++) {
    if (await bcrypt.compare(normalized, hashedCodes[i])) {
      return [...hashedCodes.slice(0, i), ...hashedCodes.slice(i + 1)];
    }
  }
  return null;
}
