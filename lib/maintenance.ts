// lib/maintenance.ts
//
// Site-wide maintenance mode. Checked once per request in
// app/(public)/layout.tsx (which already fetches the Profile row for other
// reasons — this adds no extra query) and swaps in MaintenancePage instead
// of the real site for every visitor. /admin is a separate route group with
// its own layout, so it's never gated — the admin can always get back in to
// flip this off.

export const MAINTENANCE_DEFAULTS = {
  maintenanceMode: false,
  maintenanceMessage: "",
};

export const DEFAULT_MAINTENANCE_MESSAGE =
  "We're making a few improvements behind the scenes. Please check back shortly.";

const MAX_MESSAGE_LENGTH = 400;

/** Trims/caps free text before it lands in the DB or gets rendered raw. */
export function sanitizeMaintenanceMessage(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, MAX_MESSAGE_LENGTH);
}
