// lib/auth.ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import Facebook from "next-auth/providers/facebook";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/auth.config";
import { notifyUserOfNewLoginDevice } from "@/lib/notifications/security";
import { consumeRecoveryCode, verifyTotpToken } from "@/lib/totp";
import { logActivity } from "@/lib/activity-log-server";

function clientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip")?.trim() || null;
}

/**
 * Record a sign-in attempt on the audit trail (Dashboard ▸ Activity Log).
 *
 * Every actor is passed explicitly rather than left to the session lookup:
 * during `authorize` there is no session yet by definition, and on a failed
 * attempt there may be no user at all — only the email that was typed, which
 * is exactly the field an admin reviewing failed logins needs to see.
 *
 * `reason` is deliberately coarse ("bad-password", "totp-required"). A failed
 * login is read by whoever is investigating one, and telling them *which*
 * half of a credential pair was wrong is the same hint it would give an
 * attacker who could see this. The categories here distinguish "wrong
 * password" from "second factor missing" because those need different
 * responses, and stop there.
 */
function logLoginAttempt(
  request: Request,
  outcome: "succeeded" | "failed",
  email: string,
  detail: { userId?: string; name?: string | null; reason?: string; newDevice?: boolean }
): void {
  void logActivity({
    category: "AUTH",
    action: outcome === "succeeded" ? "auth.login.succeeded" : "auth.login.failed",
    summary:
      outcome === "succeeded"
        ? `${detail.name || email} signed in${detail.newDevice ? " from a new device" : ""}.`
        : `Failed sign-in attempt for ${email}.`,
    actor: {
      id: detail.userId ?? null,
      label: detail.name ?? email,
      email,
      type: "admin",
    },
    entityType: detail.userId ? "user" : null,
    entityId: detail.userId ?? null,
    metadata: {
      ...(detail.reason ? { reason: detail.reason } : {}),
      ...(detail.newDevice ? { newDevice: true } : {}),
    },
    request,
  });
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  trustHost: true,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  callbacks: {
    ...authConfig.callbacks,
    // Admin-only login surface, not general sign-up: an OAuth sign-in is
    // allowed only when it resolves to an email that already exists as an
    // ADMIN user. Runs (and can reject) *before* the adapter would ever
    // touch the database for this sign-in — see handleAuthorized firing
    // ahead of handleLoginOrRegister in @auth/core — so a rejection here
    // never lets a new User/Account row get created.
    async signIn({ user, account }) {
      if (account?.provider === "google" || account?.provider === "facebook") {
        if (!user.email) return false;
        const existing = await prisma.user.findUnique({
          where: { email: user.email },
        });
        if (!existing || existing.role !== "ADMIN") return false;
      }
      return true;
    },
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        // Populated only on the second step of the login form once a TOTP-
        // enabled account's password has already checked out client-side
        // via /api/auth/check-password. Accepts either a 6-digit
        // authenticator code or a recovery code — see the check below.
        code: { label: "Authenticator code", type: "text" },
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) return null;
        const attemptedEmail = credentials.email as string;
        const user = await prisma.user.findUnique({
          where: { email: attemptedEmail },
        });
        if (!user || !user.password) {
          logLoginAttempt(request, "failed", attemptedEmail, { reason: "unknown-account" });
          return null;
        }
        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );
        if (!isValid) {
          logLoginAttempt(request, "failed", attemptedEmail, {
            userId: user.id,
            name: user.name,
            reason: "bad-password",
          });
          return null;
        }

        // Second factor — a correct password alone must never issue a
        // session once TOTP is enabled. Tries a 6-digit authenticator code
        // first (the common case), then falls back to treating the input as
        // a one-time recovery code.
        if (user.totpEnabled) {
          const code = typeof credentials.code === "string" ? credentials.code.trim() : "";
          if (!code) {
            // Not really an attack signal on its own — this is the normal
            // first leg of the two-step form, before the code is collected.
            // Logged anyway so a burst of them is visible as one.
            logLoginAttempt(request, "failed", attemptedEmail, {
              userId: user.id,
              name: user.name,
              reason: "totp-required",
            });
            return null;
          }

          let totpOk = false;
          if (/^\d{6}$/.test(code) && user.totpSecret) {
            totpOk = await verifyTotpToken(code, user.totpSecret);
          }

          if (!totpOk) {
            const remaining = await consumeRecoveryCode(code, user.totpRecoveryCodes);
            if (remaining === null) {
              // Password was right, second factor was not — the single most
              // worth-investigating line this log can hold.
              logLoginAttempt(request, "failed", attemptedEmail, {
                userId: user.id,
                name: user.name,
                reason: "bad-totp-code",
              });
              return null;
            }
            await prisma.user
              .update({ where: { id: user.id }, data: { totpRecoveryCodes: remaining } })
              .catch((err) => {
                console.error("[auth] failed to burn used recovery code", err);
              });
          }
        }

        // New-device detection: compare this request's user-agent against
        // the one recorded on the last successful login. A user with no
        // prior fingerprint (first login since this shipped, or a fresh
        // account) never fires a false alert — there's nothing to compare
        // against yet. Best-effort: a mail hiccup or a slow write here must
        // never block sign-in.
        const ip = clientIp(request);
        const userAgent = request.headers.get("user-agent");
        const isNewDevice =
          user.lastLoginUserAgent !== null &&
          user.lastLoginUserAgent !== userAgent;

        if (isNewDevice) {
          notifyUserOfNewLoginDevice(user.email, {
            ip,
            userAgent,
            occurredAt: new Date(),
          }).catch((err) => {
            console.error("[auth] failed to send new-login-device email", err);
          });
        }

        await prisma.user
          .update({
            where: { id: user.id },
            data: { lastLoginAt: new Date(), lastLoginIp: ip, lastLoginUserAgent: userAgent },
          })
          .catch((err) => {
            console.error("[auth] failed to record login fingerprint", err);
          });

        logLoginAttempt(request, "succeeded", user.email, {
          userId: user.id,
          name: user.name,
          newDevice: isNewDevice,
        });

        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // Safe specifically because the signIn callback above already refuses
      // anything but an email that's already an ADMIN row — this doesn't
      // open the "attacker signs up with someone else's email" hole the
      // option is normally named for, since there's no sign-up path here at
      // all. Without it, Auth.js throws OAuthAccountNotLinked instead of
      // linking to the existing admin account by email.
      allowDangerousEmailAccountLinking: true,
    }),
    Facebook({
      clientId: process.env.FACEBOOK_CLIENT_ID,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
  ],
});