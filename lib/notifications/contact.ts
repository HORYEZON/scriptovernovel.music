// lib/notifications/contact.ts
//
// Admin notification when the public contact form (app/api/contact/route.ts)
// is submitted. The email itself was already being sent before this file
// existed — this only adds the in-app Notification row (type CONTACT,
// labeled "Gmail" in the admin UI since that's where the admin actually
// reads it) alongside it, same "DB write + best-effort" shape as
// lib/notifications/order.ts and highscore.ts.
import { prisma } from "@/lib/prisma";

export interface ContactMessageNotification {
  name: string;
  email: string;
  // Raw key (e.g. "purchase") — stored in metadata so the admin's Gmail-tab
  // subject filter (app/api/admin/notifications/route.ts) can query on it
  // directly instead of matching against the human label.
  subject: string;
  subjectLabel: string;
  message: string;
}

const BODY_PREVIEW_LENGTH = 200;

export async function notifyAdminOfContactMessage(
  data: ContactMessageNotification
): Promise<void> {
  const preview =
    data.message.length > BODY_PREVIEW_LENGTH
      ? `${data.message.slice(0, BODY_PREVIEW_LENGTH)}…`
      : data.message;

  try {
    await prisma.notification.create({
      data: {
        type: "CONTACT",
        title: `New message — ${data.subjectLabel}`,
        body: `${data.name} (${data.email}): ${preview}`,
        // Full, untruncated message kept here in case a detail view ever
        // needs it — the list itself only ever shows the preview above.
        metadata: {
          name: data.name,
          email: data.email,
          subject: data.subject,
          subjectLabel: data.subjectLabel,
          message: data.message,
        },
      },
    });
  } catch (error) {
    console.error(
      "[notifications] failed to record contact-message notification",
      error
    );
  }
}
