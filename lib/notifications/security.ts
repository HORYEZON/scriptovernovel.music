// lib/notifications/security.ts
//
// Account security alerts — email only, no in-app Notification row (see the
// Notification model's doc comment in prisma/schema.prisma for why: these
// concern whoever owns the account, not something the admin dashboard's
// notification list is for). Best-effort like every other notifier here — a
// send failure never blocks the password change or the login itself.
import { isMailConfigured, sendMail } from "@/lib/mail";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function notifyUserOfPasswordChange(to: string): Promise<void> {
  if (!isMailConfigured()) return;

  try {
    await sendMail({
      to,
      subject: "Your ScriptOverNovel Music password was changed",
      text: `This confirms the password for your ScriptOverNovel Music admin account (${to}) was just changed.\n\nIf you made this change, no action is needed.\n\nIf you didn't request this, reset your password immediately — someone else may have access to your account.`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
          <h2 style="margin-bottom: 8px;">Password changed</h2>
          <p>The password for your ScriptOverNovel Music admin account (<strong>${escapeHtml(to)}</strong>) was just changed.</p>
          <p style="font-size: 13px; color: #666; margin-top: 24px;">If you made this change, no action is needed. If you didn't request this, reset your password immediately — someone else may have access to your account.</p>
        </div>
      `,
    });
  } catch (error) {
    console.error(
      "[notifications] failed to send password-changed email",
      error
    );
  }
}

/**
 * Sent whenever two-factor auth gets turned off for the account — whether
 * the admin did it themselves from Settings → Security, or it happened as
 * the last-resort recovery path (see app/api/admin/totp/disable/route.ts).
 * Either way, this is the account's security posture visibly weakening, so
 * it gets the same "heads up" treatment as a password change.
 */
export async function notifyUserOfTotpDisabled(to: string): Promise<void> {
  if (!isMailConfigured()) return;

  try {
    await sendMail({
      to,
      subject: "Two-factor authentication was turned off",
      text: `This confirms that two-factor authentication (Google Authenticator) for your ScriptOverNovel Music admin account (${to}) was just turned off.\n\nIf you did this, no action is needed.\n\nIf you didn't request this, reset your password immediately and re-enable two-factor authentication from Admin → Settings → Security.`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
          <h2 style="margin-bottom: 8px;">Two-factor authentication turned off</h2>
          <p>Two-factor authentication for your ScriptOverNovel Music admin account (<strong>${escapeHtml(to)}</strong>) was just turned off.</p>
          <p style="font-size: 13px; color: #666; margin-top: 24px;">If you did this, no action is needed. If you didn't request this, reset your password immediately and re-enable two-factor authentication from Admin → Settings → Security.</p>
        </div>
      `,
    });
  } catch (error) {
    console.error(
      "[notifications] failed to send totp-disabled email",
      error
    );
  }
}

export interface LoginDeviceInfo {
  ip: string | null;
  userAgent: string | null;
  occurredAt: Date;
}

export async function notifyUserOfNewLoginDevice(
  to: string,
  device: LoginDeviceInfo
): Promise<void> {
  if (!isMailConfigured()) return;

  const when = `${device.occurredAt.toISOString().replace("T", " ").slice(0, 16)} UTC`;
  const ip = device.ip ?? "unknown";
  const ua = device.userAgent ?? "unknown";

  try {
    await sendMail({
      to,
      subject: "New login to your ScriptOverNovel Music admin account",
      text: `A login to your ScriptOverNovel Music admin account (${to}) was just detected from a device/browser we haven't seen before.\n\nWhen: ${when}\nIP: ${ip}\nDevice: ${ua}\n\nIf this was you, no action is needed. If you don't recognize this, reset your password immediately.`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
          <h2 style="margin-bottom: 8px;">New login detected</h2>
          <p>We noticed a login to your ScriptOverNovel Music admin account from a device/browser we haven't seen before.</p>
          <table style="border-collapse: collapse; width: 100%; font-size: 14px; margin: 16px 0;">
            <tr>
              <td style="padding: 6px 12px 6px 0; color: #666; white-space: nowrap;">When</td>
              <td style="padding: 6px 0; font-weight: 600;">${escapeHtml(when)}</td>
            </tr>
            <tr>
              <td style="padding: 6px 12px 6px 0; color: #666; white-space: nowrap;">IP</td>
              <td style="padding: 6px 0; font-weight: 600;">${escapeHtml(ip)}</td>
            </tr>
            <tr>
              <td style="padding: 6px 12px 6px 0; color: #666; white-space: nowrap;">Device</td>
              <td style="padding: 6px 0; font-weight: 600;">${escapeHtml(ua)}</td>
            </tr>
          </table>
          <p style="font-size: 13px; color: #666; margin-top: 24px;">If this was you, no action is needed. If you don't recognize this, reset your password immediately.</p>
        </div>
      `,
    });
  } catch (error) {
    console.error(
      "[notifications] failed to send new-login-device email",
      error
    );
  }
}
