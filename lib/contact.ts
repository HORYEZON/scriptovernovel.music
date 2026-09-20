// lib/contact.ts
//
// Single source for the contact form's subject options — used by the public
// form (app/(public)/contact/ContactClient.tsx), the API route that emails
// it (app/api/contact/route.ts), and the admin notifications "Gmail" tab's
// subject filter (app/(admin)/admin/notifications/NotificationsClient.tsx +
// its API route), so all three agree on the same keys/labels/order without
// hand-copying the list.
export interface ContactSubjectOption {
  key: string;
  label: string;
}

export const CONTACT_SUBJECTS: ContactSubjectOption[] = [
  { key: "booking", label: "Booking / Shows" },
  { key: "press", label: "Press / Media" },
  { key: "collaboration", label: "Collaboration" },
  { key: "general", label: "General" },
];

// Subjects from the site's art-gallery days — no longer offered, but
// messages filed under them still exist and should keep their labels in
// the admin's Gmail tab rather than showing a raw key.
const LEGACY_SUBJECT_LABELS: Record<string, string> = {
  purchase: "Purchase Inquiry",
  commission: "Commission Request",
  exhibition: "Exhibition / Collaboration",
  other: "Other",
};

const LABEL_BY_KEY = new Map(CONTACT_SUBJECTS.map((s) => [s.key, s.label]));

export function contactSubjectLabel(key: string): string {
  return LABEL_BY_KEY.get(key) ?? LEGACY_SUBJECT_LABELS[key] ?? key;
}

export function isContactSubjectKey(value: unknown): value is string {
  return typeof value === "string" && LABEL_BY_KEY.has(value);
}
