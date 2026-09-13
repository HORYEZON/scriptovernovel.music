// lib/cosplays.ts
//
// Shared constants for the Cosplays module (admin CRUD + the Digital Museum's
// Cosplay Room). Kept alongside lib/stories.ts, and deliberately much smaller:
// a cosplay has no types/genres to enumerate, so this is the upload rules and
// the wording that has to match between the admin form and the room.
//
// Client-safe (no prisma, no server-only imports) — the admin client and the
// API routes both import from here.

/** Same accept list and copy as the Stories module's cover upload, so the two
 *  admin forms state the same rule in the same words. */
export const COSPLAY_IMAGE_ACCEPT = "image/jpeg,image/png";
export const COSPLAY_IMAGE_HINT = "JPG or PNG (max 10 MB)";
export const COSPLAY_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

/**
 * What each of the two photos is for, in the admin's own words — used as the
 * upload fields' help text.
 *
 * Worth stating explicitly in the form rather than leaving to be discovered:
 * the standee shot is rendered roughly life-size standing on the floor, so a
 * full-length portrait works and a tight crop or a landscape group shot does
 * not, and there is no way to tell that from the admin list's thumbnails.
 */
export const STANDEE_PHOTO_HINT =
  "The shot printed on the standee — a full-length portrait works best, since it stands life-size on the floor.";
export const BACKDROP_PHOTO_HINT =
  "Optional. Hung on the panel behind the standee, like the About room's photos. Any crop works.";
